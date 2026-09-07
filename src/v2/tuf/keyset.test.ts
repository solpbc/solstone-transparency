// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { generateEd25519SigningKey } from "./ed25519";
import {
	generateSyntheticKeySet,
	loadEd25519SigningKeyEntry,
	loadRepositorySigningKeys,
} from "./keyset";

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

describe("keyset loader and synthetic generator", () => {
	test("generates and loads a valid 9-key synthetic key set", async () => {
		const generated = await generateSyntheticKeySet();
		expect(generated.root.length).toBe(1);
		expect(generated.targets.length).toBe(1);
		expect(generated.snapshot.length).toBe(1);
		expect(generated.timestamp.length).toBe(1);
		expect(Object.keys(generated.delegated).length).toBe(4);
		expect(generated.dsseSigner).toBeDefined();

		const loaded = await loadRepositorySigningKeys(generated);
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;

		expect(loaded.value.signingKeys.root.length).toBe(1);
		expect(loaded.value.signingKeys.targets.length).toBe(1);
		expect(loaded.value.signingKeys.snapshot.length).toBe(1);
		expect(loaded.value.signingKeys.timestamp.length).toBe(1);
		expect(Object.keys(loaded.value.signingKeys.delegated).length).toBe(4);
		expect(loaded.value.dsseSigner.keyId).toBe(generated.dsseSigner.keyid);
	});

	test("rejects invalid key counts", async () => {
		const generated = await generateSyntheticKeySet();
		const badRoot = { ...generated, root: [] };
		const result = await loadRepositorySigningKeys(badRoot);
		expect(result).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["root"] },
		});
	});

	test("rejects mismatched keyid", async () => {
		const generated = await generateSyntheticKeySet();
		const tampered = {
			...generated,
			targets: [
				{
					...generated.targets[0],
					keyid:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				},
			],
		};
		const result = await loadRepositorySigningKeys(tampered);
		expect(result).toMatchObject({
			ok: false,
			reason: "malformed-key",
			detail: { path: ["targets", "0", "keyid"] },
		});
	});

	test("rejects invalid base64 in pkcs8", async () => {
		const generated = await generateSyntheticKeySet();
		const badBase64 = {
			...generated,
			targets: [
				{
					...generated.targets[0],
					pkcs8: "not-valid-base64!!",
				},
			],
		};
		const result = await loadRepositorySigningKeys(badBase64);
		expect(result).toMatchObject({
			ok: false,
			reason: "malformed",
		});
	});

	test("never includes malformed pkcs8 text in a structured rejection", async () => {
		const generated = await generateSyntheticKeySet();
		const sentinel = "THIS-IS-A-FAKE-PRIVATE-KEY-SENTINEL-VALUE";
		const result = await loadEd25519SigningKeyEntry(
			{
				keyid: generated.timestamp[0]?.keyid,
				public: generated.timestamp[0]?.public,
				pkcs8: sentinel,
			},
			["sentinel"],
		);
		expect(result).toMatchObject({ ok: false, reason: "malformed" });
		expect(JSON.stringify(result)).not.toContain(sentinel);
	});

	test("rejects a private key that does not correspond to public key material", async () => {
		const publicKey = await generateEd25519SigningKey();
		const privateKey = await generateEd25519SigningKey();
		if (!publicKey.ok || !privateKey.ok)
			throw new Error("synthetic key generation failed");
		const pkcs8 = new Uint8Array(
			await crypto.subtle.exportKey("pkcs8", privateKey.value.privateKey),
		);
		const result = await loadEd25519SigningKeyEntry(
			{
				keyid: publicKey.value.keyId,
				public: publicKey.value.keyObject.keyval.public,
				pkcs8: bytesToBase64(pkcs8),
			},
			["synthetic"],
		);
		expect(result).toMatchObject({ ok: false, reason: "signature-invalid" });
	});
});
