// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { canonicalizeTufJson } from "../tuf/canonical";
import { type Ed25519SigningKey, computeKeyId } from "../tuf/ed25519";
import { type TufJsonValue, type TufResult, rejection } from "../tuf/outcome";
import {
	type DsseAuthorizationPolicy,
	loadDsseAuthorizationPolicy,
} from "./authorization-policy";
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

export interface BuildDsseAuthorizationPolicyInput {
	version: number;
	effectiveFrom: string;
	now: Date;
	revokedAt?: string;
	producerReleaseKeys: readonly {
		keyObject: Ed25519SigningKey["keyObject"];
	}[];
	tufRoleKeyids: readonly string[];
	trustedVersion?: number;
}

export interface BuiltDsseAuthorizationPolicyTargets {
	policyLogicalPath: string;
	policyBytes: Uint8Array;
	policySha256: string;
	keysLogicalPath: string;
	keysTargetBytes: Uint8Array;
	keysTargetSha256: string;
	policy: DsseAuthorizationPolicy;
}

const POLICY_SCHEMA = "solstone-transparency/dsse-keys/v1";
const OPEN_ENDED_POLICY_INSTANT = "9999-12-31T23:59:59.999Z";

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function sha256(bytes: Uint8Array): Promise<TufResult<string>> {
	try {
		return {
			ok: true,
			value: bytesToHex(
				new Uint8Array(
					await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
				),
			),
		};
	} catch (error) {
		return rejection("malformed", {
			path: [],
			expected: "canonical DSSE policy bytes accepted by SHA-256",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}

function policyRole(
	input: BuildDsseAuthorizationPolicyInput,
	role: Omit<DsseAuthorizationPolicy["roles"][number], "revoked_at">,
) {
	return input.revokedAt === undefined
		? role
		: { ...role, revoked_at: input.revokedAt };
}

/** Builds canonical policy and public-key targets for the fixed DSSE role roster. */
export async function buildDsseAuthorizationPolicyTargets(
	input: BuildDsseAuthorizationPolicyInput,
): Promise<TufResult<BuiltDsseAuthorizationPolicyTargets>> {
	if (input.producerReleaseKeys.length === 0) {
		return rejection("degenerate-role-configuration", {
			path: ["roles", "producer.release", "keyids"],
			expected: "at least one producer.release public key",
			observed: 0,
		});
	}
	const producerKeyids: string[] = [];
	const evidenceKeys: Record<string, Ed25519SigningKey["keyObject"]> = {};
	for (const producerKey of input.producerReleaseKeys) {
		const keyid = await computeKeyId(producerKey.keyObject);
		if (!keyid.ok) return keyid;
		producerKeyids.push(keyid.value);
		evidenceKeys[keyid.value] = producerKey.keyObject;
	}

	const window = {
		not_before: input.effectiveFrom,
		not_after: OPEN_ENDED_POLICY_INSTANT,
	};
	const policy: DsseAuthorizationPolicy = {
		version: input.version,
		effective_from: input.effectiveFrom,
		roles: [
			policyRole(input, {
				id: "producer.release",
				key_label: "producer-release",
				keyids: producerKeyids,
				threshold: Math.max(1, producerKeyids.length),
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
			}),
			policyRole(input, {
				id: "producer.image",
				key_label: "producer-image",
				keyids: [],
				threshold: 1,
				predicate_types: [
					IMAGE_BUILD_PREDICATE_TYPE,
					DEPLOYMENT_PREDICATE_TYPE,
				],
				subject_patterns: ["services/{service}/**"],
				claim_ceiling: "image identity; a promotion event",
				issuance_window: window,
			}),
			policyRole(input, {
				id: "verifier.repro",
				key_label: "verifier-repro",
				keyids: [],
				threshold: 1,
				predicate_types: [REPRODUCIBILITY_RESULT_PREDICATE_TYPE],
				subject_patterns: ["software/**"],
				claim_ceiling:
					"a named verifier reran a specified recipe and obtained this match/mismatch",
				issuance_window: window,
			}),
			policyRole(input, {
				id: "verifier.audit",
				key_label: "verifier-audit",
				keyids: [],
				threshold: 1,
				predicate_types: [AUDIT_RESULT_PREDICATE_TYPE],
				subject_patterns: ["**"],
				claim_ceiling: "the named verifier ran the declared checks",
				issuance_window: window,
			}),
			policyRole(input, {
				id: "appraiser.runtime",
				key_label: "appraiser-runtime",
				keyids: [],
				threshold: 1,
				predicate_types: [RUNTIME_ATTESTATION_PREDICATE_TYPE],
				subject_patterns: ["services/{service}/instances/**"],
				claim_ceiling: "an appraiser verified this measurement at this time",
				issuance_window: window,
			}),
			policyRole(input, {
				id: "key-events",
				key_label: "key-events",
				keyids: [],
				threshold: 1,
				predicate_types: [KEY_EVENT_PREDICATE_TYPE],
				subject_patterns: ["keys/**"],
				claim_ceiling: "key lifecycle facts under the root policy",
				issuance_window: window,
			}),
		],
		evaluation_rules: {
			unrecognized_predicate: "unrecognized-predicate",
			unknown_key: "unknown-key",
			role_not_authorized: "role-not-authorized",
			threshold_unmet: "threshold-unmet",
			outside_issuance_window: "outside-issuance-window",
		},
	};
	const policyBytes = canonicalizeTufJson(policy as unknown as TufJsonValue);
	if (!policyBytes.ok) return policyBytes;
	const keysTarget = { schema: POLICY_SCHEMA, keys: evidenceKeys };
	const keysTargetBytes = canonicalizeTufJson(
		keysTarget as unknown as TufJsonValue,
	);
	if (!keysTargetBytes.ok) return keysTargetBytes;

	const loaded = await loadDsseAuthorizationPolicy({
		bytes: policyBytes.value,
		now: input.now,
		trustedVersion: input.trustedVersion,
		evidenceKeys,
		tufRoleKeyids: new Set(input.tufRoleKeyids),
	});
	if (!loaded.ok) return loaded;
	const policySha256 = await sha256(policyBytes.value);
	if (!policySha256.ok) return policySha256;
	const keysTargetSha256 = await sha256(keysTargetBytes.value);
	if (!keysTargetSha256.ok) return keysTargetSha256;
	return {
		ok: true,
		value: {
			policyLogicalPath: `policy/dsse-authorization/${input.version}.json`,
			policyBytes: policyBytes.value,
			policySha256: policySha256.value,
			keysLogicalPath: `keys/dsse/${input.version}.json`,
			keysTargetBytes: keysTargetBytes.value,
			keysTargetSha256: keysTargetSha256.value,
			policy: loaded.value.policy,
		},
	};
}
