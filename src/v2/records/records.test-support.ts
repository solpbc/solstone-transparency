// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { canonicalizeTufJson } from "../tuf/canonical";
import {
	type Ed25519SigningKey,
	generateEd25519SigningKey,
	signEd25519,
} from "../tuf/ed25519";
import type { TufJsonValue } from "../tuf/outcome";
import {
	type DsseAuthorizationPolicy,
	type LoadedDsseAuthorizationPolicy,
	loadDsseAuthorizationPolicy,
} from "./authorization-policy";
import {
	IN_TOTO_PAYLOAD_TYPE,
	dssePreAuthenticationEncoding,
	encodeDsseBase64,
} from "./dsse";
import {
	MIGRATION_MANIFEST_SCHEMA,
	type MigrationManifestPredicate,
} from "./migration-manifest";
import {
	AUDIT_RESULT_PREDICATE_TYPE,
	DEPLOYMENT_PREDICATE_TYPE,
	IMAGE_BUILD_PREDICATE_TYPE,
	KEY_EVENT_PREDICATE_TYPE,
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	NATIVE_PLATFORM_RECEIPT_PREDICATE_TYPE,
	RELEASE_RECORD_PREDICATE_TYPE,
	REPRODUCIBILITY_RESULT_PREDICATE_TYPE,
	RUNTIME_ATTESTATION_PREDICATE_TYPE,
	SLSA_BUILD_PROVENANCE_V1_PREDICATE_TYPE,
	SPDX_SBOM_PREDICATE_TYPE,
} from "./predicates";
import { EVIDENCE_RECORD_SCHEMA, type EvidenceRecord } from "./record";
import { IN_TOTO_STATEMENT_V1 } from "./statement";

export const NOW = new Date("2027-06-01T00:00:00.000Z");
export const ISSUED_AT = "2027-05-01T00:00:00.000Z";

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export async function sha256(bytes: Uint8Array): Promise<string> {
	return bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
		),
	);
}

export async function generatedKey(): Promise<Ed25519SigningKey> {
	const generated = await generateEd25519SigningKey();
	if (!generated.ok)
		throw new Error(`synthetic Ed25519 key failed: ${generated.reason}`);
	return generated.value;
}

export async function canonicalBytes(value: unknown): Promise<Uint8Array> {
	const encoded = canonicalizeTufJson(value);
	if (!encoded.ok)
		throw new Error(`fixture canonicalization failed: ${encoded.reason}`);
	return encoded.value;
}

export function basePolicy(
	releaseKey: Ed25519SigningKey,
	auditKey: Ed25519SigningKey,
): DsseAuthorizationPolicy {
	const window = {
		not_before: "2026-01-01T00:00:00.000Z",
		not_after: "2030-01-01T00:00:00.000Z",
	};
	return {
		version: 1,
		effective_from: "2026-01-01T00:00:00.000Z",
		roles: [
			{
				id: "producer.release",
				key_label: "synthetic-release",
				keyids: [releaseKey.keyId],
				threshold: 1,
				predicate_types: [
					RELEASE_RECORD_PREDICATE_TYPE,
					SLSA_BUILD_PROVENANCE_V1_PREDICATE_TYPE,
					SPDX_SBOM_PREDICATE_TYPE,
					NATIVE_PLATFORM_RECEIPT_PREDICATE_TYPE,
					MIGRATION_MANIFEST_PREDICATE_TYPE,
				],
				subject_patterns: ["software/{product}/**"],
				claim_ceiling: "sol pbc recorded these exact final bytes as a release",
				issuance_window: window,
			},
			{
				id: "producer.image",
				key_label: "synthetic-image-empty",
				keyids: [],
				threshold: 1,
				predicate_types: [
					IMAGE_BUILD_PREDICATE_TYPE,
					DEPLOYMENT_PREDICATE_TYPE,
				],
				subject_patterns: ["services/{service}/**"],
				claim_ceiling: "image identity; a promotion event",
				issuance_window: window,
			},
			{
				id: "verifier.repro",
				key_label: "synthetic-repro-empty",
				keyids: [],
				threshold: 1,
				predicate_types: [REPRODUCIBILITY_RESULT_PREDICATE_TYPE],
				subject_patterns: ["software/**"],
				claim_ceiling:
					"a named verifier reran a specified recipe and obtained this match/mismatch",
				issuance_window: window,
			},
			{
				id: "verifier.audit",
				key_label: "synthetic-audit",
				keyids: [auditKey.keyId],
				threshold: 1,
				predicate_types: [AUDIT_RESULT_PREDICATE_TYPE],
				subject_patterns: ["**"],
				claim_ceiling: "the named verifier ran the declared checks",
				issuance_window: window,
			},
			{
				id: "appraiser.runtime",
				key_label: "synthetic-runtime-empty",
				keyids: [],
				threshold: 1,
				predicate_types: [RUNTIME_ATTESTATION_PREDICATE_TYPE],
				subject_patterns: ["services/{service}/instances/**"],
				claim_ceiling: "an appraiser verified this measurement at this time",
				issuance_window: window,
			},
			{
				id: "key-events",
				key_label: "root-quorum-no-standing-dsse-key",
				keyids: [],
				threshold: 1,
				predicate_types: [KEY_EVENT_PREDICATE_TYPE],
				subject_patterns: ["keys/**"],
				claim_ceiling: "key lifecycle facts under the root policy",
				issuance_window: window,
			},
		],
		evaluation_rules: {
			unrecognized_predicate: "unrecognized-predicate",
			unknown_key: "unknown-key",
			role_not_authorized: "role-not-authorized",
			threshold_unmet: "threshold-unmet",
			outside_issuance_window: "outside-issuance-window",
		},
	};
}

