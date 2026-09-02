// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import type { PortalModelResult } from "../legacy/types";
import { buildSitemap } from "./sitemap";

function degraded(): PortalModelResult {
	return {
		ok: false,
		degraded: {
			httpStatus: 503,
			marker: "degraded",
			reason: "test",
			neverStale: true,
		},
	};
}

describe("buildSitemap", () => {
	test("a degraded model produces no URLs at all, never a stale sitemap", () => {
		const xml = buildSitemap(degraded());
		expect(xml).not.toContain("<url>");
	});

	test("never lists the stylesheet route or a 404 route", () => {
		const xml = buildSitemap(degraded());
		expect(xml).not.toContain("/static/portal.css");
	});

	test("every listed URL is an absolute trust.solstone.app URL, sorted", () => {
		const xml = buildSitemap(degraded());
		const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
		for (const loc of locs) {
			expect(loc?.startsWith("https://trust.solstone.app/")).toBe(true);
		}
		expect(locs).toEqual([...locs].sort());
	});
});
