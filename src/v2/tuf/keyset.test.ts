// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { generateSyntheticKeySet, loadRepositorySigningKeys } from "./keyset";

describe("keyset loader and synthetic generator", () => {
	test("generates and loads a valid 11-key synthetic key set", async () => {
		const generated = await generateSyntheticKeySet();
		expect(generated.root.length).toBe(3);
		expect(generated.targets.length).toBe(1);
		expect(generated.snapshot.length).toBe(1);
		expect(generated.timestamp.length).toBe(1);
		expect(Object.keys(generated.delegated).length).toBe(4);
		expect(generated.dsseSigner).toBeDefined();

		const loaded = await loadRepositorySigningKeys(generated);
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;

		expect(loaded.value.signingKeys.root.length).toBe(3);
		expect(loaded.value.signingKeys.targets.length).toBe(1);
		expect(loaded.value.signingKeys.snapshot.length).toBe(1);
		expect(loaded.value.signingKeys.timestamp.length).toBe(1);
		expect(Object.keys(loaded.value.signingKeys.delegated).length).toBe(4);
		expect(loaded.value.dsseSigner.keyId).toBe(generated.dsseSigner.keyid);
	});

	test("rejects invalid key counts", async () => {
		const generated = await generateSyntheticKeySet();
		const badRoot = { ...generated, root: generated.root.slice(0, 2) };
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
});
