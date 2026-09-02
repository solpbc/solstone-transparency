// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { DEFAULT_MAX_METADATA_BYTES, admitTufJson } from "./admission";
import { canonicalizeTufJson } from "./canonical";
import { computeKeyId, verifyEd25519Signature } from "./ed25519";
import { TUF_REJECTION_REASONS, type TufResult } from "./outcome";
import { validateFilenameVersion } from "./reader";
import {
	authorizeTargetPath,
	checkMetadataType,
	evaluateRoleAuthorization,
	validateDelegationChain,
	validateRoleConfiguration,
	validateTargetPath,
} from "./role-graph";

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
	"threshold-unmet",
	"key-not-in-role",
	"dangling-keyid",
	"degenerate-role-configuration",
	"role-not-authorized",
	"delegation-too-deep",
	"unsafe-target-path",
	"metadata-type-mismatch",
	"filename-version-mismatch",
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

function assertMeaningful(value: unknown): void {
	expect(value).not.toBeUndefined();
	if (typeof value === "string") expect(value.length).toBeGreaterThan(0);
	if (Array.isArray(value)) expect(value.length).toBeGreaterThan(0);
	if (value !== null && typeof value === "object")
		expect(Object.keys(value).length).toBeGreaterThan(0);
}

function recordFailure(result: TufResult<unknown>, observed: string[]): void {
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(Object.keys(result.detail).length).toBeGreaterThan(0);
	expect(result.detail).toHaveProperty("expected");
	expect(result.detail).toHaveProperty("observed");
	assertMeaningful(result.detail.expected);
	assertMeaningful(result.detail.observed);
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

	const secondPair = await crypto.subtle.generateKey(
		{ name: "Ed25519" },
		true,
		["sign", "verify"],
	);
	if (!isCryptoKeyPair(secondPair))
		throw new Error("expected second Ed25519 key pair");
	const secondObject = {
		keytype: "ed25519",
		scheme: "ed25519",
		keyval: {
			public: bytesToHex(
				new Uint8Array(
					await crypto.subtle.exportKey("raw", secondPair.publicKey),
				),
			),
		},
	};
	const secondId = await computeKeyId(secondObject);
	if (!secondId.ok) throw new Error("could not compute second test key ID");
	const signedMessage = new TextEncoder().encode("outcome reachability");
	const validSignature = bytesToHex(
		new Uint8Array(
			await crypto.subtle.sign(
				{ name: "Ed25519" },
				keyPair.privateKey,
				signedMessage,
			),
		),
	);
	const secondSignature = bytesToHex(
		new Uint8Array(
			await crypto.subtle.sign(
				{ name: "Ed25519" },
				secondPair.privateKey,
				signedMessage,
			),
		),
	);
	recordFailure(
		await evaluateRoleAuthorization({
			role: { keyids: [keyId.value, secondId.value], threshold: 2 },
			keys: { [keyId.value]: keyObject, [secondId.value]: secondObject },
			signatures: [{ keyid: keyId.value, sig: validSignature }],
			message: signedMessage,
		}),
		observed,
	);
	recordFailure(
		await evaluateRoleAuthorization({
			role: { keyids: [keyId.value], threshold: 1 },
			keys: { [keyId.value]: keyObject, [secondId.value]: secondObject },
			signatures: [{ keyid: secondId.value, sig: secondSignature }],
			message: signedMessage,
		}),
		observed,
	);
	recordFailure(
		await evaluateRoleAuthorization({
			role: { keyids: ["missing"], threshold: 1 },
			keys: {},
			signatures: [],
			message: signedMessage,
		}),
		observed,
	);
	recordFailure(
		validateRoleConfiguration(
			{ keyids: [keyId.value], threshold: 0 },
			{ [keyId.value]: keyObject },
		),
		observed,
	);
	recordFailure(
		authorizeTargetPath("targets/services", "software/item"),
		observed,
	);
	recordFailure(
		validateDelegationChain(
			Array.from({ length: 10 }, (_, index) => `role-${index}`),
		),
		observed,
	);
	recordFailure(validateTargetPath("https://unsafe.example/item"), observed);
	recordFailure(
		checkMetadataType({ _type: "snapshot" }, "timestamp"),
		observed,
	);
	recordFailure(validateFilenameVersion("5.targets.json", 5, 3), observed);

	expect(observed.sort()).toEqual([...EXPECTED_REASONS].sort());
});
