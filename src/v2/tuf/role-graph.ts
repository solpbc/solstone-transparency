// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { verifyEd25519Signature } from "./ed25519";
import { type TufResult, rejection } from "./outcome";
import { DELEGATED_ROLES, TOP_LEVEL_ONLY_PREFIXES } from "./role-config";

/** Resolver safety bound, not CSO role-policy data. Top-level targets is depth zero. */
export const MAX_DELEGATION_DEPTH = 8;

/** The finite, mandatory policy for one raw target-path segment. */
export const TARGET_PATH_ALLOW_SET: readonly RegExp[] = [/^[A-Za-z0-9._-]+$/];

export interface TargetPathPolicy {
	segmentAllowSet: readonly RegExp[];
}

export const DEFAULT_TARGET_PATH_POLICY: TargetPathPolicy = {
	segmentAllowSet: TARGET_PATH_ALLOW_SET,
};

/**
 * This intentionally refines TOP_LEVEL_ONLY_PREFIXES. The CSO design, "and what
 * is deliberately NOT delegated" (lines 177-202), gives policy/ and keys/ to
 * top-level targets but leaves commitments/ claimable by no role at Wave 2.
 */
export const TOP_LEVEL_TARGETS_PREFIXES: readonly string[] = [
	"policy/",
	"keys/",
];
export const UNCLAIMABLE_PREFIXES: readonly string[] = ["commitments/"];

export interface TufRole {
	keyids: readonly string[];
	threshold: number;
}

export interface TufDelegationRole extends TufRole {
	name: string;
	paths: readonly string[];
	terminating: boolean;
}

/** The signed delegation fields needed for target-path resolution. */
export interface DelegationAuthority {
	name: string;
	pathPrefix: string;
	terminating: boolean;
}

export interface TufSignature {
	keyid: string;
	sig: string;
}

export interface RoleAuthorizationInput {
	role: TufRole;
	keys: Readonly<Record<string, unknown>>;
	signatures: readonly TufSignature[];
	message: Uint8Array;
}

export type MetadataRoleKind = "root" | "timestamp" | "snapshot" | "targets";

export type DelegationResolution =
	| {
			kind: "not-consulted";
			targetPath: string;
			authority: "top-level" | "none";
	  }
	| {
			kind: "consulted";
			targetPath: string;
			role: DelegationAuthority;
			outcome: "accepted" | "declined";
	  };

