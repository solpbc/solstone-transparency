// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type DsseAuthorizationPolicy,
	type LoadedDsseAuthorizationPolicy,
	evaluateDssePolicyAuthorization,
} from "../records/authorization-policy";
import { IN_TOTO_PAYLOAD_TYPE, verifyDsseEnvelope } from "../records/dsse";
import {
	type MigrationManifestPredicate,
	walkMigrationManifest,
} from "../records/migration-manifest";
import {
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	validateKnownPredicate,
} from "../records/predicates";
import {
	EVIDENCE_RECORD_SCHEMA,
	verifyEvidenceRecord,
} from "../records/record";
import {
	IN_TOTO_STATEMENT_V1,
	type InTotoStatementV1,
	verifyStatementSubjects,
} from "../records/statement";
import { DEFAULT_MAX_METADATA_BYTES, admitTufJson } from "./admission";
import { type RepositorySigningKeys, buildRepository } from "./builder";
import { canonicalizeTufJson } from "./canonical";
import { updateTufRepository } from "./client";
import {
	type ClientMetadata,
	validateMetadataDescription,
	validateMetadataFreshnessAndSpec,
	validateTargetBytes,
} from "./client-metadata";
import {
	computeKeyId,
	generateEd25519SigningKey,
	signEd25519,
	verifyEd25519Signature,
} from "./ed25519";
import type { TufFetchResponse } from "./fetch";
import { type TufRejectionReason, type TufResult, rejection } from "./outcome";
import { validateFilenameVersion } from "./reader";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import {
	authorizeTargetPath,
	checkMetadataType,
	evaluateRoleAuthorization,
	validateDelegationChain,
	validateRoleConfiguration,
	validateTargetPath,
} from "./role-graph";
import { metadataFilename } from "./serializer";
import { openFileTrustStore } from "./trust-store";

export interface RejectionFixture {
	reason: TufRejectionReason;
	invoke(): Promise<TufResult<unknown>>;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function sha256(bytes: Uint8Array): Promise<string> {
	return bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
		),
	);
}

async function generatedKey() {
	const key = await generateEd25519SigningKey();
	if (!key.ok)
		throw new Error(`synthetic key generation failed: ${key.reason}`);
	return key.value;
}

