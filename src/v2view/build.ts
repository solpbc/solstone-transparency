// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Builds the v2 portal model (`src/v2view/types.ts`) from a pinned root and a
 * repository base, offline, at `make build-model` time.
 *
 * What this does, in order, and what each step earns the page:
 *
 *   1. Reads the pinned root from a FILE the operator names. Never from the
 *      repository itself: a root fetched over the channel it is meant to
 *      authenticate is not a trust bootstrap, it is a convenience, and this
 *      builder refuses the convenience. No pin → the `absent` model.
 *   2. Runs the public v2 TUF client (`src/v2/tuf/client.ts`) against the
 *      base through a RECORDING fetcher, so every metadata file and target
 *      the client accepted is available afterwards by path and by sha256.
 *      The client discards target bytes once it has checked them; the portal
 *      needs the release records, so it keeps its own copy of exactly what
 *      the client saw. Nothing is fetched that the client did not ask for.
 *   3. On a client failure: an expired role is its own state; anything else
 *      is `unverified` with the verifier's reason. The pinned root is still
 *      shown, because it was trusted out of band.
 *   4. On success: loads the DSSE public keys and the authorization policy
 *      (both TUF-authenticated top-level targets), then verifies every
 *      release record under `targets-software` and the legacy migration
 *      manifest under `targets-legacy` with the shared record verifier.
 *      A record that fails is carried with its failure; it is never dropped
 *      and never rendered as a release.
 *   5. Names any EXPECTED release the repository lacks as a gap.
 *
 * Read-only. Holds no key, writes nothing to any host.
 */

import { readFile } from "node:fs/promises";
import { validateRawLink } from "../legacy/rawlink";
import type { EvidenceLinkStatus, Iso8601 } from "../legacy/types";
import { loadDsseAuthorizationPolicy } from "../v2/records/authorization-policy";
import {
	type MigrationFetchResponse,
	type MigrationObjectFetcher,
	descriptorDigest,
} from "../v2/records/migration-manifest";
import {
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	RELEASE_RECORD_PREDICATE_TYPE,
} from "../v2/records/predicates";
import {
	type EvidenceRecord,
	parseEvidenceRecord,
	verifyEvidenceRecord,
} from "../v2/records/record";
import { validateReleaseRecordPredicate } from "../v2/records/release-record";
import { parseInTotoStatementV1 } from "../v2/records/statement";
import { admitTufJson } from "../v2/tuf/admission";
import { updateTufRepository } from "../v2/tuf/client";
import {
	parseClientMetadata,
	parseRootDeclarations,
} from "../v2/tuf/client-metadata";
import type { TufFetchResponse, TufFetcher } from "../v2/tuf/fetch";
import type { TrustStoreState, TufTrustStore } from "../v2/tuf/trust-store";
import { httpsFetcher, resolveObjectUrl } from "../v2/verify-cli";
import {
	type V2Artifact,
	type V2LegacyBinding,
	type V2Model,
	type V2PolicyView,
	type V2ReleaseRecord,
	type V2RootView,
	type V2SoftwareEntry,
	type V2VerificationAxis,
	slugForProduct,
} from "./types";

// ---- inputs ---------------------------------------------------------------

export interface V2Expectation {
	product: string;
	version: string;
	/** Named so the gap row can say where the expectation came from. */
	basis: string;
}

export interface V2Witness {
	label: string;
	url: string;
}

export interface BuildV2ModelOptions {
	metadataBase: string;
	targetsBase: string;
	/** Path to the pinned root envelope. `undefined` means no pin: the absent model. */
	rootPath?: string;
	/** Test seam: the pinned root bytes directly, instead of a file. */
	rootBytes?: Uint8Array;
	now?: Date;
	expectations?: readonly V2Expectation[];
	witnesses?: readonly V2Witness[];
	/** Test seam: replaces the HTTPS fetcher for repository objects. */
	fetcher?: TufFetcher;
	/** Test seam: replaces the HTTPS fetcher the legacy-manifest walk uses. */
	migrationFetcher?: MigrationObjectFetcher;
}

