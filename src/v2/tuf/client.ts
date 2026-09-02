// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { DEFAULT_MAX_METADATA_BYTES } from "./admission";
import { DEFAULT_ROLE_CONFIGURATION, type RoleConfiguration } from "./builder";
import { canonicalizeTufJson } from "./canonical";
import {
	type ClientMetadata,
	type MetadataDescription,
	type RootDeclarations,
	metadataDescription,
	parseClientMetadata,
	parseDelegations,
	parseRootDeclarations,
	parseTargets,
	validateMetadataDescription,
	validateMetadataFreshnessAndSpec,
	validateTargetBytes,
	verifyClientMetadata,
} from "./client-metadata";
import type {
	AuthorizationChainEntry,
	PartialConsumedVersions,
	RenewalAdvisory,
	RoleStatus,
	TufClientFailure,
	TufClientPartialView,
	TufClientResult,
	TufClientSuccess,
} from "./client-result";
import type { TufFetchResponse, TufFetcher } from "./fetch";
import { computeTufFingerprint } from "./fingerprint";
import {
	type TufFailure,
	type TufJsonValue,
	type TufResult,
	rejection,
} from "./outcome";
import type { RoleWindow } from "./role-config";
import { authorizeTargetPath, validateDelegationChain } from "./role-graph";
import { metadataFilename } from "./serializer";
import type { TufTrustStore } from "./trust-store";

export interface TufClientInput {
	fetcher: TufFetcher;
	bootstrapRoot: Uint8Array;
	trustStore: TufTrustStore;
	now: Date;
	/** Test-only policy injection; production callers use the founder-approved defaults. */
	roleConfiguration?: RoleConfiguration;
}

interface RootState {
	metadata: ClientMetadata;
	declarations: RootDeclarations;
	satisfyingKeyids: readonly string[];
}

interface AcceptedRole {
	metadata: ClientMetadata;
	expiresAt: number;
}

interface RoleTargets {
	roleName: string;
	targets: Readonly<Record<string, MetadataDescription>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

class RunState {
	readonly authorizationChain: AuthorizationChainEntry[] = [];
	readonly metadata: Record<
		string,
		{ version: number; signed: Record<string, TufJsonValue> }
	> = {};
	readonly targets: Record<
		string,
		Record<string, { length: number; hashes: Readonly<Record<string, string>> }>
	> = {};
	readonly delegatedVersions: Record<string, number> = {};
	private readonly statuses = new Map<string, RoleStatus>();
	private readonly versions: {
		root?: number;
		timestamp?: number;
		snapshot?: number;
		targets?: number;
		delegatedTargets: Record<string, number>;
	} = { delegatedTargets: {} };

	constructor(
		readonly evaluatedAt: string,
		roleNames: readonly string[],
	) {
		for (const roleName of roleNames) {
			this.statuses.set(roleName, { roleName, state: "never-checked" });
		}
	}

	markVerified(roleName: string, version: number): void {
		this.statuses.set(roleName, { roleName, state: "verified", version });
	}

	markFailed(roleName: string, reason: TufFailure["reason"]): void {
		this.statuses.set(roleName, { roleName, state: "failed", reason });
	}

	markDelegation(roleName: string): void {
		if (!this.statuses.has(roleName)) {
			this.statuses.set(roleName, { roleName, state: "never-checked" });
		}
	}

	recordMetadata(metadata: ClientMetadata): void {
		this.metadata[metadata.roleName] = {
			version: metadata.version,
			signed: metadata.signed,
		};
		if (metadata.roleName === "root") this.versions.root = metadata.version;
		else if (metadata.roleName === "timestamp")
			this.versions.timestamp = metadata.version;
		else if (metadata.roleName === "snapshot")
			this.versions.snapshot = metadata.version;
		else if (metadata.roleName === "targets")
			this.versions.targets = metadata.version;
		else {
			this.delegatedVersions[metadata.roleName] = metadata.version;
			this.versions.delegatedTargets[metadata.roleName] = metadata.version;
		}
	}

