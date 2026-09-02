// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { admitTufJson } from "./admission";
import { canonicalizeTufJson } from "./canonical";
import { verifyEd25519Signature } from "./ed25519";
import { type TufJsonValue, type TufResult, rejection } from "./outcome";
import { validateFilenameVersion } from "./reader";
import {
	type DelegationAuthority,
	type MetadataRoleKind,
	type TufDelegationRole,
	type TufRole,
	type TufSignature,
	checkMetadataType,
	evaluateRoleAuthorization,
	validateDelegationConfiguration,
} from "./role-graph";

export interface ClientMetadata {
	roleName: string;
	filename: string;
	version: number;
	signed: Record<string, TufJsonValue>;
	signatures: readonly TufSignature[];
	bytes: Uint8Array;
}

export interface MetadataDescription {
	version: number;
	length: number;
	hashes: Readonly<Record<string, string>>;
}

export interface RootDeclarations {
	keys: Readonly<Record<string, unknown>>;
	roles: Readonly<
		Record<"root" | "timestamp" | "snapshot" | "targets", TufRole>
	>;
	consistentSnapshot: boolean;
}

export interface ParsedDelegations {
	keys: Readonly<Record<string, unknown>>;
	roles: readonly DelegationAuthority[];
	verificationRoles: readonly TufDelegationRole[];
}

export interface VerifiedAuthorization {
	satisfyingKeyids: readonly string[];
}

function isRecord(value: unknown): value is Record<string, TufJsonValue> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function positiveVersion(
	value: unknown,
	path: readonly string[],
): TufResult<number> {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
		return rejection("malformed", {
			path,
			expected: "a positive safe integer metadata version",
			observed: value,
		});
	}
	return { ok: true, value };
}

function nonNegativeLength(
	value: unknown,
	path: readonly string[],
): TufResult<number> {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
		return rejection("malformed", {
			path,
			expected: "a non-negative safe integer byte length",
			observed: value,
		});
	}
	return { ok: true, value };
}

function parseRole(
	value: unknown,
	path: readonly string[],
): TufResult<TufRole> {
	if (
		!isRecord(value) ||
		!Array.isArray(value.keyids) ||
		!value.keyids.every((keyid) => typeof keyid === "string") ||
		typeof value.threshold !== "number"
	) {
		return rejection("malformed", {
			path,
			expected: "a role with string keyids and numeric threshold",
			observed: typeName(value),
		});
	}
	return {
		ok: true,
		value: { keyids: value.keyids, threshold: value.threshold },
	};
}

function hexToBytes(hex: string): Uint8Array | undefined {
	if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) return undefined;
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export function parseClientMetadata(
	roleName: string,
	filename: string,
	bytes: Uint8Array,
): TufResult<ClientMetadata> {
	const admitted = admitTufJson(bytes);
	if (!admitted.ok) return admitted;
	if (!isRecord(admitted.value) || !isRecord(admitted.value.signed)) {
		return rejection("malformed", {
			path: [],
			expected: "a TUF envelope with a signed object",
			observed: typeName(admitted.value),
		});
	}
	if (!Array.isArray(admitted.value.signatures)) {
		return rejection("malformed", {
			path: ["signatures"],
			expected: "a TUF envelope signatures array",
			observed: typeName(admitted.value.signatures),
		});
	}
	const signatures: TufSignature[] = [];
	for (const [index, signature] of admitted.value.signatures.entries()) {
		if (
			!isRecord(signature) ||
			typeof signature.keyid !== "string" ||
			typeof signature.sig !== "string"
		) {
			return rejection("malformed", {
				path: ["signatures", String(index)],
				expected: "a signature with string keyid and sig",
				observed: typeName(signature),
			});
		}
		signatures.push({ keyid: signature.keyid, sig: signature.sig });
	}
	const version = positiveVersion(admitted.value.signed.version, [
		"signed",
		"version",
	]);
	if (!version.ok) return version;
	return {
		ok: true,
		value: {
			roleName,
			filename,
			version: version.value,
			signed: admitted.value.signed,
			signatures,
			bytes,
		},
	};
}

/**
 * Uses the authoritative evaluator for acceptance, then re-verifies only to report
 * the first distinct keys that satisfied the already-accepted threshold.
 */
