// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Builds a complete, SYNTHETIC v2 repository in memory for the portal's own
 * tests and for a locally served rehearsal: root and every role, a DSSE
 * key-set target, an authorization policy target, release records, and a
 * legacy migration-manifest record. Every key is generated in-process and
 * discarded. Nothing here is a real key, a real release, or a real claim.
 *
 * Also runnable as a script to write the same repository to a directory a
 * local HTTP server can serve (`bun run src/v2view/fixture.test-support.ts
 * <out-dir> [--releases N] [--real-legacy] [--build-at <iso>]`), so the
 * portal can be rendered against a repository on this host before W3a's
 * staged one exists. ⛔ It writes only to the directory named; never to any
 * evidence host.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { signEvidenceRecord } from "../v2/records/build-evidence-record";
import {
	type MigrationFetchResponse,
	type MigrationManifestPredicate,
	type MigrationObjectFetcher,
	descriptorDigest,
} from "../v2/records/migration-manifest";
import { buildMigrationManifestPredicate } from "../v2/records/migration-manifest-constructor";
import {
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	RELEASE_RECORD_PREDICATE_TYPE,
} from "../v2/records/predicates";
import {
	basePolicy,
	migrationPredicate,
} from "../v2/records/records.test-support";
import { RELEASE_RECORD_SCHEMA } from "../v2/records/release-record";
import {
	type BuiltRepository,
	type TufTargetDescription,
	buildRepository,
} from "../v2/tuf/builder";
import { canonicalizeTufJson } from "../v2/tuf/canonical";
import {
	type Ed25519SigningKey,
	generateEd25519SigningKey,
} from "../v2/tuf/ed25519";
import type { TufFetchResponse, TufFetcher } from "../v2/tuf/fetch";
import {
	generateSyntheticKeySet,
	loadRepositorySigningKeys,
} from "../v2/tuf/keyset";
import type { TufJsonValue } from "../v2/tuf/outcome";
import { metadataFilename } from "../v2/tuf/serializer";

export interface FixtureArtifact {
	url: string;
	length: number;
	sha256: string;
}

export interface FixtureRelease {
	product: string;
	version: string;
	artifacts?: readonly FixtureArtifact[];
	issuedAt?: string;
	/** Which key signs the DSSE envelope. `unknown` is a key in no policy role. */
	signer?: "release" | "audit" | "unknown";
	/** Bind the record to a digest that is not the live policy's. */
	wrongPolicySha256?: boolean;
	doesProve?: readonly string[];
	doesNotProve?: readonly string[];
}

export interface FixtureOptions {
	/** The instant the repository is built (signatures, expiries). */
	buildAt: Date;
	releases?: readonly FixtureRelease[];
	/** `synthetic` uses the records test-support manifest; `real` constructs journal's from the committed inventory; `none` omits it. */
	legacy?: "synthetic" | "real" | "none";
	includePolicy?: boolean;
	includeDsseKeys?: boolean;
	/** Serve targets under their consistent-snapshot name `<dir>/<sha256>.<file>` in addition to the logical path. */
	hashPrefixedTargets?: boolean;
}

export interface Fixture {
	/** Every servable object keyed by the client-relative path (`timestamp.json`, `software/…/release-record.json`). */
	files: Map<string, Uint8Array>;
	/** Logical target path → the consistent-snapshot (hash-prefixed) path, so a test can address whichever name a client fetches. */
	targetPaths: Map<string, string>;
	rootBytes: Uint8Array;
	repository: BuiltRepository;
	policySha256: string | undefined;
	keys: {
		release: Ed25519SigningKey;
		audit: Ed25519SigningKey;
		unknown: Ed25519SigningKey;
	};
	/** For the synthetic legacy manifest: the object bytes its walk fetches, by URL. */
	legacyObjects: Map<string, Uint8Array>;
}

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

function canonical(value: unknown): Uint8Array {
	const encoded = canonicalizeTufJson(value);
	if (!encoded.ok)
		throw new Error(`fixture canonicalization failed: ${encoded.reason}`);
	return encoded.value;
}

async function key(): Promise<Ed25519SigningKey> {
	const generated = await generateEd25519SigningKey();
	if (!generated.ok)
		throw new Error(`fixture key generation failed: ${generated.reason}`);
	return generated.value;
}

/** The twelve real journal 1.0.22 evidence objects, as the readiness rehearsal recorded them. Real URLs; used so a local render's artifact links validate. */
export const REHEARSAL_ARTIFACTS: readonly FixtureArtifact[] = [
	{
		url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.22/ledger-entry.json",
		length: 4172,
		sha256: "12dcc873dfa68e801e7c39b7298c3c418ddcb675f1adca066e9e2c667a224f99",
	},
	{
		url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.22/ledger-entry.json.minisig",
		length: 479,
		sha256: "6e690b78c6f0087d570762a2c749b9f558096a1f98c83376822506feb61e83f8",
	},
];

