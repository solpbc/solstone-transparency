// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { DEFAULT_MAX_METADATA_BYTES, admitTufJson } from "./admission";
import { canonicalizeTufJson } from "./canonical";
import { computeKeyId, verifyEd25519Signature } from "./ed25519";
import { TUF_REJECTION_REASONS, type TufResult } from "./outcome";

const EXPECTED_REASONS = [
	"malformed",
	"invalid-encoding",
	"byte-length-changed",
	"unpaired-surrogate",
	"non-finite-number",
	"non-integer-number",
	"undefined-value",
	"oversized",
	"too-deep",
	"duplicate-key",
	"integer-not-round-trippable",
	"malformed-key",
	"wrong-key-length",
	"wrong-signature-length",
	"unsupported-key-type",
	"signature-invalid",
	"keyid-mismatch",
] as const;

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

function recordFailure(result: TufResult<unknown>, observed: string[]): void {
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(Object.keys(result.detail).length).toBeGreaterThan(0);
	expect(result.detail).toHaveProperty("expected");
	expect(result.detail).toHaveProperty("observed");
	observed.push(result.reason);
}

test("the reason vocabulary is complete, duplicate-free, and reachable without oracle fixtures", async () => {
	expect(TUF_REJECTION_REASONS).toEqual(EXPECTED_REASONS);
	expect(new Set(TUF_REJECTION_REASONS).size).toBe(EXPECTED_REASONS.length);

	const text = new TextEncoder();
	const observed: string[] = [];
	recordFailure(admitTufJson(text.encode("[1,]")), observed);
	recordFailure(admitTufJson(new Uint8Array([0xc3, 0x28])), observed);
	recordFailure(
		admitTufJson(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])),
		observed,
	);
	recordFailure(canonicalizeTufJson("\ud800"), observed);
	recordFailure(canonicalizeTufJson(Number.NaN), observed);
	recordFailure(canonicalizeTufJson(1.5), observed);
	recordFailure(canonicalizeTufJson(undefined), observed);
	recordFailure(
		admitTufJson(new Uint8Array(DEFAULT_MAX_METADATA_BYTES + 1).fill(0xff)),
		observed,
	);
	recordFailure(admitTufJson(text.encode("[".repeat(33))), observed);
	recordFailure(admitTufJson(text.encode('{"a":1,"\\u0061":2}')), observed);
	recordFailure(admitTufJson(text.encode("9007199254740993")), observed);
	recordFailure(await computeKeyId({}), observed);

	const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
		"sign",
		"verify",
	]);
	if (!isCryptoKeyPair(keyPair)) {
		throw new Error("Ed25519 generateKey did not return a key pair");
	}
	const publicBytes = new Uint8Array(
		await crypto.subtle.exportKey("raw", keyPair.publicKey),
	);
	const keyObject = {
		keytype: "ed25519",
		scheme: "ed25519",
		keyval: { public: bytesToHex(publicBytes) },
	};
	const keyId = await computeKeyId(keyObject);
	expect(keyId.ok).toBe(true);
	if (!keyId.ok) return;

	recordFailure(
		await verifyEd25519Signature({
			keyObject: { ...keyObject, keyval: { public: "" } },
			expectedKeyId: keyId.value,
			signature: new Uint8Array(64),
			message: new Uint8Array(),
		}),
		observed,
	);
	recordFailure(
		await verifyEd25519Signature({
			keyObject,
			expectedKeyId: keyId.value,
			signature: new Uint8Array(),
			message: new Uint8Array(),
		}),
		observed,
	);
	recordFailure(
		await verifyEd25519Signature({
			keyObject: { ...keyObject, scheme: "other" },
			expectedKeyId: keyId.value,
			signature: new Uint8Array(64),
			message: new Uint8Array(),
		}),
		observed,
	);
	recordFailure(
		await verifyEd25519Signature({
			keyObject,
			expectedKeyId: keyId.value,
			signature: new Uint8Array(64),
			message: new Uint8Array(),
		}),
		observed,
	);
	recordFailure(
		await verifyEd25519Signature({
			keyObject,
			expectedKeyId: "0".repeat(64),
			signature: new Uint8Array(64),
			message: new Uint8Array(),
		}),
		observed,
	);

	expect(observed.sort()).toEqual([...EXPECTED_REASONS].sort());
});
