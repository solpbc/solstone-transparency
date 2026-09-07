// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type RepositorySigningKeys, buildRepository } from "./builder";
import { parseClientMetadata } from "./client-metadata";
import type { TufClientSuccess } from "./client-result";
import { type Ed25519SigningKey, generateEd25519SigningKey } from "./ed25519";
import { authenticateLocalRepository } from "./local-repository";
import { refreshTimestamp, renewTufMetadata } from "./metadata-renewal";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import { serializeRepository } from "./serializer";
import { targetStoragePath } from "./target-storage";

const now = new Date("2030-01-02T03:04:05.000Z");

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function sha256(bytes: Uint8Array): Promise<string> {
	return bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
		),
	);
}

async function signingKeys(): Promise<RepositorySigningKeys> {
	const generate = async (count: number) => {
		const generated = await Promise.all(
			Array.from({ length: count }, () => generateEd25519SigningKey()),
		);
		return generated.map((key) => {
			if (!key.ok)
				throw new Error(`synthetic key generation failed: ${key.reason}`);
			return key.value;
		});
	};
	const delegated: Record<string, Ed25519SigningKey[]> = {};
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

interface Fixture {
	directory: string;
	repositoryDirectory: string;
	keys: RepositorySigningKeys;
	state: TufClientSuccess;
	expectedTimestampSha256: string;
}

async function fixture(
	targetPath = "software/journal/release.json",
): Promise<Fixture> {
	const directory = await mkdtemp("/var/tmp/solstone-metadata-renewal-");
	const repositoryDirectory = join(directory, "repository");
	const keys = await signingKeys();
	const targetBytes = new TextEncoder().encode("synthetic target bytes");
	const targetSha256 = await sha256(targetBytes);
	const built = await buildRepository({
		signingKeys: keys,
		targets: {
			[targetPath]: {
				length: targetBytes.byteLength,
				hashes: { sha256: targetSha256 },
			},
		},
		consistentSnapshot: true,
		now,
	});
	if (!built.ok) throw new Error(`build failed: ${built.reason}`);
	const serialized = await serializeRepository(
		built.value,
		join(repositoryDirectory, "metadata"),
	);
	if (!serialized.ok) throw new Error(`serialize failed: ${serialized.reason}`);
	const storage = targetStoragePath(targetPath, {
		sha256: targetSha256,
		consistentSnapshot: true,
	});
	if (!storage.ok) throw new Error(`target storage failed: ${storage.reason}`);
	await mkdir(
		join(repositoryDirectory, "targets", ...targetPath.split("/").slice(0, -1)),
		{
			recursive: true,
		},
	);
	await writeFile(
		join(repositoryDirectory, "targets", storage.value),
		targetBytes,
	);
	const expectedTimestampSha256 = await sha256(built.value.timestamp.bytes);
	const authenticated = await authenticateLocalRepository({
		repositoryDirectory,
		rootPath: join(repositoryDirectory, "metadata", "1.root.json"),
		expectedTimestampSha256,
		now,
	});
	if (!authenticated.ok)
		throw new Error(`authentication failed: ${authenticated.reason}`);
	return {
		directory,
		repositoryDirectory,
		keys,
		state: authenticated.value,
		expectedTimestampSha256,
	};
}

async function writeRenewal(
	fixture: Fixture,
	bytes: readonly { filename: string; bytes: Uint8Array }[],
) {
	for (const metadata of bytes) {
		await writeFile(
			join(fixture.repositoryDirectory, "metadata", metadata.filename),
			metadata.bytes,
		);
	}
}

test("refreshTimestamp is the timestamp-only renewal wrapper", async () => {
	const created = await fixture();
	try {
		const direct = await renewTufMetadata({
			priorState: created.state,
			expectedPriorTimestampSha256: created.expectedTimestampSha256,
			roleName: "timestamp",
			keys: { timestamp: created.keys.timestamp[0] as Ed25519SigningKey },
			now,
		});
		const wrapped = await refreshTimestamp({
			priorState: created.state,
			expectedPriorTimestampSha256: created.expectedTimestampSha256,
			timestampKey: created.keys.timestamp[0] as Ed25519SigningKey,
			now,
		});
		expect(direct).toEqual(wrapped);
		if (!direct.ok) return;
		expect(direct.value.renewedRoles).toHaveLength(1);
		expect(direct.value.renewedRoles[0]?.version).toBe(2);
		const oldMeta =
			created.state.authenticatedMetadata.timestamp?.envelope.signed.meta;
		const parsed = parseClientMetadata(
			"timestamp",
			"timestamp.json",
			direct.value.renewedRoles[0]?.bytes as Uint8Array,
		);
		if (!parsed.ok) throw new Error("renewed timestamp did not parse");
		expect(parsed.value.signed.meta).toEqual(oldMeta);
	} finally {
		await rm(created.directory, { recursive: true, force: true });
	}
});

test("snapshot renewal cascades while preserving unrelated descriptors", async () => {
	const created = await fixture();
	try {
		const oldMeta = created.state.authenticatedMetadata.snapshot?.envelope
			.signed.meta as Record<string, unknown>;
		const renewed = await renewTufMetadata({
			priorState: created.state,
			expectedPriorTimestampSha256: created.expectedTimestampSha256,
			roleName: "snapshot",
			keys: {
				snapshot: created.keys.snapshot[0] as Ed25519SigningKey,
				timestamp: created.keys.timestamp[0] as Ed25519SigningKey,
			},
			now,
		});
		expect(renewed.ok).toBe(true);
		if (!renewed.ok) return;
		expect(renewed.value.renewedRoles.map((role) => role.version)).toEqual([
			2, 2,
		]);
		const parsed = parseClientMetadata(
			"snapshot",
			"2.snapshot.json",
			renewed.value.renewedRoles[0]?.bytes as Uint8Array,
		);
		if (!parsed.ok) throw new Error("renewed snapshot did not parse");
		expect(
			(parsed.value.signed.meta as Record<string, unknown>)[
				"targets-services.json"
			],
		).toEqual(oldMeta["targets-services.json"]);
	} finally {
		await rm(created.directory, { recursive: true, force: true });
	}
});

test("targets-software renewal preserves targets, cascades, and re-verifies", async () => {
	const created = await fixture();
	try {
		const originalTargets =
			created.state.authenticatedMetadata["targets-software"]?.envelope.signed
				.targets;
		const renewed = await renewTufMetadata({
			priorState: created.state,
			expectedPriorTimestampSha256: created.expectedTimestampSha256,
			roleName: "targets-software",
			keys: {
				"targets-software": created.keys.delegated[
					"targets-software"
				]?.[0] as Ed25519SigningKey,
				snapshot: created.keys.snapshot[0] as Ed25519SigningKey,
				timestamp: created.keys.timestamp[0] as Ed25519SigningKey,
			},
			now,
		});
		expect(renewed.ok).toBe(true);
		if (!renewed.ok) return;
		expect(renewed.value.renewedRoles.map((role) => role.version)).toEqual([
			2, 2, 2,
		]);
		const parsed = parseClientMetadata(
			"targets-software",
			"2.targets-software.json",
			renewed.value.renewedRoles[0]?.bytes as Uint8Array,
		);
		if (!parsed.ok) throw new Error("renewed delegated metadata did not parse");
		expect(parsed.value.signed.targets).toEqual(originalTargets);
		await writeRenewal(created, renewed.value.renewedRoles);
		const reverified = await authenticateLocalRepository({
			repositoryDirectory: created.repositoryDirectory,
			rootPath: join(created.repositoryDirectory, "metadata", "1.root.json"),
			expectedTimestampSha256: renewed.value.newTimestampSha256,
			now,
		});
		expect(reverified.ok).toBe(true);
	} finally {
		await rm(created.directory, { recursive: true, force: true });
	}
});

for (const [roleName, targetPath] of [
	["targets", "policy/renewal-fixture.json"],
	["targets-services", "services/renewal-fixture.json"],
	["targets-verification", "verification/renewal-fixture.json"],
	["targets-legacy", "legacy/renewal-fixture.json"],
] as const) {
	test(`${roleName} renewal preserves its populated targets and authority through the full chain`, async () => {
		const created = await fixture(targetPath);
		try {
			const selectedKey =
				roleName === "targets"
					? created.keys.targets[0]
					: created.keys.delegated[roleName]?.[0];
			const snapshotKey = created.keys.snapshot[0];
			const timestampKey = created.keys.timestamp[0];
			const unrelatedKey = created.keys.delegated["targets-software"]?.[0];
			if (!selectedKey || !snapshotKey || !timestampKey || !unrelatedKey) {
				throw new Error("synthetic fixture lacks required role keys");
			}
			const original = created.state.authenticatedMetadata[roleName];
			if (!original) throw new Error("fixture lacks selected metadata");
			expect(
				Object.keys(created.state.authenticatedTargets[roleName] ?? {}),
			).toEqual([targetPath]);
			const renewalNow = new Date(now.getTime() + 3_600_000);
			const input = {
				priorState: created.state,
				expectedPriorTimestampSha256: created.expectedTimestampSha256,
				roleName,
				keys: {
					[roleName]: selectedKey,
					snapshot: snapshotKey,
					timestamp: timestampKey,
				},
				now: renewalNow,
			};
			await expect(
				renewTufMetadata({
					...input,
					keys: { ...input.keys, "targets-software": unrelatedKey },
				}),
			).resolves.toMatchObject({ ok: false, reason: "malformed" });
			await expect(
				renewTufMetadata({
					...input,
					keys: { ...input.keys, [roleName]: unrelatedKey },
				}),
			).resolves.toMatchObject({ ok: false, reason: "key-not-in-role" });

			const renewed = await renewTufMetadata(input);
			expect(renewed.ok).toBe(true);
			if (!renewed.ok) throw new Error(`renewal failed: ${renewed.reason}`);
			expect(
				renewed.value.renewedRoles.map((metadata) => metadata.filename),
			).toEqual([`2.${roleName}.json`, "2.snapshot.json", "timestamp.json"]);
			await writeRenewal(created, renewed.value.renewedRoles);
			const reverified = await authenticateLocalRepository({
				repositoryDirectory: created.repositoryDirectory,
				rootPath: join(created.repositoryDirectory, "metadata", "1.root.json"),
				expectedTimestampSha256: renewed.value.newTimestampSha256,
				now: renewalNow,
			});
			expect(reverified.ok).toBe(true);
			if (!reverified.ok)
				throw new Error(`composed renewal rejected: ${reverified.reason}`);
			expect(reverified.value.authenticatedTargets).toEqual(
				created.state.authenticatedTargets,
			);
			for (const [name, previous] of Object.entries(
				created.state.authenticatedMetadata,
			)) {
				const current = reverified.value.authenticatedMetadata[name];
				if (!current) throw new Error(`renewal lost metadata role ${name}`);
				if ([roleName, "snapshot", "timestamp"].includes(name)) {
					expect(current.version).toBe(previous.version + 1);
					expect(
						Date.parse(String(current.envelope.signed.expires)) -
							Date.parse(String(previous.envelope.signed.expires)),
					).toBe(3_600_000);
				} else {
					expect(current.bytes).toEqual(previous.bytes);
				}
			}
			const selected = reverified.value.authenticatedMetadata[roleName];
			if (!selected) throw new Error("renewal lost selected role");
			const {
				version: oldVersion,
				expires: oldExpiry,
				...oldDeclaration
			} = original.envelope.signed;
			const {
				version: newVersion,
				expires: newExpiry,
				...newDeclaration
			} = selected.envelope.signed;
			expect(newDeclaration).toEqual(oldDeclaration);
			expect(newVersion).not.toBe(oldVersion);
			expect(newExpiry).not.toBe(oldExpiry);
		} finally {
			await rm(created.directory, { recursive: true, force: true });
		}
	});
}

test("rejects unauthorized, mismatched, and expired renewal inputs", async () => {
	const created = await fixture();
	try {
		const unrelated = await generateEd25519SigningKey();
		if (!unrelated.ok) throw new Error("synthetic key generation failed");
		const unauthorized = await renewTufMetadata({
			priorState: created.state,
			expectedPriorTimestampSha256: created.expectedTimestampSha256,
			roleName: "timestamp",
			keys: { timestamp: unrelated.value },
			now,
		});
		expect(unauthorized).toMatchObject({
			ok: false,
			reason: "key-not-in-role",
		});
		const extraKey = await renewTufMetadata({
			priorState: created.state,
			expectedPriorTimestampSha256: created.expectedTimestampSha256,
			roleName: "timestamp",
			keys: {
				timestamp: created.keys.timestamp[0] as Ed25519SigningKey,
				snapshot: created.keys.snapshot[0] as Ed25519SigningKey,
			},
			now,
		});
		expect(extraKey).toMatchObject({ ok: false, reason: "malformed" });
		const service = created.state.authenticatedMetadata["targets-services"];
		if (service === undefined)
			throw new Error("fixture lacks targets-services");
		(created.state.authenticatedMetadata as Record<string, unknown>)[
			"targets-services"
		] = {
			...service,
			envelope: {
				...service.envelope,
				signed: { ...service.envelope.signed, expires: "2030-01-01T00:00:00Z" },
			},
		};
		const expired = await renewTufMetadata({
			priorState: created.state,
			expectedPriorTimestampSha256: created.expectedTimestampSha256,
			roleName: "timestamp",
			keys: { timestamp: created.keys.timestamp[0] as Ed25519SigningKey },
			now,
		});
		expect(expired).toMatchObject({ ok: false, reason: "expired" });
	} finally {
		await rm(created.directory, { recursive: true, force: true });
	}
});
