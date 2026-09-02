// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { beforeAll, describe, expect, test } from "bun:test";
import { buildPortalModel } from "../legacy/adapter";
import { CATALOG, JOURNAL_GAP } from "../legacy/inventory";
import {
	FakeFetcher,
	TEST_KEY_FILENAME,
	generateThrowawayKeypair,
	seedProductChain,
} from "../legacy/test-helpers";
import type { PortalModelResult } from "../legacy/types";
import { trustedText } from "./escape";
import {
	collectHrefs,
	collectInternalHrefs,
	foreignHrefs,
	handle,
	renderAll,
} from "./handle";
import { versionPath } from "./routes";

const NOW = new Date("2026-06-01T00:00:00Z");

let defaultResult: PortalModelResult;

beforeAll(async () => {
	const kp = await generateThrowawayKeypair();
	const fetcher = new FakeFetcher();
	fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
	await seedProductChain(fetcher, kp, "journal", "solstone-journal");
	await seedProductChain(fetcher, kp, "linux", "solstone-linux");
	defaultResult = await buildPortalModel(fetcher, NOW);
});

function reachableFromHome(result: PortalModelResult): Set<string> {
	const pages = renderAll(result);
	const seen = new Set<string>();
	const queue = ["/"];
	while (queue.length > 0) {
		const path = queue.pop();
		if (path === undefined || seen.has(path)) continue;
		seen.add(path);
		const page = pages.get(path) ?? handle(path, result);
		for (const href of collectInternalHrefs(page.body, path)) {
			if (!seen.has(href)) queue.push(href);
		}
	}
	return seen;
}

describe("AC-1 durable routes and JS-free graph walk", () => {
	test("renderAll enumerates 9 static routes plus every modeled entry; walk from home reaches them", () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const pages = renderAll(defaultResult);
		const expected = new Set<string>([
			"/",
			"/software/",
			"/software/journal/",
			"/software/linux/",
			"/software/windows/",
			"/verify/",
			"/keys/",
			"/about/",
		]);
		for (const v of CATALOG.journal) {
			expected.add(versionPath("journal", v));
		}
		for (const v of CATALOG.linux) {
			expected.add(versionPath("linux", v));
		}
		expect(pages.size).toBe(expected.size);
		for (const p of expected) {
			expect(pages.has(p)).toBe(true);
			expect(pages.get(p)?.status).toBe(200);
		}
		const reached = reachableFromHome(defaultResult);
		for (const p of expected) {
			expect(reached.has(p)).toBe(true);
		}
		expect(reached.has("/services/")).toBe(false);
		expect(reached.has("/commitments/")).toBe(false);
	});

	test("every internal href on a durable page resolves; about is reachable", () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const pages = renderAll(defaultResult);
		for (const [path, res] of pages) {
			for (const href of collectInternalHrefs(res.body, path)) {
				const target = pages.get(href) ?? handle(href, defaultResult);
				expect(target.status).not.toBe(500);
				if (href === "/software/" || href.startsWith("/software/")) {
					expect([200, 404]).toContain(target.status);
				}
			}
			expect(res.body).not.toContain("<script");
			expect(res.body).toContain('id="main"');
			expect(res.body).toContain("skip to content");
			expect(res.body).toContain("<nav");
			expect((res.body.match(/<h1/g) ?? []).length).toBe(1);
		}
		expect(pages.get("/about/")?.body).toContain("about this register");
	});
});

describe("AC-15 initial HTML, no JS", () => {
	test("no script tags; details default open; version page carries supplied fields", () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const tip = CATALOG.journal[CATALOG.journal.length - 1];
		if (tip === undefined) throw new Error("empty journal catalog");
		const page = handle(versionPath("journal", tip), defaultResult);
		expect(page.body).not.toContain("<script");
		expect(page.body).toContain('<details class="tech" open>');
		expect(page.body).toContain("entry sha256");
		expect(page.body).toContain(tip);
	});
});

describe("AC-18 portal never rewrites evidence URLs", () => {
	test("raw-link hrefs stay on transparency.solstone.app", () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const pages = renderAll(defaultResult);
		for (const res of pages.values()) {
			const raw = [...res.body.matchAll(/class="raw-link" href="([^"]+)"/g)];
			for (const m of raw) {
				const href = m[1] ?? "";
				expect(href.startsWith("https://transparency.solstone.app/")).toBe(
					true,
				);
				expect(href).not.toContain("trust.solstone.app");
			}
			expect(foreignHrefs(res.body)).toEqual([]);
		}
	});
});

describe("AC-20 invalid-model fixture", () => {
	test("missing key degrades every path: 503, no-store, marker, nav, no stale versions", async () => {
		const fetcher = new FakeFetcher();
		const result = await buildPortalModel(fetcher, NOW);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		const home = handle("/", result);
		const product = handle("/software/journal/", result);
		expect(home.status).toBe(404);
		expect(product.status).toBe(404);
		expect(home.headers["cache-control"]).toBe("no-store");
		expect(home.body).toContain("degraded");
		expect(home.body).toContain("could not fetch the pinned public key");
		expect(home.body).toContain('href="/software/"');
		expect(home.body).not.toContain("latest recorded");
		for (const v of CATALOG.journal) {
			expect(home.body).not.toContain(v);
		}
		expect(home.body).toBe(product.body);
		const zero = handle("/", {
			ok: false,
			degraded: {
				httpStatus: 0,
				marker: "degraded",
				reason: "could not fetch the pinned public key",
				neverStale: true,
			},
		});
		expect(zero.status).toBe(503);
		expect(zero.headers["cache-control"]).toBe("no-store");
	});
});

describe("AC-21 not-found", () => {
	test("generic 404 does not echo the attempted path", () => {
		const res = handle("/nope-not-a-route/", defaultResult);
		expect(res.status).toBe(404);
		expect(res.body).toContain(trustedText("there's nothing at this address"));
		expect(res.body).not.toContain("nope-not-a-route");
		expect(res.body).toContain('href="/"');
		expect(res.body).not.toContain("axis-block");
	});

	test("unrecorded version and the curated gap path share version-shaped 404, no echo", () => {
		const guessed = handle("/software/journal/9.9.9/", defaultResult);
		const gap = handle(
			`/software/journal/${JOURNAL_GAP.absentVersion}/`,
			defaultResult,
		);
		expect(guessed.status).toBe(404);
		expect(gap.status).toBe(404);
		expect(guessed.body).toContain(
			trustedText("there's no record here for that version"),
		);
		expect(gap.body).toContain(
			trustedText("there's no record here for that version"),
		);
		expect(guessed.body).not.toContain("9.9.9");
		expect(gap.body).not.toContain(JOURNAL_GAP.absentVersion);
		expect(guessed.body).toContain("/software/journal/");
		expect(guessed.body).not.toContain("axis-block");
	});
});

describe("href collection", () => {
	test("collectHrefs reads quoted hrefs", () => {
		expect(collectHrefs(`<a href="/software/">x</a>`)).toEqual(["/software/"]);
	});
});