/** The two witness locations the runbook requires. Bluesky is a founder decision and is not listed until made. */
export const DEFAULT_WITNESSES: readonly V2Witness[] = [
	{
		label: "the pinned root in the public verifier repository",
		url: "https://github.com/solpbc/solstone-transparency/blob/main/protocol/tuf-root.json",
	},
	{
		label: "solpbc.org",
		url: "https://solpbc.org/transparency/tuf-root.txt",
	},
];

// ---- helpers --------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	return bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
		),
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function iso(now: Date): Iso8601 {
	return now.toISOString().replace(/\.\d+Z$/, "Z");
}

function linkFor(url: string): EvidenceLinkStatus {
	const checked = validateRawLink(url);
	if (checked.status === "linked")
		return { status: "linked", link: { url: checked.url } };
	return { status: "rejected", rejected: { reason: checked.reason } };
}

function describe(detail: unknown): string {
	try {
		const text = JSON.stringify(detail);
		return text.length > 400 ? `${text.slice(0, 400)}…` : text;
	} catch {
		return String(detail);
	}
}

/**
 * Wraps a fetcher and keeps every successful response by the path the client
 * asked for and by the sha256 of the bytes. The client's own request stream
 * is the only source of what lands here.
 */
class RecordingFetcher implements TufFetcher {
	readonly byPath = new Map<string, Uint8Array>();
	readonly bySha256 = new Map<string, Uint8Array>();
	readonly pathBySha256 = new Map<string, string>();
	readonly notFound = new Set<string>();
	constructor(private readonly inner: TufFetcher) {}
	async fetch(
		relativePath: string,
		maxBytes: number,
	): Promise<TufFetchResponse> {
		const response = await this.inner.fetch(relativePath, maxBytes);
		if (response.kind === "ok") {
			this.byPath.set(relativePath, response.bytes);
			const digest = await sha256Hex(response.bytes);
			this.bySha256.set(digest, response.bytes);
			this.pathBySha256.set(digest, relativePath);
		} else if (response.kind === "not-found") {
			this.notFound.add(relativePath);
		}
		return response;
	}
}

/** A build runs once from the pinned root; nothing persists between builds. */
export function memoryTrustStore(): TufTrustStore {
	let state: TrustStoreState | undefined;
	let revision: string | undefined;
	return {
		async read() {
			if (state === undefined) return { ok: true, value: undefined };
			return {
				ok: true,
				value: { state, revision: revision ?? "" },
			};
		},
		async replace(expectedRevision, next) {
			if (expectedRevision !== revision) {
				return {
					ok: false,
					reason: "malformed",
					detail: {
						path: ["trustStore"],
						expected: revision ?? "missing",
						observed: expectedRevision ?? "missing",
					},
				};
			}
			state = next;
			revision = String((Number(revision ?? "0") || 0) + 1);
			return { ok: true, value: undefined };
		},
	};
}

/** The live HTTPS fetcher the legacy-manifest walk uses. Read-only GETs against the evidence host. */
export const liveMigrationFetcher: MigrationObjectFetcher = {
	async fetch(url: string): Promise<MigrationFetchResponse> {
		try {
			const response = await fetch(url);
			if (response.status === 404) return { kind: "not-found" };
			if (!response.ok)
				return { kind: "error", error: new Error(`HTTP ${response.status}`) };
			return {
				kind: "ok",
				bytes: new Uint8Array(await response.arrayBuffer()),
			};
		} catch (error) {
			return { kind: "error", error };
		}
	},
};

// ---- root view ------------------------------------------------------------

interface ParsedRoot {
	view: V2RootView;
	keyids: Set<string>;
}

async function rootView(
	bytes: Uint8Array,
	metadataBase: string,
	targetsBase: string,
	witnesses: readonly V2Witness[],
): Promise<
	| { ok: true; value: ParsedRoot }
	| { ok: false; reason: string; detail: string }
