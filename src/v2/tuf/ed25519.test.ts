// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { computeKeyId, verifyEd25519Signature } from "./ed25519";
import type { TufRejectionReason } from "./outcome";
import { loadTufConformanceVectors } from "./testdata/vectors";

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function isCryptoKeyPair(
	value: CryptoKey | CryptoKeyPair,
): value is { privateKey: CryptoKey; publicKey: CryptoKey } {
	return "privateKey" in value && "publicKey" in value;
}

async function generatedKeyFixture(): Promise<{
	keyObject: { keytype: string; scheme: string; keyval: { public: string } };
	keyId: string;
	privateKey: CryptoKey;
}> {
	const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
		"sign",
		"verify",
	]);
	if (!isCryptoKeyPair(keyPair)) {
		throw new Error("Ed25519 generateKey did not return a key pair");
	}
	const raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
	const keyObject = {
		keytype: "ed25519",
		scheme: "ed25519",
		keyval: { public: bytesToHex(new Uint8Array(raw)) },
	};
	const keyId = await computeKeyId(keyObject);
	if (!keyId.ok)
		throw new Error(`could not compute generated key ID: ${keyId.reason}`);
	return { keyObject, keyId: keyId.value, privateKey: keyPair.privateKey };
}

function expectFailure(
	result: Awaited<ReturnType<typeof verifyEd25519Signature>>,
	reason: TufRejectionReason,
): void {
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(result.reason).toBe(reason);
	expect(Object.keys(result.detail).length).toBeGreaterThan(0);
}

describe("computeKeyId", () => {
	test("matches all independent key-ID vectors", async () => {
		const vectors = await loadTufConformanceVectors();
		for (const vector of vectors.keyid) {
			const result = await computeKeyId(vector.key_object);
			expect(result.ok, vector.name).toBe(true);
			if (!result.ok) continue;
			expect(result.value, vector.name).toBe(vector.keyid);
		}
	});

	test("includes unrecognized fields in the hashed key object", async () => {
		// Repository-asserted, not oracle-backed: committed oracle vectors have no extras.
		const base = {
			keytype: "ed25519",
			scheme: "ed25519",
			keyval: { public: "00".repeat(32) },
		};
		const withExtras = {
			...base,
			keyval: { ...base.keyval, vendor_extension: { enabled: true } },
			unrecognized: "included",
		};
		const baseId = await computeKeyId(base);
		const extraId = await computeKeyId(withExtras);
		expect(baseId.ok).toBe(true);
		expect(extraId.ok).toBe(true);
		if (!baseId.ok || !extraId.ok) return;
		expect(extraId.value).not.toBe(baseId.value);
	});

	test("rejects malformed key objects", async () => {
		const result = await computeKeyId({
			keytype: "ed25519",
			scheme: "ed25519",
			keyval: {},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("malformed-key");
			expect(Object.keys(result.detail).length).toBeGreaterThan(0);
		}
	});
});

describe("verifyEd25519Signature", () => {
	test("verifies a generated signature against an imported raw public key", async () => {
		const fixture = await generatedKeyFixture();
		const message = new Uint8Array(
			new TextEncoder().encode("synthetic test message"),
		);
		const signature = new Uint8Array(
			await crypto.subtle.sign(
				{ name: "Ed25519" },
				fixture.privateKey,
				message,
			),
		);
		expect(
			await verifyEd25519Signature({
				keyObject: fixture.keyObject,
				expectedKeyId: fixture.keyId,
				signature,
				message,
			}),
		).toEqual({ ok: true, value: undefined });
	});

	test("reports a corrupted signature as signature-invalid", async () => {
		const fixture = await generatedKeyFixture();
		const message = new Uint8Array(
			new TextEncoder().encode("synthetic test message"),
		);
		const signature = new Uint8Array(
			await crypto.subtle.sign(
				{ name: "Ed25519" },
				fixture.privateKey,
				message,
			),
		);
		const firstByte = signature[0];
		if (firstByte === undefined)
			throw new Error("Ed25519 signature was unexpectedly empty");
		signature[0] = firstByte ^ 1;
		expectFailure(
			await verifyEd25519Signature({
				keyObject: fixture.keyObject,
				expectedKeyId: fixture.keyId,
				signature,
				message,
			}),
			"signature-invalid",
		);
	});

	test("checks public key length before Web Crypto import", async () => {
		for (const length of [0, 31, 33]) {
			const result = await verifyEd25519Signature({
				keyObject: {
					keytype: "ed25519",
					scheme: "ed25519",
					keyval: { public: bytesToHex(new Uint8Array(length)) },
				},
				expectedKeyId: "unused",
				signature: new Uint8Array(64),
				message: new Uint8Array(),
			});
			expectFailure(result, "wrong-key-length");
		}
	});

	test("checks signature length before Web Crypto verify", async () => {
		const fixture = await generatedKeyFixture();
		for (const length of [0, 63, 65]) {
			const result = await verifyEd25519Signature({
				keyObject: fixture.keyObject,
				expectedKeyId: fixture.keyId,
				signature: new Uint8Array(length),
				message: new Uint8Array(),
			});
			expectFailure(result, "wrong-signature-length");
		}
	});

	test("reports mismatched IDs and unsupported algorithms before verification", async () => {
		const fixture = await generatedKeyFixture();
		const mismatched = await verifyEd25519Signature({
			keyObject: fixture.keyObject,
			expectedKeyId: "0".repeat(64),
			signature: new Uint8Array(64),
			message: new Uint8Array(),
		});
		expectFailure(mismatched, "keyid-mismatch");

		const unsupported = await verifyEd25519Signature({
			keyObject: { ...fixture.keyObject, keytype: "rsa" },
			expectedKeyId: fixture.keyId,
			signature: new Uint8Array(64),
			message: new Uint8Array(),
		});
		expectFailure(unsupported, "unsupported-key-type");

		const unknownScheme = await verifyEd25519Signature({
			keyObject: { ...fixture.keyObject, scheme: "unknown" },
			expectedKeyId: fixture.keyId,
			signature: new Uint8Array(64),
			message: new Uint8Array(),
		});
		expectFailure(unknownScheme, "unsupported-key-type");
	});
});
