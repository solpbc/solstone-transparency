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

function isCryptoKeyPair(
	value: CryptoKey | CryptoKeyPair,
): value is { privateKey: CryptoKey; publicKey: CryptoKey } {
	return "privateKey" in value && "publicKey" in value;
}

/**
 * A generated Ed25519 signing key, paired with the public key object a TUF role
 * carries and the key ID computed over it.
 *
 * The private half stays a `CryptoKey`. Callers that need to persist it export
 * pkcs8 deliberately rather than getting raw bytes handed to them by default.
 */
export interface Ed25519SigningKey {
	privateKey: CryptoKey;
	keyObject: {
		keytype: "ed25519";
		scheme: "ed25519";
		keyval: { public: string };
	};
	keyId: string;
}

/**
 * Generates a fresh Ed25519 signing key and computes its TUF key ID from the same
 * key object a role will carry, so a caller cannot end up with a key ID derived
 * from a different projection than the one it publishes.
 *
 * ⛔ Every key this produces in Wave 2 is synthetic and thrown away. This module
 * has no persistence, no vault access, and no ceremony; a production root key is
 * generated under a separate custody process, not here.
 */
export async function generateEd25519SigningKey(): Promise<
	TufResult<Ed25519SigningKey>
> {
	let generated: CryptoKey | CryptoKeyPair;
	try {
		generated = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
			"sign",
			"verify",
		]);
	} catch (error) {
		return malformedKey(
			[],
			"an Ed25519 key pair from crypto.subtle.generateKey",
			error instanceof Error ? error.name : typeName(error),
		);
	}
	// Narrow through a predicate rather than cast: generateKey's declared return is
	// the union, and asserting past it would hide a runtime shape change instead of
	// reporting one as a named rejection.
	if (!isCryptoKeyPair(generated)) {
		return malformedKey([], "an Ed25519 key pair", "a single CryptoKey");
	}
	const pair = generated;
	const raw = new Uint8Array(
		await crypto.subtle.exportKey("raw", pair.publicKey),
	);
	const keyObject = {
		keytype: "ed25519" as const,
		scheme: "ed25519" as const,
		keyval: { public: bytesToHex(raw) },
	};
	const keyId = await computeKeyId(keyObject);
	if (!keyId.ok) return keyId;
	return {
		ok: true,
		value: { privateKey: pair.privateKey, keyObject, keyId: keyId.value },
	};
}

/**
 * Imports a private signing key from pkcs8 bytes.
 *
 * pkcs8 is the only import format Web Crypto accepts for an Ed25519 private key:
 * a `raw` import throws `SyntaxError` even at the correct 32-byte length, so a
 * caller holding raw seed bytes cannot use them directly. Verified in this
 * runtime rather than assumed.
 */
export async function importEd25519SigningKey(
	pkcs8: Uint8Array,
): Promise<TufResult<CryptoKey>> {
	try {
		return {
			ok: true,
			value: await crypto.subtle.importKey(
				"pkcs8",
				new Uint8Array(pkcs8),
				{ name: "Ed25519" },
				true,
				["sign"],
			),
		};
	} catch (error) {
		return malformedKey(
			[],
			"an importable pkcs8 Ed25519 private key",
			error instanceof Error ? error.name : typeName(error),
		);
	}
}

/**
 * Signs `message` and returns the 64-byte signature.
 *
 * Never throws for an expected failure, matching this module's verify side: a key
 * that cannot sign comes back as a named rejection rather than a Web Crypto
 * exception escaping into a caller that has no discriminated branch for it.
 */
export async function signEd25519(
	privateKey: CryptoKey,
	message: Uint8Array,
): Promise<TufResult<Uint8Array>> {
	let signature: ArrayBuffer;
	try {
		signature = await crypto.subtle.sign(
			{ name: "Ed25519" },
			privateKey,
			new Uint8Array(message),
		);
	} catch (error) {
		return malformedKey(
			[],
			"a CryptoKey usable for Ed25519 signing",
			error instanceof Error ? error.name : typeName(error),
		);
	}
	const bytes = new Uint8Array(signature);
	if (bytes.byteLength !== 64) {
		return rejection("wrong-signature-length", {
			path: ["signature"],
			expected: 64,
			observed: bytes.byteLength,
			requiredBytes: 64,
			observedBytes: bytes.byteLength,
		});
	}
	return { ok: true, value: bytes };
}