export async function verifyClientMetadata(
	metadata: ClientMetadata,
	expectedType: MetadataRoleKind,
	role: TufRole,
	keys: Readonly<Record<string, unknown>>,
	filenameVersion: number | undefined,
	ignoreForeignSignatures = false,
): Promise<TufResult<VerifiedAuthorization>> {
	const typed = checkMetadataType(metadata.signed, expectedType);
	if (!typed.ok) return typed;
	const filename = validateFilenameVersion(
		metadata.filename,
		filenameVersion,
		metadata.version,
	);
	if (!filename.ok) return filename;
	const canonical = canonicalizeTufJson(metadata.signed);
	if (!canonical.ok) return canonical;
	// Root rotation carries signatures from both the old and new root roles. The
	// evaluator remains authoritative; this filter only selects its current role view.
	const signatures = ignoreForeignSignatures
		? metadata.signatures.filter((signature) =>
				role.keyids.includes(signature.keyid),
			)
		: metadata.signatures;
	const authorized = await evaluateRoleAuthorization({
		role,
		keys,
		signatures,
		message: canonical.value,
	});
	if (!authorized.ok) return authorized;

	// This is reporting only: evaluateRoleAuthorization above is the sole
	// accept/reject decision. A disagreement below is a programmer invariant, not
	// an untrusted-metadata rejection.
	const allowed = new Set(role.keyids);
	const seen = new Set<string>();
	const satisfyingKeyids: string[] = [];
	for (const signature of signatures) {
		if (!allowed.has(signature.keyid) || seen.has(signature.keyid)) continue;
		seen.add(signature.keyid);
		const keyObject = keys[signature.keyid];
		const signatureBytes = hexToBytes(signature.sig);
		if (keyObject === undefined || signatureBytes === undefined) {
			throw new Error(
				"authorized signature collector disagreed with evaluator",
			);
		}
		const verified = await verifyEd25519Signature({
			keyObject,
			expectedKeyId: signature.keyid,
			signature: signatureBytes,
			message: canonical.value,
		});
		if (!verified.ok)
			throw new Error("authorized signature collector failed to re-verify");
		satisfyingKeyids.push(signature.keyid);
		if (satisfyingKeyids.length === role.threshold) break;
	}
	if (satisfyingKeyids.length !== role.threshold) {
		throw new Error("authorized signature collector did not reach threshold");
	}
	return { ok: true, value: { satisfyingKeyids } };
}

export function parseRootDeclarations(
	signed: Record<string, TufJsonValue>,
): TufResult<RootDeclarations> {
	if (!isRecord(signed.keys) || !isRecord(signed.roles)) {
		return rejection("malformed", {
			path: ["signed"],
			expected: "root keys and roles objects",
			observed: "missing root declarations",
		});
	}
	const roles = {} as Record<
		"root" | "timestamp" | "snapshot" | "targets",
		TufRole
	>;
	for (const roleName of [
		"root",
		"timestamp",
		"snapshot",
		"targets",
	] as const) {
		const parsed = parseRole(signed.roles[roleName], [
			"signed",
			"roles",
			roleName,
		]);
		if (!parsed.ok) return parsed;
		roles[roleName] = parsed.value;
	}
	if (typeof signed.consistent_snapshot !== "boolean") {
		return rejection("malformed", {
			path: ["signed", "consistent_snapshot"],
			expected: "a boolean consistent_snapshot flag",
			observed: typeName(signed.consistent_snapshot),
		});
	}
	return {
		ok: true,
		value: {
			keys: signed.keys,
			roles,
			consistentSnapshot: signed.consistent_snapshot,
		},
	};
}

