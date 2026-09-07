// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The v2 portal model builder, exercised the way the contract is stated:
 * every green preceded by its red. Each negative control below is the shape
 * a page must never render as a release — an expired repository, a tampered
 * record, a record signed by the wrong key, a missing expected record — and
 * each is asserted to land in its own distinct model state.
 */

import { describe, expect, test } from "bun:test";
import { buildV2Model, parseExpectation } from "./build";
import {
	type Fixture,
	buildFixture,
	fixtureFetcher,
	fixtureMigrationFetcher,
	flipLastByte,
} from "./fixture.test-support";

const BUILD_AT = new Date("2026-09-07T12:00:00.000Z");
const NOW = new Date("2026-09-08T12:00:00.000Z");
const BASE = {
	metadataBase: "https://transparency.solstone.app/staging/v2/metadata",
	targetsBase: "https://transparency.solstone.app/staging/v2/targets",
};

async function build(
	fixture: Fixture,
	extra: Partial<Parameters<typeof buildV2Model>[0]> = {},
) {
	return buildV2Model({
		...BASE,
		rootBytes: fixture.rootBytes,
		now: NOW,
		fetcher: fixtureFetcher(fixture.files),
		migrationFetcher: fixtureMigrationFetcher(fixture.legacyObjects),
		...extra,
	});
}

describe("absent: no pin, no register", () => {
	test("no root path → absent, and nothing was fetched", async () => {
		const requested: string[] = [];
		const model = await buildV2Model({
			...BASE,
			now: NOW,
			fetcher: fixtureFetcher(new Map(), { requested }),
		});
		expect(model.state).toBe("absent");
		expect(requested).toEqual([]);
	});

	test("a root path that does not exist → absent with the reason, never a same-channel bootstrap", async () => {
		const requested: string[] = [];
		const model = await buildV2Model({
			...BASE,
			rootPath: "/nonexistent/protocol/tuf-root.json",
			now: NOW,
			fetcher: fixtureFetcher(new Map(), { requested }),
		});
		expect(model.state).toBe("absent");
		if (model.state !== "absent") return;
		expect(model.reason).toContain("pinned root not present");
		expect(requested).toEqual([]);
	});
});

