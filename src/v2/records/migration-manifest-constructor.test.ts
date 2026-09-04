// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { generateThrowawayKeypair } from "../../legacy/test-helpers";
import type { TufJsonValue } from "../tuf/outcome";
import {
	type MigrationManifestPredicate,
	validateMigrationManifestPredicate,
	walkMigrationManifest,
} from "./migration-manifest";
import { buildMigrationManifestPredicate } from "./migration-manifest-constructor";

function sha256Hex(bytes: Uint8Array): Promise<string> {
	return crypto.subtle
		.digest("SHA-256", new Uint8Array(bytes))
		.then((buf) =>
			Array.from(new Uint8Array(buf), (b) =>
				b.toString(16).padStart(2, "0"),
			).join(""),
		);
}

describe("migration-manifest constructor", () => {
	test("constructs valid migration manifest predicate for journal", async () => {
		const predicate = await buildMigrationManifestPredicate("journal");
		expect(
			await validateMigrationManifestPredicate(
				predicate as unknown as TufJsonValue,
			),
		).toMatchObject({
			ok: true,
			value: {
				schema: "solstone-transparency/migration-manifest/v1-to-v2",
				products: [
					{
						product: "journal",
						chain_length: 10,
						chain_tip_version: "1.0.22",
						declared_gap_versions: ["1.0.14"],
						object_count: 108,
					},
				],
				object_count: 108,
			},
		});
		expect(predicate.verification_contract.v1_public_key).toBe(
			"https://transparency.solstone.app/releases/keys/solpbc-transparency-1.pub",
		);
		expect(predicate.objects.length).toBe(108);
	});

	test("constructs valid migration manifest predicate for windows (empty chain)", async () => {
		const predicate = await buildMigrationManifestPredicate("windows");
		expect(
			await validateMigrationManifestPredicate(
				predicate as unknown as TufJsonValue,
			),
		).toMatchObject({
			ok: true,
			value: {
				schema: "solstone-transparency/migration-manifest/v1-to-v2",
				products: [
					{
						product: "windows",
						chain_length: 0,
						chain_tip_version: null,
						declared_gap_versions: [],
						object_count: 0,
					},
				],
				object_count: 0,
			},
		});
		expect(predicate.objects.length).toBe(0);

		// Walking empty windows manifest succeeds with zero object fetches
		const walk = await walkMigrationManifest(predicate, {
			async fetch(url: string) {
				if (url === predicate.verification_contract.v1_public_key) {
					return { kind: "ok", bytes: new TextEncoder().encode("public key") };
				}
				return { kind: "not-found" };
			},
		});
		expect(walk.verdict).toMatchObject({ ok: true });
		expect(walk.objects).toEqual([]);
	});

	test("constructs valid migration manifest predicate for linux", async () => {
		const predicate = await buildMigrationManifestPredicate("linux");
		expect(
			await validateMigrationManifestPredicate(
				predicate as unknown as TufJsonValue,
			),
		).toMatchObject({
			ok: true,
			value: {
				schema: "solstone-transparency/migration-manifest/v1-to-v2",
				products: [
					{
						product: "linux",
						chain_length: 1,
						chain_tip_version: "1.0.2",
						declared_gap_versions: [],
						object_count: 9,
					},
				],
				object_count: 9,
			},
		});
		expect(predicate.objects.length).toBe(9);
	});

	test("walkMigrationManifest verifies synthetic objects and minisign signatures", async () => {
		const keypair = await generateThrowawayKeypair();
		const dataBytes = new TextEncoder().encode("hello release world");
		const sigText = await keypair.sign(dataBytes, "trusted comment");
		const sigBytes = new TextEncoder().encode(sigText);

		const dataHash = await sha256Hex(dataBytes);
		const sigHash = await sha256Hex(sigBytes);

		const objects = [
			{
				url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.23/release.tar.gz",
				length: dataBytes.byteLength,
				sha256: dataHash,
			},
			{
				url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.23/release.tar.gz.minisig",
				length: sigBytes.byteLength,
				sha256: sigHash,
			},
		].sort((a, b) => a.url.localeCompare(b.url));

		const predicate: MigrationManifestPredicate = {
			_comment: ["Synthetic walk test"],
			schema: "solstone-transparency/migration-manifest/v1-to-v2",
			verification_contract: {
				v1_algorithm: "minisign",
				v1_public_key:
					"https://transparency.solstone.app/releases/keys/solpbc-transparency-1.pub",
				note: "Test contract",
			},
			corpus_sha256: "placeholder",
			object_count: objects.length,
			products: [
				{
					product: "journal",
					chain_length: 1,
					chain_tip_version: "1.0.23",
					declared_gap_versions: [],
					object_count: objects.length,
					corpus_sha256: "placeholder",
				},
			],
			objects,
		};

		const obj0 = objects[0];
		const obj1 = objects[1];
		if (!obj0 || !obj1) throw new Error("expected 2 objects");

		const store = new Map<string, Uint8Array>([
			[
				predicate.verification_contract.v1_public_key,
				new TextEncoder().encode(keypair.pubKeyText),
			],
			[obj0.url, obj0.url.endsWith(".minisig") ? sigBytes : dataBytes],
			[obj1.url, obj1.url.endsWith(".minisig") ? sigBytes : dataBytes],
		]);

		const walk = await walkMigrationManifest(predicate, {
			async fetch(url: string) {
				const bytes = store.get(url);
				if (!bytes) return { kind: "not-found" };
				return { kind: "ok", bytes };
			},
		});

		expect(walk.verdict).toMatchObject({ ok: true });
		expect(walk.objects.length).toBe(2);
		expect(walk.objects.every((o) => o.state === "verified")).toBe(true);
	});
});
