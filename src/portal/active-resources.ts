// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Active-resource URL scanner. Distinct from collectHrefs/foreignHrefs, which
 * only inspect anchor hrefs. Fetching the evidence host is foreign here.
 */

const FETCH_RELS = new Set([
	"stylesheet",
	"icon",
	"preload",
	"prefetch",
	"modulepreload",
	"dns-prefetch",
	"preconnect",
]);

function parseAttrs(tagInner: string): Record<string, string> {
	const out: Record<string, string> = {};
	const re = /([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(["'])(.*?)\2/g;
	let match = re.exec(tagInner);
	while (match !== null) {
		const name = match[1];
		const value = match[3];
		if (name !== undefined && value !== undefined) {
			out[name.toLowerCase()] = value;
		}
		match = re.exec(tagInner);
	}
	return out;
}

function isPortalOrigin(url: string): boolean {
	const u = url.trim();
	if (u === "" || u.startsWith("#")) return true;
	if (u.startsWith("//")) return false;
	if (u.startsWith("/")) return true;
	if (u === "https://trust.solstone.app") return true;
	if (u.startsWith("https://trust.solstone.app/")) return true;
	return false;
}

function pushSrcset(urls: string[], value: string): void {
	for (const part of value.split(",")) {
		const token = part.trim().split(/\s+/)[0];
		if (token !== undefined && token !== "") urls.push(token);
	}
}

export function collectActiveResourceUrls(html: string): string[] {
	const urls: string[] = [];

	const linkRe = /<link\b([^>]*)>/gi;
	let linkMatch = linkRe.exec(html);
	while (linkMatch !== null) {
		const attrs = parseAttrs(linkMatch[1] ?? "");
		const rels = (attrs.rel ?? "")
			.toLowerCase()
			.split(/\s+/)
			.filter((r) => r.length > 0);
		if (!rels.includes("canonical") && rels.some((r) => FETCH_RELS.has(r))) {
			const href = attrs.href;
			if (href !== undefined && href !== "") urls.push(href);
		}
		linkMatch = linkRe.exec(html);
	}

	const attrRe =
		/(?:^|\s)(srcset|src|action|formaction|poster|data|ping)\s*=\s*(["'])(.*?)\2/gi;
	let attrMatch = attrRe.exec(html);
	while (attrMatch !== null) {
		const name = (attrMatch[1] ?? "").toLowerCase();
		const value = attrMatch[3] ?? "";
		if (name === "srcset") pushSrcset(urls, value);
		else if (value !== "") urls.push(value);
		attrMatch = attrRe.exec(html);
	}

	return urls;
}

export function foreignActiveResources(html: string): string[] {
	return collectActiveResourceUrls(html).filter((url) => !isPortalOrigin(url));
}