async function primitiveFixtures(): Promise<readonly RejectionFixture[]> {
	const text = new TextEncoder();
	const first = await generatedKey();
	const second = await generatedKey();
	const signedMessage = text.encode("outcome reachability");
	const firstSignature = await signEd25519(first.privateKey, signedMessage);
	const secondSignature = await signEd25519(second.privateKey, signedMessage);
	if (!firstSignature.ok || !secondSignature.ok)
		throw new Error("synthetic signature generation failed");

	return [
		{
			reason: "malformed",
			invoke: async () => admitTufJson(text.encode("[1,]")),
		},
		{
			reason: "invalid-encoding",
			invoke: async () => admitTufJson(new Uint8Array([0xc3, 0x28])),
		},
		{
			reason: "byte-length-changed",
			invoke: async () =>
				admitTufJson(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])),
		},
		{
			reason: "unpaired-surrogate",
			invoke: async () => canonicalizeTufJson("\ud800"),
		},
		{
			reason: "non-finite-number",
			invoke: async () => canonicalizeTufJson(Number.NaN),
		},
		{
			reason: "non-integer-number",
			invoke: async () => canonicalizeTufJson(1.5),
		},
		{
			reason: "undefined-value",
			invoke: async () => canonicalizeTufJson(undefined),
		},
		{
			reason: "oversized",
			invoke: async () =>
				admitTufJson(new Uint8Array(DEFAULT_MAX_METADATA_BYTES + 1).fill(0xff)),
		},
		{
			reason: "too-deep",
			invoke: async () => admitTufJson(text.encode("[".repeat(33))),
		},
		{
			reason: "duplicate-key",
			invoke: async () => admitTufJson(text.encode('{"a":1,"\\u0061":2}')),
		},
		{
			reason: "integer-not-round-trippable",
			invoke: async () => admitTufJson(text.encode("9007199254740993")),
		},
		{ reason: "malformed-key", invoke: async () => computeKeyId({}) },
		{
			reason: "wrong-key-length",
			invoke: async () =>
				verifyEd25519Signature({
					keyObject: { ...first.keyObject, keyval: { public: "" } },
					expectedKeyId: first.keyId,
					signature: new Uint8Array(64),
					message: new Uint8Array(),
				}),
		},
		{
			reason: "wrong-signature-length",
			invoke: async () =>
				verifyEd25519Signature({
					keyObject: first.keyObject,
					expectedKeyId: first.keyId,
					signature: new Uint8Array(),
					message: new Uint8Array(),
				}),
		},
		{
			reason: "unsupported-key-type",
			invoke: async () =>
				verifyEd25519Signature({
					keyObject: { ...first.keyObject, scheme: "other" },
					expectedKeyId: first.keyId,
					signature: new Uint8Array(64),
					message: new Uint8Array(),
				}),
		},
		{
			reason: "signature-invalid",
			invoke: async () =>
				verifyEd25519Signature({
					keyObject: first.keyObject,
					expectedKeyId: first.keyId,
					signature: new Uint8Array(64),
					message: new Uint8Array(),
				}),
		},
		{
			reason: "keyid-mismatch",
			invoke: async () =>
				verifyEd25519Signature({
					keyObject: first.keyObject,
					expectedKeyId: "0".repeat(64),
					signature: new Uint8Array(64),
					message: new Uint8Array(),
				}),
		},
		{
			reason: "threshold-unmet",
			invoke: async () =>
				evaluateRoleAuthorization({
					role: { keyids: [first.keyId, second.keyId], threshold: 2 },
					keys: {
						[first.keyId]: first.keyObject,
						[second.keyId]: second.keyObject,
					},
					signatures: [
						{ keyid: first.keyId, sig: bytesToHex(firstSignature.value) },
					],
					message: signedMessage,
				}),
		},
		{
			reason: "key-not-in-role",
			invoke: async () =>
				evaluateRoleAuthorization({
					role: { keyids: [first.keyId], threshold: 1 },
					keys: {
						[first.keyId]: first.keyObject,
						[second.keyId]: second.keyObject,
					},
					signatures: [
						{ keyid: second.keyId, sig: bytesToHex(secondSignature.value) },
					],
					message: signedMessage,
				}),
		},
		{
			reason: "dangling-keyid",
			invoke: async () =>
				evaluateRoleAuthorization({
					role: { keyids: ["missing"], threshold: 1 },
					keys: {},
					signatures: [],
					message: signedMessage,
				}),
		},
		{
			reason: "degenerate-role-configuration",
			invoke: async () =>
				validateRoleConfiguration(
					{ keyids: [first.keyId], threshold: 0 },
					{ [first.keyId]: first.keyObject },
				),
		},
		{
			reason: "role-not-authorized",
			invoke: async () =>
				authorizeTargetPath("targets/services", "software/item"),
		},
		{
			reason: "delegation-too-deep",
			invoke: async () =>
				validateDelegationChain(
					Array.from({ length: 10 }, (_, index) => `role-${index}`),
				),
		},
		{
			reason: "unsafe-target-path",
			invoke: async () => validateTargetPath("https://unsafe.example/item"),
		},
		{
			reason: "metadata-type-mismatch",
			invoke: async () => checkMetadataType({ _type: "snapshot" }, "timestamp"),
		},
		{
			reason: "filename-version-mismatch",
			invoke: async () => validateFilenameVersion("5.targets.json", 5, 3),
		},
	];
}

function fixturePolicy(
	roles: DsseAuthorizationPolicy["roles"],
): LoadedDsseAuthorizationPolicy {
	return {
		sha256: "a".repeat(64),
		keyMap: {},
		policy: {
			version: 1,
			effective_from: "2026-01-01T00:00:00.000Z",
			roles,
			evaluation_rules: {
				unrecognized_predicate: "unrecognized-predicate",
				unknown_key: "unknown-key",
				role_not_authorized: "role-not-authorized",
				threshold_unmet: "threshold-unmet",
				outside_issuance_window: "outside-issuance-window",
			},
		},
	};
}

