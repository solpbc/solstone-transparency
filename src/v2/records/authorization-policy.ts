// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Founder-approved DSSE authorization-policy loading and evaluation.
 *
 * Signature classification is deliberately three-way: a key absent from every
 * policy role is unknown-key; a verified role key outside this claim is
 * role-not-authorized; and distinct verified authorized keys below threshold are
 * threshold-unmet. Keeping these apart prevents a missing authorization from
 * looking like an authorized signer shortage.
 */

import { admitTufJson } from "../tuf/admission";
import { computeKeyId } from "../tuf/ed25519";
import { type TufJsonValue, type TufResult, rejection } from "../tuf/outcome";
import type { VerifiedDsseSignature } from "./dsse";
import type { InTotoSubject } from "./statement";

export interface IssuanceWindow {
	not_before: string;
	not_after: string;
}

export interface DsseAuthorizationRole {
	id: string;
	key_label: string;
	keyids: readonly string[];
	threshold: number;
	predicate_types: readonly string[];
	subject_patterns: readonly string[];
	claim_ceiling: string;
	issuance_window: IssuanceWindow;
	revoked_at?: string;
	compromised?: boolean;
}

export interface DsseEvaluationRules {
	unrecognized_predicate: "unrecognized-predicate";
	unknown_key: "unknown-key";
	role_not_authorized: "role-not-authorized";
	threshold_unmet: "threshold-unmet";
	outside_issuance_window: "outside-issuance-window";
}

export interface DsseAuthorizationPolicy {
	version: number;
	effective_from: string;
	roles: readonly DsseAuthorizationRole[];
	evaluation_rules: DsseEvaluationRules;
}

export interface DssePolicyLoadInput {
	bytes: Uint8Array;
	now: Date;
	trustedVersion?: number;
	evidenceKeys: Readonly<Record<string, unknown>>;
	tufRoleKeyids: ReadonlySet<string>;
}

export interface LoadedDsseAuthorizationPolicy {
	policy: DsseAuthorizationPolicy;
	sha256: string;
	keyMap: Readonly<Record<string, unknown>>;
}

export interface DssePolicyAuthorizationInput {
	policy: LoadedDsseAuthorizationPolicy;
	predicateType: string;
	subjects: readonly InTotoSubject[];
	issuedAt: string;
	verifiedSignatures: readonly VerifiedDsseSignature[];
}

export interface DssePolicyAuthorization {
	role: DsseAuthorizationRole;
	satisfyingKeyids: readonly string[];
	compromised: boolean;
}