> {
	const parsed = parseClientMetadata("root", "pinned.root.json", bytes);
	if (!parsed.ok)
		return {
			ok: false,
			reason: parsed.reason,
			detail: describe(parsed.detail),
		};
	const declarations = parseRootDeclarations(parsed.value.signed);
	if (!declarations.ok)
		return {
			ok: false,
			reason: declarations.reason,
			detail: describe(declarations.detail),
		};
	const root = declarations.value.roles.root;
	const digest = await sha256Hex(bytes);
	const version = parsed.value.version;
	const keyids = root.keyids;
	const witnessLines: [string, string] = [
		`solpbc-tuf-root keyids (${root.threshold} of ${keyids.length}): ${keyids.join(" ")}`,
		`solpbc-tuf-root v${version}  sha256:    ${digest}`,
	];
	const filename = `${version}.root.json`;
	return {
		ok: true,
		value: {
			view: {
				version,
				keyids: [...keyids],
				threshold: root.threshold,
				rootSha256: digest,
				witnessLines,
				witnesses: [...witnesses],
				rootLink: linkFor(
					resolveObjectUrl(metadataBase, targetsBase, filename),
				),
			},
			keyids: new Set(Object.keys(declarations.value.keys)),
		},
	};
}

// ---- captured-metadata parsing --------------------------------------------

interface TargetDescriptor {
	length: number;
	sha256: string;
}

function parseSigned(bytes: Uint8Array): Record<string, unknown> | undefined {
	const admitted = admitTufJson(bytes);
	if (!admitted.ok || !isRecord(admitted.value)) return undefined;
	const signed = admitted.value.signed;
	return isRecord(signed) ? signed : undefined;
}

function targetsOf(
	signed: Record<string, unknown> | undefined,
): Map<string, TargetDescriptor> {
	const out = new Map<string, TargetDescriptor>();
	if (signed === undefined || !isRecord(signed.targets)) return out;
	for (const [path, description] of Object.entries(signed.targets)) {
		if (!isRecord(description) || !isRecord(description.hashes)) continue;
		const sha256 = description.hashes.sha256;
		if (typeof description.length !== "number" || typeof sha256 !== "string")
			continue;
		out.set(path, { length: description.length, sha256 });
	}
	return out;
}

function delegationKeyids(
	signed: Record<string, unknown> | undefined,
): string[] {
	if (signed === undefined || !isRecord(signed.delegations)) return [];
	const keys = signed.delegations.keys;
	return isRecord(keys) ? Object.keys(keys) : [];
}

// ---- record verification --------------------------------------------------

interface LoadedPolicy {
	view: V2PolicyView;
	loaded: Awaited<ReturnType<typeof loadDsseAuthorizationPolicy>>;
}

function highestVersioned(
	targets: Map<string, TargetDescriptor>,
	prefix: string,
): { path: string; version: number; descriptor: TargetDescriptor } | undefined {
	let best:
		| { path: string; version: number; descriptor: TargetDescriptor }
		| undefined;
	for (const [path, descriptor] of targets) {
		if (!path.startsWith(prefix)) continue;
		const match = /^(\d+)\.json$/.exec(path.slice(prefix.length));
		if (match === null) continue;
		const version = Number(match[1]);
		if (best === undefined || version > best.version)
			best = { path, version, descriptor };
	}
	return best;
}

/** `keys/dsse/<n>.json`: `{ schema: "solstone-transparency/dsse-keys/v1", keys: { <keyid>: <TUF key object> } }`. */
function parseDsseKeys(bytes: Uint8Array | undefined): Record<string, unknown> {
	if (bytes === undefined) return {};
	const admitted = admitTufJson(bytes);
	if (!admitted.ok || !isRecord(admitted.value)) return {};
	if (admitted.value.schema !== "solstone-transparency/dsse-keys/v1") return {};
	return isRecord(admitted.value.keys) ? { ...admitted.value.keys } : {};
}

function verificationFromRecordOutcome(
	outcome: Awaited<ReturnType<typeof verifyEvidenceRecord>>,
	checkedAt: Iso8601,
): { axis: V2VerificationAxis; signerKeyids: readonly string[] } {
	const provenance = { kind: "verifier" as const, checkedAt };
	if (outcome.state === "accepted") {
		return {
			axis: { state: "valid", checkedAt, provenance },
			signerKeyids: outcome.satisfyingKeyids,
		};
	}
	if (outcome.state === "suspect") {
		return {
			axis: {
				state: "invalid",
				reason:
					"the signing key is marked compromised in the policy; this record requires re-attestation",
				checkedAt,
				provenance,
			},
			signerKeyids: outcome.satisfyingKeyids,
		};
	}
	const unavailable =
		outcome.reason === "unavailable" || outcome.reason === "retrieval-failed";
	return {
		axis: {
			state: unavailable ? "unavailable" : "invalid",
			reason: `${outcome.reason}: ${describe(outcome.detail)}`,
			checkedAt,
			provenance,
		},
		signerKeyids: [],
	};
}

