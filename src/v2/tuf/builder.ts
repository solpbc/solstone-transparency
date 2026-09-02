// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { canonicalizeTufJson } from "./canonical";
import { type Ed25519SigningKey, signEd25519 } from "./ed25519";
import { type TufResult, rejection } from "./outcome";
import {
	DELEGATED_ROLES,
	type DelegatedRoleConfig,
	type RoleWindow,
	TOP_LEVEL_ROLES,
} from "./role-config";
import {
	type TufDelegationRole,
	type TufRole,
	authorizeTargetPath,
	resolveDelegation,
	validateDelegationConfiguration,
	validateRoleConfiguration,
} from "./role-graph";
import { metadataLogicalName } from "./serializer";

export interface RoleConfiguration {
	topLevelRoles: Readonly<Record<string, RoleWindow>>;
	delegatedRoles: readonly DelegatedRoleConfig[];
}

export const DEFAULT_ROLE_CONFIGURATION: RoleConfiguration = {
	topLevelRoles: TOP_LEVEL_ROLES,
	delegatedRoles: DELEGATED_ROLES,
};

export interface RepositorySigningKeys {
	root: readonly Ed25519SigningKey[];
	targets: readonly Ed25519SigningKey[];
	snapshot: readonly Ed25519SigningKey[];
	timestamp: readonly Ed25519SigningKey[];
	delegated: Readonly<Record<string, readonly Ed25519SigningKey[]>>;
}

export interface TufTargetDescription {
	length: number;
	hashes: Readonly<Record<string, string>>;
	custom?: unknown;
}

export interface RepositoryVersions {
	root?: number;
	targets?: number;
	snapshot?: number;
	timestamp?: number;
	delegated?: Readonly<Record<string, number>>;
}

export interface BuildRepositoryInput {
	signingKeys: RepositorySigningKeys;
	targets: Readonly<Record<string, TufTargetDescription>>;
	consistentSnapshot: boolean;
	now: Date;
	roleConfiguration?: RoleConfiguration;
	versions?: RepositoryVersions;
}

export interface TufEnvelope {
	signed: Record<string, unknown>;
	signatures: readonly { keyid: string; sig: string }[];
}

export interface BuiltMetadata {
	roleName: string;
	version: number;
	envelope: TufEnvelope;
	bytes: Uint8Array;
}

