// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Request → HTML for the Wave 1 portal. Consumes a PortalModelResult;
 * never re-fetches or re-verifies evidence.
 */

import { ASSET_HEADERS, HTML_HEADERS } from "../legacy/response-policy";
import type { PortalModel, PortalModelResult } from "../legacy/types";
import { ABSENT_NO_PIN, type V2Model } from "../v2view/types";
import {
	renderAbout,
	renderCollision,
	renderDegraded,
	renderHome,
	renderKeys,
	renderNotFound,
	renderProduct,
	renderSoftwareIndex,
	renderV2Version,
	renderVerify,
	renderVersion,
	renderVersionFailure,
} from "./pages";
import {
	type ParsedPath,
	STYLESHEET_PATH,
	type VersionTarget,
	buildRouteTable,
	normalizePath,
	parsePath,
	versionPath,
} from "./routes";
import { PORTAL_CSS } from "./stylesheet";

export interface PortalResponse {
	status: number;
	body: string;
	headers: Readonly<Record<string, string>>;
}

export type HeaderKind = "html" | "html-fail-closed" | "asset-css";

export function headersFor(kind: HeaderKind): Readonly<Record<string, string>> {
	if (kind === "asset-css") return { ...ASSET_HEADERS };
	if (kind === "html-fail-closed") {
		return { ...HTML_HEADERS, "Cache-Control": "no-store" };
	}
	return { ...HTML_HEADERS };
}

function httpStatusFromDegraded(status: number): number {
	return status >= 400 && status <= 599 ? status : 503;
}

function failClosed(status: number, body: string): PortalResponse {
	return { status, body, headers: headersFor("html-fail-closed") };
}

function ok(body: string): PortalResponse {
	return { status: 200, body, headers: headersFor("html") };
}

function notFound(body: string): PortalResponse {
	return { status: 404, body, headers: headersFor("html") };
}

function stylesheetResponse(): PortalResponse {
	return {
		status: 200,
		body: PORTAL_CSS,
		headers: headersFor("asset-css"),
	};
}

type HtmlParsed = Exclude<ParsedPath, { page: "stylesheet" }>;

export function handle(
	path: string,
	result: PortalModelResult,
	v2: V2Model = ABSENT_NO_PIN,
): PortalResponse {
	const parsed = parsePath(path);
	if (parsed.page === "stylesheet") return stylesheetResponse();
	const canonicalPath = normalizePath(path);
	if (!result.ok) {
		return failClosed(
			httpStatusFromDegraded(result.degraded.httpStatus),
			renderDegraded(result.degraded, canonicalPath),
		);
	}
	const table = buildRouteTable(result.model, v2);
	if (!table.ok) {
		return failClosed(
			500,
			renderCollision(
				table.collision.left,
				table.collision.right,
				canonicalPath,
			),
		);
	}
	return dispatch(canonicalPath, parsed, result.model, v2, table.versions);
}

function dispatch(
	canonicalPath: string,
	parsed: HtmlParsed,
	model: PortalModel,
	v2: V2Model,
	versions: Map<string, VersionTarget>,
): PortalResponse {
	switch (parsed.page) {
		case "home":
			return ok(renderHome(model, v2, canonicalPath));
		case "software":
			return ok(renderSoftwareIndex(model, v2, canonicalPath));
		case "product":
			return ok(renderProduct(model, v2, parsed.product, canonicalPath));
		case "verify":
			return ok(renderVerify(model, v2, canonicalPath));
		case "keys":
			return ok(renderKeys(model, v2, canonicalPath));
		case "about":
			return ok(renderAbout(v2, canonicalPath));
		case "not-found-generic":
			return notFound(renderNotFound("generic", canonicalPath));
		case "version": {
			const key = versionPath(parsed.product, parsed.version);
			const target = versions.get(key);
			if (target === undefined) {
				return notFound(
					renderNotFound("version-shaped", canonicalPath, parsed.product),
				);
			}
			if (target.kind === "v2-release")
				return ok(renderV2Version(model, v2, target.record, canonicalPath));
			if (target.kind === "entry")
				return ok(renderVersion(model, v2, target.entry, canonicalPath));
			return ok(renderVersionFailure(model, target.failure, canonicalPath));
		}
	}
}

const STATIC_PATHS = [
	"/",
	"/software/",
	"/software/journal/",
	"/software/linux/",
	"/software/windows/",
	"/verify/",
	"/keys/",
	"/about/",
] as const;

export function renderAll(
	result: PortalModelResult,
	v2: V2Model = ABSENT_NO_PIN,
): Map<string, PortalResponse> {
	const out = new Map<string, PortalResponse>();
	out.set(STYLESHEET_PATH, stylesheetResponse());
	if (!result.ok) {
		for (const p of STATIC_PATHS) out.set(p, handle(p, result, v2));
		return out;
	}
	const table = buildRouteTable(result.model, v2);
	if (!table.ok) {
		for (const p of STATIC_PATHS) out.set(p, handle(p, result, v2));
		return out;
	}
	for (const p of STATIC_PATHS) out.set(p, handle(p, result, v2));
	for (const p of table.versions.keys()) out.set(p, handle(p, result, v2));
	return out;
}

export function collectHrefs(html: string): string[] {
	const hrefs: string[] = [];
	const re = /href=(["'])(.*?)\1/gi;
	let match: RegExpExecArray | null = re.exec(html);
	while (match !== null) {
		const href = match[2];
		if (href !== undefined) hrefs.push(href);
		match = re.exec(html);
	}
	return hrefs;
}

/** sol pbc's own witness page for the v2 root fingerprint lines: first-party, linked, never walked as a portal route. */
const OWN_WITNESS_HOST = "https://solpbc.org/";

function resolveHref(href: string, fromPath: string): string | null {
	if (href.startsWith("https://transparency.solstone.app")) return null;
	if (href.startsWith("https://trust.solstone.app")) return null;
	if (href.startsWith(OWN_WITNESS_HOST)) return null;
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return null;
	const hash = href.indexOf("#");
	const withoutHash = hash >= 0 ? href.slice(0, hash) : href;
	if (withoutHash === "" || withoutHash === "#") {
		return normalizePath(fromPath);
	}
	if (withoutHash.startsWith("/")) return normalizePath(withoutHash);
	const base = fromPath.endsWith("/") ? fromPath : `${fromPath}/`;
	return normalizePath(base + withoutHash);
}

export function collectInternalHrefs(html: string, fromPath: string): string[] {
	const out: string[] = [];
	for (const href of collectHrefs(html)) {
		const resolved = resolveHref(href, fromPath);
		if (resolved !== null) out.push(resolved);
	}
	return out;
}

export function foreignHrefs(html: string): string[] {
	return collectHrefs(html).filter((href) => {
		if (href.startsWith("https://transparency.solstone.app")) return false;
		if (
			href === "https://trust.solstone.app" ||
			href.startsWith("https://trust.solstone.app/")
		)
			return false;
		if (href.startsWith(OWN_WITNESS_HOST)) return false;
		if (href.startsWith("/") || href.startsWith("#")) return false;
		if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return false;
		return true;
	});
}