async function recordFixtures(): Promise<readonly RejectionFixture[]> {
	const text = new TextEncoder();
	const statement: InTotoStatementV1 = {
		type: IN_TOTO_STATEMENT_V1,
		subject: [
			{ name: "software/example/v1", digest: { sha256: "0".repeat(64) } },
		],
		predicateType: MIGRATION_MANIFEST_PREDICATE_TYPE,
		predicate: {},
	};
	const policy = fixturePolicy([
		{
			id: "producer.release",
			key_label: "fixture",
			keyids: [],
			threshold: 1,
			predicate_types: [MIGRATION_MANIFEST_PREDICATE_TYPE],
			subject_patterns: ["software/**"],
			claim_ceiling: "fixture",
			issuance_window: {
				not_before: "2026-01-01T00:00:00.000Z",
				not_after: "2026-12-31T00:00:00.000Z",
			},
		},
	]);
	const migration: MigrationManifestPredicate = {
		_comment: ["fixture"],
		schema: "solstone-transparency/migration-manifest/v1-to-v2",
		verification_contract: {
			v1_algorithm: "minisign",
			v1_public_key:
				"https://transparency.solstone.app/releases/keys/fixture.pub",
			note: "fixture",
		},
		corpus_sha256: "0".repeat(64),
		object_count: 1,
		products: [],
		objects: [
			{
				url: "https://transparency.solstone.app/releases/fixture/object",
				length: 1,
				sha256: "0".repeat(64),
			},
		],
	};
	return [
		{
			reason: "payload-type-mismatch",
			invoke: async () =>
				verifyDsseEnvelope({
					envelope: {
						payloadType: "application/other",
						payload: "",
						signatures: [],
					},
					expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
					keys: {},
				}),
		},
		{
			reason: "unrecognized-predicate",
			invoke: async () =>
				validateKnownPredicate("https://example.invalid/future", {}),
		},
		{
			reason: "predicate-malformed",
			invoke: async () =>
				validateKnownPredicate(MIGRATION_MANIFEST_PREDICATE_TYPE, {}),
		},
		{
			reason: "subject-mismatch",
			invoke: async () =>
				verifyStatementSubjects(
					statement,
					new Map([["software/example/v1", text.encode("not matching")]]),
				),
		},
		{
			reason: "outside-issuance-window",
			invoke: async () =>
				evaluateDssePolicyAuthorization({
					policy,
					predicateType: MIGRATION_MANIFEST_PREDICATE_TYPE,
					subjects: statement.subject,
					issuedAt: "2027-01-01T00:00:00.000Z",
					verifiedSignatures: [],
				}),
		},
		{
			reason: "unknown-key",
			invoke: async () => {
				const outcome = await verifyEvidenceRecord({
					record: {
						schema: EVIDENCE_RECORD_SCHEMA,
						policy_sha256: policy.sha256,
						issued_at: "2026-06-01T00:00:00.000Z",
						envelope: {
							payloadType: IN_TOTO_PAYLOAD_TYPE,
							payload: "",
							signatures: [{ keyid: "b".repeat(64), sig: "" }],
						},
					},
					policy,
					subjectBytes: new Map(),
				});
				if (outcome.state !== "rejected")
					throw new Error("unknown-key fixture must reject");
				return rejection(outcome.reason, outcome.detail);
			},
		},
		{
			reason: "migration-target-mismatch",
			invoke: async () =>
				(
					await walkMigrationManifest(migration, {
						async fetch(url) {
							return {
								kind: "ok",
								bytes:
									url === migration.verification_contract.v1_public_key
										? text.encode("fixture key")
										: text.encode("x"),
							};
						},
					})
				).verdict,
		},
	];
}

