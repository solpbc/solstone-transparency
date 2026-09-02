// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Request → HTML for the Wave 1 portal. Consumes a PortalModelResult;
 * never re-fetches or re-verifies evidence.
 */

import type { PortalModel, PortalModelResult } from "../legacy/types";
import {
	renderAbout,
	renderCollision,
	renderDegraded,
	renderHome,
	renderKeys,
	renderNotFound,
	renderProduct,
	renderSoftwareIndex,
	renderVerify,
	renderVersion,
	renderVersionFailure,
} from "./pages";
import {
	type VersionTarget,
	buildRouteTable,
	normalizePath,
	parsePath,
	versionPath,
} from "./routes";

export interface PortalResponse {
	status: number;
	body: string;
	headers: { "cache-control"?: "no-store" };
}

function httpStatusFromDegraded(status: number): number {
	return status >= 400 && status <= 599 ? status : 503;
}

function failClosed(status: number, body: string): PortalResponse {
	return { status, body, headers: { "cache-control": "no-store" } };
}

function ok(body: string): PortalResponse {
	return { status: 200, body, headers: {} };
}

function notFound(body: string): PortalResponse {
	return { status: 404, body, headers: {} };
}

export function handle(
	path: string,
	result: PortalModelResult,
): PortalResponse {
	if (!result.ok) {
		return failClosed(
			httpStatusFromDegraded(result.degraded.httpStatus),
			renderDegraded(result.degraded),
		);
	}
	const table = buildRouteTable(result.model);
	if (!table.ok) {
		return failClosed(
			500,
			renderCollision(table.collision.left, table.collision.right),
		);
	}
	return dispatch(path, result.model, table.versions);
}

function dispatch(
	path: string,
	model: PortalModel,
	versions: Map<string, VersionTarget>,
): PortalResponse {
	const parsed = parsePath(path);
	switch (parsed.page) {
		case "home":
			return ok(renderHome(model));
		case "software":
			return ok(renderSoftwareIndex(model));
		case "product":
			return ok(renderProduct(model, parsed.product));
		case "verify":
			return ok(renderVerify(model));
		case "keys":
			return ok(renderKeys(model));
		case "about":
			return ok(renderAbout());
		case "not-found-generic":
			return notFound(renderNotFound("generic"));
		case "version": {
			if (parsed.product === "windows") {
				return notFound(renderNotFound("version-shaped", "windows"));
			}
			const key = versionPath(parsed.product, parsed.version);
			const target = versions.get(key);
			if (target === undefined) {
				return notFound(renderNotFound("version-shaped", parsed.product));
			}
			if (target.kind === "entry")
				return ok(renderVersion(model, target.entry));
			return ok(renderVersionFailure(model, target.failure));
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
): Map<string, PortalResponse> {
	const out = new Map<string, PortalResponse>();
	if (!result.ok) {
		const body = failClosed(
			httpStatusFromDegraded(result.degraded.httpStatus),
			renderDegraded(result.degraded),
		);
		for (const p of STATIC_PATHS) out.set(p, body);
		return out;
	}
	const table = buildRouteTable(result.model);
	if (!table.ok) {
		const body = failClosed(
			500,
			renderCollision(table.collision.left, table.collision.right),
		);
		for (const p of STATIC_PATHS) out.set(p, body);
		return out;
	}
	for (const p of STATIC_PATHS) out.set(p, handle(p, result));
	for (const p of table.versions.keys()) out.set(p, handle(p, result));
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

function resolveHref(href: string, fromPath: string): string | null {
	if (href.startsWith("https://transparency.solstone.app")) return null;
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
		if (href.startsWith("/") || href.startsWith("#")) return false;
		if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return false;
		return true;
	});
}