export async function loadedPolicy(
	releaseKey: Ed25519SigningKey,
	auditKey: Ed25519SigningKey,
	policy = basePolicy(releaseKey, auditKey),
	extraEvidenceKeys: Readonly<Record<string, unknown>> = {},
): Promise<LoadedDsseAuthorizationPolicy> {
	const bytes = await canonicalBytes(policy);
	const loaded = await loadDsseAuthorizationPolicy({
		bytes,
		now: NOW,
		evidenceKeys: {
			[releaseKey.keyId]: releaseKey.keyObject,
			[auditKey.keyId]: auditKey.keyObject,
			...extraEvidenceKeys,
		},
		tufRoleKeyids: new Set(),
	});
	if (!loaded.ok)
		throw new Error(`synthetic policy load failed: ${loaded.reason}`);
	return loaded.value;
}

export async function migrationPredicate(): Promise<{
	predicate: MigrationManifestPredicate;
	subjectBytes: Uint8Array;
	objectBytes: Uint8Array;
}> {
	const objectBytes = new TextEncoder().encode("legacy object");
	const object = {
		url: "https://transparency.solstone.app/releases/solstone-legacy-corpus/v/1/object.txt",
		length: objectBytes.byteLength,
		sha256: await sha256(objectBytes),
	};
	const subjectBytes = new TextEncoder().encode(
		`${object.url}\n${object.length}\n${object.sha256}\n`,
	);
	const digest = await sha256(subjectBytes);
	return {
		predicate: {
			_comment: ["synthetic migration manifest"],
			schema: MIGRATION_MANIFEST_SCHEMA,
			verification_contract: {
				v1_algorithm: "minisign",
				v1_public_key:
					"https://transparency.solstone.app/releases/keys/synthetic.pub",
				note: "Synthetic fixture only.",
			},
			corpus_sha256: digest,
			object_count: 1,
			products: [
				{
					product: "legacy-corpus",
					chain_length: 1,
					chain_tip_version: "1",
					declared_gap_versions: [],
					object_count: 1,
					corpus_sha256: digest,
				},
			],
			objects: [object],
		},
		subjectBytes,
		objectBytes,
	};
}

export async function signedEnvelope(
	statement: TufJsonValue,
	keys: readonly Ed25519SigningKey[],
	payloadType = IN_TOTO_PAYLOAD_TYPE,
): Promise<EvidenceRecord["envelope"]> {
	const payload = await canonicalBytes(statement);
	const preimage = dssePreAuthenticationEncoding(
		new TextEncoder().encode(payloadType),
		payload,
	);
	const signatures = [];
	for (const key of keys) {
		const signature = await signEd25519(key.privateKey, preimage);
		if (!signature.ok)
			throw new Error(`synthetic signing failed: ${signature.reason}`);
		signatures.push({
			keyid: key.keyId,
			sig: encodeDsseBase64(signature.value),
		});
	}
	return { payloadType, payload: encodeDsseBase64(payload), signatures };
}

export async function signedMigrationRecord(
	policy: LoadedDsseAuthorizationPolicy,
	key: Ed25519SigningKey,
	predicate?: MigrationManifestPredicate,
	issuedAt = ISSUED_AT,
): Promise<{
	record: EvidenceRecord;
	subjectBytes: Uint8Array;
	objectBytes: Uint8Array;
	predicate: MigrationManifestPredicate;
}> {
	const fixture =
		predicate === undefined
			? await migrationPredicate()
			: {
					predicate,
					subjectBytes: new Uint8Array(),
					objectBytes: new Uint8Array(),
				};
	const statement: TufJsonValue = {
		_type: IN_TOTO_STATEMENT_V1,
		subject: [
			{
				name: "software/legacy-corpus/v1",
				digest: { sha256: fixture.predicate.corpus_sha256 },
			},
		],
		predicateType: MIGRATION_MANIFEST_PREDICATE_TYPE,
		predicate: fixture.predicate as unknown as TufJsonValue,
	};
	return {
		record: {
			schema: EVIDENCE_RECORD_SCHEMA,
			policy_sha256: policy.sha256,
			issued_at: issuedAt,
			envelope: await signedEnvelope(statement, [key]),
		},
		subjectBytes: fixture.subjectBytes,
		objectBytes: fixture.objectBytes,
		predicate: fixture.predicate,
	};
}
