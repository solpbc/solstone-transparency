// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * TUF-targeted evidence-record orchestration. The outer target binds policy and
 * issuance facts; DSSE authenticates the exact in-toto Statement payload.
 */

import { admitTufJson } from "../tuf/admission";
import {
	type TufFailureDetail,
	type TufRejectionReason,
	type TufResult,
	rejection,
} from "../tuf/outcome";
import {
	type DsseAuthorizationRole,
	type LoadedDsseAuthorizationPolicy,
	evaluateDssePolicyAuthorization,
} from "./authorization-policy";
import {
	type DsseEnvelope,
	IN_TOTO_PAYLOAD_TYPE,
	parseDsseEnvelopeValue,
	verifyDsseEnvelope,
} from "./dsse";
import {
	type MigrationObjectFetcher,
	walkMigrationManifest,
} from "./migration-manifest";
import {
	type KnownPredicate,
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	validateKnownPredicate,
} from "./predicates";
import {
	type InTotoStatementV1,
	parseInTotoStatementV1,
	verifyStatementSubjects,
} from "./statement";

export const EVIDENCE_RECORD_SCHEMA =
	"solstone-transparency/evidence-record/v1";

export interface EvidenceRecord {
	schema: typeof EVIDENCE_RECORD_SCHEMA;
	policy_sha256: string;
	issued_at: string;
	envelope: DsseEnvelope;
}

export interface VerifyEvidenceRecordInput {
	record: EvidenceRecord;
	policy?: LoadedDsseAuthorizationPolicy;
	subjectBytes: ReadonlyMap<string, Uint8Array>;
	migrationFetcher?: MigrationObjectFetcher;
}

export type EvidenceVerificationResult =
	| {
			state: "accepted";
			statement: InTotoStatementV1;
			predicate: KnownPredicate;
			role: DsseAuthorizationRole;
			satisfyingKeyids: readonly string[];
	  }
	| {
			state: "suspect";
			requiresReattestation: true;
			statement: InTotoStatementV1;
			predicate: KnownPredicate;
			role: DsseAuthorizationRole;
			satisfyingKeyids: readonly string[];
	  }
	| {
			state: "rejected";
			reason: TufRejectionReason;
			detail: TufFailureDetail;
	  };

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function canonicalInstant(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const milliseconds = Date.parse(value);
	return (
		Number.isFinite(milliseconds) &&
		new Date(milliseconds).toISOString() === value
	);
}

function rejected(result: {
	reason: TufRejectionReason;
	detail: TufFailureDetail;
}): EvidenceVerificationResult {
	return { state: "rejected", reason: result.reason, detail: result.detail };
}

function malformed(
	path: readonly string[],
	expected: string,
	observed: unknown,
): TufResult<never> {
	return rejection("malformed", { path, expected, observed });
}

export function parseEvidenceRecord(
	bytes: Uint8Array,
): TufResult<EvidenceRecord> {
	const admitted = admitTufJson(bytes);
	if (!admitted.ok) return admitted;
	if (!isRecord(admitted.value))
		return malformed([], "an evidence-record object", typeName(admitted.value));
	const value = admitted.value;
	if (value.schema !== EVIDENCE_RECORD_SCHEMA)
		return malformed(["schema"], EVIDENCE_RECORD_SCHEMA, value.schema);
	if (
		typeof value.policy_sha256 !== "string" ||
		!/^[0-9a-f]{64}$/.test(value.policy_sha256)
	)
		return malformed(
			["policy_sha256"],
			"a lowercase SHA-256 digest",
			value.policy_sha256,
		);
	if (!canonicalInstant(value.issued_at))
		return malformed(
			["issued_at"],
			"a canonical issuance instant",
			value.issued_at,
		);
	const envelope = parseDsseEnvelopeValue(value.envelope);
	if (!envelope.ok) return envelope;
	return {
		ok: true,
		value: {
			schema: EVIDENCE_RECORD_SCHEMA,
			policy_sha256: value.policy_sha256,
			issued_at: value.issued_at,
			envelope: envelope.value,
		},
	};
}

/**
 * Crypto intentionally happens before Statement/predicate parsing. A malformed or
 * unrecognized assertion must not hide a signature-invalid envelope (AC 13).
 */
export async function verifyEvidenceRecord(
	input: VerifyEvidenceRecordInput,
): Promise<EvidenceVerificationResult> {
	const policy = input.policy;
	if (policy === undefined) {
		return rejected(
			rejection("unavailable", {
				path: ["policy_sha256"],
				expected: "the exact bound authorization policy",
				observed: input.record.policy_sha256,
			}),
		);
	}
	if (policy.sha256 !== input.record.policy_sha256) {
		return rejected(
			rejection("hash-mismatch", {
				path: ["policy_sha256"],
				expected: input.record.policy_sha256,
				observed: policy.sha256,
			}),
		);
	}
	const envelope = await verifyDsseEnvelope({
		envelope: input.record.envelope,
		expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
		keys: policy.keyMap,
	});
	if (!envelope.ok) return rejected(envelope);
	const unknownKey = envelope.value.verifiedSignatures.find(
		(signature) => signature.state === "key-unavailable",
	);
	if (unknownKey !== undefined) {
		return rejected(
			rejection("unknown-key", {
				path: ["signatures", "keyid"],
				expected: "a key ID appearing in a loaded policy role",
				observed: unknownKey.keyid,
			}),
		);
	}
	const statement = parseInTotoStatementV1(envelope.value.payload);
	if (!statement.ok) return rejected(statement);
	const predicate = await validateKnownPredicate(
		statement.value.predicateType,
		statement.value.predicate,
	);
	if (!predicate.ok) return rejected(predicate);
	const authorized = evaluateDssePolicyAuthorization({
		policy,
		predicateType: statement.value.predicateType,
		subjects: statement.value.subject,
		issuedAt: input.record.issued_at,
		verifiedSignatures: envelope.value.verifiedSignatures,
	});
	if (!authorized.ok) return rejected(authorized);
	const subjects = await verifyStatementSubjects(
		statement.value,
		input.subjectBytes,
	);
	if (!subjects.ok) return rejected(subjects);
	if (predicate.value.type === MIGRATION_MANIFEST_PREDICATE_TYPE) {
		// Fail closed: this predicate's evidence claim is incomplete until its objects walk.
		if (input.migrationFetcher === undefined) {
			return rejected(
				rejection("unavailable", {
					path: ["migrationFetcher"],
					expected: "a fetcher for migration-manifest object verification",
					observed: "missing",
				}),
			);
		}
		const walked = await walkMigrationManifest(
			predicate.value.body,
			input.migrationFetcher,
		);
		if (!walked.verdict.ok) return rejected(walked.verdict);
	}
	if (authorized.value.compromised) {
		return {
			state: "suspect",
			requiresReattestation: true,
			statement: statement.value,
			predicate: predicate.value,
			role: authorized.value.role,
			satisfyingKeyids: authorized.value.satisfyingKeyids,
		};
	}
	return {
		state: "accepted",
		statement: statement.value,
		predicate: predicate.value,
		role: authorized.value.role,
		satisfyingKeyids: authorized.value.satisfyingKeyids,
	};
}
