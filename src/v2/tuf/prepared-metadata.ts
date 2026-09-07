// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import type { BuiltMetadata } from "./builder";
import { canonicalizeTufJson } from "./canonical";
import type {
	AuthenticatedRoleMetadata,
	TufClientSuccess,
} from "./client-result";
import { type TufJsonValue, type TufResult, rejection } from "./outcome";
import { type TufRole, evaluateRoleAuthorization } from "./role-graph";

export interface PreparedMetadata {
	filename: string;
	version: number;
	bytes: Uint8Array;
}

export function isRecord(
	value: unknown,
): value is Record<string, TufJsonValue> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export async function sha256(bytes: Uint8Array): Promise<TufResult<string>> {
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
			expected: "authenticated bytes accepted by SHA-256",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}

export function requiredMetadata(
	priorState: TufClientSuccess,
	roleName: string,
): TufResult<AuthenticatedRoleMetadata> {
	const metadata = priorState.authenticatedMetadata[roleName];
	if (metadata === undefined) {
		return rejection("unavailable", {
			path: ["authenticatedMetadata", roleName],
			expected: "authenticated metadata for the required role",
			observed: "missing",
		});
	}
	return { ok: true, value: metadata };
}

export function nextVersion(
	metadata: AuthenticatedRoleMetadata,
): TufResult<number> {
	if (!Number.isSafeInteger(metadata.version) || metadata.version < 1) {
		return rejection("malformed", {
			path: ["authenticatedMetadata", metadata.roleName, "version"],
			expected: "a positive safe integer version",
			observed: metadata.version,
		});
	}
	if (metadata.version === Number.MAX_SAFE_INTEGER) {
		return rejection("malformed", {
			path: ["authenticatedMetadata", metadata.roleName, "version"],
			expected: "a version that can be incremented safely",
			observed: metadata.version,
		});
	}
	return { ok: true, value: metadata.version + 1 };
}

export async function authorizeMetadata(
	metadata: BuiltMetadata,
	role: TufRole,
	keys: Readonly<Record<string, unknown>>,
): Promise<TufResult<undefined>> {
	const signed = canonicalizeTufJson(
		metadata.envelope.signed as unknown as TufJsonValue,
	);
	if (!signed.ok) return signed;
	return evaluateRoleAuthorization({
		role,
		keys,
		signatures: metadata.envelope.signatures,
		message: signed.value,
	});
}

export function metadataOutput(
	metadata: BuiltMetadata,
	filename: string,
): PreparedMetadata {
	return { filename, version: metadata.version, bytes: metadata.bytes };
}
