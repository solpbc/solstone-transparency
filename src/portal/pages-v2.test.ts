// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The portal's v2 register view, rendered against synthetic v2 models built
 * by the real builder over the in-memory fixture, in every state the
 * claim-ceiling spec names: absent (today's pages, byte-identical), (a) root
 * and legacy binding with no release record, (b) a release record, and the
 * verifier's own report when the repository did not verify or had expired.
 *
 * Two things are asserted page by page rather than trusted from the copy
 * file: the v2 claim ceiling's forbidden reader-facing words never appear in
 * new copy, and the Wave 1 structural guarantees (four separate axes, no
 * composite verdict, zero script, no foreign hrefs, every internal href
 * resolving) still hold with a v2 model present.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { buildPortalModel } from "../legacy/adapter";
import {
	HOME_PUBLICATION_DECLARATION,
	KEYS_ROLE_STATEMENT,
	VERIFY_METHOD_INTRO,
	WINDOWS_ABSENCE_EXPLAINER,
} from "../legacy/copy";
import {
	FakeFetcher,
	TEST_KEY_FILENAME,
	generateThrowawayKeypair,
	seedProductChain,
} from "../legacy/test-helpers";
import type { PortalModelResult } from "../legacy/types";
import { buildV2Model } from "../v2view/build";
import {
	AXIS_PUBLICATION_A,
	AXIS_PUBLICATION_B,
	HOME_PUBLICATION_DECLARATION_A,
	HOME_PUBLICATION_DECLARATION_A_UNBOUND,
	HOME_PUBLICATION_DECLARATION_UNVERIFIED,
	KEYS_V1_STATUS,
	VERIFY_METHOD_INTRO_V2,
	VERSION_RECORD_CLAIMS_LEAD,
	WINDOWS_ABSENCE_EXPLAINER_STATE_A,
} from "../v2view/copy";
import {
	buildFixture,
	fixtureFetcher,
	fixtureMigrationFetcher,
	flipLastByte,
} from "../v2view/fixture.test-support";
import { ABSENT_NO_PIN, type V2Model } from "../v2view/types";
import { trustedText } from "./escape";
import {
	collectInternalHrefs,
	foreignHrefs,
	handle,
	renderAll,
} from "./handle";
import { KIND_DECLARATION, KIND_SIGNED, KIND_VERIFIER } from "./vocab";

const NOW = new Date("2026-09-08T12:00:00.000Z");
const BUILD_AT = new Date("2026-09-07T12:00:00.000Z");
const BASE = {
	metadataBase: "https://transparency.solstone.app/staging/v2/metadata",
	targetsBase: "https://transparency.solstone.app/staging/v2/targets",
};

let v1: PortalModelResult;
let stateA: V2Model;
let stateB: V2Model;
let expired: V2Model;
let tampered: V2Model;

async function v2For(
	releases: { product: string; version: string }[],
	extra: Partial<Parameters<typeof buildV2Model>[0]> = {},
): Promise<V2Model> {
	const fixture = await buildFixture({ buildAt: BUILD_AT, releases });
	return buildV2Model({
		...BASE,
		rootBytes: fixture.rootBytes,
		now: NOW,
		fetcher: fixtureFetcher(fixture.files),
		migrationFetcher: fixtureMigrationFetcher(fixture.legacyObjects),
		...extra,
	});
}

beforeAll(async () => {
	const kp = await generateThrowawayKeypair();
	const fetcher = new FakeFetcher();
	fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
	await seedProductChain(fetcher, kp, "journal", "solstone-journal");
	await seedProductChain(fetcher, kp, "linux", "solstone-linux");
	v1 = await buildPortalModel(fetcher, new Date("2026-06-01T00:00:00Z"));
	if (!v1.ok) throw new Error("expected the v1 model to build");
	stateA = await v2For([]);
	stateB = await v2For([{ product: "solstone-journal", version: "2.0.0" }]);
	const expiredFixture = await buildFixture({
		buildAt: new Date("2026-08-01T00:00:00.000Z"),
		releases: [{ product: "solstone-journal", version: "2.0.0" }],
	});
	expired = await buildV2Model({
		...BASE,
		rootBytes: expiredFixture.rootBytes,
		now: NOW,
		fetcher: fixtureFetcher(expiredFixture.files),
	});
	const tamperedFixture = await buildFixture({
		buildAt: BUILD_AT,
		releases: [{ product: "solstone-journal", version: "2.0.0" }],
	});
	tampered = await buildV2Model({
		...BASE,
		rootBytes: tamperedFixture.rootBytes,
		now: NOW,
		fetcher: fixtureFetcher(tamperedFixture.files, {
			tamper: {
				path: "software/solstone-journal/2.0.0/release-record.json",
				mutate: flipLastByte,
			},
		}),
	});
});

function text(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ");
}

/** Reader-facing words the v2 ceiling forbids, as patterns over page text. Allowed contexts are excluded by the pattern itself. */
const FORBIDDEN: readonly RegExp[] = [
	/\bverified release\b/i,
	/\bsecure\b/i,
	/tamper-proof/i,
	/irrevocable/i,
	/\bpermanent\b/i,
	/\bcurrent until\b/i,
	/\blatest release\b/i,
	/\bresumed\b/i,
	/independently (witnessed|verified)/i,
	/\b(superseded|retired|archived) (chain|register)\b/i,
	/\bceremony\b/i,
	/\bproduction\b/i,
	/\breactivation\b/i,
	/\bpaused\b/i,
	/\bnever (been )?released\b(?! *\.)/i,
	/trust score/i,
	/all verified/i,
];

function assertCeiling(pages: Map<string, { body: string }>): void {
	for (const [path, res] of pages) {
		if (path === "/about/") continue; // the byte-for-byte v1 ABOUT.txt object, out of scope by the Wave 1 spec
		if (path === "/static/portal.css") continue;
		const t = text(res.body);
		for (const pattern of FORBIDDEN) {
			const m = pattern.exec(t);
			if (
				m !== null &&
				!/not evidence that .* was never released/.test(
					t.slice(Math.max(0, m.index - 80), m.index + 40),
				)
			) {
				throw new Error(
					`${path}: forbidden "${m[0]}" near …${t.slice(Math.max(0, m.index - 80), m.index + 60)}…`,
				);
			}
		}
	}
}

describe("absent: no pinned root", () => {
	test("renderAll with the absent model is identical to renderAll with no v2 argument", () => {
		const a = renderAll(v1);
		const b = renderAll(v1, ABSENT_NO_PIN);
		expect(a.size).toBe(b.size);
		for (const [path, res] of a) expect(b.get(path)?.body).toBe(res.body);
		expect(a.get("/")?.body).toContain(
			trustedText(HOME_PUBLICATION_DECLARATION),
		);
		expect(a.get("/keys/")?.body).toContain(trustedText(KEYS_ROLE_STATEMENT));
		expect(a.get("/")?.body).not.toContain("v2");
	});
});

describe("state (a): root and legacy binding, no release record", () => {
	test("home carries the one permitted declaration, the legacy binding, and no release", () => {
		const body = handle("/", v1, stateA).body;
		// The synthetic manifest binds one made-up product, so the "whole register" declaration must NOT render; the scoped one does.
		expect(body).not.toContain(trustedText(HOME_PUBLICATION_DECLARATION_A));
		expect(body).toContain(
			"bound the v1 release records of legacy-corpus into it",
		);
		expect(body).toContain(
			"the rest of the v1 release records are not yet bound",
		);
		expect(body).not.toContain(trustedText(HOME_PUBLICATION_DECLARATION));
		expect(body).toContain("bound into the v2 root by signed manifests");
		expect(body).toContain(trustedText(AXIS_PUBLICATION_A));
		expect(body).toContain("v1 chain closed at");
		expect(text(body)).not.toMatch(/\bpaused\b/);
	});

	test("product pages read the closed v1 chain, keep four axes, and show no v2 records section", () => {
		const body = handle("/software/journal/", v1, stateA).body;
		expect(body).toContain("closed at");
		expect(body).toContain("v1 release timeline (closed chain)");
		expect(body).toContain(trustedText(AXIS_PUBLICATION_A));
		expect(body).not.toContain("v2 release records");
		expect(body).toContain("evidence freshness");
		expect(body).toContain("rebuild");
	});

	test("windows renders the decided closed-fact framing once a root is known, and today's framing when none is", () => {
		const body = handle("/software/windows/", v1, stateA).body;
		expect(body).toContain(trustedText(WINDOWS_ABSENCE_EXPLAINER_STATE_A));
		expect(body).toContain("recorded no windows release and is closed");
		expect(body).not.toContain(trustedText(WINDOWS_ABSENCE_EXPLAINER));
		expect(handle("/software/windows/", v1, ABSENT_NO_PIN).body).toContain(
			trustedText(WINDOWS_ABSENCE_EXPLAINER),
		);
	});

	test("/keys/ shows the v2 root: version, three key ids, 2 of 3, both witness lines, and re-reads the v1 key as v1-only", () => {
		if (stateA.state !== "verified") throw new Error("expected verified");
		const body = handle("/keys/", v1, stateA).body;
		expect(body).toContain("the v2 signing root");
		expect(body).toContain("2 of 3");
		expect(body).toContain("3 key ids, of which 2 must sign");
		for (const keyid of stateA.root.keyids) expect(body).toContain(keyid);
		expect(body).toContain(trustedText(stateA.root.witnessLines[0]));
		expect(body).toContain(trustedText(stateA.root.witnessLines[1]));
		expect(body).toContain(trustedText(KEYS_V1_STATUS));
		expect(body).not.toContain("<td>active</td>");
		expect(body).toContain("https://solpbc.org/transparency/tuf-root.txt");
		// A third-party witness location is named, never linked.
		expect(body).not.toContain('href="https://github.com');
		expect(foreignHrefs(body)).toEqual([]);
	});

	test("/verify/ carries two methods and keeps the v1 safety sentence verbatim", () => {
		if (stateA.state !== "verified") throw new Error("expected verified");
		const body = handle("/verify/", v1, stateA).body;
		expect(body).toContain(trustedText(VERIFY_METHOD_INTRO));
		expect(body).toContain(trustedText(VERIFY_METHOD_INTRO_V2));
		expect(body).toContain("minisign -Vm ledger-entry.json");
		expect(body).toContain(
			`verify-v2 --root tuf-root.json --metadata-base ${stateA.metadataBase}`,
		);
	});

	test("every page passes the v2 ceiling word check", () => {
		assertCeiling(renderAll(v1, stateA));
	});

	test("a legacy binding that did not verify → the unbound state-(a) declaration, no binding claim, no empty token", async () => {
		const model = await v2For([], {
			migrationFetcher: fixtureMigrationFetcher(new Map()),
		});
		if (model.state !== "verified") throw new Error("expected verified");
		expect(model.legacy.state).toBe("not-verified");
		const body = handle("/", v1, model).body;
		expect(body).toContain(trustedText(HOME_PUBLICATION_DECLARATION_A_UNBOUND));
		expect(body).not.toContain("bound the v1 release records");
		expect(body).not.toContain("for  into");
		expect(body).toContain(
			"a manifest binding the v1 release records into the v2 root did not verify",
		);
		expect(text(body)).not.toMatch(/unavailable:|retrieval-failed/);
	});
});

describe("state (b): a release record", () => {
	test("home declares the first record; the journal row shows the latest recorded v2 release", () => {
		const body = handle("/", v1, stateB).body;
		expect(body).toContain("the first is the journal 2.0.0");
		expect(body).toContain("newest recorded release 2.0.0");
		expect(body).toContain(trustedText(AXIS_PUBLICATION_B));
		expect(body).toContain("v1 chain closed at"); // linux, no v2 record
	});

	test("the journal page carries the v2 record axes, the v1→v2 gap note, and the closed v1 timeline", () => {
		const body = handle("/software/journal/", v1, stateB).body;
		expect(body).toContain("v2 release records");
		expect(body).toContain("asserted until");
		expect(body).not.toContain("current until");
		expect(body).toContain("the register moves from the v1 tip");
		expect(body).toContain("v1 release timeline (closed chain)");
		expect(body).toContain('href="/software/journal/2.0.0/"');
	});

	test("the v2 record page: four axes, the record's own claims verbatim, every evidence link, technical fields", () => {
		if (stateB.state !== "verified") throw new Error("expected verified");
		const res = handle("/software/journal/2.0.0/", v1, stateB);
		expect(res.status).toBe(200);
		const body = res.body;
		expect(body).toContain("v2 record");
		expect(body).toContain("asserted until");
		expect(body).toContain(KIND_SIGNED);
		expect(body).toContain(KIND_VERIFIER);
		expect(body).toContain(KIND_DECLARATION);
		expect(body).toContain(trustedText(VERSION_RECORD_CLAIMS_LEAD));
		expect(body).toContain(
			"that builds shipped through app stores are these bytes",
		);
		expect(body).toContain("release record");
		expect(body).toContain("authorization policy");
		expect(body).toContain("signing key set");
		expect(body).toContain("pinned root");
		expect(body).toContain("freshness assertion");
		expect(body).toContain(
			"software/solstone-journal/2.0.0/release-record.json",
		);
		expect(body).toContain("verify this record yourself");
		const record = stateB.software[0];
		if (record?.kind !== "release") throw new Error("expected release");
		for (const k of record.signerKeyids) expect(body).toContain(k);
		// The link is whichever name the client actually fetched: the logical
		// path today, the hash-prefixed name once consistent-snapshot target
		// naming lands in the client; both end in the record's filename.
		if (record.recordLink.status !== "linked")
			throw new Error("expected a linked record");
		expect(
			record.recordLink.link.url.startsWith(
				"https://transparency.solstone.app/staging/v2/targets/software/solstone-journal/2.0.0/",
			),
		).toBe(true);
		expect(record.recordLink.link.url.endsWith("release-record.json")).toBe(
			true,
		);
		expect(body).toContain(record.recordLink.link.url);
	});

	test("a v1 record page in the v2 era drops the pause sentence for the closed-chain one", () => {
		const body = handle("/software/journal/1.0.22/", v1, stateB).body;
		const t = text(body);
		expect(t).not.toMatch(/publication pause/);
		expect(body).toContain("v1 record");
	});

	test("sitemap lists the v2 record route; the graph from home reaches it; no foreign hrefs anywhere", () => {
		const pages = renderAll(v1, stateB);
		expect(pages.has("/software/journal/2.0.0/")).toBe(true);
		const seen = new Set<string>();
		const queue = ["/"];
		while (queue.length > 0) {
			const path = queue.pop();
			if (path === undefined || seen.has(path)) continue;
			seen.add(path);
			const page = pages.get(path) ?? handle(path, v1, stateB);
			for (const href of collectInternalHrefs(page.body, path))
				if (!seen.has(href)) queue.push(href);
		}
		expect(seen.has("/software/journal/2.0.0/")).toBe(true);
		for (const [path, res] of pages) {
			expect(res.body.includes("<script")).toBe(false);
			expect(foreignHrefs(res.body)).toEqual([]);
			for (const href of collectInternalHrefs(res.body, path)) {
				const target = pages.get(href) ?? handle(href, v1, stateB);
				expect(target.status).toBe(200);
			}
		}
	});

	test("every page passes the v2 ceiling word check", () => {
		assertCeiling(renderAll(v1, stateB));
	});
});

describe("the verifier's own report", () => {
	test("expired: home says the register did not verify and why; the expiry is its own sentence; nothing renders as a release", () => {
		expect(expired.state).toBe("unverified");
		const body = handle("/", v1, expired).body;
		expect(body).toContain(
			trustedText(HOME_PUBLICATION_DECLARATION_UNVERIFIED),
		);
		expect(body).toContain("did not verify when this page was built");
		expect(body).toContain("had passed by 2026-08-08T00:00:00Z");
		expect(body).toContain(KIND_VERIFIER);
		expect(body).not.toContain("recorded release 2.0.0");
		expect(text(body)).not.toMatch(/\b(tampered|insecure|invalid)\b/);
		expect(handle("/software/journal/2.0.0/", v1, expired).status).toBe(404);
	});

	test("expired: product pages read publication as could-not-be-checked; /keys/ still shows the pinned root", () => {
		if (expired.state !== "unverified") throw new Error("expected unverified");
		const body = handle("/software/journal/", v1, expired).body;
		expect(body).toContain("v2 register not checked");
		expect(body).toContain("one of its signed validity windows had passed");
		expect(text(body)).not.toMatch(/timestamp: expired/);
		expect(handle("/", v1, expired).body).toContain("v2 register not checked");
		const keys = handle("/keys/", v1, expired).body;
		for (const keyid of expired.root.keyids) expect(keys).toContain(keyid);
	});

	test("tampered record: the repository is unverified (hash mismatch) and no page shows the release", () => {
		expect(tampered.state).toBe("unverified");
		const pages = renderAll(v1, tampered);
		for (const [, res] of pages) expect(res.body).not.toContain("2.0.0");
		expect(handle("/", v1, tampered).body).toContain(
			"a file did not match its signed description",
		);
		expect(text(handle("/", v1, tampered).body)).not.toMatch(/hash-mismatch/);
		assertCeiling(pages);
	});

	test("a record signed by an unknown key renders its failure state, not the release", async () => {
		const model = await v2For([
			{ product: "solstone-journal", version: "2.0.0" },
			{ product: "solstone-journal", version: "2.0.1", signer: "unknown" } as {
				product: string;
				version: string;
			},
		]);
		if (model.state !== "verified") throw new Error("expected verified");
		const product = handle("/software/journal/", v1, model).body;
		expect(product).toContain("the record for 2.0.1 did not verify");
		const page = handle("/software/journal/2.0.1/", v1, model);
		expect(page.status).toBe(200);
		expect(page.body).toContain("did not verify");
		expect(page.body).not.toContain("asserted until");
		expect(page.body).not.toContain("what this proves");
		// The good sibling is unaffected.
		expect(handle("/software/journal/2.0.0/", v1, model).body).toContain(
			"asserted until",
		);
	});

	test("a missing expected record renders as a gap with its basis, on the product page", async () => {
		const model = await v2For([], {
			expectations: [
				{
					product: "solstone-journal",
					version: "2.0.0",
					basis: "the release lane listing",
				},
			],
		});
		const body = handle("/software/journal/", v1, model).body;
		expect(body).toContain("expected record missing");
		expect(body).toContain(
			"a record of the journal 2.0.0 was expected (the release lane listing)",
		);
		expect(handle("/software/journal/2.0.0/", v1, model).status).toBe(404);
		assertCeiling(renderAll(v1, model));
	});
});
