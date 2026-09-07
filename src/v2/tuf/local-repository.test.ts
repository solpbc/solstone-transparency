// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type RepositorySigningKeys, buildRepository } from "./builder";
import { generateEd25519SigningKey } from "./ed25519";
import {
	authenticateLocalRepository,
	createLocalRepositoryFetcher,
} from "./local-repository";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import { serializeRepository } from "./serializer";
import { targetStoragePath } from "./target-storage";

const now = new Date("2030-01-02T03:04:05.000Z");

function hex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function digest(bytes: Uint8Array): Promise<string> {
	return hex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
		),
	);
}

async function keys(): Promise<RepositorySigningKeys> {
	const generate = async (count: number) => {
		const all = await Promise.all(
			Array.from({ length: count }, () => generateEd25519SigningKey()),
		);
		return all.map((key) => {
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
		targets: await generate(TOP_LEVEL_ROLES.targets.keyCount),
		snapshot: await generate(TOP_LEVEL_ROLES.snapshot.keyCount),
		timestamp: await generate(TOP_LEVEL_ROLES.timestamp.keyCount),
		delegated,
	};
}

async function fixture() {
	const directory = await mkdtemp("/var/tmp/solstone-local-repository-");
	const repositoryDirectory = join(directory, "repository");
	const targetPath = "software/journal/release.json";
	const targetBytes = new TextEncoder().encode("synthetic target");
	const targetSha256 = await digest(targetBytes);
	const repository = await buildRepository({
		signingKeys: await keys(),
		targets: {
			[targetPath]: {
				length: targetBytes.byteLength,
				hashes: { sha256: targetSha256 },
			},
		},
		consistentSnapshot: true,
		now,
	});
	if (!repository.ok)
		throw new Error(`repository build failed: ${repository.reason}`);
	const serialized = await serializeRepository(
		repository.value,
		join(repositoryDirectory, "metadata"),
	);
	if (!serialized.ok)
		throw new Error(`metadata write failed: ${serialized.reason}`);
	const storagePath = targetStoragePath(targetPath, {
		sha256: targetSha256,
		consistentSnapshot: true,
	});
	if (!storagePath.ok)
		throw new Error(`target path failed: ${storagePath.reason}`);
	await mkdir(join(repositoryDirectory, "targets", "software", "journal"), {
		recursive: true,
	});
	await writeFile(
		join(repositoryDirectory, "targets", storagePath.value),
		targetBytes,
	);
	return {
		directory,
		repositoryDirectory,
		rootPath: join(repositoryDirectory, "metadata", "1.root.json"),
		timestampSha256: await digest(repository.value.timestamp.bytes),
		storagePath: storagePath.value,
	};
}

test("authenticates a local consistent-snapshot repository from its supplied root", async () => {
	const created = await fixture();
	try {
		const result = await authenticateLocalRepository({
			repositoryDirectory: created.repositoryDirectory,
			rootPath: created.rootPath,
			expectedTimestampSha256: created.timestampSha256,
			now,
		});
		expect(result.ok).toBe(true);
		const fetched = await createLocalRepositoryFetcher(
			created.repositoryDirectory,
		).fetch(created.storagePath, 1024);
		expect(fetched.kind).toBe("ok");
	} finally {
		await rm(created.directory, { recursive: true, force: true });
	}
});

test("rejects a wrong timestamp pin and missing or corrupt caller root", async () => {
	const created = await fixture();
	try {
		const wrongPin = await authenticateLocalRepository({
			repositoryDirectory: created.repositoryDirectory,
			rootPath: created.rootPath,
			expectedTimestampSha256: "a".repeat(64),
			now,
		});
		expect(wrongPin).toMatchObject({ ok: false, reason: "hash-mismatch" });
		const missingRoot = await authenticateLocalRepository({
			repositoryDirectory: created.repositoryDirectory,
			rootPath: join(created.directory, "missing-root.json"),
			expectedTimestampSha256: created.timestampSha256,
			now,
		});
		expect(missingRoot).toMatchObject({
			ok: false,
			reason: "retrieval-failed",
		});
		const corruptRoot = join(created.directory, "corrupt-root.json");
		await writeFile(corruptRoot, "not a TUF root");
		const corrupt = await authenticateLocalRepository({
			repositoryDirectory: created.repositoryDirectory,
			rootPath: corruptRoot,
			expectedTimestampSha256: created.timestampSha256,
			now,
		});
		expect(corrupt.ok).toBe(false);
	} finally {
		await rm(created.directory, { recursive: true, force: true });
	}
});