async function signingKeys(): Promise<RepositorySigningKeys> {
	const generate = async (count: number) =>
		Promise.all(Array.from({ length: count }, () => generatedKey()));
	const delegated: Record<string, Awaited<ReturnType<typeof generate>>> = {};
	for (const role of DELEGATED_ROLES)
		delegated[role.name] = await generate(role.keyCount);
	return {
		root: await generate(TOP_LEVEL_ROLES.root.keyCount),
		targets: await generate(TOP_LEVEL_ROLES.targets.keyCount),
		snapshot: await generate(TOP_LEVEL_ROLES.snapshot.keyCount),
		timestamp: await generate(TOP_LEVEL_ROLES.timestamp.keyCount),
		delegated,
	};
}

async function signFixture(
	signed: Record<string, unknown>,
	keys: readonly Awaited<ReturnType<typeof generatedKey>>[],
): Promise<Uint8Array> {
	const canonical = canonicalizeTufJson(signed);
	if (!canonical.ok) throw new Error("fixture canonicalization failed");
	const signatures: { keyid: string; sig: string }[] = [];
	for (const key of keys) {
		const signature = await signEd25519(key.privateKey, canonical.value);
		if (!signature.ok) throw new Error("fixture signing failed");
		signatures.push({ keyid: key.keyId, sig: bytesToHex(signature.value) });
	}
	const envelope = canonicalizeTufJson({ signed, signatures });
	if (!envelope.ok) throw new Error("fixture envelope canonicalization failed");
	return envelope.value;
}

async function clientFixture() {
	const keys = await signingKeys();
	const targetBytes = new TextEncoder().encode("oracle target");
	const built = await buildRepository({
		signingKeys: keys,
		targets: {
			"software/release.json": {
				length: targetBytes.byteLength,
				hashes: { sha256: await sha256(targetBytes) },
			},
		},
		consistentSnapshot: true,
		now: new Date("2030-01-02T03:04:05Z"),
	});
	if (!built.ok) throw new Error(`fixture build failed: ${built.reason}`);
	const objects = new Map<string, TufFetchResponse>();
	for (const metadata of [
		built.value.root,
		built.value.timestamp,
		built.value.snapshot,
		built.value.targets,
		...built.value.delegatedTargets,
	]) {
		const filename = metadataFilename(
			metadata.roleName,
			metadata.version,
			true,
		);
		if (!filename.ok) throw new Error("fixture filename failed");
		objects.set(filename.value, { kind: "ok", bytes: metadata.bytes });
	}
	objects.set("software/release.json", { kind: "ok", bytes: targetBytes });
	return { built: built.value, keys, objects };
}

