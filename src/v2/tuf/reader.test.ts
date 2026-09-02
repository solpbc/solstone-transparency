// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type BuiltMetadata,
	type RepositorySigningKeys,
	type RoleConfiguration,
	buildRepository,
} from "./builder";
import { canonicalizeTufJson } from "./canonical";
import { generateEd25519SigningKey, signEd25519 } from "./ed25519";
import { readRepository } from "./reader";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import { metadataFilename, serializeRepository } from "./serializer";

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

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

async function builtFixture() {
	const keys = await signingKeys();
	const repository = await buildRepository({
		signingKeys: keys,
		targets: {
			"software/release.json": {
				length: 1,
				hashes: { sha256: "a".repeat(64) },
			},
			"services/deployment.json": {
				length: 1,
				hashes: { sha256: "b".repeat(64) },
			},
			"verification/result.json": {
				length: 1,
				hashes: { sha256: "c".repeat(64) },
			},
			"legacy/manifest.json": { length: 1, hashes: { sha256: "d".repeat(64) } },
			"policy/authorization.json": {
				length: 1,
				hashes: { sha256: "e".repeat(64) },
			},
		},
		consistentSnapshot: true,
		now: new Date("2030-01-02T03:04:05Z"),
	});
	if (!repository.ok)
		throw new Error(`repository build failed: ${repository.reason}`);
	return { repository: repository.value, keys };
}

async function signedBytes(
	signed: Record<string, unknown>,
	privateKey: CryptoKey,
	keyId: string,
): Promise<Uint8Array> {
	const canonicalSigned = canonicalizeTufJson(signed);
	if (!canonicalSigned.ok) throw new Error("canonical signed metadata failed");
	const signature = await signEd25519(privateKey, canonicalSigned.value);
	if (!signature.ok) throw new Error("metadata signing failed");
	const envelope = canonicalizeTufJson({
		signed,
		signatures: [{ keyid: keyId, sig: bytesToHex(signature.value) }],
	});
	if (!envelope.ok) throw new Error("canonical envelope failed");
	return envelope.value;
}

async function writeRepository() {
	const fixture = await builtFixture();
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-reader-"),
	);
	try {
		const serialized = await serializeRepository(fixture.repository, directory);
		if (!serialized.ok)
			throw new Error(`serialization failed: ${serialized.reason}`);
		return { ...fixture, directory };
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	}
}

test("reads real serialized bytes and re-verifies every top-level and delegated role", async () => {
	const fixture = await writeRepository();
	try {
		const read = await readRepository(fixture.directory);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		expect(
			read.value.delegatedTargets.map((metadata) => metadata.roleName),
		).toEqual(DELEGATED_ROLES.map((role) => role.name));
	} finally {
		await rm(fixture.directory, { recursive: true, force: true });
	}
});