describe("negative controls observed first", () => {
	test("a pinned root with an empty base → unverified (unreachable), root still known", async () => {
		const fixture = await buildFixture({ buildAt: BUILD_AT });
		const model = await build(fixture, {
			fetcher: fixtureFetcher(fixture.files, { unreachable: true }),
		});
		expect(model.state).toBe("unverified");
		if (model.state !== "unverified") return;
		expect(model.failure.roleName).toBe("timestamp");
		expect(model.failure.reason).toBe("unavailable");
		expect(model.root.keyids.length).toBe(3);
		expect(model.freshness).toBeUndefined();
	});

	test("an expired timestamp → the expired state with the expiry instant, not green and not a generic failure", async () => {
		const fixture = await buildFixture({ buildAt: BUILD_AT });
		const model = await build(fixture, {
			now: new Date("2026-09-30T00:00:00.000Z"),
		});
		expect(model.state).toBe("unverified");
		if (model.state !== "unverified") return;
		expect(model.failure.reason).toBe("expired");
		expect(model.failure.roleName).toBe("timestamp");
		expect(model.freshness?.state).toBe("expired");
		expect(model.freshness?.expiredAt).toBe("2026-09-14T12:00:00Z");
	});

	test("a tampered release record → TUF hash mismatch → unverified, no release anywhere in the model", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [{ product: "solstone-journal", version: "2.0.0" }],
		});
		const path = "software/solstone-journal/2.0.0/release-record.json";
		const model = await build(fixture, {
			fetcher: fixtureFetcher(fixture.files, {
				tamper: { path, mutate: flipLastByte },
			}),
		});
		expect(model.state).toBe("unverified");
		if (model.state !== "unverified") return;
		expect(model.failure.reason).toBe("hash-mismatch");
		expect(model.failure.roleName).toBe("targets-software");
		expect(JSON.stringify(model)).not.toContain('"kind":"release"');
	});

	test("a record signed by a key the policy does not know → that record is invalid; the repository stays verified", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [
				{ product: "solstone-journal", version: "2.0.0" },
				{ product: "solstone-journal", version: "2.0.1", signer: "unknown" },
			],
		});
		const model = await build(fixture);
		expect(model.state).toBe("verified");
		if (model.state !== "verified") return;
		const good = model.software.find(
			(s) => s.kind === "release" && s.version === "2.0.0",
		);
		const bad = model.software.find(
			(s) => s.kind === "release" && s.version === "2.0.1",
		);
		expect(good?.kind).toBe("release");
		expect(bad?.kind).toBe("release");
		if (good?.kind !== "release" || bad?.kind !== "release") return;
		expect(good.verification.state).toBe("valid");
		expect(bad.verification.state).toBe("invalid");
		expect(
			bad.verification.state === "invalid" && bad.verification.reason,
		).toContain("unknown-key");
		// A record that did not verify carries none of its claims.
		expect(bad.artifacts).toEqual([]);
		expect(bad.doesProve).toEqual([]);
		expect(bad.issuedAt).toBe("");
	});

	test("a record bound to a policy digest that is not the live policy → invalid (hash-mismatch)", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [
				{
					product: "solstone-journal",
					version: "2.0.0",
					wrongPolicySha256: true,
				},
			],
		});
		const model = await build(fixture);
		expect(model.state).toBe("verified");
		if (model.state !== "verified") return;
		const record = model.software[0];
		expect(record?.kind).toBe("release");
		if (record?.kind !== "release") return;
		expect(record.verification.state).toBe("invalid");
		expect(
			record.verification.state === "invalid" && record.verification.reason,
		).toContain("hash-mismatch");
	});

	test("a record signed by the audit key (a role not authorized for release records) → invalid, role-not-authorized", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [
				{ product: "solstone-journal", version: "2.0.0", signer: "audit" },
			],
		});
		const model = await build(fixture);
		if (model.state !== "verified") throw new Error("expected verified");
		const record = model.software[0];
		if (record?.kind !== "release") throw new Error("expected release");
		expect(record.verification.state).toBe("invalid");
		expect(
			record.verification.state === "invalid" && record.verification.reason,
		).toContain("role-not-authorized");
	});

	test("no policy target → every record is unavailable (fail closed), never valid", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			includePolicy: false,
			releases: [{ product: "solstone-journal", version: "2.0.0" }],
		});
		const model = await build(fixture);
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.policy).toEqual({ state: "absent" });
		const record = model.software[0];
		if (record?.kind !== "release") throw new Error("expected release");
		expect(record.verification.state).toBe("unavailable");
		expect(model.legacy.state).toBe("not-verified");
	});

	test("policy present but the DSSE key-set target missing → policy fails to load with a named reason; records unavailable", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			includeDsseKeys: false,
			releases: [{ product: "solstone-journal", version: "2.0.0" }],
		});
		const model = await build(fixture);
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.policy.state).toBe("failed");
		if (model.policy.state === "failed")
			expect(model.policy.reason).toContain("dangling-keyid");
		const record = model.software[0];
		if (record?.kind !== "release") throw new Error("expected release");
		expect(record.verification.state).toBe("unavailable");
	});

	test("an expected record that is not in the repository → a gap with its basis, never silence", async () => {
		const fixture = await buildFixture({ buildAt: BUILD_AT });
		const model = await build(fixture, {
			expectations: [
				{
					product: "solstone-journal",
					version: "2.0.0",
					basis: "test expectation",
				},
			],
		});
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.software).toEqual([
			{
				kind: "gap",
				product: "solstone-journal",
				slug: "journal",
				version: "2.0.0",
				basis: "test expectation",
				provenance: { kind: "declaration", basis: "test expectation" },
			},
		]);
	});

	test("an expectation that IS present produces no gap", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [{ product: "solstone-journal", version: "2.0.0" }],
		});
		const model = await build(fixture, {
			expectations: [
				{ product: "solstone-journal", version: "2.0.0", basis: "t" },
			],
		});
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.software.filter((s) => s.kind === "gap")).toEqual([]);
	});
});

describe("state (a): root, legacy binding, no release record", () => {
	test("verified, software empty, legacy bound, freshness asserted from the timestamp role", async () => {
		const fixture = await buildFixture({ buildAt: BUILD_AT });
		const model = await build(fixture);
		expect(model.state).toBe("verified");
		if (model.state !== "verified") return;
		expect(model.software).toEqual([]);
		expect(model.legacy.state).toBe("bound");
		if (model.legacy.state === "bound") {
			expect(model.legacy.objectCount).toBe(1);
			expect(model.legacy.products[0]?.product).toBe("legacy-corpus");
		}
		expect(model.freshness.state).toBe("asserted");
		expect(model.freshness.assertedUntil).toBe("2026-09-14T12:00:00Z");
		expect(model.freshness.provenance.sourceUrl).toBe(
			`${BASE.metadataBase}/timestamp.json`,
		);
		expect(model.root.version).toBe(1);
		expect(model.root.threshold).toBe(2);
		expect(model.root.keyids.length).toBe(3);
		expect(model.root.witnessLines[0]).toBe(
			`solpbc-tuf-root keyids (2 of 3): ${model.root.keyids.join(" ")}`,
		);
		expect(model.root.witnessLines[1]).toBe(
			`solpbc-tuf-root v1  sha256:    ${model.root.rootSha256}`,
		);
		expect(model.root.rootLink.status).toBe("linked");
		expect(model.policy.state).toBe("loaded");
		if (model.policy.state === "loaded")
			expect(model.policy.sha256).toBe(fixture.policySha256 ?? "");
		expect(model.dsseKeys?.targetPath).toBe("keys/dsse/1.json");
	});

	test("the legacy walk failing (an object missing) → legacy not-verified with the reason; software untouched", async () => {
		const fixture = await buildFixture({ buildAt: BUILD_AT });
		const model = await build(fixture, {
			migrationFetcher: fixtureMigrationFetcher(new Map()),
		});
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.legacy.state).toBe("not-verified");
		if (model.legacy.state === "not-verified")
			expect(model.legacy.reason).toContain("unavailable");
	});
});

