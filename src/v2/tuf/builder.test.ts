// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import {
	type RepositorySigningKeys,
	type RoleConfiguration,
	buildRepository,
} from "./builder";
import { canonicalizeTufJson } from "./canonical";
import { generateEd25519SigningKey } from "./ed25519";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import { evaluateRoleAuthorization } from "./role-graph";

async function keysFor(
	configuration: RoleConfiguration = {
		topLevelRoles: TOP_LEVEL_ROLES,
		delegatedRoles: DELEGATED_ROLES,
	},
): Promise<RepositorySigningKeys> {
	const generate = async (count: number) => {
		const keys = await Promise.all(
			Array.from({ length: count }, () => generateEd25519SigningKey()),
		);
		if (keys.some((key) => !key.ok))
			throw new Error("synthetic signing-key generation failed");
		return keys.map((key) => {
			if (!key.ok) throw new Error("unreachable generated-key failure");
			return key.value;
		});
	};
	const root = await generate(configuration.topLevelRoles.root?.keyCount ?? 0);
	const targets = await generate(
		configuration.topLevelRoles.targets?.keyCount ?? 0,
	);
	const snapshot = await generate(
		configuration.topLevelRoles.snapshot?.keyCount ?? 0,
	);
	const timestamp = await generate(
		configuration.topLevelRoles.timestamp?.keyCount ?? 0,
	);
	const delegated: Record<string, Awaited<ReturnType<typeof generate>>> = {};
	for (const role of configuration.delegatedRoles)
		delegated[role.name] = await generate(role.keyCount);
	return { root, targets, snapshot, timestamp, delegated };
}

function targetSet() {
	return {
		"software/release-1.json": {
			length: 12,
			hashes: { sha256: "a".repeat(64) },
		},
		"services/deployment-1.json": {
			length: 13,
			hashes: { sha256: "b".repeat(64) },
		},
		"verification/result-1.json": {
			length: 14,
			hashes: { sha256: "c".repeat(64) },
		},
		"legacy/manifest-1.json": {
			length: 15,
			hashes: { sha256: "d".repeat(64) },
		},
		"policy/authorization.json": {
			length: 16,
			hashes: { sha256: "e".repeat(64) },
		},
	};
}

function metaNames(repository: Awaited<ReturnType<typeof buildRepository>>) {
	if (!repository.ok) throw new Error(`build failed: ${repository.reason}`);
	const meta = repository.value.snapshot.envelope.signed.meta;
	if (meta === null || typeof meta !== "object" || Array.isArray(meta))
		throw new Error("snapshot meta missing");
	return Object.keys(meta).sort();
}