export const SYNTHETIC_DOES_PROVE: readonly string[] = [
	"that sol pbc recorded these exact final bytes, by url, length and sha256, as a release of this product and version, signed at the stated time.",
];
export const SYNTHETIC_DOES_NOT_PROVE: readonly string[] = [
	"that the source code produced these bytes.",
	"that this is what any owner is running, or the newest build available.",
	"that the software is safe, free of defects, fit for a purpose, reviewed or audited.",
	"that builds shipped through app stores are these bytes.",
];

export async function buildFixture(options: FixtureOptions): Promise<Fixture> {
	const keySetJson = await generateSyntheticKeySet();
	const loaded = await loadRepositorySigningKeys(keySetJson);
	if (!loaded.ok) throw new Error(`fixture key set failed: ${loaded.reason}`);
	const release = loaded.value.dsseSigner;
	const audit = await key();
	const unknown = await key();

	const targets: Record<string, TufTargetDescription> = {};
	const files = new Map<string, Uint8Array>();
	const targetPaths = new Map<string, string>();
	const addTarget = async (path: string, bytes: Uint8Array) => {
		const sha256 = await sha256Hex(bytes);
		targets[path] = { length: bytes.byteLength, hashes: { sha256 } };
		files.set(path, bytes);
		const slash = path.lastIndexOf("/");
		const physical = `${path.slice(0, slash + 1)}${sha256}.${path.slice(slash + 1)}`;
		targetPaths.set(path, physical);
		if (options.hashPrefixedTargets) files.set(physical, bytes);
	};

	let policySha256: string | undefined;
	if (options.includePolicy !== false) {
		const policyBytes = canonical(basePolicy(release, audit));
		policySha256 = await sha256Hex(policyBytes);
		await addTarget("policy/dsse-authorization/1.json", policyBytes);
	}
	if (options.includeDsseKeys !== false) {
		await addTarget(
			"keys/dsse/1.json",
			canonical({
				schema: "solstone-transparency/dsse-keys/v1",
				keys: {
					[release.keyId]: release.keyObject,
					[audit.keyId]: audit.keyObject,
				},
			}),
		);
	}

	const boundPolicy = policySha256 ?? "0".repeat(64);
	for (const spec of options.releases ?? []) {
		const artifacts = spec.artifacts ?? REHEARSAL_ARTIFACTS;
		const predicate = {
			_comment: [
				"SYNTHETIC portal fixture record. Not a release of anything. Signed with an in-process throwaway key.",
			],
			schema: RELEASE_RECORD_SCHEMA,
			product: spec.product,
			version: spec.version,
			artifacts: [...artifacts],
			does_prove: [...(spec.doesProve ?? SYNTHETIC_DOES_PROVE)],
			does_not_prove: [...(spec.doesNotProve ?? SYNTHETIC_DOES_NOT_PROVE)],
		};
		const signer =
			spec.signer === "audit"
				? audit
				: spec.signer === "unknown"
					? unknown
					: release;
		const signed = await signEvidenceRecord({
			predicateType: RELEASE_RECORD_PREDICATE_TYPE,
			predicate: predicate as unknown as TufJsonValue,
			subjectName: `software/${spec.product}/${spec.version}`,
			subjectSha256: await descriptorDigest(artifacts),
			policySha256: spec.wrongPolicySha256 ? "f".repeat(64) : boundPolicy,
			issuedAt: spec.issuedAt ?? options.buildAt.toISOString(),
			signingKeys: [signer],
		});
		if (!signed.ok)
			throw new Error(`fixture record signing failed: ${signed.reason}`);
		await addTarget(
			`software/${spec.product}/${spec.version}/release-record.json`,
			canonical(signed.value),
		);
	}

	const legacyObjects = new Map<string, Uint8Array>();
	const legacyMode = options.legacy ?? "synthetic";
	if (legacyMode !== "none") {
		let predicate: MigrationManifestPredicate;
		let legacyTargetPath: string;
		if (legacyMode === "real") {
			predicate = await buildMigrationManifestPredicate("journal");
			legacyTargetPath = "legacy/journal/migration-manifest.json";
		} else {
			const fixture = await migrationPredicate();
			predicate = fixture.predicate;
			const object = fixture.predicate.objects[0];
			if (object !== undefined)
				legacyObjects.set(object.url, fixture.objectBytes);
			legacyObjects.set(
				fixture.predicate.verification_contract.v1_public_key,
				new TextEncoder().encode("untrusted comment: synthetic\nRWQ\n"),
			);
			legacyTargetPath = "legacy/legacy-corpus/migration-manifest.json";
		}
		const signed = await signEvidenceRecord({
			predicateType: MIGRATION_MANIFEST_PREDICATE_TYPE,
			predicate: predicate as unknown as TufJsonValue,
			subjectName: "software/legacy-corpus/v1",
			subjectSha256: predicate.corpus_sha256,
			policySha256: boundPolicy,
			issuedAt: options.buildAt.toISOString(),
			signingKeys: [release],
		});
		if (!signed.ok)
			throw new Error(`fixture manifest signing failed: ${signed.reason}`);
		await addTarget(legacyTargetPath, canonical(signed.value));
	}

	const built = await buildRepository({
		signingKeys: loaded.value.signingKeys,
		targets,
		consistentSnapshot: true,
		now: options.buildAt,
	});
	if (!built.ok)
		throw new Error(
			`fixture repository build failed: ${built.reason} ${JSON.stringify(built.detail)}`,
		);
	const repository = built.value;
	for (const metadata of [
		repository.root,
		repository.targets,
		...repository.delegatedTargets,
		repository.snapshot,
		repository.timestamp,
	]) {
		const filename = metadataFilename(
			metadata.roleName,
			metadata.version,
			true,
		);
		if (!filename.ok)
			throw new Error(`fixture filename failed: ${filename.reason}`);
		files.set(filename.value, metadata.bytes);
	}
	return {
		files,
		targetPaths,
		rootBytes: repository.root.bytes,
		repository,
		policySha256,
		keys: { release, audit, unknown },
		legacyObjects,
	};
}