/** Statement subject bytes for a release record: the same construction `descriptorDigest` hashes. */
function releaseSubjectBytes(
	artifacts: readonly { url: string; length: number; sha256: string }[],
): Uint8Array {
	const text = artifacts
		.slice()
		.sort((left, right) => left.url.localeCompare(right.url))
		.map((object) => `${object.url}\n${object.length}\n${object.sha256}\n`)
		.join("");
	return new TextEncoder().encode(text);
}

async function releaseFromTarget(
	path: string,
	descriptor: TargetDescriptor,
	recording: RecordingFetcher,
	policy: LoadedPolicy | undefined,
	metadataBase: string,
	targetsBase: string,
	checkedAt: Iso8601,
): Promise<V2ReleaseRecord | undefined> {
	const match = /^software\/([^/]+)\/([^/]+)\/release-record\.json$/.exec(path);
	if (match === null) return undefined;
	const [, productFromPath, versionFromPath] = match;
	const bytes = recording.bySha256.get(descriptor.sha256);
	const servedPath = recording.pathBySha256.get(descriptor.sha256) ?? path;
	const recordLink = linkFor(
		resolveObjectUrl(metadataBase, targetsBase, servedPath),
	);
	const provenance = { kind: "verifier" as const, checkedAt };
	const base = {
		kind: "release" as const,
		product: productFromPath ?? "",
		slug: slugForProduct(productFromPath ?? ""),
		version: versionFromPath ?? "",
		issuedAt: "",
		targetPath: path,
		targetSha256: descriptor.sha256,
		recordLink,
		signerKeyids: [] as readonly string[],
		artifacts: [] as V2Artifact[],
		doesProve: [] as readonly string[],
		doesNotProve: [] as readonly string[],
	};
	if (bytes === undefined) {
		return {
			...base,
			verification: {
				state: "unavailable",
				reason: "the verified target bytes were not retained by the client run",
				checkedAt,
				provenance,
			},
		};
	}
	const parsed = parseEvidenceRecord(bytes);
	if (!parsed.ok) {
		return {
			...base,
			verification: {
				state: "invalid",
				reason: `${parsed.reason}: ${describe(parsed.detail)}`,
				checkedAt,
				provenance,
			},
		};
	}
	const record: EvidenceRecord = parsed.value;
	// The statement is parsed here only to learn the subject and the artifact
	// list, so the subject bytes can be supplied to the verifier. Nothing read
	// here reaches the page unless the verifier accepts the record.
	const subjectBytes = new Map<string, Uint8Array>();
	let predicateArtifacts: readonly {
		url: string;
		length: number;
		sha256: string;
	}[] = [];
	let doesProve: readonly string[] = [];
	let doesNotProve: readonly string[] = [];
	let product = base.product;
	let version = base.version;
	try {
		const payload = Uint8Array.from(atob(record.envelope.payload), (c) =>
			c.charCodeAt(0),
		);
		const statement = parseInTotoStatementV1(payload);
		if (
			statement.ok &&
			statement.value.predicateType === RELEASE_RECORD_PREDICATE_TYPE
		) {
			const predicate = await validateReleaseRecordPredicate(
				statement.value.predicate,
			);
			if (predicate.ok) {
				predicateArtifacts = predicate.value.artifacts;
				doesProve = predicate.value.does_prove;
				doesNotProve = predicate.value.does_not_prove;
				product = predicate.value.product;
				version = predicate.value.version;
				const subject = releaseSubjectBytes(predicate.value.artifacts);
				for (const s of statement.value.subject)
					subjectBytes.set(s.name, subject);
			}
		}
	} catch {
		// Fall through: the verifier reports the malformed envelope itself.
	}
	const outcome = await verifyEvidenceRecord({
		record,
		policy: policy?.loaded.ok ? policy.loaded.value : undefined,
		subjectBytes,
	});
	const { axis, signerKeyids } = verificationFromRecordOutcome(
		outcome,
		checkedAt,
	);
	if (axis.state !== "valid") {
		// A record that did not verify shows its identity and its failure, and
		// none of its claims.
		return { ...base, product, version, verification: axis };
	}
	// Belt and braces: the path's product/version and the signed body's must
	// agree, or the record is not the release its path says it is.
	if (product !== base.product || version !== base.version) {
		return {
			...base,
			product,
			version,
			verification: {
				state: "invalid",
				reason: `the signed record names ${product} ${version}; its target path names ${base.product} ${base.version}`,
				checkedAt,
				provenance,
			},
		};
	}
	return {
		...base,
		product,
		slug: slugForProduct(product),
		version,
		issuedAt: record.issued_at,
		signerKeyids,
		artifacts: predicateArtifacts.map((a) => ({
			url: a.url,
			length: a.length,
			sha256: a.sha256,
			link: linkFor(a.url),
		})),
		doesProve,
		doesNotProve,
		verification: axis,
	};
}

