// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type RepositorySigningKeys, buildRepository } from "./builder";
import { generateEd25519SigningKey } from "./ed25519";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import type { TrustStoreState } from "./trust-store";
import { openFileTrustStore } from "./trust-store";

async function signingKeys(): Promise<RepositorySigningKeys> {
	const generate = async (count: number) => {
		const keys = await Promise.all(
			Array.from({ length: count }, () => generateEd25519SigningKey()),
		);
		return keys.map((key) => {
			if (!key.ok)
				throw new Error(`synthetic key generation failed: ${key.reason}`);
			return key.value;
		});
	};
	const delegated: Record<string, Awaited<ReturnType<typeof generate>>> = {};
	for (const role of DELEGATED_ROLES)
		delegated[role.name] = await generate(role.keyCount);
	return {
		root: await generate(TOP_LEVEL_ROLES.root.keyCount),
		timestamp: await generate(TOP_LEVEL_ROLES.timestamp.keyCount),
		snapshot: await generate(TOP_LEVEL_ROLES.snapshot.keyCount),
		targets: await generate(TOP_LEVEL_ROLES.targets.keyCount),
		delegated,
	};
}

async function storeState(version = 1): Promise<TrustStoreState> {
	const repository = await buildRepository({
		signingKeys: await signingKeys(),
		targets: {},
		consistentSnapshot: true,
		now: new Date("2030-01-02T03:04:05Z"),
		versions: {
			root: version,
			timestamp: version,
			snapshot: version,
			targets: version,
			delegated: Object.fromEntries(
				DELEGATED_ROLES.map((role) => [role.name, version]),
			),
		},
	});
	if (!repository.ok)
		throw new Error(`trust-store fixture build failed: ${repository.reason}`);
	return {
		schemaVersion: 1,
		trustedRoot: {
			version,
			envelope: {
				signed: repository.value.root.envelope
					.signed as TrustStoreState["trustedRoot"]["envelope"]["signed"],
				signatures: repository.value.root.envelope.signatures,
			},
		},
		versions: {
			root: version,
			timestamp: version,
			snapshot: version,
			targets: version,
			delegatedTargets: Object.fromEntries(
				DELEGATED_ROLES.map((role) => [role.name, version]),
			),
		},
	};
}

test("trust store round-trips a valid canonical state", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-store-"),
	);
	const path = join(directory, "store.json");
	try {
		const store = openFileTrustStore(path);
		const empty = await store.read();
		expect(empty).toEqual({ ok: true, value: undefined });
		const initialState = await storeState();
		const written = await store.replace(undefined, initialState);
		expect(written).toEqual({ ok: true, value: undefined });
		const read = await store.read();
		// 🔴 Assert the value is PRESENT before narrowing. An early `return` here
		// makes this test vacuous in exactly the case it exists to catch: a store
		// that never persists reads back `undefined`, the narrowing bails, and the
		// state comparison below is never reached. Verified: with `replace()`
		// short-circuited to success without writing, this test still PASSED.
		expect(read.ok).toBe(true);
		if (!read.ok) throw new Error(`read failed: ${read.reason}`);
		expect(read.value).toBeDefined();
		if (read.value === undefined) throw new Error("store did not persist");
		expect(read.value.state).toEqual(initialState);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("trust store rejects a valid root replay from version 2 to version 1", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-store-root-rollback-"),
	);
	const path = join(directory, "store.json");
	try {
		const store = openFileTrustStore(path);
		const versionTwo = await store.replace(undefined, await storeState(2));
		expect(versionTwo).toEqual({ ok: true, value: undefined });
		const current = await store.read();
		expect(current.ok).toBe(true);
		if (!current.ok || current.value === undefined) return;
		const replay = await store.replace(
			current.value.revision,
			await storeState(1),
		);
		expect(replay).toMatchObject({ ok: false, reason: "version-rollback" });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("trust store refuses a next state that its reader would reject", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-store-invalid-next-"),
	);
	const path = join(directory, "store.json");
	try {
		const store = openFileTrustStore(path);
		const valid = await storeState();
		const invalid = await store.replace(undefined, {
			...valid,
			versions: { ...valid.versions, timestamp: 0 },
		});
		expect(invalid).toMatchObject({
			ok: false,
			reason: "trust-store-corrupt",
		});
		expect(await store.read()).toEqual({ ok: true, value: undefined });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("trust store rejects corrupt bytes", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-store-"),
	);
	const path = join(directory, "store.json");
	try {
		await writeFile(path, "not json");
		const result = await openFileTrustStore(path).read();
		expect(result).toMatchObject({ ok: false, reason: "trust-store-corrupt" });
		expect(await readFile(path, "utf8")).toBe("not json");
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