const EXPECTED_EVALUATION_RULES: DsseEvaluationRules = {
	unrecognized_predicate: "unrecognized-predicate",
	unknown_key: "unknown-key",
	role_not_authorized: "role-not-authorized",
	threshold_unmet: "threshold-unmet",
	outside_issuance_window: "outside-issuance-window",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function malformed(
	path: readonly string[],
	expected: string,
	observed: unknown,
) {
	return rejection("malformed", { path, expected, observed });
}

function canonicalInstant(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const milliseconds = Date.parse(value);
	return (
		Number.isFinite(milliseconds) &&
		new Date(milliseconds).toISOString() === value
	);
}

function validKeyId(value: string): boolean {
	return /^[0-9a-f]{64}$/.test(value);
}

function validPredicateType(value: string): boolean {
	return (
		value.length > 0 &&
		!/[?*\[\]{}]/.test(value) &&
		/^https:\/\/transparency\.solstone\.app\/predicates\/v1\/[a-z0-9-]+$/.test(
			value,
		)
	);
}

function validSubjectPattern(value: string): boolean {
	if (value === "**") return true;
	const parts = value.split("/");
	return (
		parts.length > 0 &&
		parts.every((part, index) => {
			if (part === "**") return index === parts.length - 1;
			if (/^\{[a-z]+\}$/.test(part)) return true;
			return /^[A-Za-z0-9._-]+$/.test(part);
		}) &&
		parts.at(-1) === "**"
	);
}

function parseStringArray(
	value: unknown,
	path: readonly string[],
): TufResult<readonly string[]> {
	if (
		!Array.isArray(value) ||
		value.some((entry) => typeof entry !== "string")
	) {
		return malformed(path, "an array of strings", typeName(value));
	}
	return { ok: true, value: value as string[] };
}

function parseWindow(
	value: unknown,
	path: readonly string[],
): TufResult<IssuanceWindow> {
	if (
		!isRecord(value) ||
		!canonicalInstant(value.not_before) ||
		!canonicalInstant(value.not_after)
	) {
		return malformed(
			path,
			"canonical not_before and not_after instants",
			value,
		);
	}
	if (Date.parse(value.not_before) > Date.parse(value.not_after)) {
		return malformed(path, "not_before no later than not_after", value);
	}
	return {
		ok: true,
		value: { not_before: value.not_before, not_after: value.not_after },
	};
}

function parseRole(
	value: unknown,
	index: number,
): TufResult<DsseAuthorizationRole> {
	const path = ["roles", String(index)];
	if (!isRecord(value))
		return malformed(path, "a policy role object", typeName(value));
	if (typeof value.id !== "string" || value.id.length === 0)
		return malformed([...path, "id"], "a non-empty role id", value.id);
	if (typeof value.key_label !== "string")
		return malformed(
			[...path, "key_label"],
			"a key label string",
			value.key_label,
		);
	if (
		typeof value.threshold !== "number" ||
		!Number.isInteger(value.threshold) ||
		value.threshold < 1
	) {
		return rejection("degenerate-role-configuration", {
			path: [...path, "threshold"],
			expected: "an integer threshold >= 1",
			observed: value.threshold,
		});
	}
	if (typeof value.claim_ceiling !== "string")
		return malformed(
			[...path, "claim_ceiling"],
			"a claim ceiling string",
			value.claim_ceiling,
		);
	const keyids = parseStringArray(value.keyids, [...path, "keyids"]);
	if (!keyids.ok) return keyids;
	if (
		keyids.value.some((keyid) => !validKeyId(keyid)) ||
		new Set(keyids.value).size !== keyids.value.length
	) {
		return rejection("degenerate-role-configuration", {
			path: [...path, "keyids"],
			expected: "distinct lowercase SHA-256 key IDs",
			observed: keyids.value,
		});
	}
	if (keyids.value.length > 0 && value.threshold > keyids.value.length) {
		return rejection("degenerate-role-configuration", {
			path: [...path, "threshold"],
			expected: "a threshold no greater than non-empty keyids length",
			observed: { threshold: value.threshold, keyids: keyids.value.length },
		});
	}
	const predicateTypes = parseStringArray(value.predicate_types, [
		...path,
		"predicate_types",
	]);
	if (!predicateTypes.ok) return predicateTypes;
	if (
		predicateTypes.value.length === 0 ||
		predicateTypes.value.some((type) => !validPredicateType(type))
	) {
		return malformed(
			[...path, "predicate_types"],
			"a non-empty list of exact, non-wildcard predicate URIs",
			predicateTypes.value,
		);
	}
	const subjectPatterns = parseStringArray(value.subject_patterns, [
		...path,
		"subject_patterns",
	]);
	if (!subjectPatterns.ok) return subjectPatterns;
	if (
		subjectPatterns.value.length === 0 ||
		subjectPatterns.value.some((pattern) => !validSubjectPattern(pattern))
	) {
		return malformed(
			[...path, "subject_patterns"],
			"approved terminal-** subject patterns",
			subjectPatterns.value,
		);
	}
	const window = parseWindow(value.issuance_window, [
		...path,
		"issuance_window",
	]);
	if (!window.ok) return window;
	if (value.revoked_at !== undefined && !canonicalInstant(value.revoked_at))
		return malformed(
			[...path, "revoked_at"],
			"a canonical optional instant",
			value.revoked_at,
		);
	if (value.compromised !== undefined && typeof value.compromised !== "boolean")
		return malformed(
			[...path, "compromised"],
			"an optional boolean",
			value.compromised,
		);
	return {
		ok: true,
		value: {
			id: value.id,
			key_label: value.key_label,
			keyids: keyids.value,
			threshold: value.threshold,
			predicate_types: predicateTypes.value,
			subject_patterns: subjectPatterns.value,
			claim_ceiling: value.claim_ceiling,
			issuance_window: window.value,
			revoked_at: value.revoked_at,
			compromised: value.compromised,
		},
	};
}

function parseRules(value: unknown): TufResult<DsseEvaluationRules> {
	if (!isRecord(value))
		return malformed(
			["evaluation_rules"],
			"the CSO reason mapping",
			typeName(value),
		);
	for (const [key, expected] of Object.entries(EXPECTED_EVALUATION_RULES)) {
		if (value[key] !== expected) {
			return malformed(["evaluation_rules", key], expected, value[key]);
		}
	}
	return { ok: true, value: { ...EXPECTED_EVALUATION_RULES } };
}

function parsePolicy(value: TufJsonValue): TufResult<DsseAuthorizationPolicy> {
	if (!isRecord(value))
		return malformed([], "an authorization policy object", typeName(value));
	if (
		typeof value.version !== "number" ||
		!Number.isInteger(value.version) ||
		value.version < 1
	)
		return malformed(["version"], "a positive integer version", value.version);
	if (!canonicalInstant(value.effective_from))
		return malformed(
			["effective_from"],
			"a canonical effective_from instant",
			value.effective_from,
		);
	if (!Array.isArray(value.roles) || value.roles.length !== 6)
		return malformed(
			["roles"],
			"the six founder-approved policy roles",
			value.roles,
		);
	const roles: DsseAuthorizationRole[] = [];
	for (const [index, candidate] of value.roles.entries()) {
		const role = parseRole(candidate, index);
		if (!role.ok) return role;
		roles.push(role.value);
	}
	if (new Set(roles.map((role) => role.id)).size !== roles.length) {
		return rejection("degenerate-role-configuration", {
			path: ["roles"],
			expected: "distinct policy role IDs",
			observed: roles.map((role) => role.id),
		});
	}
	const rules = parseRules(value.evaluation_rules);
	if (!rules.ok) return rules;
	return {
		ok: true,
		value: {
			version: value.version,
			effective_from: value.effective_from,
			roles,
			evaluation_rules: rules.value,
		},
	};
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function roleClass(
	role: DsseAuthorizationRole,
): "producer" | "independent" | "other" {
	if (role.id.startsWith("producer.")) return "producer";
	if (role.id.startsWith("verifier.") || role.id.startsWith("appraiser."))
		return "independent";
	return "other";
}

/** Loads policy bytes and rejects cross-namespace or producer/independent key reuse. */
export async function loadDsseAuthorizationPolicy(
	input: DssePolicyLoadInput,
): Promise<TufResult<LoadedDsseAuthorizationPolicy>> {
	const admitted = admitTufJson(input.bytes);
	if (!admitted.ok) return admitted;
	const policy = parsePolicy(admitted.value);
	if (!policy.ok) return policy;
	if (
		input.trustedVersion !== undefined &&
		policy.value.version <= input.trustedVersion
	) {
		return rejection("version-rollback", {
			path: ["version"],
			expected: `a version greater than ${input.trustedVersion}`,
			observed: policy.value.version,
		});
	}
	if (Date.parse(policy.value.effective_from) > input.now.getTime()) {
		// Deliberate reuse: this is policy activation time, not record issuance time.
		return rejection("outside-issuance-window", {
			path: ["effective_from"],
			expected: `an instant no later than ${input.now.toISOString()}`,
			observed: policy.value.effective_from,
		});
	}
	const producerKeys = new Set<string>();
	const independentKeys = new Set<string>();
	const keyMap: Record<string, unknown> = {};
	for (const role of policy.value.roles) {
		for (const keyid of role.keyids) {
			const classification = roleClass(role);
			if (classification === "producer") producerKeys.add(keyid);
			if (classification === "independent") independentKeys.add(keyid);
			if (input.tufRoleKeyids.has(keyid)) {
				return rejection("degenerate-role-configuration", {
					path: ["roles", role.id, "keyids"],
					expected: "a DSSE key ID disjoint from every TUF role key ID",
					observed: keyid,
					rule: "dsse-tuf-keyid-disjointness",
				});
			}
			const keyObject = input.evidenceKeys[keyid];
			if (keyObject === undefined) {
				return rejection("dangling-keyid", {
					path: ["roles", role.id, "keyids"],
					expected: "a supplied evidence public key",
					observed: keyid,
				});
			}
			const computed = await computeKeyId(keyObject);
			if (!computed.ok) return computed;
			if (computed.value !== keyid) {
				return rejection("keyid-mismatch", {
					path: ["roles", role.id, "keyids"],
					expected: keyid,
					observed: computed.value,
				});
			}
			keyMap[keyid] = keyObject;
		}
	}
	for (const keyid of producerKeys) {
		if (independentKeys.has(keyid)) {
			return rejection("degenerate-role-configuration", {
				path: ["roles"],
				expected: "producer key IDs disjoint from verifier/appraiser key IDs",
				observed: keyid,
				rule: "producer-independent-keyid-disjointness",
			});
		}
	}
	const digest = bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(input.bytes)),
		),
	);
	return { ok: true, value: { policy: policy.value, sha256: digest, keyMap } };
}