async function legacyFromTargets(
	targets: Map<string, TargetDescriptor>,
	recording: RecordingFetcher,
	policy: LoadedPolicy | undefined,
	migrationFetcher: MigrationObjectFetcher,
	metadataBase: string,
	targetsBase: string,
	checkedAt: Iso8601,
): Promise<V2LegacyBinding> {
	const provenance = { kind: "verifier" as const, checkedAt };
	const manifests = [...targets].filter(([path]) =>
		/^legacy\/.*migration-manifest\.json$/.test(path),
	);
	if (manifests.length === 0) return { state: "absent" };
	const products: {
		product: string;
		chainLength: number;
		chainTipVersion: string | null;
	}[] = [];
	let objectCount = 0;
	let firstLink: EvidenceLinkStatus | undefined;
	for (const [path, descriptor] of manifests) {
		const bytes = recording.bySha256.get(descriptor.sha256);
		if (bytes === undefined)
			return {
				state: "not-verified",
				reason: `${path}: bytes not retained by the client run`,
				checkedAt,
				provenance,
			};
		const parsed = parseEvidenceRecord(bytes);
		if (!parsed.ok)
			return {
				state: "not-verified",
				reason: `${path}: ${parsed.reason}`,
				checkedAt,
				provenance,
			};
		const outcome = await verifyEvidenceRecord({
			record: parsed.value,
			policy: policy?.loaded.ok ? policy.loaded.value : undefined,
			subjectBytes: await migrationSubjectBytes(parsed.value),
			migrationFetcher,
		});
		if (outcome.state !== "accepted")
			return {
				state: "not-verified",
				reason:
					outcome.state === "rejected"
						? `${path}: ${outcome.reason}: ${describe(outcome.detail)}`
						: `${path}: signing key marked compromised`,
				checkedAt,
				provenance,
			};
		if (outcome.predicate.type !== MIGRATION_MANIFEST_PREDICATE_TYPE)
			return {
				state: "not-verified",
				reason: `${path}: not a migration manifest`,
				checkedAt,
				provenance,
			};
		for (const p of outcome.predicate.body.products) {
			products.push({
				product: p.product,
				chainLength: p.chain_length,
				chainTipVersion: p.chain_tip_version,
			});
		}
		objectCount += outcome.predicate.body.object_count;
		firstLink ??= linkFor(
			resolveObjectUrl(
				metadataBase,
				targetsBase,
				recording.pathBySha256.get(descriptor.sha256) ?? path,
			),
		);
	}
	return {
		state: "bound",
		products,
		objectCount,
		manifestLink: firstLink ?? {
			status: "rejected",
			rejected: { reason: "no manifest link" },
		},
		checkedAt,
		provenance,
	};
}