export interface BuiltRepository {
	consistentSnapshot: boolean;
	root: BuiltMetadata;
	targets: BuiltMetadata;
	delegatedTargets: readonly BuiltMetadata[];
	snapshot: BuiltMetadata;
	timestamp: BuiltMetadata;
	targetsByPath: Readonly<Record<string, TufTargetDescription>>;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function validVersion(version: number): boolean {
	return Number.isSafeInteger(version) && version > 0;
}

function versionFor(
	versions: RepositoryVersions | undefined,
	roleName: string,
): TufResult<number> {
	const version =
		roleName === "root"
			? (versions?.root ?? 1)
			: roleName === "targets"
				? (versions?.targets ?? 1)
				: roleName === "snapshot"
					? (versions?.snapshot ?? 1)
					: roleName === "timestamp"
						? (versions?.timestamp ?? 1)
						: (versions?.delegated?.[roleName] ?? 1);
	if (!validVersion(version)) {
		return rejection("malformed", {
			path: ["versions", roleName],
			expected: "a positive safe integer version",
			observed: version,
		});
	}
	return { ok: true, value: version };
}

function roleWindow(
	configuration: RoleConfiguration,
	roleName: "root" | "targets" | "snapshot" | "timestamp",
): TufResult<RoleWindow> {
	const role = configuration.topLevelRoles[roleName];
	if (role === undefined) {
		return rejection("degenerate-role-configuration", {
			path: ["topLevelRoles", roleName],
			expected: `a ${roleName} role configuration`,
			observed: "missing",
		});
	}
	return { ok: true, value: role };
}

function roleFromKeys(
	window: RoleWindow,
	keys: readonly Ed25519SigningKey[],
): TufRole {
	return { keyids: keys.map((key) => key.keyId), threshold: window.threshold };
}

function validateSigningKeyCount(
	roleName: string,
	window: RoleWindow,
	keys: readonly Ed25519SigningKey[],
): TufResult<undefined> {
	if (keys.length !== window.keyCount) {
		return rejection("degenerate-role-configuration", {
			path: ["signingKeys", roleName],
			expected: window.keyCount,
			observed: keys.length,
		});
	}
	return { ok: true, value: undefined };
}

function keyMap(
	keys: readonly Ed25519SigningKey[],
): TufResult<Record<string, unknown>> {
	const result: Record<string, unknown> = {};
	for (const key of keys) {
		if (key.keyId in result) {
			return rejection("degenerate-role-configuration", {
				path: ["keys"],
				expected: "distinct generated key IDs",
				observed: key.keyId,
			});
		}
		result[key.keyId] = key.keyObject;
	}
	return { ok: true, value: result };
}

function mergeKeyMaps(
	maps: readonly Readonly<Record<string, unknown>>[],
): TufResult<Record<string, unknown>> {
	const merged: Record<string, unknown> = {};
	for (const map of maps) {
		for (const [keyid, key] of Object.entries(map)) {
			if (keyid in merged) {
				return rejection("degenerate-role-configuration", {
					path: ["keys"],
					expected: "a unique key ID across a keys map",
					observed: keyid,
				});
			}
			merged[keyid] = key;
		}
	}
	return { ok: true, value: merged };
}

function expiresAt(now: Date, validityDays: number): TufResult<string> {
	if (!Number.isFinite(now.getTime())) {
		return rejection("malformed", {
			path: ["now"],
			expected: "a valid injected Date",
			observed: "invalid Date",
		});
	}
	const expires = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
	return { ok: true, value: expires.toISOString().replace(/\.\d{3}Z$/, "Z") };
}

function expiryMillis(now: Date, validityDays: number): number {
	return now.getTime() + validityDays * 24 * 60 * 60 * 1000;
}

function hexSignature(bytes: Uint8Array): string {
	return bytesToHex(bytes);
}

async function signMetadata(
	roleName: string,
	version: number,
	signed: Record<string, unknown>,
	keys: readonly Ed25519SigningKey[],
): Promise<TufResult<BuiltMetadata>> {
	const canonicalSigned = canonicalizeTufJson(signed);
	if (!canonicalSigned.ok) return canonicalSigned;
	const signatures: { keyid: string; sig: string }[] = [];
	for (const key of keys) {
		const signature = await signEd25519(key.privateKey, canonicalSigned.value);
		if (!signature.ok) return signature;
		signatures.push({ keyid: key.keyId, sig: hexSignature(signature.value) });
	}
	signatures.sort((left, right) => left.keyid.localeCompare(right.keyid));
	const envelope: TufEnvelope = { signed, signatures };
	const bytes = canonicalizeTufJson(envelope);
	if (!bytes.ok) return bytes;
	return {
		ok: true,
		value: { roleName, version, envelope, bytes: bytes.value },
	};
}

async function metaDescription(
	metadata: BuiltMetadata,
): Promise<TufResult<Record<string, unknown>>> {
	try {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new Uint8Array(metadata.bytes),
		);
		return {
			ok: true,
			value: {
				version: metadata.version,
				length: metadata.bytes.byteLength,
				hashes: { sha256: bytesToHex(new Uint8Array(digest)) },
			},
		};
	} catch (error) {
		return rejection("malformed", {
			path: ["meta"],
			expected: "metadata bytes accepted by SHA-256",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}

function targetObject(target: TufTargetDescription): Record<string, unknown> {
	const result: Record<string, unknown> = {
		length: target.length,
		hashes: { ...target.hashes },
	};
	if (target.custom !== undefined) result.custom = target.custom;
	return result;
}

function assertExpiryOrdering(
	now: Date,
	top: Readonly<Record<string, RoleWindow>>,
	delegated: readonly DelegatedRoleConfig[],
): TufResult<undefined> {
	const timestamp = top.timestamp;
	const snapshot = top.snapshot;
	const targets = top.targets;
	const root = top.root;
	if (
		timestamp === undefined ||
		snapshot === undefined ||
		targets === undefined ||
		root === undefined
	) {
		return rejection("degenerate-role-configuration", {
			path: ["topLevelRoles"],
			expected: "root, targets, snapshot, and timestamp role windows",
			observed: Object.keys(top),
		});
	}
	const delegatedExpiry = delegated.map((role) =>
		expiryMillis(now, role.validityDays),
	);
	const ordered =
		expiryMillis(now, timestamp.validityDays) <
			expiryMillis(now, snapshot.validityDays) &&
		delegatedExpiry.every(
			(expiry) => expiryMillis(now, snapshot.validityDays) < expiry,
		) &&
		delegatedExpiry.every(
			(expiry) => expiry < expiryMillis(now, targets.validityDays),
		) &&
		expiryMillis(now, targets.validityDays) <
			expiryMillis(now, root.validityDays);
	if (!ordered) {
		return rejection("degenerate-role-configuration", {
			path: ["validityDays"],
			expected:
				"timestamp < snapshot < delegated < targets < root expiry ordering",
			observed: {
				timestamp: timestamp.validityDays,
				snapshot: snapshot.validityDays,
				delegated: delegated.map((role) => role.validityDays),
				targets: targets.validityDays,
				root: root.validityDays,
			},
		});
	}
	return { ok: true, value: undefined };
}

/** Builds one synthetic, fully signed TUF repository from caller-supplied material. */
export async function buildRepository(
	input: BuildRepositoryInput,
): Promise<TufResult<BuiltRepository>> {
	const configuration = input.roleConfiguration ?? DEFAULT_ROLE_CONFIGURATION;
	const rootWindow = roleWindow(configuration, "root");
	if (!rootWindow.ok) return rootWindow;
	const targetsWindow = roleWindow(configuration, "targets");
	if (!targetsWindow.ok) return targetsWindow;
	const snapshotWindow = roleWindow(configuration, "snapshot");
	if (!snapshotWindow.ok) return snapshotWindow;
	const timestampWindow = roleWindow(configuration, "timestamp");
	if (!timestampWindow.ok) return timestampWindow;
	for (const [roleName, window, keys] of [
		["root", rootWindow.value, input.signingKeys.root],
		["targets", targetsWindow.value, input.signingKeys.targets],
		["snapshot", snapshotWindow.value, input.signingKeys.snapshot],
		["timestamp", timestampWindow.value, input.signingKeys.timestamp],
	] as const) {
		const count = validateSigningKeyCount(roleName, window, keys);
		if (!count.ok) return count;
	}
	const ordering = assertExpiryOrdering(
		input.now,
		configuration.topLevelRoles,
		configuration.delegatedRoles,
	);
	if (!ordering.ok) return ordering;

	const rootKeyMap = keyMap(input.signingKeys.root);
	if (!rootKeyMap.ok) return rootKeyMap;
	const targetsKeyMap = keyMap(input.signingKeys.targets);
	if (!targetsKeyMap.ok) return targetsKeyMap;
	const snapshotKeyMap = keyMap(input.signingKeys.snapshot);
	if (!snapshotKeyMap.ok) return snapshotKeyMap;
	const timestampKeyMap = keyMap(input.signingKeys.timestamp);
	if (!timestampKeyMap.ok) return timestampKeyMap;
	const rootKeys = mergeKeyMaps([
		rootKeyMap.value,
		targetsKeyMap.value,
		snapshotKeyMap.value,
		timestampKeyMap.value,
	]);
	if (!rootKeys.ok) return rootKeys;

	const rootRole = roleFromKeys(rootWindow.value, input.signingKeys.root);
	const targetsRole = roleFromKeys(
		targetsWindow.value,
		input.signingKeys.targets,
	);
	const snapshotRole = roleFromKeys(
		snapshotWindow.value,
		input.signingKeys.snapshot,
	);
	const timestampRole = roleFromKeys(
		timestampWindow.value,
		input.signingKeys.timestamp,
	);
	for (const role of [rootRole, targetsRole, snapshotRole, timestampRole]) {
		const valid = validateRoleConfiguration(role, rootKeys.value);
		if (!valid.ok) return valid;
	}

	const delegatedKeyMaps: Record<string, Record<string, unknown>> = {};
	const delegatedRoles: TufDelegationRole[] = [];
	for (const configurationRole of configuration.delegatedRoles) {
		const signingKeys = input.signingKeys.delegated[configurationRole.name];
		if (signingKeys === undefined) {
			return rejection("degenerate-role-configuration", {
				path: ["signingKeys", "delegated", configurationRole.name],
				expected: "signing keys for every configured delegated role",
				observed: "missing",
			});
		}
		const count = validateSigningKeyCount(
			configurationRole.name,
			configurationRole,
			signingKeys,
		);
		if (!count.ok) return count;
		const keys = keyMap(signingKeys);
		if (!keys.ok) return keys;
		delegatedKeyMaps[configurationRole.name] = keys.value;
		delegatedRoles.push({
			name: configurationRole.name,
			keyids: signingKeys.map((key) => key.keyId),
			threshold: configurationRole.threshold,
			paths: [`${configurationRole.pathPrefix}*`],
			terminating: configurationRole.terminating,
		});
	}
	const delegatedKeys = mergeKeyMaps(Object.values(delegatedKeyMaps));
	if (!delegatedKeys.ok) return delegatedKeys;
	const delegatedConfigured = validateDelegationConfiguration(
		delegatedRoles,
		delegatedKeys.value,
	);
	if (!delegatedConfigured.ok) return delegatedConfigured;

	const targetBuckets: Record<
		string,
		Record<string, Record<string, unknown>>
	> = {
		targets: {},
	};
	for (const role of configuration.delegatedRoles)
		targetBuckets[role.name] = {};
	for (const [targetPath, target] of Object.entries(input.targets)) {
		const resolution = resolveDelegation(
			targetPath,
			configuration.delegatedRoles,
		);
		if (!resolution.ok) return resolution;
		let roleName: string;
		if (resolution.value.kind === "not-consulted") {
			if (resolution.value.authority === "none") {
				return rejection("role-not-authorized", {
					path: ["targets", targetPath],
					expected: "a target path claimable by one configured role",
					observed: targetPath,
				});
			}
			roleName = "targets";
		} else {
			roleName = resolution.value.role.name;
		}
		const authorized = authorizeTargetPath(
			roleName,
			targetPath,
			configuration.delegatedRoles,
		);
		if (!authorized.ok) return authorized;
		const bucket = targetBuckets[roleName];
		if (bucket === undefined) {
			return rejection("role-not-authorized", {
				path: ["targets", targetPath],
				expected: "a configured target-role bucket",
				observed: roleName,
			});
		}
		bucket[targetPath] = targetObject(target);
	}

	const rootVersion = versionFor(input.versions, "root");
	if (!rootVersion.ok) return rootVersion;
	const targetsVersion = versionFor(input.versions, "targets");
	if (!targetsVersion.ok) return targetsVersion;
	const snapshotVersion = versionFor(input.versions, "snapshot");
	if (!snapshotVersion.ok) return snapshotVersion;
	const timestampVersion = versionFor(input.versions, "timestamp");
	if (!timestampVersion.ok) return timestampVersion;
	const rootExpires = expiresAt(input.now, rootWindow.value.validityDays);
	if (!rootExpires.ok) return rootExpires;
	const targetsExpires = expiresAt(input.now, targetsWindow.value.validityDays);
	if (!targetsExpires.ok) return targetsExpires;
	const snapshotExpires = expiresAt(
		input.now,
		snapshotWindow.value.validityDays,
	);
	if (!snapshotExpires.ok) return snapshotExpires;
	const timestampExpires = expiresAt(
		input.now,
		timestampWindow.value.validityDays,
	);
	if (!timestampExpires.ok) return timestampExpires;

	const root = await signMetadata(
		"root",
		rootVersion.value,
		{
			_type: "root",
			spec_version: "1.0.31",
			version: rootVersion.value,
			expires: rootExpires.value,
			consistent_snapshot: input.consistentSnapshot,
			keys: rootKeys.value,
			roles: {
				root: rootRole,
				targets: targetsRole,
				snapshot: snapshotRole,
				timestamp: timestampRole,
			},
		},
		input.signingKeys.root,
	);
	if (!root.ok) return root;

	const delegatedBuilt: BuiltMetadata[] = [];
	for (const configurationRole of configuration.delegatedRoles) {
		const version = versionFor(input.versions, configurationRole.name);
		if (!version.ok) return version;
		const expires = expiresAt(input.now, configurationRole.validityDays);
		if (!expires.ok) return expires;
		const keys = input.signingKeys.delegated[configurationRole.name];
		if (keys === undefined) {
			return rejection("degenerate-role-configuration", {
				path: ["signingKeys", "delegated", configurationRole.name],
				expected: "signing keys for the delegated role",
				observed: "missing",
			});
		}
		const built = await signMetadata(
			configurationRole.name,
			version.value,
			{
				_type: "targets",
				spec_version: "1.0.31",
				version: version.value,
				expires: expires.value,
				targets: targetBuckets[configurationRole.name] ?? {},
			},
			keys,
		);
		if (!built.ok) return built;
		delegatedBuilt.push(built.value);
	}

	const targets = await signMetadata(
		"targets",
		targetsVersion.value,
		{
			_type: "targets",
			spec_version: "1.0.31",
			version: targetsVersion.value,
			expires: targetsExpires.value,
			targets: targetBuckets.targets,
			delegations: {
				keys: delegatedKeys.value,
				roles: delegatedRoles,
			},
		},
		input.signingKeys.targets,
	);
	if (!targets.ok) return targets;

	const snapshotMeta: Record<string, unknown> = {};
	for (const metadata of [targets.value, ...delegatedBuilt]) {
		const name = metadataLogicalName(metadata.roleName);
		if (!name.ok) return name;
		const description = await metaDescription(metadata);
		if (!description.ok) return description;
		snapshotMeta[name.value] = description.value;
	}
	const snapshot = await signMetadata(
		"snapshot",
		snapshotVersion.value,
		{
			_type: "snapshot",
			spec_version: "1.0.31",
			version: snapshotVersion.value,
			expires: snapshotExpires.value,
			meta: snapshotMeta,
		},
		input.signingKeys.snapshot,
	);
	if (!snapshot.ok) return snapshot;

	const snapshotName = metadataLogicalName("snapshot");
	if (!snapshotName.ok) return snapshotName;
	const snapshotDescription = await metaDescription(snapshot.value);
	if (!snapshotDescription.ok) return snapshotDescription;
	const timestamp = await signMetadata(
		"timestamp",
		timestampVersion.value,
		{
			_type: "timestamp",
			spec_version: "1.0.31",
			version: timestampVersion.value,
			expires: timestampExpires.value,
			meta: { [snapshotName.value]: snapshotDescription.value },
		},
		input.signingKeys.timestamp,
	);
	if (!timestamp.ok) return timestamp;

	return {
		ok: true,
		value: {
			consistentSnapshot: input.consistentSnapshot,
			root: root.value,
			targets: targets.value,
			delegatedTargets: delegatedBuilt,
			snapshot: snapshot.value,
			timestamp: timestamp.value,
			targetsByPath: input.targets,
		},
	};
}
