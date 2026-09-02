// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { beforeAll, describe, expect, test } from "bun:test";
import { buildPortalModel } from "../legacy/adapter";
import { CATALOG, JOURNAL_GAP } from "../legacy/inventory";
import {
	ASSET_HEADERS,
	FORBIDDEN_HEADERS,
	HTML_HEADERS,
} from "../legacy/response-policy";
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
import { STYLESHEET_PATH, versionPath } from "./routes";
import { PORTAL_CSS } from "./stylesheet";

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
			STYLESHEET_PATH,
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
				expect(target.status).toBe(200);
			}
			if (path === STYLESHEET_PATH) continue;
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
		expect(home.headers["Cache-Control"]).toBe("no-store");
		expect(home.body).toContain("degraded");
		expect(home.body).toContain("could not fetch the pinned public key");
		expect(home.body).toContain('href="/software/"');
		expect(home.body).not.toContain("latest recorded");
		for (const v of CATALOG.journal) {
			expect(home.body).not.toContain(v);
		}
		expect(withoutCanonical(home.body)).toBe(withoutCanonical(product.body));
		expect(home.body).toContain(
			'rel="canonical" href="https://trust.solstone.app/"',
		);
		expect(product.body).toContain(
			'rel="canonical" href="https://trust.solstone.app/software/journal/"',
		);
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
		expect(zero.headers["Cache-Control"]).toBe("no-store");
	});
});

describe("AC-21 not-found", () => {
	test("generic 404 does not echo the attempted path", () => {
		const res = handle("/nope-not-a-route/", defaultResult);
		expect(res.status).toBe(404);
		expect(res.body).toContain(trustedText("there's nothing at this address"));
		expect(mainHtml(res.body)).not.toContain("nope-not-a-route");
		expect(res.body).toContain(
			'rel="canonical" href="https://trust.solstone.app/nope-not-a-route/"',
		);
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
		expect(mainHtml(guessed.body)).not.toContain("9.9.9");
		expect(mainHtml(gap.body)).not.toContain(JOURNAL_GAP.absentVersion);
		expect(guessed.body).toContain("/software/journal/");
		expect(guessed.body).not.toContain("axis-block");
	});
});

describe("href collection", () => {
	test("collectHrefs reads quoted hrefs", () => {
		expect(collectHrefs(`<a href="/software/">x</a>`)).toEqual(["/software/"]);
	});
});

function withoutCanonical(html: string): string {
	return html.replace(/<link rel="canonical" href="[^"]+">/g, "");
}

function mainHtml(body: string): string {
	const start = body.indexOf("<main");
	const end = body.indexOf("</main>");
	expect(start).toBeGreaterThan(-1);
	expect(end).toBeGreaterThan(start);
	return body.slice(start, end);
}

function assertNoForbidden(headers: Readonly<Record<string, string>>): void {
	const names = Object.keys(headers).map((k) => k.toLowerCase());
	for (const forbidden of FORBIDDEN_HEADERS) {
		expect(names).not.toContain(forbidden.toLowerCase());
	}
}

function assertHtmlHeaders(
	headers: Readonly<Record<string, string>>,
	cache: "no-cache" | "no-store",
): void {
	for (const [key, value] of Object.entries(HTML_HEADERS)) {
		if (key === "Cache-Control") {
			expect(headers[key]).toBe(cache);
		} else {
			expect(headers[key]).toBe(value);
		}
	}
	assertNoForbidden(headers);
}

function countAriaCurrentPage(html: string): number {
	return (html.match(/aria-current="page"/g) ?? []).length;
}

describe("header matrix per response class", () => {
	test("200 HTML, both 404s, degraded, collision, and CSS carry the approved headers", async () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const home = handle("/", defaultResult);
		expect(home.status).toBe(200);
		assertHtmlHeaders(home.headers, "no-cache");

		const generic404 = handle("/nope-not-a-route/", defaultResult);
		expect(generic404.status).toBe(404);
		assertHtmlHeaders(generic404.headers, "no-cache");

		const version404 = handle("/software/journal/9.9.9/", defaultResult);
		expect(version404.status).toBe(404);
		assertHtmlHeaders(version404.headers, "no-cache");

		const degraded = handle("/", {
			ok: false,
			degraded: {
				httpStatus: 503,
				marker: "degraded",
				reason: "fixture",
				neverStale: true,
			},
		});
		expect(degraded.status).toBe(503);
		assertHtmlHeaders(degraded.headers, "no-store");

		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "journal", "solstone-journal", {
			versions: ["0.0.1"],
		});
		const collided = await buildPortalModel(fetcher, NOW, {
			journal: ["0.0.1", "0.0.1"],
			linux: [],
		});
		expect(collided.ok).toBe(true);
		if (!collided.ok) return;
		const collision = handle("/", collided);
		expect(collision.status).toBe(500);
		assertHtmlHeaders(collision.headers, "no-store");

		const css = handle(STYLESHEET_PATH, defaultResult);
		expect(css.status).toBe(200);
		expect(css.body).toBe(PORTAL_CSS);
		for (const [key, value] of Object.entries(ASSET_HEADERS)) {
			expect(css.headers[key]).toBe(value);
		}
		assertNoForbidden(css.headers);

		const cssOnDegraded = handle(STYLESHEET_PATH, {
			ok: false,
			degraded: {
				httpStatus: 503,
				marker: "degraded",
				reason: "fixture",
				neverStale: true,
			},
		});
		expect(cssOnDegraded.status).toBe(200);
		expect(cssOnDegraded.body).toBe(PORTAL_CSS);
		expect(cssOnDegraded.headers["Content-Type"]).toBe(
			"text/css; charset=utf-8",
		);
	});
});