function matchesSubjectPattern(pattern: string, name: string): boolean {
	if (pattern === "**") return true;
	const patternParts = pattern.split("/");
	const nameParts = name.split("/");
	for (let index = 0; index < patternParts.length; index++) {
		const patternPart = patternParts[index];
		if (patternPart === undefined) return false;
		if (patternPart === "**") return true;
		const namePart = nameParts[index];
		if (namePart === undefined) return false;
		if (/^\{[a-z]+\}$/.test(patternPart)) continue;
		if (patternPart !== namePart) return false;
	}
	return patternParts.length === nameParts.length;
}

function roleMatchesClaim(
	role: DsseAuthorizationRole,
	predicateType: string,
	subjects: readonly InTotoSubject[],
): boolean {
	return (
		role.predicate_types.includes(predicateType) &&
		subjects.every((subject) =>
			role.subject_patterns.some((pattern) =>
				matchesSubjectPattern(pattern, subject.name),
			),
		)
	);
}

/** Evaluates the three-way DSSE policy classification after crypto has completed. */
export function evaluateDssePolicyAuthorization(
	input: DssePolicyAuthorizationInput,
): TufResult<DssePolicyAuthorization> {
	const issuedAt = Date.parse(input.issuedAt);
	if (!canonicalInstant(input.issuedAt))
		return malformed(
			["issued_at"],
			"a canonical record issuance instant",
			input.issuedAt,
		);
	const verifiedKeyids = new Set(
		input.verifiedSignatures
			.filter((signature) => signature.state === "verified")
			.map((signature) => signature.keyid),
	);
	const matching = input.policy.policy.roles.filter((role) =>
		roleMatchesClaim(role, input.predicateType, input.subjects),
	);
	if (matching.length === 0) {
		return rejection("role-not-authorized", {
			path: ["predicateType"],
			expected: "a policy role authorized for this predicate and subjects",
			observed: {
				predicateType: input.predicateType,
				subjects: input.subjects.map((subject) => subject.name),
			},
		});
	}
	const inWindow = matching.filter((role) => {
		const start = Date.parse(role.issuance_window.not_before);
		const end = Date.parse(role.issuance_window.not_after);
		return issuedAt >= start && issuedAt <= end;
	});
	if (inWindow.length === 0) {
		// Deliberate reuse: this is record issuance time, unlike policy effective_from above.
		return rejection("outside-issuance-window", {
			path: ["issued_at"],
			expected: matching.map((role) => role.issuance_window),
			observed: input.issuedAt,
		});
	}
	const active = inWindow.filter(
		(role) =>
			role.revoked_at === undefined || issuedAt < Date.parse(role.revoked_at),
	);
	if (active.length === 0) {
		return rejection("role-not-authorized", {
			path: ["issued_at"],
			expected: "an issuance instant before the role revocation",
			observed: input.issuedAt,
		});
	}
	const authorizedKeyids = new Set(
		active
			.flatMap((role) => role.keyids)
			.filter((keyid) => verifiedKeyids.has(keyid)),
	);
	if (verifiedKeyids.size > 0 && authorizedKeyids.size === 0) {
		return rejection("role-not-authorized", {
			path: ["signatures"],
			expected: "a verified key authorized by a role matching this claim",
			observed: [...verifiedKeyids],
		});
	}
	for (const role of active) {
		const satisfyingKeyids = [...verifiedKeyids].filter((keyid) =>
			role.keyids.includes(keyid),
		);
		if (satisfyingKeyids.length >= role.threshold) {
			return {
				ok: true,
				value: {
					role,
					satisfyingKeyids,
					compromised: role.compromised === true,
				},
			};
		}
	}
	return rejection("threshold-unmet", {
		path: ["signatures"],
		expected: active.map((role) => ({
			role: role.id,
			threshold: role.threshold,
		})),
		observed: verifiedKeyids.size,
	});
}
