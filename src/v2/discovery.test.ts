// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { SCHEMA_URI_BASE, generateDiscovery } from "./discovery";
import { PREDICATE_URI_BASE } from "./records/predicates";
import { buildRepository } from "./tuf/builder";
import {
	generateSyntheticKeySet,
	loadRepositorySigningKeys,
} from "./tuf/keyset";

test("discovery refuses an invalid root signature before deriving the valid pin and bases", async () => {
	const loaded = await loadRepositorySigningKeys(
		await generateSyntheticKeySet(),
	);
	if (!loaded.ok) throw new Error(loaded.reason);
	const built = await buildRepository({
		signingKeys: loaded.value.signingKeys,
		targets: {},
		consistentSnapshot: true,
		now: new Date("2030-01-01T00:00:00Z"),
	});
	if (!built.ok) throw new Error(built.reason);
	const bytes = built.value.root.bytes;
	const altered = JSON.parse(new TextDecoder().decode(bytes));
	altered.signed.version = 2;
	await expect(
		generateDiscovery(new TextEncoder().encode(JSON.stringify(altered))),
	).rejects.toThrow();
	const doc = await generateDiscovery(bytes);
	expect(doc.tuf.root_sha256).toBe(
		createHash("sha256").update(bytes).digest("hex"),
	);
	expect(doc.tuf.root_version).toBe(1);
	expect(doc.tuf.metadata_base).toBe(
		"https://transparency.solstone.app/v2/metadata/",
	);
	expect(doc.tuf.targets_base).toBe(
		"https://transparency.solstone.app/v2/targets/",
	);
	// The bases records embed, not derived from the repository prefix: a
	// staging repository still points at the same predicate and schema documents.
	expect(doc.predicates.base).toBe(PREDICATE_URI_BASE);
	expect(doc.predicates.base).toBe(
		"https://transparency.solstone.app/predicates/v1/",
	);
	expect(doc.schemas.base).toBe(SCHEMA_URI_BASE);
	expect(doc.schemas.base).toBe("https://transparency.solstone.app/schemas/");
	const staged = await generateDiscovery(
		bytes,
		"https://transparency.solstone.app/staging/v2/",
	);
	expect(staged.predicates.base).toBe(PREDICATE_URI_BASE);
	expect(staged.schemas.base).toBe(SCHEMA_URI_BASE);
	await expect(
		generateDiscovery(bytes, "http://example.invalid/v2/"),
	).rejects.toThrow("discovery-base-invalid");
});
