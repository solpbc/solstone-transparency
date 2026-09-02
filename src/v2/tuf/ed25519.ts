// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { canonicalizeTufJson } from "./canonical";
import { type TufFailure, type TufResult, rejection } from "./outcome";

interface ValidatedKeyObject {
	keyObject: Record<string, unknown>;
	keytype: string;
	scheme: string;
	publicHex: string;
}

export interface Ed25519VerificationInput {
	keyObject: unknown;
	expectedKeyId: string;
	signature: Uint8Array;
	message: Uint8Array;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function malformedKey(
	path: readonly string[],
	expected: string,
	observed: unknown,
): TufFailure<"malformed-key"> {
	return rejection("malformed-key", { path, expected, observed });
}

function validateKeyObject(keyObject: unknown): TufResult<ValidatedKeyObject> {
	if (!isRecord(keyObject)) {
		return malformedKey([], "a TUF key object", typeName(keyObject));
	}
	if (typeof keyObject.keytype !== "string") {
		return malformedKey(
			["keytype"],
			"a string keytype",
			typeName(keyObject.keytype),
		);
	}
	if (typeof keyObject.scheme !== "string") {
		return malformedKey(
			["scheme"],
			"a string scheme",
			typeName(keyObject.scheme),
		);
	}
	if (!isRecord(keyObject.keyval)) {
		return malformedKey(
			["keyval"],
			"an object containing public",
			typeName(keyObject.keyval),
		);
	}
	if (typeof keyObject.keyval.public !== "string") {
		return malformedKey(
			["keyval", "public"],
			"an even-length hexadecimal public key string",
			typeName(keyObject.keyval.public),
		);
	}
	if (!/^(?:[0-9a-fA-F]{2})*$/.test(keyObject.keyval.public)) {
		return malformedKey(
			["keyval", "public"],
			"an even-length hexadecimal public key string",
			keyObject.keyval.public,
		);
	}
	return {
		ok: true,
		value: {
			keyObject,
			keytype: keyObject.keytype,
			scheme: keyObject.scheme,
			publicHex: keyObject.keyval.public,
		},
	};
}

function hexToBytes(hex: string): Uint8Array {
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

/**
 * Computes the TUF key identifier over the complete, unprojected key object.
 * Call only with an admitted, depth-bounded key object; admission owns hostile-depth handling.
 */
export async function computeKeyId(
	keyObject: unknown,
): Promise<TufResult<string>> {
	const validated = validateKeyObject(keyObject);
	if (!validated.ok) return validated;
	const canonical = canonicalizeTufJson(validated.value.keyObject);
	if (!canonical.ok) return canonical;
	try {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new Uint8Array(canonical.value),
		);
		return { ok: true, value: bytesToHex(new Uint8Array(digest)) };
	} catch (error) {
		return malformedKey(
			[],
			"canonical key bytes accepted by SHA-256",
			error instanceof Error ? error.name : typeName(error),
		);
	}
}

/** Validates a TUF Ed25519 key and verifies one signature without leaking Web Crypto exceptions. */
export async function verifyEd25519Signature(
	input: Ed25519VerificationInput,
): Promise<TufResult<undefined>> {
	const validated = validateKeyObject(input.keyObject);
	if (!validated.ok) return validated;
	if (
		validated.value.keytype !== "ed25519" ||
		validated.value.scheme !== "ed25519"
	) {
		return rejection("unsupported-key-type", {
			path: [],
			expected: { keytype: "ed25519", scheme: "ed25519" },
			observed: {
				keytype: validated.value.keytype,
				scheme: validated.value.scheme,
			},
		});
	}

	const publicKeyBytes = hexToBytes(validated.value.publicHex);
	if (publicKeyBytes.byteLength !== 32) {
		return rejection("wrong-key-length", {
			path: ["keyval", "public"],
			expected: 32,
			observed: publicKeyBytes.byteLength,
			requiredBytes: 32,
			observedBytes: publicKeyBytes.byteLength,
		});
	}
	if (input.signature.byteLength !== 64) {
		return rejection("wrong-signature-length", {
			path: ["signature"],
			expected: 64,
			observed: input.signature.byteLength,
			requiredBytes: 64,
			observedBytes: input.signature.byteLength,
		});
	}

	const keyId = await computeKeyId(validated.value.keyObject);
	if (!keyId.ok) return keyId;
	if (keyId.value !== input.expectedKeyId) {
		return rejection("keyid-mismatch", {
			path: ["keyid"],
			expected: input.expectedKeyId,
			observed: keyId.value,
			computedKeyId: keyId.value,
		});
	}

	let publicKey: CryptoKey;
	try {
		publicKey = await crypto.subtle.importKey(
			"raw",
			new Uint8Array(publicKeyBytes),
			{ name: "Ed25519" },
			false,
			["verify"],
		);
	} catch (error) {
		return malformedKey(
			["keyval", "public"],
			"an importable 32-byte Ed25519 public key",
			error instanceof Error ? error.name : typeName(error),
		);
	}

	try {
		const verified = await crypto.subtle.verify(
			{ name: "Ed25519" },
			publicKey,
			new Uint8Array(input.signature),
			new Uint8Array(input.message),
		);
		if (!verified) {
			return rejection("signature-invalid", {
				path: ["signature"],
				expected: true,
				observed: false,
				signatureBytes: input.signature.byteLength,
			});
		}
		return { ok: true, value: undefined };
	} catch (error) {
		return rejection("signature-invalid", {
			path: ["signature"],
			expected: "crypto.subtle.verify returns true",
			observed: error instanceof Error ? error.name : typeName(error),
			signatureBytes: input.signature.byteLength,
		});
	}
}