describe("canonical URLs and unique titles", () => {
	test("each HTML page has a stylesheet link, a path-specific canonical, and no meta description", () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const pages = renderAll(defaultResult);
		for (const [path, res] of pages) {
			if (path === STYLESHEET_PATH) continue;
			expect(res.body).toContain(`href="${STYLESHEET_PATH}"`);
			expect(res.body).toContain(
				`rel="canonical" href="https://trust.solstone.app${path}"`,
			);
			expect(res.body).not.toContain('name="description"');
		}
	});

	test("the two former title collisions are now distinct", () => {
		const generic = handle("/nope/", defaultResult);
		const shaped = handle("/software/journal/9.9.9/", defaultResult);
		expect(generic.body).toContain(
			"<title>not found — trust.solstone.app</title>",
		);
		expect(shaped.body).toContain(
			"<title>no record at this version — trust.solstone.app</title>",
		);
		expect(generic.body).not.toBe(shaped.body);
		const degraded = handle("/", {
			ok: false,
			degraded: {
				httpStatus: 503,
				marker: "degraded",
				reason: "fixture",
				neverStale: true,
			},
		});
		expect(degraded.body).toContain(
			"<title>unavailable — trust.solstone.app</title>",
		);
	});
});

describe("aria-current page uniqueness", () => {
	test("exactly one aria-current=page per rendered HTML page", () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const pages = renderAll(defaultResult);
		for (const [path, res] of pages) {
			if (path === STYLESHEET_PATH) continue;
			expect(countAriaCurrentPage(res.body)).toBe(1);
		}
	});

	test("the counter can fail on a two-element fixture", () => {
		const two = `<a aria-current="page" href="/"></a><span aria-current="page"></span>`;
		expect(countAriaCurrentPage(two)).toBe(2);
		expect(countAriaCurrentPage(two)).not.toBe(1);
	});
});

describe("details remain open", () => {
	test("every details tag in renderAll HTML has the literal open attribute", () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const pages = renderAll(defaultResult);
		let seen = 0;
		for (const [path, res] of pages) {
			if (path === STYLESHEET_PATH) continue;
			const tags = res.body.match(/<details\b[^>]*>/gi) ?? [];
			for (const tag of tags) {
				expect(tag).toContain("open");
				seen += 1;
			}
		}
		expect(seen).toBeGreaterThan(0);
	});
});

describe("stylesheet is model-independent", () => {
	test("renderAll includes the stylesheet path on degraded and collision results", async () => {
		const degradedResult: PortalModelResult = {
			ok: false,
			degraded: {
				httpStatus: 503,
				marker: "degraded",
				reason: "fixture",
				neverStale: true,
			},
		};
		const degradedPages = renderAll(degradedResult);
		expect(degradedPages.has(STYLESHEET_PATH)).toBe(true);
		expect(degradedPages.get(STYLESHEET_PATH)?.body).toBe(PORTAL_CSS);
		expect(degradedPages.get("/")?.body).toContain(
			'rel="canonical" href="https://trust.solstone.app/"',
		);
		expect(degradedPages.get("/software/")?.body).toContain(
			'rel="canonical" href="https://trust.solstone.app/software/"',
		);

		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "journal", "solstone-journal", {
			versions: ["0.0.1"],
		});
		const collided = await buildPortalModel(fetcher, NOW, {
			journal: ["0.0.1", "0.0.1"],
			linux: [],
		});
		expect(collided.ok).toBe(true);
		if (!collided.ok) return;
		const collisionPages = renderAll(collided);
		expect(collisionPages.has(STYLESHEET_PATH)).toBe(true);
		expect(collisionPages.get(STYLESHEET_PATH)?.status).toBe(200);
		expect(collisionPages.get("/")?.status).toBe(500);
		expect(collisionPages.get("/")?.body).toContain(
			"<title>this portal cannot present colliding records — trust.solstone.app</title>",
		);
	});
});
