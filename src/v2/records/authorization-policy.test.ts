// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { loadDsseAuthorizationPolicy } from "./authorization-policy";
import {
	NOW,
	basePolicy,
	canonicalBytes,
	generatedKey,
} from "./records.test-support";

/**
 * CSO §4 transcribed independently. This must stay a local literal: deriving it
 * from the shipped fixture would not detect a policy-table transcription drift.
 */
const CSO_ROLES = [
	[
		"producer.release",
		"synthetic-release",
		1,
		[
			"https://transparency.solstone.app/predicates/v1/release-record",
			"https://transparency.solstone.app/predicates/v1/slsa-build-provenance-v1",
			"https://transparency.solstone.app/predicates/v1/spdx-sbom",
			"https://transparency.solstone.app/predicates/v1/native-platform-receipt",
			"https://transparency.solstone.app/predicates/v1/migration-manifest-v1-to-v2",
		],
		["software/{product}/**"],
		"sol pbc recorded these exact final bytes as a release",
	],
	[
		"producer.image",
		"synthetic-image-empty",
		1,
		[
			"https://transparency.solstone.app/predicates/v1/image-build",
			"https://transparency.solstone.app/predicates/v1/deployment",
		],
		["services/{service}/**"],
		"image identity; a promotion event",
	],
	[
		"verifier.repro",
		"synthetic-repro-empty",
		1,
		["https://transparency.solstone.app/predicates/v1/reproducibility-result"],
		["software/**"],
		"a named verifier reran a specified recipe and obtained this match/mismatch",
	],
	[
		"verifier.audit",
		"synthetic-audit",
		1,
		["https://transparency.solstone.app/predicates/v1/audit-result"],
		["**"],
		"the named verifier ran the declared checks",
	],
	[
		"appraiser.runtime",
		"synthetic-runtime-empty",
		1,
		["https://transparency.solstone.app/predicates/v1/runtime-attestation"],
		["services/{service}/instances/**"],
		"an appraiser verified this measurement at this time",
	],
	[
		"key-events",
		"root-quorum-no-standing-dsse-key",
		1,
		["https://transparency.solstone.app/predicates/v1/key-event"],
		["keys/**"],
		"key lifecycle facts under the root policy",
	],
] as const;

async function load(
	policy: ReturnType<typeof basePolicy>,
	releaseKey: Awaited<ReturnType<typeof generatedKey>>,
	auditKey: Awaited<ReturnType<typeof generatedKey>>,
	overrides: Partial<Parameters<typeof loadDsseAuthorizationPolicy>[0]> = {},
) {
	return loadDsseAuthorizationPolicy({
		bytes: await canonicalBytes(policy),
		now: NOW,
		evidenceKeys: {
			[releaseKey.keyId]: releaseKey.keyObject,
			[auditKey.keyId]: auditKey.keyObject,
		},
		tufRoleKeyids: new Set(),
		...overrides,
	});
}

describe("DSSE authorization policy", () => {
	test("AC 5z: the synthetic fixture transcribes all six approved roles", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const policy = basePolicy(release, audit);
		expect(policy.roles).toHaveLength(CSO_ROLES.length);
		for (const [index, expected] of CSO_ROLES.entries()) {
			const role = policy.roles[index];
			expect(role).toBeDefined();
			if (role === undefined)
				throw new Error("fixture policy omitted a CSO role");
			expect([
				role.id,
				role.key_label,
				role.threshold,
				role.predicate_types,
				role.subject_patterns,
				role.claim_ceiling,
			] as const).toEqual(expected);
			expect(role.issuance_window).toEqual({
				not_before: "2026-01-01T00:00:00.000Z",
				not_after: "2030-01-01T00:00:00.000Z",
			});
		}
		expect(policy.roles.map((role) => role.keyids.length)).toEqual([
			1, 0, 0, 1, 0, 0,
		]);
		expect((await load(policy, release, audit)).ok).toBe(true);
	});

	test("AC 5a and 5b: every key namespace collision and wildcard reject at load", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const collision = basePolicy(release, audit);
		collision.roles = collision.roles.map((role, index) =>
			index === 3 ? { ...role, keyids: [release.keyId] } : role,
		);
		expect(await load(collision, release, audit)).toMatchObject({
			ok: false,
			reason: "degenerate-role-configuration",
		});
		const appraiserCollision = basePolicy(release, audit);
		appraiserCollision.roles = appraiserCollision.roles.map((role, index) =>
			index === 4 ? { ...role, keyids: [release.keyId] } : role,
		);
		expect(await load(appraiserCollision, release, audit)).toMatchObject({
			ok: false,
			reason: "degenerate-role-configuration",
		});
		const tufCollision = basePolicy(release, audit);
		expect(
			await load(tufCollision, release, audit, {
				tufRoleKeyids: new Set([release.keyId]),
			}),
		).toMatchObject({ ok: false, reason: "degenerate-role-configuration" });
		const wildcard = basePolicy(release, audit);
		wildcard.roles = wildcard.roles.map((role, index) =>
			index === 0 ? { ...role, predicate_types: ["*"] } : role,
		);
		expect(await load(wildcard, release, audit)).toMatchObject({
			ok: false,
			reason: "malformed",
		});
	});

	test("AC 5y: policy version and effective_from reject independently", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const rollback = basePolicy(release, audit);
		expect(
			await load(rollback, release, audit, { trustedVersion: 1 }),
		).toMatchObject({ ok: false, reason: "version-rollback" });
		const future = basePolicy(release, audit);
		future.effective_from = "2028-01-01T00:00:00.000Z";
		expect(await load(future, release, audit)).toMatchObject({
			ok: false,
			reason: "outside-issuance-window",
		});
	});
});