export interface FixtureFetcherOptions {
	/** Mutate the bytes served for one target (a tamper control). `path` is the logical target path; the tamper fires whether the client fetches that name or its hash-prefixed form. */
	tamper?: { path: string; mutate: (bytes: Uint8Array) => Uint8Array };
	/** Serve nothing at all (an empty base). */
	unreachable?: boolean;
	/** Record every path the client asked for. */
	requested?: string[];
}

/** A TufFetcher over the fixture's in-memory files. */
export function fixtureFetcher(
	files: Map<string, Uint8Array>,
	options: FixtureFetcherOptions = {},
): TufFetcher {
	return {
		async fetch(
			relativePath: string,
			maxBytes: number,
		): Promise<TufFetchResponse> {
			options.requested?.push(relativePath);
			if (options.unreachable) return { kind: "not-found" };
			let bytes = files.get(relativePath);
			if (bytes === undefined) return { kind: "not-found" };
			if (
				options.tamper !== undefined &&
				tamperMatches(options.tamper.path, relativePath)
			)
				bytes = options.tamper.mutate(bytes);
			if (bytes.byteLength > maxBytes)
				return { kind: "error", error: new Error("over ceiling") };
			return { kind: "ok", bytes };
		},
	};
}

/** True when `requested` is the logical `target` or its `<dir>/<sha256>.<file>` form. */
function tamperMatches(target: string, requested: string): boolean {
	if (requested === target) return true;
	const slash = target.lastIndexOf("/");
	const dir = target.slice(0, slash + 1);
	const file = target.slice(slash + 1);
	return new RegExp(
		`^${dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[0-9a-f]{64}\\.${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
	).test(requested);
}

/** A MigrationObjectFetcher over the synthetic manifest's objects. */
export function fixtureMigrationFetcher(
	objects: Map<string, Uint8Array>,
): MigrationObjectFetcher {
	return {
		async fetch(url: string): Promise<MigrationFetchResponse> {
			const bytes = objects.get(url);
			return bytes === undefined
				? { kind: "not-found" }
				: { kind: "ok", bytes };
		},
	};
}

/** Flip the last byte of a payload. Enough to break any digest. */
export function flipLastByte(bytes: Uint8Array): Uint8Array {
	const out = new Uint8Array(bytes);
	const last = out.length - 1;
	out[last] = (out[last] ?? 0) ^ 0x01;
	return out;
}

/** Writes the fixture to `<dir>/metadata/` and `<dir>/targets/` plus `<dir>/pinned-root.json`. */
export async function writeFixture(
	fixture: Fixture,
	dir: string,
): Promise<void> {
	for (const [path, bytes] of fixture.files) {
		const isMetadata =
			/(^|\.)(root|timestamp|snapshot|targets(-[^.]+)?)\.json$/.test(path);
		const dest = join(dir, isMetadata ? "metadata" : "targets", path);
		await mkdir(dirname(dest), { recursive: true });
		await writeFile(dest, bytes);
	}
	await writeFile(join(dir, "pinned-root.json"), fixture.rootBytes);
}

if (import.meta.main) {
	const argv = process.argv.slice(2);
	const dir = argv[0];
	if (!dir) {
		console.error(
			"usage: bun run src/v2view/fixture.test-support.ts <out-dir> [--releases N] [--real-legacy] [--build-at <iso>] [--hash-prefixed]",
		);
		process.exit(1);
	}
	const flag = (name: string) => {
		const index = argv.indexOf(name);
		return index >= 0 ? argv[index + 1] : undefined;
	};
	const count = Number(flag("--releases") ?? "0");
	const releases: FixtureRelease[] = [];
	for (let i = 0; i < count; i++) {
		releases.push({ product: "solstone-journal", version: `2.0.${i}` });
	}
	const buildAt = flag("--build-at")
		? new Date(flag("--build-at") ?? "")
		: new Date();
	const fixture = await buildFixture({
		buildAt,
		releases,
		legacy: argv.includes("--real-legacy") ? "real" : "synthetic",
		hashPrefixedTargets: argv.includes("--hash-prefixed"),
	});
	await writeFixture(fixture, dir);
	console.log(
		`wrote SYNTHETIC v2 fixture to ${dir}: ${fixture.files.size} objects, ${releases.length} release record(s), legacy ${argv.includes("--real-legacy") ? "real" : "synthetic"}, built at ${buildAt.toISOString()}`,
	);
}