test("authorizes delegated targets using the verified repository delegation graph", async () => {
	const delegatedRoles = DELEGATED_ROLES.map((role) =>
		role.name === "targets/software"
			? { ...role, name: "targets/product" }
			: role,
	);
	const configuration: RoleConfiguration = {
		topLevelRoles: TOP_LEVEL_ROLES,
		delegatedRoles,
	};
	const keys = await signingKeys();
	const { "targets/software": productKeys, ...otherDelegated } = keys.delegated;
	if (productKeys === undefined)
		throw new Error("software signing keys missing");
	const repository = await buildRepository({
		signingKeys: {
			...keys,
			delegated: { ...otherDelegated, "targets/product": productKeys },
		},
		targets: {
			"software/release.json": {
				length: 1,
				hashes: { sha256: "a".repeat(64) },
			},
		},
		consistentSnapshot: true,
		now: new Date("2030-01-02T03:04:05Z"),
		roleConfiguration: configuration,
	});
	if (!repository.ok)
		throw new Error(`custom repository build failed: ${repository.reason}`);
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-reader-"),
	);
	try {
		const serialized = await serializeRepository(repository.value, directory);
		if (!serialized.ok)
			throw new Error(`custom serialization failed: ${serialized.reason}`);
		const read = await readRepository(directory);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		expect(
			read.value.delegatedTargets.map((metadata) => metadata.roleName),
		).toContain("targets/product");
		expect(
			read.value.delegatedTargets.map((metadata) => metadata.roleName),
		).not.toContain("targets/software");
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("a byte flip in one written role fails that role's signature while baseline peers verify", async () => {
	const fixture = await writeRepository();
	try {
		expect((await readRepository(fixture.directory)).ok).toBe(true);
		const filename = metadataFilename("targets/software", 1, true);
		if (!filename.ok) throw new Error("delegated targets filename failed");
		const path = join(fixture.directory, filename.value);
		const bytes = new Uint8Array(await readFile(path));
		const needle = new TextEncoder().encode("software/release.json");
		const index = Array.from(
			{ length: bytes.length - needle.length + 1 },
			(_, start) => start,
		).find((start) =>
			needle.every((byte, offset) => bytes[start + offset] === byte),
		);
		if (index === undefined) throw new Error("target fixture byte missing");
		bytes[index] = bytes[index] === 0x73 ? 0x74 : 0x73;
		await writeFile(path, bytes);
		const read = await readRepository(fixture.directory);
		expect(read).toMatchObject({ ok: false, reason: "signature-invalid" });
	} finally {
		await rm(fixture.directory, { recursive: true, force: true });
	}
});

test("checks identity and filename version before a mismatched document signature", async () => {
	const fixture = await writeRepository();
	try {
		await writeFile(
			join(fixture.directory, "timestamp.json"),
			fixture.repository.snapshot.bytes,
		);
		expect(await readRepository(fixture.directory)).toMatchObject({
			ok: false,
			reason: "metadata-type-mismatch",
		});
	} finally {
		await rm(fixture.directory, { recursive: true, force: true });
	}

	const versionFixture = await writeRepository();
	try {
		const alteredSigned = {
			...versionFixture.repository.targets.envelope.signed,
			version: 3,
		};
		const altered = canonicalizeTufJson({
			signed: alteredSigned,
			signatures: versionFixture.repository.targets.envelope.signatures,
		});
		if (!altered.ok)
			throw new Error("altered target envelope canonicalization failed");
		await writeFile(
			join(versionFixture.directory, "1.targets.json"),
			altered.value,
		);
		expect(await readRepository(versionFixture.directory)).toMatchObject({
			ok: false,
			reason: "filename-version-mismatch",
		});
	} finally {
		await rm(versionFixture.directory, { recursive: true, force: true });
	}
});

test("rejects genuinely signed but unauthorized delegated and top-level commitments targets", async () => {
	const cases: {
		roleName: string;
		targetPath: string;
		metadata: (
			fixture: Awaited<ReturnType<typeof writeRepository>>,
		) => BuiltMetadata;
		key: (fixture: Awaited<ReturnType<typeof writeRepository>>) => {
			privateKey: CryptoKey;
			keyId: string;
		};
	}[] = [
		{
			roleName: "targets/services",
			targetPath: "software/wrong-sibling.json",
			metadata: (fixture) => {
				const metadata = fixture.repository.delegatedTargets.find(
					(item) => item.roleName === "targets/services",
				);
				if (metadata === undefined)
					throw new Error("services metadata missing");
				return metadata;
			},
			key: (fixture) => {
				const key = fixture.keys.delegated["targets/services"]?.[0];
				if (key === undefined) throw new Error("services key missing");
				return key;
			},
		},
		{
			roleName: "targets/software",
			targetPath: "policy/wrong-authority.json",
			metadata: (fixture) => {
				const metadata = fixture.repository.delegatedTargets.find(
					(item) => item.roleName === "targets/software",
				);
				if (metadata === undefined)
					throw new Error("software metadata missing");
				return metadata;
			},
			key: (fixture) => {
				const key = fixture.keys.delegated["targets/software"]?.[0];
				if (key === undefined) throw new Error("software key missing");
				return key;
			},
		},
		{
			roleName: "targets/verification",
			targetPath: "commitments/delegated.json",
			metadata: (fixture) => {
				const metadata = fixture.repository.delegatedTargets.find(
					(item) => item.roleName === "targets/verification",
				);
				if (metadata === undefined)
					throw new Error("verification metadata missing");
				return metadata;
			},
			key: (fixture) => {
				const key = fixture.keys.delegated["targets/verification"]?.[0];
				if (key === undefined) throw new Error("verification key missing");
				return key;
			},
		},
		{
			roleName: "targets",
			targetPath: "commitments/top-level.json",
			metadata: (fixture) => fixture.repository.targets,
			key: (fixture) => {
				const key = fixture.keys.targets[0];
				if (key === undefined) throw new Error("targets key missing");
				return key;
			},
		},
	];
	for (const fixtureCase of cases) {
		const fixture = await writeRepository();
		try {
			const metadata = fixtureCase.metadata(fixture);
			const key = fixtureCase.key(fixture);
			const signed = {
				...metadata.envelope.signed,
				targets: {
					[fixtureCase.targetPath]: {
						length: 1,
						hashes: { sha256: "f".repeat(64) },
					},
				},
			};
			const filename = metadataFilename(
				fixtureCase.roleName,
				metadata.version,
				true,
			);
			if (!filename.ok) throw new Error("metadata filename failed");
			await writeFile(
				join(fixture.directory, filename.value),
				await signedBytes(signed, key.privateKey, key.keyId),
			);
			expect(await readRepository(fixture.directory)).toMatchObject({
				ok: false,
				reason: "role-not-authorized",
			});
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}
});