export function validateMetadataFreshnessAndSpec(
	signed: Record<string, TufJsonValue>,
	now: Date,
): TufResult<number> {
	if (!Number.isFinite(now.getTime())) {
		return rejection("malformed", {
			path: ["now"],
			expected: "a valid injected Date",
			observed: "invalid Date",
		});
	}
	if (typeof signed.spec_version !== "string") {
		return rejection("malformed", {
			path: ["signed", "spec_version"],
			expected: "a TUF spec_version string",
			observed: typeName(signed.spec_version),
		});
	}
	const spec = /^(\d+)\.\d+\.\d+$/.exec(signed.spec_version);
	if (spec === null) {
		return rejection("malformed", {
			path: ["signed", "spec_version"],
			expected: "a numeric major.minor.patch TUF spec_version",
			observed: signed.spec_version,
		});
	}
	if (spec[1] !== "1") {
		return rejection("unsupported-spec-version", {
			path: ["signed", "spec_version"],
			expected: "a supported TUF spec_version major of 1",
			observed: signed.spec_version,
		});
	}
	if (typeof signed.expires !== "string") {
		return rejection("malformed", {
			path: ["signed", "expires"],
			expected: "an RFC 3339 UTC expiration string",
			observed: typeName(signed.expires),
		});
	}
	const expires = new Date(signed.expires);
	if (
		!Number.isFinite(expires.getTime()) ||
		expires.toISOString().replace(/\.\d{3}Z$/, "Z") !== signed.expires
	) {
		return rejection("malformed", {
			path: ["signed", "expires"],
			expected: "an exact RFC 3339 UTC expiration string",
			observed: signed.expires,
		});
	}
	// TUF metadata has no not-before field, so product-level "not-yet-valid" has no dispatch here.
	if (expires.getTime() <= now.getTime()) {
		return rejection("expired", {
			path: ["signed", "expires"],
			expected: "an expiration after the injected evaluation time",
			observed: signed.expires,
		});
	}
	return { ok: true, value: expires.getTime() };
}

export function metadataDescription(
	signed: Record<string, TufJsonValue>,
	logicalName: string,
): TufResult<MetadataDescription> {
	if (!isRecord(signed.meta) || !isRecord(signed.meta[logicalName])) {
		return rejection("malformed", {
			path: ["signed", "meta", logicalName],
			expected: "a metadata description",
			observed: "missing or non-object metadata description",
		});
	}
	const description = signed.meta[logicalName];
	const version = positiveVersion(description.version, [
		"signed",
		"meta",
		logicalName,
		"version",
	]);
	if (!version.ok) return version;
	const length = nonNegativeLength(description.length, [
		"signed",
		"meta",
		logicalName,
		"length",
	]);
	if (!length.ok) return length;
	if (
		!isRecord(description.hashes) ||
		typeof description.hashes.sha256 !== "string"
	) {
		return rejection("malformed", {
			path: ["signed", "meta", logicalName, "hashes"],
			expected: "a metadata hashes object with sha256",
			observed: typeName(description.hashes),
		});
	}
	const hashes: Record<string, string> = {};
	for (const [algorithm, digest] of Object.entries(description.hashes)) {
		if (typeof digest !== "string") {
			return rejection("malformed", {
				path: ["signed", "meta", logicalName, "hashes", algorithm],
				expected: "a hexadecimal digest string",
				observed: typeName(digest),
			});
		}
		hashes[algorithm] = digest;
	}
	return {
		ok: true,
		value: { version: version.value, length: length.value, hashes },
	};
}