/** The migration manifest's subject digest is `descriptorDigest(objects)`; the subject bytes are that same text. */
async function migrationSubjectBytes(
	record: EvidenceRecord,
): Promise<Map<string, Uint8Array>> {
	const out = new Map<string, Uint8Array>();
	try {
		const payload = Uint8Array.from(atob(record.envelope.payload), (c) =>
			c.charCodeAt(0),
		);
		const statement = parseInTotoStatementV1(payload);
		if (!statement.ok) return out;
		const predicate = statement.value.predicate;
		if (!isRecord(predicate) || !Array.isArray(predicate.objects)) return out;
		const objects = predicate.objects.filter(
			(o): o is { url: string; length: number; sha256: string } =>
				isRecord(o) &&
				typeof o.url === "string" &&
				typeof o.length === "number" &&
				typeof o.sha256 === "string",
		);
		const text = releaseSubjectBytes(objects);
		// Sanity: the construction must reproduce the predicate's own digest.
		const digest = await descriptorDigest(objects);
		for (const s of statement.value.subject) {
			if (s.digest.sha256 === digest) out.set(s.name, text);
		}
	} catch {
		// verifier reports
	}
	return out;
}

// ---- the build ------------------------------------------------------------

export async function buildV2Model(
	options: BuildV2ModelOptions,
): Promise<V2Model> {
	const now = options.now ?? new Date();
	const generatedAt = iso(now);
	const witnesses = options.witnesses ?? DEFAULT_WITNESSES;

	let rootBytes = options.rootBytes;
	if (rootBytes === undefined) {
		if (options.rootPath === undefined) {
			return {
				state: "absent",
				generatedAt,
				reason: "no pinned root configured",
			};
		}
		try {
			rootBytes = new Uint8Array(await readFile(options.rootPath));
		} catch (error) {
			return {
				state: "absent",
				generatedAt,
				reason: `pinned root not present at ${options.rootPath} (${error instanceof Error && "code" in error ? String(error.code) : "unreadable"})`,
			};
		}
	}

	const root = await rootView(
		rootBytes,
		options.metadataBase,
		options.targetsBase,
		witnesses,
	);
	if (!root.ok) {
		// A pin that does not parse is a configuration error, not a register
		// state. It is surfaced as unverified with the reason rather than
		// silently rendering today's pages, because a bad pin is exactly the
		// kind of thing an operator must see.
		return {
			state: "absent",
			generatedAt,
			reason: `pinned root did not parse: ${root.reason} ${root.detail}`,
		};
	}

	const recording = new RecordingFetcher(
		options.fetcher ?? httpsFetcher(options.metadataBase, options.targetsBase),
	);
	const result = await updateTufRepository({
		fetcher: recording,
		bootstrapRoot: rootBytes,
		trustStore: memoryTrustStore(),
		now,
	});

	if (!result.ok) {
		const roleName =
			result.classification.kind === "role"
				? result.classification.roleName
				: undefined;
		const provenance = { kind: "verifier" as const, checkedAt: generatedAt };
		const expiredAt =
			result.reason === "expired" && typeof result.detail.observed === "string"
				? result.detail.observed
				: undefined;
		return {
			state: "unverified",
			generatedAt,
			metadataBase: options.metadataBase,
			targetsBase: options.targetsBase,
			root: root.value.view,
			freshness:
				expiredAt !== undefined
					? {
							state: "expired",
							expiredAt,
							roleName: roleName ?? "unknown",
							provenance,
						}
					: undefined,
			failure: {
				roleName,
				reason: result.reason,
				detail: describe(result.detail),
				checkedAt: generatedAt,
				provenance,
			},
		};
	}

	const success = result.value;
	const versions = success.versions;
	const timestampSigned = parseSigned(
		recording.byPath.get("timestamp.json") ?? new Uint8Array(),
	);
	const assertedUntil =
		typeof timestampSigned?.expires === "string"
			? timestampSigned.expires
			: generatedAt;
	const topSigned = parseSigned(
		recording.byPath.get(`${versions.targets}.targets.json`) ??
			new Uint8Array(),
	);
	const topTargets = targetsOf(topSigned);
	const softwareVersion = versions.delegatedTargets["targets-software"];
	const legacyVersion = versions.delegatedTargets["targets-legacy"];
	const softwareTargets = targetsOf(
		parseSigned(
			recording.byPath.get(`${softwareVersion}.targets-software.json`) ??
				new Uint8Array(),
		),
	);
	const legacyTargets = targetsOf(
		parseSigned(
			recording.byPath.get(`${legacyVersion}.targets-legacy.json`) ??
				new Uint8Array(),
		),
	);

	// DSSE keys and policy: both are top-level targets the TUF layer just
	// authenticated, so their bytes are exactly what `targets` signed.
	const tufKeyids = new Set<string>([
		...root.value.keyids,
		...delegationKeyids(topSigned),
	]);
	const dsseKeysTarget = highestVersioned(topTargets, "keys/dsse/");
	const evidenceKeys = parseDsseKeys(
		dsseKeysTarget === undefined
			? undefined
			: recording.bySha256.get(dsseKeysTarget.descriptor.sha256),
	);
	const policyTarget = highestVersioned(
		topTargets,
		"policy/dsse-authorization/",
	);
	let policy: LoadedPolicy | undefined;
	if (policyTarget !== undefined) {
		const bytes = recording.bySha256.get(policyTarget.descriptor.sha256);
		if (bytes !== undefined) {
			const loaded = await loadDsseAuthorizationPolicy({
				bytes,
				now,
				evidenceKeys,
				tufRoleKeyids: tufKeyids,
			});
			policy = {
				loaded,
				view: {
					targetPath: policyTarget.path,
					version: policyTarget.version,
					sha256: policyTarget.descriptor.sha256,
					link: linkFor(
						resolveObjectUrl(
							options.metadataBase,
							options.targetsBase,
							recording.pathBySha256.get(policyTarget.descriptor.sha256) ??
								policyTarget.path,
						),
					),
				},
			};
		}
	}

	const software: V2SoftwareEntry[] = [];
	const unmapped = new Set<string>();
	for (const [path, descriptor] of softwareTargets) {
		const release = await releaseFromTarget(
			path,
			descriptor,
			recording,
			policy,
			options.metadataBase,
			options.targetsBase,
			generatedAt,
		);
		if (release === undefined) continue;
		software.push(release);
		if (release.slug === undefined) unmapped.add(release.product);
	}
	// Records are ordered by product then version string, so the page order is
	// a function of the repository content and nothing else.
	software.sort((a, b) =>
		a.product === b.product
			? a.version.localeCompare(b.version, "en", { numeric: true })
			: a.product.localeCompare(b.product),
	);
	for (const expectation of options.expectations ?? []) {
		const present = software.some(
			(entry) =>
				entry.kind === "release" &&
				entry.product === expectation.product &&
				entry.version === expectation.version,
		);
		if (present) continue;
		software.push({
			kind: "gap",
			product: expectation.product,
			slug: slugForProduct(expectation.product),
			version: expectation.version,
			basis: expectation.basis,
			provenance: { kind: "declaration", basis: expectation.basis },
		});
		if (slugForProduct(expectation.product) === undefined)
			unmapped.add(expectation.product);
	}

	const legacy = await legacyFromTargets(
		legacyTargets,
		recording,
		policy,
		options.migrationFetcher ?? liveMigrationFetcher,
		options.metadataBase,
		options.targetsBase,
		generatedAt,
	);

	return {
		state: "verified",
		generatedAt,
		metadataBase: options.metadataBase,
		targetsBase: options.targetsBase,
		root: root.value.view,
		freshness: {
			state: "asserted",
			assertedUntil,
			signedVersion: versions.timestamp,
			provenance: {
				kind: "signed",
				sourceUrl: resolveObjectUrl(
					options.metadataBase,
					options.targetsBase,
					"timestamp.json",
				),
			},
		},
		repositoryFingerprint: success.fingerprint,
		policy:
			policy === undefined
				? { state: "absent" }
				: policy.loaded.ok
					? policy.view
					: {
							state: "failed",
							targetPath: policy.view.targetPath,
							reason: `${policy.loaded.reason}: ${describe(policy.loaded.detail)}`,
						},
		legacy,
		software,
		unmappedProducts: [...unmapped].sort(),
	};
}

/** Parses `--expect product@version[:basis]`. */
export function parseExpectation(text: string): V2Expectation | undefined {
	const match = /^([^@]+)@([^:]+)(?::(.+))?$/.exec(text);
	if (match === null) return undefined;
	return {
		product: match[1] ?? "",
		version: match[2] ?? "",
		basis: match[3] ?? "named as expected at build time",
	};
}
