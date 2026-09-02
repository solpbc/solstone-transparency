// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Builds `sitemap.xml`, listing every HTML route this portal actually
 * serves with a `200` response — never the stylesheet, never a route that
 * 404s (a routing miss, an absent-version guess). Derived from the same
 * `renderAll()` output the portal itself serves, so the sitemap can never
 * drift from what a visitor actually finds.
 */

import type { PortalModelResult } from "../legacy/types";
import { renderAll } from "./handle";
import { STYLESHEET_PATH } from "./routes";

const BASE_URL = "https://trust.solstone.app";

export function buildSitemap(result: PortalModelResult): string {
	const pages = renderAll(result);
	const urls: string[] = [];
	for (const [path, res] of pages) {
		if (path === STYLESHEET_PATH) continue;
		if (res.status !== 200) continue;
		urls.push(`${BASE_URL}${path}`);
	}
	urls.sort();
	const entries = urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