async function clientResult(
	objects: Map<string, TufFetchResponse>,
	bootstrapRoot: Uint8Array,
): Promise<TufResult<unknown>> {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-reason-oracle-"),
	);
	try {
		return await updateTufRepository({
			fetcher: {
				async fetch(path) {
					return objects.get(path) ?? { kind: "not-found" };
				},
			},
			bootstrapRoot,
			trustStore: openFileTrustStore(join(directory, "store.json")),
			now: new Date("2030-01-02T03:04:05Z"),
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

async function clientFixtures(): Promise<readonly RejectionFixture[]> {
	return [
		{
			reason: "unavailable",
			invoke: async () => {
				const fixture = await clientFixture();
				fixture.objects.delete("timestamp.json");
				return clientResult(fixture.objects, fixture.built.root.bytes);
			},
		},
		{
			reason: "retrieval-failed",
			invoke: async () => {
				const fixture = await clientFixture();
				fixture.objects.set("timestamp.json", {
					kind: "error",
					error: new Error("offline"),
				});
				return clientResult(fixture.objects, fixture.built.root.bytes);
			},
		},
		{
			reason: "version-rollback",
			invoke: async () => {
				const fixture = await clientFixture();
				return updateTufRepository({
					fetcher: {
						async fetch(path) {
							return fixture.objects.get(path) ?? { kind: "not-found" };
						},
					},
					bootstrapRoot: fixture.built.root.bytes,
					trustStore: {
						async read() {
							return {
								ok: true as const,
								value: {
									state: {
										schemaVersion: 1 as const,
										trustedRoot: {
											version: 1,
											envelope: {
												signed: fixture.built.root.envelope.signed as Record<
													string,
													never
												>,
												signatures: fixture.built.root.envelope.signatures,
											},
										},
										versions: {
											root: 1,
											timestamp: 2,
											snapshot: 1,
											targets: 1,
											delegatedTargets: {},
										},
									},
									revision: "reason-oracle",
								},
							};
						},
						async replace() {
							throw new Error("rollback must stop before persistence");
						},
					},
					now: new Date("2030-01-02T03:04:05Z"),
				});
			},
		},
		{
			reason: "snapshot-role-dropped",
			invoke: async () => {
				const fixture = await clientFixture();
				const snapshot = fixture.built.snapshot.envelope.signed as Record<
					string,
					unknown
				>;
				const meta = Object.fromEntries(
					Object.entries(snapshot.meta as Record<string, unknown>).filter(
						([name]) => name !== "targets/software.json",
					),
				);
				const snapshotBytes = await signFixture(
					{ ...snapshot, meta },
					fixture.keys.snapshot,
				);
				fixture.objects.set("1.snapshot.json", {
					kind: "ok",
					bytes: snapshotBytes,
				});
				const timestamp = {
					...fixture.built.timestamp.envelope.signed,
					meta: {
						"snapshot.json": {
							version: 1,
							length: snapshotBytes.byteLength,
							hashes: { sha256: await sha256(snapshotBytes) },
						},
					},
				};
				fixture.objects.set("timestamp.json", {
					kind: "ok",
					bytes: await signFixture(timestamp, fixture.keys.timestamp),
				});
				return clientResult(fixture.objects, fixture.built.root.bytes);
			},
		},
		{
			reason: "snapshot-mismatch",
			invoke: async () =>
				validateMetadataDescription(
					{ version: 1, length: 1, hashes: { sha256: "0".repeat(64) } },
					{
						roleName: "targets",
						filename: "1.targets.json",
						version: 2,
						signed: {},
						signatures: [],
						bytes: new Uint8Array([0]),
					} satisfies ClientMetadata,
				),
		},
		{
			reason: "length-mismatch",
			invoke: async () =>
				validateTargetBytes(
					{ version: 1, length: 2, hashes: { sha256: "0".repeat(64) } },
					new Uint8Array([0]),
				),
		},
		{
			reason: "hash-mismatch",
			invoke: async () =>
				validateTargetBytes(
					{ version: 1, length: 1, hashes: { sha256: "0".repeat(64) } },
					new Uint8Array([0]),
				),
		},
		{
			reason: "expired",
			invoke: async () =>
				validateMetadataFreshnessAndSpec(
					{ spec_version: "1.0.31", expires: "2030-01-01T00:00:00Z" },
					new Date("2030-01-02T03:04:05Z"),
				),
		},
		{
			reason: "unsupported-spec-version",
			invoke: async () =>
				validateMetadataFreshnessAndSpec(
					{ spec_version: "2.0.0", expires: "2031-01-01T00:00:00Z" },
					new Date("2030-01-02T03:04:05Z"),
				),
		},
		{
			reason: "trust-store-corrupt",
			invoke: async () => {
				const directory = await mkdtemp(
					join(tmpdir(), "solstone-transparency-tuf-reason-corrupt-"),
				);
				try {
					const path = join(directory, "store.json");
					await writeFile(path, "not json");
					return openFileTrustStore(path).read();
				} finally {
					await rm(directory, { recursive: true, force: true });
				}
			},
		},
	];
}

/** Every test independently executes these real fixtures; no observed state is shared. */
export async function allRejectionFixtures(): Promise<
	readonly RejectionFixture[]
> {
	return [
		...(await primitiveFixtures()),
		...(await clientFixtures()),
		...(await recordFixtures()),
	];
}