	recordTargets(
		roleName: string,
		targets: Readonly<Record<string, MetadataDescription>>,
	): void {
		this.targets[roleName] = Object.fromEntries(
			Object.entries(targets).map(([targetPath, target]) => [
				targetPath,
				{ length: target.length, hashes: target.hashes },
			]),
		);
	}

	roleStatuses(): readonly RoleStatus[] {
		return [...this.statuses.values()];
	}

	partialVersions(): PartialConsumedVersions {
		return {
			...this.versions,
			delegatedTargets: { ...this.versions.delegatedTargets },
		};
	}

	async fingerprint(): Promise<string> {
		const fingerprint = await computeTufFingerprint({
			metadata: this.metadata,
			targets: this.targets,
			roleStatuses: this.roleStatuses(),
		});
		if (!fingerprint.ok) {
			throw new Error(
				`could not fingerprint accepted TUF view: ${fingerprint.reason}`,
			);
		}
		return fingerprint.value;
	}

	async partial(): Promise<TufClientPartialView> {
		return {
			evaluatedAt: this.evaluatedAt,
			authorizationChain: this.authorizationChain,
			versions: this.partialVersions(),
			roleStatuses: this.roleStatuses(),
			fingerprint: await this.fingerprint(),
		};
	}
}

function metadataFailure(
	roleName: string,
	result: TufFailure,
	state: RunState,
): Promise<TufClientFailure> {
	state.markFailed(roleName, result.reason);
	return state.partial().then((partial) => ({
		...result,
		partial,
		classification: { kind: "role" as const, roleName },
	}));
}

function invalidBootstrap(
	state: RunState,
	expected: string,
	observed: unknown,
): Promise<TufClientFailure> {
	return metadataFailure(
		"root",
		rejection("malformed", { path: ["bootstrapRoot"], expected, observed }),
		state,
	);
}

async function fetchRequired(
	fetcher: TufFetcher,
	relativePath: string,
	maxBytes: number,
): Promise<TufResult<Uint8Array>> {
	try {
		const response = await fetcher.fetch(relativePath, maxBytes);
		if (response.kind === "ok") return { ok: true, value: response.bytes };
		if (response.kind === "not-found") {
			return rejection("unavailable", {
				path: [relativePath],
				expected: "a required repository object",
				observed: "not-found",
			});
		}
		return rejection("retrieval-failed", {
			path: [relativePath],
			expected: "a successful bounded repository retrieval",
			observed:
				response.error instanceof Error
					? response.error.name
					: typeof response.error,
		});
	} catch (error) {
		return rejection("retrieval-failed", {
			path: [relativePath],
			expected: "a successful bounded repository retrieval",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}

function roleWindowFor(
	configuration: RoleConfiguration,
	roleName: string,
): RoleWindow | undefined {
	if (Object.hasOwn(configuration.topLevelRoles, roleName)) {
		return configuration.topLevelRoles[roleName];
	}
	return configuration.delegatedRoles.find((role) => role.name === roleName);
}

function rolloverCheck(
	roleName: string,
	version: number,
	stored: Awaited<ReturnType<TufTrustStore["read"]>> extends TufResult<
		infer Value
	>
		? Value
		: never,
): TufResult<undefined> {
	const state = stored?.state;
	if (state === undefined) return { ok: true, value: undefined };
	const previous =
		roleName === "root"
			? state.versions.root
			: roleName === "timestamp"
				? state.versions.timestamp
				: roleName === "snapshot"
					? state.versions.snapshot
					: roleName === "targets"
						? state.versions.targets
						: state.versions.delegatedTargets[roleName];
	if (previous !== undefined && version < previous) {
		return rejection("version-rollback", {
			path: ["versions", roleName],
			expected: previous,
			observed: version,
		});
	}
	return { ok: true, value: undefined };
}

async function rootFromMetadata(
	metadata: ClientMetadata,
	filenameVersion: number | undefined,
): Promise<TufResult<RootState>> {
	const declarations = parseRootDeclarations(metadata.signed);
	if (!declarations.ok) return declarations;
	const verified = await verifyClientMetadata(
		metadata,
		"root",
		declarations.value.roles.root,
		declarations.value.keys,
		filenameVersion,
		true,
	);
	if (!verified.ok) return verified;
	return {
		ok: true,
		value: {
			metadata,
			declarations: declarations.value,
			satisfyingKeyids: verified.value.satisfyingKeyids,
		},
	};
}

async function rootFromStore(
	store: NonNullable<
		Awaited<ReturnType<TufTrustStore["read"]>> extends TufResult<infer Value>
			? Value
			: never
	>,
): Promise<TufResult<RootState>> {
	const envelope = store.state.trustedRoot.envelope;
	const bytes = canonicalizeEnvelope(envelope.signed, envelope.signatures);
	if (!bytes.ok) return bytes;
	const parsed = parseClientMetadata(
		"root",
		`${store.state.trustedRoot.version}.root.json`,
		bytes.value,
	);
	if (!parsed.ok) return parsed;
	return rootFromMetadata(parsed.value, store.state.trustedRoot.version);
}

function canonicalizeEnvelope(
	signed: Record<string, TufJsonValue>,
	signatures: readonly { keyid: string; sig: string }[],
): TufResult<Uint8Array> {
	return canonicalizeTufJson({ signed, signatures: [...signatures] });
}

function failureFromStore(
	state: RunState,
	result: TufFailure,
): Promise<TufClientFailure> {
	return state.partial().then((partial) => ({
		...result,
		partial,
		classification: { kind: "trust-store" as const },
	}));
}

function addAuthorization(
	state: RunState,
	metadata: ClientMetadata,
	delegationPath: readonly string[],
	authorizingRole: string,
	authorizingVersion: number,
	satisfyingKeyids: readonly string[],
): void {
	state.authorizationChain.push({
		subjectRole: metadata.roleName,
		subjectVersion: metadata.version,
		delegationPath,
		authorizingRole,
		authorizingVersion,
		satisfyingKeyids,
	});
}

function directDelegationDropped(
	snapshot: ClientMetadata,
	roleName: string,
): TufFailure | undefined {
	const meta = snapshot.signed.meta;
	if (!isRecord(meta)) return undefined;
	if (`${roleName}.json` in meta) return undefined;
	return rejection("snapshot-role-dropped", {
		path: ["signed", "meta", `${roleName}.json`],
		expected: "a snapshot descriptor for every declared delegated role",
		observed: "missing",
	});
}

function persistableRoot(root: RootState) {
	return {
		version: root.metadata.version,
		envelope: {
			signed: root.metadata.signed,
			signatures: root.metadata.signatures.map((signature) => ({
				...signature,
			})),
		},
	};
}

/** Updates one TUF repository using a pinned bootstrap root and caller-provided bounded fetcher. */
export async function updateTufRepository(
	input: TufClientInput,
): Promise<TufClientResult> {
	const configuration: RoleConfiguration =
		input.roleConfiguration ?? DEFAULT_ROLE_CONFIGURATION;
	const nowMillis = input.now.getTime();
	const now = new Date(nowMillis);
	const evaluatedAt = Number.isFinite(nowMillis)
		? now.toISOString()
		: "invalid-date";
	const state = new RunState(evaluatedAt, [
		"root",
		"timestamp",
		"snapshot",
		"targets",
		...configuration.delegatedRoles.map((role) => role.name),
	]);

	const loaded = await input.trustStore.read();
	if (!loaded.ok) return failureFromStore(state, loaded);
	let root: RootState;
	if (loaded.value === undefined) {
		const bootstrap = parseClientMetadata(
			"root",
			"bootstrap.root.json",
			input.bootstrapRoot,
		);
		if (!bootstrap.ok) return metadataFailure("root", bootstrap, state);
		const parsedRoot = await rootFromMetadata(bootstrap.value, undefined);
		if (!parsedRoot.ok) return metadataFailure("root", parsedRoot, state);
		root = parsedRoot.value;
	} else {
		const stored = await rootFromStore(loaded.value);
		if (!stored.ok) {
			return failureFromStore(
				state,
				rejection("trust-store-corrupt", {
					path: ["trustedRoot"],
					expected: "a self-verifying persisted root envelope",
					observed: stored.reason,
				}),
			);
		}
		root = stored.value;
	}
	state.markVerified("root", root.metadata.version);
	state.recordMetadata(root.metadata);
	addAuthorization(
		state,
		root.metadata,
		["root"],
		"root",
		root.metadata.version,
		root.satisfyingKeyids,
	);

	while (true) {
		const nextVersion = root.metadata.version + 1;
		const nextFilename = metadataFilename("root", nextVersion, true);
		if (!nextFilename.ok) return metadataFailure("root", nextFilename, state);
		let response: TufFetchResponse;
		try {
			response = await input.fetcher.fetch(
				nextFilename.value,
				DEFAULT_MAX_METADATA_BYTES,
			);
		} catch (error) {
			return metadataFailure(
				"root",
				rejection("retrieval-failed", {
					path: [nextFilename.value],
					expected: "a successful bounded root retrieval",
					observed: error instanceof Error ? error.name : typeof error,
				}),
				state,
			);
		}
		// Only root look-ahead treats N+1 not-found as termination; all other not-found results are unavailable.
		if (response.kind === "not-found") break;
		if (response.kind === "error") {
			return metadataFailure(
				"root",
				rejection("retrieval-failed", {
					path: [nextFilename.value],
					expected: "a successful bounded root retrieval",
					observed:
						response.error instanceof Error
							? response.error.name
							: typeof response.error,
				}),
				state,
			);
		}
		const candidate = parseClientMetadata(
			"root",
			nextFilename.value,
			response.bytes,
		);
		if (!candidate.ok) return metadataFailure("root", candidate, state);
		const oldVerified = await verifyClientMetadata(
			candidate.value,
			"root",
			root.declarations.roles.root,
			root.declarations.keys,
			nextVersion,
			true,
		);
		if (!oldVerified.ok) return metadataFailure("root", oldVerified, state);
		const declarations = parseRootDeclarations(candidate.value.signed);
		if (!declarations.ok) return metadataFailure("root", declarations, state);
		const selfVerified = await verifyClientMetadata(
			candidate.value,
			"root",
			declarations.value.roles.root,
			declarations.value.keys,
			nextVersion,
			true,
		);
		if (!selfVerified.ok) return metadataFailure("root", selfVerified, state);
		addAuthorization(
			state,
			candidate.value,
			["root"],
			"root",
			root.metadata.version,
			oldVerified.value.satisfyingKeyids,
		);
		addAuthorization(
			state,
			candidate.value,
			["root"],
			"root",
			candidate.value.version,
			selfVerified.value.satisfyingKeyids,
		);
		root = {
			metadata: candidate.value,
			declarations: declarations.value,
			satisfyingKeyids: selfVerified.value.satisfyingKeyids,
		};
		state.markVerified("root", root.metadata.version);
		state.recordMetadata(root.metadata);
	}

	const rootFresh = validateMetadataFreshnessAndSpec(root.metadata.signed, now);
	if (!rootFresh.ok) return metadataFailure("root", rootFresh, state);
	const rootRollback = rolloverCheck(
		"root",
		root.metadata.version,
		loaded.value,
	);
	if (!rootRollback.ok) return metadataFailure("root", rootRollback, state);

	const timestampBytes = await fetchRequired(
		input.fetcher,
		"timestamp.json",
		DEFAULT_MAX_METADATA_BYTES,
	);
	if (!timestampBytes.ok)
		return metadataFailure("timestamp", timestampBytes, state);
	const timestamp = parseClientMetadata(
		"timestamp",
		"timestamp.json",
		timestampBytes.value,
	);
	if (!timestamp.ok) return metadataFailure("timestamp", timestamp, state);
	const timestampVerified = await verifyClientMetadata(
		timestamp.value,
		"timestamp",
		root.declarations.roles.timestamp,
		root.declarations.keys,
		undefined,
	);
	if (!timestampVerified.ok)
		return metadataFailure("timestamp", timestampVerified, state);
	const timestampFresh = validateMetadataFreshnessAndSpec(
		timestamp.value.signed,
		now,
	);
	if (!timestampFresh.ok)
		return metadataFailure("timestamp", timestampFresh, state);
	const timestampRollback = rolloverCheck(
		"timestamp",
		timestamp.value.version,
		loaded.value,
	);
	if (!timestampRollback.ok)
		return metadataFailure("timestamp", timestampRollback, state);
	state.markVerified("timestamp", timestamp.value.version);
	state.recordMetadata(timestamp.value);
	addAuthorization(
		state,
		timestamp.value,
		["root", "timestamp"],
		"timestamp",
		root.metadata.version,
		timestampVerified.value.satisfyingKeyids,
	);

	const snapshotDescriptor = metadataDescription(
		timestamp.value.signed,
		"snapshot.json",
	);
	if (!snapshotDescriptor.ok)
		return metadataFailure("timestamp", snapshotDescriptor, state);
	const snapshotFilename = metadataFilename(
		"snapshot",
		snapshotDescriptor.value.version,
		root.declarations.consistentSnapshot,
	);
	if (!snapshotFilename.ok)
		return metadataFailure("snapshot", snapshotFilename, state);
	const snapshotBytes = await fetchRequired(
		input.fetcher,
		snapshotFilename.value,
		DEFAULT_MAX_METADATA_BYTES,
	);
	if (!snapshotBytes.ok)
		return metadataFailure("snapshot", snapshotBytes, state);
	const snapshot = parseClientMetadata(
		"snapshot",
		snapshotFilename.value,
		snapshotBytes.value,
	);
	if (!snapshot.ok) return metadataFailure("snapshot", snapshot, state);
	const snapshotVerified = await verifyClientMetadata(
		snapshot.value,
		"snapshot",
		root.declarations.roles.snapshot,
		root.declarations.keys,
		root.declarations.consistentSnapshot
			? snapshotDescriptor.value.version
			: undefined,
	);
	if (!snapshotVerified.ok)
		return metadataFailure("snapshot", snapshotVerified, state);
	const snapshotFresh = validateMetadataFreshnessAndSpec(
		snapshot.value.signed,
		now,
	);
	if (!snapshotFresh.ok)
		return metadataFailure("snapshot", snapshotFresh, state);
	const snapshotRollback = rolloverCheck(
		"snapshot",
		snapshot.value.version,
		loaded.value,
	);
	if (!snapshotRollback.ok)
		return metadataFailure("snapshot", snapshotRollback, state);
	const snapshotMatched = await validateMetadataDescription(
		snapshotDescriptor.value,
		snapshot.value,
	);
	if (!snapshotMatched.ok)
		return metadataFailure("snapshot", snapshotMatched, state);
	state.markVerified("snapshot", snapshot.value.version);
	state.recordMetadata(snapshot.value);
	addAuthorization(
		state,
		snapshot.value,
		["root", "snapshot"],
		"snapshot",
		root.metadata.version,
		snapshotVerified.value.satisfyingKeyids,
	);

	const targetsDescriptor = metadataDescription(
		snapshot.value.signed,
		"targets.json",
	);
	if (!targetsDescriptor.ok)
		return metadataFailure("snapshot", targetsDescriptor, state);
	const targetsFilename = metadataFilename(
		"targets",
		targetsDescriptor.value.version,
		root.declarations.consistentSnapshot,
	);
	if (!targetsFilename.ok)
		return metadataFailure("targets", targetsFilename, state);
	const targetsBytes = await fetchRequired(
		input.fetcher,
		targetsFilename.value,
		DEFAULT_MAX_METADATA_BYTES,
	);
	if (!targetsBytes.ok) return metadataFailure("targets", targetsBytes, state);
	const targets = parseClientMetadata(
		"targets",
		targetsFilename.value,
		targetsBytes.value,
	);
	if (!targets.ok) return metadataFailure("targets", targets, state);
	const targetsVerified = await verifyClientMetadata(
		targets.value,
		"targets",
		root.declarations.roles.targets,
		root.declarations.keys,
		root.declarations.consistentSnapshot
			? targetsDescriptor.value.version
			: undefined,
	);
	if (!targetsVerified.ok)
		return metadataFailure("targets", targetsVerified, state);
	const targetsFresh = validateMetadataFreshnessAndSpec(
		targets.value.signed,
		now,
	);
	if (!targetsFresh.ok) return metadataFailure("targets", targetsFresh, state);
	const targetsRollback = rolloverCheck(
		"targets",
		targets.value.version,
		loaded.value,
	);
	if (!targetsRollback.ok)
		return metadataFailure("targets", targetsRollback, state);
	const targetsMatched = await validateMetadataDescription(
		targetsDescriptor.value,
		targets.value,
	);
	if (!targetsMatched.ok)
		return metadataFailure("targets", targetsMatched, state);
	const delegations = parseDelegations(targets.value.signed.delegations);
	if (!delegations.ok) return metadataFailure("targets", delegations, state);
	const topTargets = parseTargets(targets.value.signed);
	if (!topTargets.ok) return metadataFailure("targets", topTargets, state);
	for (const targetPath of Object.keys(topTargets.value)) {
		const authorized = authorizeTargetPath(
			"targets",
			targetPath,
			delegations.value.roles,
		);
		if (!authorized.ok) return metadataFailure("targets", authorized, state);
	}
	state.markVerified("targets", targets.value.version);
	state.recordMetadata(targets.value);
	state.recordTargets("targets", topTargets.value);
	addAuthorization(
		state,
		targets.value,
		["root", "targets"],
		"targets",
		root.metadata.version,
		targetsVerified.value.satisfyingKeyids,
	);

	const allRoleTargets: RoleTargets[] = [
		{ roleName: "targets", targets: topTargets.value },
	];
	const acceptedDelegated: AcceptedRole[] = [];
	for (const [index, role] of delegations.value.roles.entries()) {
		state.markDelegation(role.name);
		const chain = validateDelegationChain(["targets", role.name]);
		if (!chain.ok) return metadataFailure(role.name, chain, state);
		const dropped = directDelegationDropped(snapshot.value, role.name);
		if (dropped !== undefined)
			return metadataFailure(role.name, dropped, state);
		const descriptor = metadataDescription(
			snapshot.value.signed,
			`${role.name}.json`,
		);
		if (!descriptor.ok) return metadataFailure(role.name, descriptor, state);
		const filename = metadataFilename(
			role.name,
			descriptor.value.version,
			root.declarations.consistentSnapshot,
		);
		if (!filename.ok) return metadataFailure(role.name, filename, state);
		const bytes = await fetchRequired(
			input.fetcher,
			filename.value,
			DEFAULT_MAX_METADATA_BYTES,
		);
		if (!bytes.ok) return metadataFailure(role.name, bytes, state);
		const delegated = parseClientMetadata(
			role.name,
			filename.value,
			bytes.value,
		);
		if (!delegated.ok) return metadataFailure(role.name, delegated, state);
		if (delegated.value.signed.delegations !== undefined) {
			return metadataFailure(
				role.name,
				rejection("malformed", {
					path: ["signed", "delegations"],
					expected:
						"a Wave 2 delegated targets role without nested delegations",
					observed: "nested delegations",
				}),
				state,
			);
		}
		const verificationRole = delegations.value.verificationRoles[index];
		if (verificationRole === undefined) {
			return metadataFailure(
				role.name,
				rejection("malformed", {
					path: ["signed", "delegations", "roles", String(index)],
					expected: "a matching delegated verification role",
					observed: "missing",
				}),
				state,
			);
		}
		const verified = await verifyClientMetadata(
			delegated.value,
			"targets",
			verificationRole,
			delegations.value.keys,
			root.declarations.consistentSnapshot
				? descriptor.value.version
				: undefined,
		);
		if (!verified.ok) return metadataFailure(role.name, verified, state);
		const fresh = validateMetadataFreshnessAndSpec(delegated.value.signed, now);
		if (!fresh.ok) return metadataFailure(role.name, fresh, state);
		const rollback = rolloverCheck(
			role.name,
			delegated.value.version,
			loaded.value,
		);
		if (!rollback.ok) return metadataFailure(role.name, rollback, state);
		const matched = await validateMetadataDescription(
			descriptor.value,
			delegated.value,
		);
		if (!matched.ok) return metadataFailure(role.name, matched, state);
		const roleTargets = parseTargets(delegated.value.signed);
		if (!roleTargets.ok) return metadataFailure(role.name, roleTargets, state);
		for (const targetPath of Object.keys(roleTargets.value)) {
			const authorized = authorizeTargetPath(
				role.name,
				targetPath,
				delegations.value.roles,
			);
			if (!authorized.ok) return metadataFailure(role.name, authorized, state);
		}
		state.markVerified(role.name, delegated.value.version);
		state.recordMetadata(delegated.value);
		state.recordTargets(role.name, roleTargets.value);
		acceptedDelegated.push({
			metadata: delegated.value,
			expiresAt: fresh.value,
		});
		addAuthorization(
			state,
			delegated.value,
			["root", "targets", role.name],
			"targets",
			targets.value.version,
			verified.value.satisfyingKeyids,
		);
		allRoleTargets.push({ roleName: role.name, targets: roleTargets.value });
	}

	for (const roleTargets of allRoleTargets) {
		for (const [targetPath, descriptor] of Object.entries(
			roleTargets.targets,
		)) {
			const bytes = await fetchRequired(
				input.fetcher,
				targetPath,
				descriptor.length,
			);
			if (!bytes.ok) return metadataFailure(roleTargets.roleName, bytes, state);
			const valid = await validateTargetBytes(descriptor, bytes.value);
			if (!valid.ok) return metadataFailure(roleTargets.roleName, valid, state);
		}
	}

	const acceptedRoles: AcceptedRole[] = [
		{ metadata: root.metadata, expiresAt: rootFresh.value },
		{ metadata: timestamp.value, expiresAt: timestampFresh.value },
		{ metadata: snapshot.value, expiresAt: snapshotFresh.value },
		{ metadata: targets.value, expiresAt: targetsFresh.value },
		...acceptedDelegated,
	];
	const advisories: RenewalAdvisory[] = [];
	for (const role of acceptedRoles) {
		const window = roleWindowFor(configuration, role.metadata.roleName);
		if (window === undefined) continue;
		const due =
			role.expiresAt -
			window.validityDays * 86_400_000 +
			window.renewalDays * 86_400_000;
		if (nowMillis > due) {
			advisories.push({
				roleName: role.metadata.roleName,
				overdueByMilliseconds: nowMillis - due,
			});
		}
	}

	const existingDelegated = loaded.value?.state.versions.delegatedTargets ?? {};
	const nextDelegated = { ...existingDelegated, ...state.delegatedVersions };
	const partialVersions = state.partialVersions();
	if (
		partialVersions.root === undefined ||
		partialVersions.timestamp === undefined ||
		partialVersions.snapshot === undefined ||
		partialVersions.targets === undefined
	) {
		return invalidBootstrap(
			state,
			"all top-level metadata versions",
			partialVersions,
		);
	}
	const persisted = {
		schemaVersion: 1 as const,
		trustedRoot: persistableRoot(root),
		versions: {
			root: partialVersions.root,
			timestamp: partialVersions.timestamp,
			snapshot: partialVersions.snapshot,
			targets: partialVersions.targets,
			delegatedTargets: nextDelegated,
		},
	};
	const stored = await input.trustStore.replace(
		loaded.value?.revision,
		persisted,
	);
	if (!stored.ok) return failureFromStore(state, stored);

	const fingerprint = await state.fingerprint();
	const success: TufClientSuccess = {
		evaluatedAt,
		advisories,
		authorizationChain: state.authorizationChain,
		versions: {
			root: partialVersions.root,
			timestamp: partialVersions.timestamp,
			snapshot: partialVersions.snapshot,
			targets: partialVersions.targets,
			delegatedTargets: { ...state.delegatedVersions },
		},
		roleStatuses: state.roleStatuses(),
		fingerprint,
	};
	return { ok: true, value: success };
}
