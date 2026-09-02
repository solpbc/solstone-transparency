// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/** Safe absolute evidence-host links carried inside signed migration metadata. */

import { type TufResult, rejection } from "../tuf/outcome";

export const EVIDENCE_HOST = "transparency.solstone.app";

function unsafe(
	expected: string,
	observed: unknown,
	path: readonly string[] = [],
) {
	return rejection("unsafe-target-path", { path, expected, observed });
}

/**
 * Checks raw text before URL parsing because WHATWG URL normalizes dot segments
 * away. This is deliberately independent from the legacy display-link helper.
 */
export function validateEvidenceHostLink(candidate: string): TufResult<string> {
	if (
		/%2e%2e|%2f|%5c/i.test(candidate) ||
		/(^|\/)\.\.?(\/|$)/.test(candidate)
	) {
		return unsafe("no encoded separator or dot-segment ambiguity", candidate);
	}
	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return unsafe("a parseable HTTPS evidence URL", candidate);
	}
	if (url.protocol !== "https:") return unsafe("https scheme", url.protocol);
	if (url.hostname !== EVIDENCE_HOST)
		return unsafe(`host ${EVIDENCE_HOST}`, url.hostname);
	if (url.port !== "") return unsafe("default HTTPS port", url.port);
	if (url.username !== "" || url.password !== "")
		return unsafe("no URL credentials", `${url.username}:${url.password}`);
	if (url.search !== "") return unsafe("no query string", url.search);
	if (url.hash !== "") return unsafe("no fragment", url.hash);
	if (url.pathname.includes("//"))
		return unsafe("no doubled path separator", url.pathname);
	if (url.toString() !== candidate)
		return unsafe("an already normalized URL", {
			candidate,
			normalized: url.toString(),
		});
	return { ok: true, value: url.toString() };
}
