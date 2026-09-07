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
import {
	ABSENT_NO_PIN,
	type V2Model,
	type V2ReleaseRecord,
} from "../v2view/types";

const PRODUCT_SLUGS: readonly ProductSlug[] = ["journal", "linux", "windows"];

export function isProductSlug(s: string): s is ProductSlug {
	return (PRODUCT_SLUGS as readonly string[]).includes(s);
}

export function versionPath(product: ProductSlug, version: string): string {
	return `/software/${product}/${encodeURIComponent(version)}/`;
}

export type VersionTarget =
	| { kind: "entry"; entry: EntryRecord }
	| { kind: "failure"; failure: ModelConstructionFailure }
	| { kind: "v2-release"; record: V2ReleaseRecord };

export type RouteTableOk = { ok: true; versions: Map<string, VersionTarget> };
export type RouteTableCollision = {
	ok: false;
	collision: {
		left: { product: string; version: string };
		right: { product: string; version: string };
	};
};

function targetIdentity(target: VersionTarget): {
	product: string;
	version: string;
} {
	if (target.kind === "entry")
		return { product: target.entry.product, version: target.entry.version };
	if (target.kind === "failure")
		return {
			product: target.failure.product,
			version: target.failure.version,
		};
	return { product: target.record.product, version: target.record.version };
}

export function buildRouteTable(
	model: PortalModel,
	v2: V2Model = ABSENT_NO_PIN,
): RouteTableOk | RouteTableCollision {
	const versions = new Map<string, VersionTarget>();
	// v2 records route first: they are the current register, and a v1 entry
	// at the same product/version would be a real collision worth failing on.
	if (v2.state === "verified") {
		for (const entry of v2.software) {
			if (entry.kind !== "release" || entry.slug === undefined) continue;
			const path = versionPath(entry.slug, entry.version);
			const existing = versions.get(path);
			if (existing !== undefined) {
				return {
					ok: false,
					collision: {
						left: targetIdentity(existing),
						right: { product: entry.product, version: entry.version },
					},
				};
			}
			versions.set(path, { kind: "v2-release", record: entry });
		}
	}
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
				return {
					ok: false,
					collision: {
						left: targetIdentity(existing),
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