export async function validateMetadataDescription(
	description: MetadataDescription,
	metadata: ClientMetadata,
): Promise<TufResult<undefined>> {
	if (description.version !== metadata.version) {
		return rejection("snapshot-mismatch", {
			path: ["signed", "meta"],
			expected: description.version,
			observed: metadata.version,
		});
	}
	if (description.length !== metadata.bytes.byteLength) {
		return rejection("snapshot-mismatch", {
			path: ["signed", "meta"],
			expected: description.length,
			observed: metadata.bytes.byteLength,
		});
	}
	const expected = description.hashes.sha256;
	if (expected === undefined || !/^[0-9a-f]{64}$/i.test(expected)) {
		return rejection("malformed", {
			path: ["signed", "meta", "hashes", "sha256"],
			expected: "a 64-character SHA-256 hexadecimal digest",
			observed: expected,
		});
	}
	try {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new Uint8Array(metadata.bytes),
		);
		const actual = bytesToHex(new Uint8Array(digest));
		if (actual !== expected.toLowerCase()) {
			return rejection("snapshot-mismatch", {
				path: ["signed", "meta", "hashes", "sha256"],
				expected: expected.toLowerCase(),
				observed: actual,
			});
		}
		return { ok: true, value: undefined };
	} catch (error) {
		return rejection("malformed", {
			path: ["signed", "meta", "hashes", "sha256"],
			expected: "metadata bytes accepted by SHA-256",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}

export function parseDelegations(value: unknown): TufResult<ParsedDelegations> {
	if (
		!isRecord(value) ||
		!isRecord(value.keys) ||
		!Array.isArray(value.roles)
	) {
		return rejection("malformed", {
			path: ["signed", "delegations"],
			expected: "a delegations object with keys and roles",
			observed: typeName(value),
		});
	}
	const roles: DelegationAuthority[] = [];
	const verificationRoles: TufDelegationRole[] = [];
	for (const [index, item] of value.roles.entries()) {
		const parsed = parseRole(item, [
			"signed",
			"delegations",
			"roles",
			String(index),
		]);
		if (!parsed.ok) return parsed;
		if (
			!isRecord(item) ||
			typeof item.name !== "string" ||
			!Array.isArray(item.paths) ||
			!item.paths.every((path) => typeof path === "string") ||
			typeof item.terminating !== "boolean"
		) {
			return rejection("malformed", {
				path: ["signed", "delegations", "roles", String(index)],
				expected:
					"a named delegation with string paths and boolean terminating",
				observed: typeName(item),
			});
		}
		const path = item.paths[0];
		if (item.paths.length !== 1 || path === undefined || !path.endsWith("*")) {
			return rejection("malformed", {
				path: ["signed", "delegations", "roles", String(index), "paths"],
				expected: "one wildcard-suffixed delegation path",
				observed: item.paths,
			});
		}
		roles.push({
			name: item.name,
			pathPrefix: path.slice(0, -1),
			terminating: item.terminating,
		});
		verificationRoles.push({
			...parsed.value,
			name: item.name,
			paths: item.paths,
			terminating: item.terminating,
		});
	}
	const configured = validateDelegationConfiguration(
		verificationRoles,
		value.keys,
	);
	if (!configured.ok) return configured;
	return {
		ok: true,
		value: { keys: value.keys, roles, verificationRoles },
	};
}

export function parseTargets(
	signed: Record<string, TufJsonValue>,
): TufResult<Readonly<Record<string, MetadataDescription>>> {
	if (!isRecord(signed.targets)) {
		return rejection("malformed", {
			path: ["signed", "targets"],
			expected: "a targets object",
			observed: typeName(signed.targets),
		});
	}
	const targets: Record<string, MetadataDescription> = {};
	for (const [targetPath, value] of Object.entries(signed.targets)) {
		if (!isRecord(value)) {
			return rejection("malformed", {
				path: ["signed", "targets", targetPath],
				expected: "a target description object",
				observed: typeName(value),
			});
		}
		const length = nonNegativeLength(value.length, [
			"signed",
			"targets",
			targetPath,
			"length",
		]);
		if (!length.ok) return length;
		if (!isRecord(value.hashes) || typeof value.hashes.sha256 !== "string") {
			return rejection("malformed", {
				path: ["signed", "targets", targetPath, "hashes"],
				expected: "a target hashes object with sha256",
				observed: typeName(value.hashes),
			});
		}
		const hashes: Record<string, string> = {};
		for (const [algorithm, digest] of Object.entries(value.hashes)) {
			if (typeof digest !== "string") {
				return rejection("malformed", {
					path: ["signed", "targets", targetPath, "hashes", algorithm],
					expected: "a hexadecimal digest string",
					observed: typeName(digest),
				});
			}
			hashes[algorithm] = digest;
		}
		targets[targetPath] = { version: 1, length: length.value, hashes };
	}
	return { ok: true, value: targets };
}

export async function validateTargetBytes(
	description: MetadataDescription,
	bytes: Uint8Array,
): Promise<TufResult<undefined>> {
	if (bytes.byteLength !== description.length) {
		return rejection("length-mismatch", {
			path: ["targets"],
			expected: description.length,
			observed: bytes.byteLength,
		});
	}
	const expected = description.hashes.sha256;
	if (expected === undefined || !/^[0-9a-f]{64}$/i.test(expected)) {
		return rejection("malformed", {
			path: ["targets", "hashes", "sha256"],
			expected: "a 64-character SHA-256 hexadecimal digest",
			observed: expected,
		});
	}
	try {
		const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
		const actual = bytesToHex(new Uint8Array(digest));
		if (actual !== expected.toLowerCase()) {
			return rejection("hash-mismatch", {
				path: ["targets", "hashes", "sha256"],
				expected: expected.toLowerCase(),
				observed: actual,
			});
		}
		return { ok: true, value: undefined };
	} catch (error) {
		return rejection("malformed", {
			path: ["targets", "hashes", "sha256"],
			expected: "target bytes accepted by SHA-256",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}
