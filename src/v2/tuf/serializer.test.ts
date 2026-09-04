// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type RepositorySigningKeys, buildRepository } from "./builder";
import { generateEd25519SigningKey } from "./ed25519";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import {
	metadataFilename,
	metadataLogicalName,
	serializeRepository,
} from "./serializer";

async function signingKeys(): Promise<RepositorySigningKeys> {
	const generate = async (count: number) => {
		const results = await Promise.all(
			Array.from({ length: count }, () => generateEd25519SigningKey()),
		);
		return results.map((result) => {
			if (!result.ok)
				throw new Error(`synthetic key generation failed: ${result.reason}`);
			return result.value;
		});
	};
	const delegated: Record<string, Awaited<ReturnType<typeof generate>>> = {};
	for (const role of DELEGATED_ROLES)
		delegated[role.name] = await generate(role.keyCount);
	return {
		root: await generate(TOP_LEVEL_ROLES.root.keyCount),
		targets: await generate(TOP_LEVEL_ROLES.targets.keyCount),
		snapshot: await generate(TOP_LEVEL_ROLES.snapshot.keyCount),
		timestamp: await generate(TOP_LEVEL_ROLES.timestamp.keyCount),
		delegated,
	};
}

async function repository(consistentSnapshot: boolean) {
	const built = await buildRepository({
		signingKeys: await signingKeys(),
		targets: {
			"software/release.json": {
				length: 1,
				hashes: { sha256: "a".repeat(64) },
			},
		},
		consistentSnapshot,
		now: new Date("2030-01-02T03:04:05Z"),
	});
	if (!built.ok) throw new Error(`build failed: ${built.reason}`);
	return built.value;
}

test("serializes the complete and exact consistent-snapshot filename set", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-serializer-"),
	);
	try {
		const result = await serializeRepository(await repository(true), directory);
		expect(result.ok).toBe(true);
		expect((await readdir(directory)).sort()).toEqual([
			"1.root.json",
			"1.snapshot.json",
			"1.targets-legacy.json",
			"1.targets-services.json",
			"1.targets-software.json",
			"1.targets-verification.json",
			"1.targets.json",
			"timestamp.json",
		]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("serializes the complete and exact non-consistent filename set", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-serializer-"),
	);
	try {
		const result = await serializeRepository(
			await repository(false),
			directory,
		);
		expect(result.ok).toBe(true);
		expect((await readdir(directory)).sort()).toEqual([
			"1.root.json",
			"snapshot.json",
			"targets-legacy.json",
			"targets-services.json",
			"targets-software.json",
			"targets-verification.json",
			"targets.json",
			"timestamp.json",
		]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("rejects an existing planned filename before writing any repository bytes", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-serializer-"),
	);
	try {
		await writeFile(join(directory, "timestamp.json"), "already present");
		const before = await readdir(directory);
		const result = await serializeRepository(await repository(true), directory);
		expect(result).toMatchObject({ ok: false, reason: "malformed" });
		expect(await readdir(directory)).toEqual(before);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("round-trips delegated role names without percent encoding, and preserves old slash encoding as negative control", () => {
	const logical = metadataLogicalName("targets-software");
	expect(logical).toEqual({ ok: true, value: "targets-software.json" });
	expect(metadataFilename("targets-software", 5, true)).toEqual({
		ok: true,
		value: "5.targets-software.json",
	});

	// Negative control / historical comparison: slash-bearing delegated names
	// used to URL-encode to %2F.
	const logicalOld = metadataLogicalName("targets/software");
	expect(logicalOld).toEqual({ ok: true, value: "targets%2Fsoftware.json" });
	if (logicalOld.ok)
		expect(decodeURIComponent(logicalOld.value.slice(0, -".json".length))).toBe(
			"targets/software",
		);
	expect(metadataFilename("targets/software", 5, true)).toEqual({
		ok: true,
		value: "5.targets%2Fsoftware.json",
	});

	for (const roleName of [
		"targets/../software",
		"targets/%2Fsoftware",
		"targets/%5csoftware",
	]) {
		const result = metadataFilename(roleName, 1, true);
		expect(result).toMatchObject({
			ok: false,
			reason: "degenerate-role-configuration",
		});
	}
});