const RESERVED_TOP_LEVEL_ROLE_NAMES = new Set([
	"root",
	"targets",
	"snapshot",
	"timestamp",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function hasEncodedTraversalOrSeparator(value: string): boolean {
	return /%(?:2f|5c|2e%2e)/i.test(value);
}

function hexToBytes(hex: string): Uint8Array | undefined {
	if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) return undefined;
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

export function validateTargetPathPolicy(
	policy: TargetPathPolicy | undefined,
): TufResult<TargetPathPolicy> {
	if (
		policy === undefined ||
		!Array.isArray(policy.segmentAllowSet) ||
		policy.segmentAllowSet.length === 0
	) {
		return rejection("unsafe-target-path", {
			path: [],
			expected: "a non-empty target-path segment allow-set",
			observed: policy === undefined ? "unset policy" : "empty allow-set",
		});
	}
	return { ok: true, value: policy };
}

/** Validates raw target text before parsing, decoding, delegation, or filename work. */
export function validateTargetPath(
	targetPath: unknown,
	policy: TargetPathPolicy = DEFAULT_TARGET_PATH_POLICY,
): TufResult<string> {
	const policyResult = validateTargetPathPolicy(policy);
	if (!policyResult.ok) return policyResult;
	if (typeof targetPath !== "string") {
		return rejection("unsafe-target-path", {
			path: [],
			expected: "a target path string",
			observed: typeName(targetPath),
		});
	}
	if (
		targetPath.length === 0 ||
		targetPath.startsWith("/") ||
		targetPath.includes("\\") ||
		targetPath.includes("://") ||
		/^[A-Za-z][A-Za-z0-9+.-]*:/.test(targetPath) ||
		hasEncodedTraversalOrSeparator(targetPath)
	) {
		return rejection("unsafe-target-path", {
			path: [],
			expected: "a relative, non-URL target path without encoded traversal",
			observed: targetPath,
		});
	}
	const segments = targetPath.split("/");
	for (const [index, segment] of segments.entries()) {
		if (
			segment.length === 0 ||
			segment === "." ||
			segment === ".." ||
			!policyResult.value.segmentAllowSet.some((allow) => allow.test(segment))
		) {
			return rejection("unsafe-target-path", {
				path: [String(index)],
				expected:
					"a non-empty segment matching the configured target-path allow-set",
				observed: segment,
			});
		}
	}
	return { ok: true, value: targetPath };
}

export function validateDelegatedRoleName(
	roleName: unknown,
): TufResult<string> {
	if (typeof roleName !== "string") {
		return rejection("degenerate-role-configuration", {
			path: ["name"],
			expected: "a delegated role name string",
			observed: typeName(roleName),
		});
	}
	const segments = roleName.split("/");
	if (
		roleName.length === 0 ||
		RESERVED_TOP_LEVEL_ROLE_NAMES.has(roleName) ||
		segments.some((segment) => segment === "." || segment === "..") ||
		hasEncodedTraversalOrSeparator(roleName)
	) {
		return rejection("degenerate-role-configuration", {
			path: ["name"],
			expected:
				"a non-top-level role name without dot segments or encoded separators",
			observed: roleName,
		});
	}
	return { ok: true, value: roleName };
}

export function validateRoleConfiguration(
	role: TufRole,
	keys: Readonly<Record<string, unknown>>,
): TufResult<undefined> {
	if (
		!Number.isInteger(role.threshold) ||
		role.threshold <= 0 ||
		role.keyids.length === 0 ||
		role.threshold > role.keyids.length
	) {
		return rejection("degenerate-role-configuration", {
			path: ["threshold"],
			expected: "a positive threshold no greater than a non-empty keyid list",
			observed: { threshold: role.threshold, keyids: role.keyids.length },
		});
	}
	const uniqueKeyIds = new Set(role.keyids);
	if (uniqueKeyIds.size !== role.keyids.length) {
		return rejection("degenerate-role-configuration", {
			path: ["keyids"],
			expected: "distinct role keyids",
			observed: [...role.keyids],
		});
	}
	for (const keyid of role.keyids) {
		if (!(keyid in keys)) {
			return rejection("dangling-keyid", {
				path: ["keyids"],
				expected: "a keyid present in the role keys map",
				observed: keyid,
			});
		}
	}
	return { ok: true, value: undefined };
}

export function validateDelegationConfiguration(
	roles: readonly TufDelegationRole[],
	keys: Readonly<Record<string, unknown>>,
): TufResult<undefined> {
	const names = new Set<string>();
	for (const role of roles) {
		const name = validateDelegatedRoleName(role.name);
		if (!name.ok) return name;
		if (names.has(role.name)) {
			return rejection("degenerate-role-configuration", {
				path: ["delegations", "roles"],
				expected: "distinct delegated role names",
				observed: role.name,
			});
		}
		names.add(role.name);
		const roleResult = validateRoleConfiguration(role, keys);
		if (!roleResult.ok) return roleResult;
	}
	return { ok: true, value: undefined };
}

/** Counts distinct, authorized, cryptographically valid role signatures. */
export async function evaluateRoleAuthorization(
	input: RoleAuthorizationInput,
): Promise<TufResult<undefined>> {
	const configured = validateRoleConfiguration(input.role, input.keys);
	if (!configured.ok) return configured;
	const authorized = new Set(input.role.keyids);
	const counted = new Set<string>();
	for (const [index, signature] of input.signatures.entries()) {
		if (
			!isRecord(signature) ||
			typeof signature.keyid !== "string" ||
			typeof signature.sig !== "string"
		) {
			return rejection("malformed", {
				path: ["signatures", String(index)],
				expected: "a signature object with string keyid and sig",
				observed: typeName(signature),
			});
		}
		if (!authorized.has(signature.keyid)) {
			return rejection("key-not-in-role", {
				path: ["signatures", String(index), "keyid"],
				expected: [...authorized],
				observed: signature.keyid,
			});
		}
		if (counted.has(signature.keyid)) continue;
		const keyObject = input.keys[signature.keyid];
		if (keyObject === undefined) {
			return rejection("dangling-keyid", {
				path: ["signatures", String(index), "keyid"],
				expected: "a keyid present in the role keys map",
				observed: signature.keyid,
			});
		}
		const signatureBytes = hexToBytes(signature.sig);
		if (signatureBytes === undefined) {
			return rejection("malformed", {
				path: ["signatures", String(index), "sig"],
				expected: "an even-length hexadecimal Ed25519 signature",
				observed: signature.sig,
			});
		}
		const verified = await verifyEd25519Signature({
			keyObject,
			expectedKeyId: signature.keyid,
			signature: signatureBytes,
			message: input.message,
		});
		if (!verified.ok) return verified;
		counted.add(signature.keyid);
	}
	if (counted.size < input.role.threshold) {
		return rejection("threshold-unmet", {
			path: ["signatures"],
			expected: input.role.threshold,
			observed: counted.size,
			authorizedKeyids: [...authorized],
		});
	}
	return { ok: true, value: undefined };
}

export function checkMetadataType(
	signed: unknown,
	expectedType: MetadataRoleKind,
): TufResult<Record<string, unknown>> {
	if (!isRecord(signed)) {
		return rejection("malformed", {
			path: ["signed"],
			expected: "a signed metadata object",
			observed: typeName(signed),
		});
	}
	if (signed._type !== expectedType) {
		return rejection("metadata-type-mismatch", {
			path: ["signed", "_type"],
			expected: expectedType,
			observed:
				typeof signed._type === "string"
					? signed._type
					: typeName(signed._type),
		});
	}
	return { ok: true, value: signed };
}

/** Standalone depth-bound primitive; flat DelegatedRoleConfig has no nested graph, so a later recursive resolver must call it. */
export function validateDelegationChain(
	roleNames: readonly string[],
): TufResult<undefined> {
	const depth = Math.max(0, roleNames.length - 1);
	if (
		new Set(roleNames).size !== roleNames.length ||
		depth > MAX_DELEGATION_DEPTH
	) {
		return rejection("delegation-too-deep", {
			path: ["delegations"],
			expected: `an acyclic chain at depth <= ${MAX_DELEGATION_DEPTH}`,
			observed: { depth, roleNames: [...roleNames] },
		});
	}
	return { ok: true, value: undefined };
}

/**
 * Resolves configured delegations in list order. When availableRoleNames is supplied,
 * it models a role that was consulted but did not carry the target.
 */
export function resolveDelegation(
	targetPath: string,
	delegations: readonly DelegationAuthority[] = DELEGATED_ROLES,
	availableRoleNames?: ReadonlySet<string>,
): TufResult<DelegationResolution> {
	const safePath = validateTargetPath(targetPath);
	if (!safePath.ok) return safePath;
	if (
		TOP_LEVEL_TARGETS_PREFIXES.some((prefix) => targetPath.startsWith(prefix))
	) {
		return {
			ok: true,
			value: { kind: "not-consulted", targetPath, authority: "top-level" },
		};
	}
	if (UNCLAIMABLE_PREFIXES.some((prefix) => targetPath.startsWith(prefix))) {
		return {
			ok: true,
			value: { kind: "not-consulted", targetPath, authority: "none" },
		};
	}
	for (const role of delegations) {
		if (!targetPath.startsWith(role.pathPrefix)) continue;
		const accepted = availableRoleNames?.has(role.name) ?? true;
		if (accepted || role.terminating) {
			return {
				ok: true,
				value: {
					kind: "consulted",
					targetPath,
					role,
					outcome: accepted ? "accepted" : "declined",
				},
			};
		}
	}
	return {
		ok: true,
		value: { kind: "not-consulted", targetPath, authority: "none" },
	};
}

/** Applies a resolved path decision to a role that claims to carry a target. */
export function authorizeTargetPath(
	roleName: string,
	targetPath: string,
	delegations: readonly DelegationAuthority[] = DELEGATED_ROLES,
	availableRoleNames?: ReadonlySet<string>,
): TufResult<DelegationResolution> {
	const resolution = resolveDelegation(
		targetPath,
		delegations,
		availableRoleNames,
	);
	if (!resolution.ok) return resolution;
	const authorized =
		(resolution.value.kind === "not-consulted" &&
			resolution.value.authority === "top-level" &&
			roleName === "targets") ||
		(resolution.value.kind === "consulted" &&
			resolution.value.outcome === "accepted" &&
			resolution.value.role.name === roleName);
	if (!authorized) {
		return rejection("role-not-authorized", {
			path: ["targets", targetPath],
			expected: "the role selected by the target-path delegation graph",
			observed: { roleName, resolution: resolution.value },
		});
	}
	return resolution;
}

/** Allows tests and callers to assert the deliberate CSO prefix partition. */
export function topLevelOnlyPrefixPartition(): readonly string[] {
	return [...TOP_LEVEL_TARGETS_PREFIXES, ...UNCLAIMABLE_PREFIXES].sort();
}

/** Confirms the local three-way lists stay aligned with the landed CSO export. */
export function validateTopLevelOnlyPrefixPartition(): TufResult<undefined> {
	const expected = [...TOP_LEVEL_ONLY_PREFIXES].sort();
	const actual = [...topLevelOnlyPrefixPartition()];
	if (
		expected.length !== actual.length ||
		expected.some((prefix, index) => prefix !== actual[index])
	) {
		return rejection("degenerate-role-configuration", {
			path: ["TOP_LEVEL_ONLY_PREFIXES"],
			expected,
			observed: actual,
		});
	}
	return { ok: true, value: undefined };
}