describe("buildRepository", () => {
	test("uses the landed default role configuration and injected time", async () => {
		const now = new Date("2030-01-02T03:04:05Z");
		const repository = await buildRepository({
			signingKeys: await keysFor(),
			targets: targetSet(),
			consistentSnapshot: true,
			now,
		});
		expect(repository.ok).toBe(true);
		if (!repository.ok) return;
		const expiry = (days: number) =>
			new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
				.toISOString()
				.replace(/\.\d{3}Z$/, "Z");
		expect(repository.value.root.envelope.signed.expires).toBe(
			expiry(TOP_LEVEL_ROLES.root.validityDays),
		);
		expect(repository.value.targets.envelope.signed.expires).toBe(
			expiry(TOP_LEVEL_ROLES.targets.validityDays),
		);
		expect(repository.value.snapshot.envelope.signed.expires).toBe(
			expiry(TOP_LEVEL_ROLES.snapshot.validityDays),
		);
		expect(repository.value.timestamp.envelope.signed.expires).toBe(
			expiry(TOP_LEVEL_ROLES.timestamp.validityDays),
		);
		const timestampExpiry = Date.parse(
			String(repository.value.timestamp.envelope.signed.expires),
		);
		const snapshotExpiry = Date.parse(
			String(repository.value.snapshot.envelope.signed.expires),
		);
		const targetsExpiry = Date.parse(
			String(repository.value.targets.envelope.signed.expires),
		);
		const rootExpiry = Date.parse(
			String(repository.value.root.envelope.signed.expires),
		);
		expect(timestampExpiry < snapshotExpiry).toBe(true);
		for (const metadata of repository.value.delegatedTargets) {
			const delegatedExpiry = Date.parse(
				String(metadata.envelope.signed.expires),
			);
			expect(
				snapshotExpiry < delegatedExpiry && delegatedExpiry < targetsExpiry,
			).toBe(true);
		}
		expect(targetsExpiry < rootExpiry).toBe(true);
		expect(repository.value.delegatedTargets).toHaveLength(
			DELEGATED_ROLES.length,
		);
		expect(metaNames(repository)).toEqual([
			"targets%2Flegacy.json",
			"targets%2Fservices.json",
			"targets%2Fsoftware.json",
			"targets%2Fverification.json",
			"targets.json",
		]);
	});

	test("changes snapshot meta when the supplied delegation configuration changes", async () => {
		const configuration: RoleConfiguration = {
			topLevelRoles: TOP_LEVEL_ROLES,
			delegatedRoles: DELEGATED_ROLES.filter(
				(role) => role.name !== "targets/legacy",
			),
		};
		const targets = {
			"software/release-1.json": {
				length: 12,
				hashes: { sha256: "a".repeat(64) },
			},
			"services/deployment-1.json": {
				length: 13,
				hashes: { sha256: "b".repeat(64) },
			},
			"verification/result-1.json": {
				length: 14,
				hashes: { sha256: "c".repeat(64) },
			},
			"policy/authorization.json": {
				length: 16,
				hashes: { sha256: "e".repeat(64) },
			},
		};
		const repository = await buildRepository({
			signingKeys: await keysFor(configuration),
			targets,
			consistentSnapshot: false,
			now: new Date("2030-01-02T03:04:05Z"),
			roleConfiguration: configuration,
		});
		expect(metaNames(repository)).toEqual([
			"targets%2Fservices.json",
			"targets%2Fsoftware.json",
			"targets%2Fverification.json",
			"targets.json",
		]);
	});

	test("a threshold-two root rejects one signature while threshold one accepts one", async () => {
		const twoOfTwo: RoleConfiguration = {
			topLevelRoles: {
				...TOP_LEVEL_ROLES,
				root: { ...TOP_LEVEL_ROLES.root, threshold: 2, keyCount: 2 },
			},
			delegatedRoles: DELEGATED_ROLES,
		};
		const built = await buildRepository({
			signingKeys: await keysFor(twoOfTwo),
			targets: targetSet(),
			consistentSnapshot: true,
			now: new Date("2030-01-02T03:04:05Z"),
			roleConfiguration: twoOfTwo,
		});
		if (!built.ok)
			throw new Error(`threshold-two build failed: ${built.reason}`);
		const rootSigned = canonicalizeTufJson(built.value.root.envelope.signed);
		if (!rootSigned.ok) throw new Error("root canonicalization failed");
		const rootRoles = built.value.root.envelope.signed.roles as Record<
			string,
			{ keyids: string[]; threshold: number }
		>;
		const rootKeys = built.value.root.envelope.signed.keys as Record<
			string,
			unknown
		>;
		const builtRootRole = rootRoles.root;
		if (builtRootRole === undefined) throw new Error("built root role missing");
		const firstSignature = built.value.root.envelope.signatures[0];
		if (firstSignature === undefined)
			throw new Error("built root signature missing");
		const rejected = await evaluateRoleAuthorization({
			role: builtRootRole,
			keys: rootKeys,
			signatures: [firstSignature],
			message: rootSigned.value,
		});
		expect(rejected).toMatchObject({ ok: false, reason: "threshold-unmet" });

		const oneOfOne: RoleConfiguration = {
			topLevelRoles: {
				...TOP_LEVEL_ROLES,
				root: { ...TOP_LEVEL_ROLES.root, threshold: 1, keyCount: 1 },
			},
			delegatedRoles: DELEGATED_ROLES,
		};
		const accepted = await buildRepository({
			signingKeys: await keysFor(oneOfOne),
			targets: targetSet(),
			consistentSnapshot: true,
			now: new Date("2030-01-02T03:04:05Z"),
			roleConfiguration: oneOfOne,
		});
		expect(accepted.ok).toBe(true);
	});
});
