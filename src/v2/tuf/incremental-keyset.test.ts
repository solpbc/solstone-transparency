// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { type Ed25519SigningKey, generateEd25519SigningKey } from "./ed25519";
import {
	loadIncrementalReleaseSigningKeys,
	loadMetadataRenewalSigningKeys,
} from "./incremental-keyset";

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function generatedKey(): Promise<Ed25519SigningKey> {
	const key = await generateEd25519SigningKey();
	if (!key.ok)
		throw new Error(`synthetic key generation failed: ${key.reason}`);
	return key.value;
}

async function keyEntry(key: Ed25519SigningKey) {
	return {
		keyid: key.keyId,
		public: key.keyObject.keyval.public,
		pkcs8: bytesToBase64(
			new Uint8Array(await crypto.subtle.exportKey("pkcs8", key.privateKey)),
		),
	};
}

async function validKeySet() {
	const keys = await Promise.all(
		Array.from({ length: 4 }, () => generatedKey()),
	);
	return {
		"targets-software": await keyEntry(keys[0] as Ed25519SigningKey),
		snapshot: await keyEntry(keys[1] as Ed25519SigningKey),
		timestamp: await keyEntry(keys[2] as Ed25519SigningKey),
		"producer.release": await keyEntry(keys[3] as Ed25519SigningKey),
	};
}

test("loads exactly the four incremental release signing keys", async () => {
	const json = await validKeySet();
	const loaded = await loadIncrementalReleaseSigningKeys(json);
	expect(loaded.ok).toBe(true);
	if (!loaded.ok) return;
	expect(loaded.value.targetsSoftware.keyId).toBe(
		json["targets-software"].keyid,
	);
	expect(loaded.value.producerRelease.keyId).toBe(
		json["producer.release"].keyid,
	);
});

test("rejects every extra top-level field", async () => {
	for (const field of [
		"root",
		"targets",
		"delegated",
		"dsseSigner",
		"unexpected",
	]) {
		const json = await validKeySet();
		const result = await loadIncrementalReleaseSigningKeys({
			...json,
			[field]: json.snapshot,
		});
		expect(result).toMatchObject({ ok: false, reason: "malformed" });
	}
});

test("rejects extra key-entry fields and missing required keys", async () => {
	const extraEntry = await validKeySet();
	const withExtra = {
		...extraEntry,
		snapshot: { ...extraEntry.snapshot, comment: "not permitted" },
	};
	expect(await loadIncrementalReleaseSigningKeys(withExtra)).toMatchObject({
		ok: false,
		reason: "malformed",
	});
	const missing = await validKeySet();
	const { timestamp: _timestamp, ...withoutTimestamp } = missing;
	expect(
		await loadIncrementalReleaseSigningKeys(withoutTimestamp),
	).toMatchObject({
		ok: false,
		reason: "malformed",
	});
});

test("loads the exact key shape for every delegated metadata renewal role", async () => {
	const keys = await validKeySet();
	const loaded = await loadMetadataRenewalSigningKeys(
		{
			"targets-legacy": keys["targets-software"],
			snapshot: keys.snapshot,
			timestamp: keys.timestamp,
		},
		"targets-legacy",
	);
	expect(loaded.ok).toBe(true);
	if (!loaded.ok) return;
	expect(loaded.value["targets-legacy"]?.keyId).toBe(
		keys["targets-software"].keyid,
	);
});