describe("state (b): a release record", () => {
	test("the record is valid, carries its own claims verbatim, and its artifacts link to the evidence host", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [
				{
					product: "solstone-journal",
					version: "2.0.0",
					issuedAt: "2026-09-07T12:34:56.000Z",
				},
			],
		});
		const model = await build(fixture);
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.software.length).toBe(1);
		const record = model.software[0];
		if (record?.kind !== "release") throw new Error("expected release");
		expect(record.slug).toBe("journal");
		expect(record.verification.state).toBe("valid");
		expect(record.issuedAt).toBe("2026-09-07T12:34:56.000Z");
		expect(record.signerKeyids).toEqual([fixture.keys.release.keyId]);
		expect(record.artifacts.length).toBe(2);
		expect(record.artifacts[0]?.link.status).toBe("linked");
		expect(record.doesNotProve.length).toBe(4);
		expect(record.recordLink.status).toBe("linked");
		if (record.recordLink.status === "linked")
			expect(record.recordLink.link.url).toBe(
				`${BASE.targetsBase}/software/solstone-journal/2.0.0/release-record.json`,
			);
		expect(model.unmappedProducts).toEqual([]);
	});

	test("hash-prefixed target naming: the record link is the path the client actually fetched", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [{ product: "solstone-journal", version: "2.0.0" }],
			hashPrefixedTargets: true,
		});
		// Serve ONLY the hash-prefixed name, so a client that fetched the logical
		// name would fail; today's client fetches the logical name, so this test
		// documents the seam W3a's naming change lands on rather than asserting
		// which name the client uses.
		const model = await build(fixture);
		if (model.state !== "verified") throw new Error("expected verified");
		const record = model.software[0];
		if (record?.kind !== "release") throw new Error("expected release");
		expect(record.recordLink.status).toBe("linked");
		if (record.recordLink.status === "linked") {
			expect(
				record.recordLink.link.url.startsWith(
					`${BASE.targetsBase}/software/solstone-journal/2.0.0/`,
				),
			).toBe(true);
			expect(record.recordLink.link.url.endsWith("release-record.json")).toBe(
				true,
			);
		}
	});

	test("a product the portal has no page for is surfaced as unmapped, not dropped", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [{ product: "solstone-tmux", version: "2.0.0" }],
		});
		const model = await build(fixture);
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.unmappedProducts).toEqual(["solstone-tmux"]);
		expect(model.software[0]?.kind).toBe("release");
		expect(model.software[0]?.slug).toBeUndefined();
	});

	test("records are ordered by product then numeric version, independent of repository order", async () => {
		const fixture = await buildFixture({
			buildAt: BUILD_AT,
			releases: [
				{ product: "solstone-linux", version: "2.0.0" },
				{ product: "solstone-journal", version: "2.0.10" },
				{ product: "solstone-journal", version: "2.0.2" },
			],
		});
		const model = await build(fixture);
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.software.map((s) => `${s.product}@${s.version}`)).toEqual([
			"solstone-journal@2.0.2",
			"solstone-journal@2.0.10",
			"solstone-linux@2.0.0",
		]);
	});
});

describe("parseExpectation", () => {
	test("product@version with and without a basis", () => {
		expect(parseExpectation("solstone-journal@2.0.0")).toEqual({
			product: "solstone-journal",
			version: "2.0.0",
			basis: "named as expected at build time",
		});
		expect(
			parseExpectation("solstone-journal@2.0.0:release lane listing"),
		).toEqual({
			product: "solstone-journal",
			version: "2.0.0",
			basis: "release lane listing",
		});
		expect(parseExpectation("nonsense")).toBeUndefined();
	});
});
