// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Route-table construction and path matching. Product and version segments
 * are model-supplied identifiers: no case-fold, unicode normalize, or slugify.
 */

import type {
	EntryRecord,
	ModelConstructionFailure,
	PortalModel,
	ProductSlug,
} from "../legacy/types";

const PRODUCT_SLUGS: readonly ProductSlug[] = ["journal", "linux", "windows"];

export function isProductSlug(s: string): s is ProductSlug {
	return (PRODUCT_SLUGS as readonly string[]).includes(s);
}

export function versionPath(
	product: "journal" | "linux",
	version: string,
): string {
	return `/software/${product}/${encodeURIComponent(version)}/`;
}

export type VersionTarget =
	| { kind: "entry"; entry: EntryRecord }
	| { kind: "failure"; failure: ModelConstructionFailure };

export type RouteTableOk = { ok: true; versions: Map<string, VersionTarget> };
export type RouteTableCollision = {
	ok: false;
	collision: {
		left: { product: string; version: string };
		right: { product: string; version: string };
	};
};

export function buildRouteTable(
	model: PortalModel,
): RouteTableOk | RouteTableCollision {
	const versions = new Map<string, VersionTarget>();
	for (const subject of model.subjects) {
		if (subject.product === "windows") continue;
		for (const item of subject.timeline) {
			if (item.kind === "gap") continue;
			const path = versionPath(item.product, item.version);
			const existing = versions.get(path);
			const next: VersionTarget =
				item.kind === "entry"
					? { kind: "entry", entry: item }
					: { kind: "failure", failure: item };
			if (existing !== undefined) {
				const left =
					existing.kind === "entry"
						? {
								product: existing.entry.product,
								version: existing.entry.version,
							}
						: {
								product: existing.failure.product,
								version: existing.failure.version,
							};
				return {
					ok: false,
					collision: {
						left,
						right: { product: item.product, version: item.version },
					},
				};
			}
			versions.set(path, next);
		}
	}
	return { ok: true, versions };
}

/** Model-independent stylesheet path. Not a member of STATIC_PATHS. */
export const STYLESHEET_PATH = "/static/portal.css";

/** Strip query/hash, force a leading slash, and a trailing slash except for `/` and STYLESHEET_PATH. */
export function normalizePath(path: string): string {
	const noQuery = path.split("?")[0] ?? path;
	const noHash = noQuery.split("#")[0] ?? noQuery;
	let p = noHash;
	if (!p.startsWith("/")) p = `/${p}`;
	if (p === STYLESHEET_PATH || p === `${STYLESHEET_PATH}/`)
		return STYLESHEET_PATH;
	if (p !== "/" && !p.endsWith("/")) p = `${p}/`;
	return p;
}

export type ParsedPath =
	| { page: "home" }
	| { page: "software" }
	| { page: "product"; product: ProductSlug }
	| {
			page: "version";
			product: "journal" | "linux" | "windows";
			version: string;
	  }
	| { page: "verify" }
	| { page: "keys" }
	| { page: "about" }
	| { page: "stylesheet" }
	| { page: "not-found-generic" };

export function parsePath(path: string): ParsedPath {
	const n = normalizePath(path);
	if (n === STYLESHEET_PATH) return { page: "stylesheet" };
	if (n === "/") return { page: "home" };
	const parts = n.split("/").filter((p) => p.length > 0);
	if (parts.length === 1 && parts[0] === "software")
		return { page: "software" };
	if (parts.length === 1 && parts[0] === "verify") return { page: "verify" };
	if (parts.length === 1 && parts[0] === "keys") return { page: "keys" };
	if (parts.length === 1 && parts[0] === "about") return { page: "about" };
	if (parts.length === 2 && parts[0] === "software" && parts[1] !== undefined) {
		const slug = parts[1];
		if (isProductSlug(slug)) return { page: "product", product: slug };
	}
	if (parts.length === 3 && parts[0] === "software" && parts[1] !== undefined) {
		const slug = parts[1];
		if (isProductSlug(slug)) {
			let version: string;
			try {
				version = decodeURIComponent(parts[2] ?? "");
			} catch {
				return { page: "not-found-generic" };
			}
			if (version === "") return { page: "not-found-generic" };
			return { page: "version", product: slug, version };
		}
	}
	return { page: "not-found-generic" };
}
