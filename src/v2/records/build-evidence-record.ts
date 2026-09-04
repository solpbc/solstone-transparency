// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * DSSE evidence record construction and Ed25519 envelope signing.
 * Assembles in-toto Statement v1 payloads, signs with caller-supplied keys, and wraps into EvidenceRecord.
 */

import { canonicalizeTufJson } from "../tuf/canonical";
import { type Ed25519SigningKey, signEd25519 } from "../tuf/ed25519";
import type { TufJsonValue, TufResult } from "../tuf/outcome";
import {
	IN_TOTO_PAYLOAD_TYPE,
	dssePreAuthenticationEncoding,
	encodeDsseBase64,
} from "./dsse";
import { EVIDENCE_RECORD_SCHEMA, type EvidenceRecord } from "./record";
import { IN_TOTO_STATEMENT_V1 } from "./statement";

export interface BuildEvidenceRecordInput {
	predicateType: string;
	predicate: TufJsonValue;
	subjectName: string;
	subjectSha256: string;
	/**
	 * Placeholder policy SHA-256 digest pending the next lode's real authorization-policy publication.
	 * In this lode, full record-level policy evaluation requires an out-of-band policy fixture.
	 */
	policySha256: string;
	issuedAt: string;
	signingKeys: readonly Ed25519SigningKey[];
}

/**
 * Constructs an in-toto Statement v1, computes DSSE PAE, signs across all supplied signing keys,
 * and packages the resulting envelope as an EvidenceRecord.
 */
export async function signEvidenceRecord(
	input: BuildEvidenceRecordInput,
): Promise<TufResult<EvidenceRecord>> {
	const statement: TufJsonValue = {
		_type: IN_TOTO_STATEMENT_V1,
		subject: [
			{
				name: input.subjectName,
				digest: { sha256: input.subjectSha256 },
			},
		],
		predicateType: input.predicateType,
		predicate: input.predicate,
	};

	const canonical = canonicalizeTufJson(statement);
	if (!canonical.ok) return canonical;
	const payloadBytes = canonical.value;

	const preimage = dssePreAuthenticationEncoding(
		new TextEncoder().encode(IN_TOTO_PAYLOAD_TYPE),
		payloadBytes,
	);

	const signatures: { keyid: string; sig: string }[] = [];
	for (const key of input.signingKeys) {
		const signature = await signEd25519(key.privateKey, preimage);
		if (!signature.ok) return signature;
		signatures.push({
			keyid: key.keyId,
			sig: encodeDsseBase64(signature.value),
		});
	}

	return {
		ok: true,
		value: {
			schema: EVIDENCE_RECORD_SCHEMA,
			policy_sha256: input.policySha256,
			issued_at: input.issuedAt,
			envelope: {
				payloadType: IN_TOTO_PAYLOAD_TYPE,
				payload: encodeDsseBase64(payloadBytes),
				signatures,
			},
		},
	};
}
