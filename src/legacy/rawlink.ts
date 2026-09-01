// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Raw evidence-link construction and validation, bound to the exact real v1
 * layout. A raw link is clickable only when it is a valid HTTPS URL on
 * `transparency.solstone.app`, uses the default port, carries no
 * credentials/query/fragment, has a normalized path with no encoded
 * separator or dot-segment ambiguity, and belongs to the exact modeled
 * member it labels. Everything else renders as non-clickable unavailable
 * evidence with a named reason — this module never silently passes through
 * a hostile or malformed candidate.
 */

export const EVIDENCE_HOST = "transparency.solstone.app";

export type RawLinkResult =
	| { status: "linked"; url: string }
	| { status: "rejected"; reason: string };

/**
 * Validates an already-constructed candidate URL string against the raw-link
 * safety contract. Never throws — a malformed input is a `rejected` result,
 * not an exception.
 *
 * The dot-segment/encoded-separator check runs against the RAW candidate
 * text, before `new URL()` ever sees it. The WHATWG URL parser silently
 * resolves a `/../` segment during construction — a candidate like
 * `.../v/../../../etc/passwd` becomes a plausible-looking, already-normalized
 * `.../etc/passwd` — so checking the parsed `url.pathname` afterward can
 * never observe the ambiguity that made the candidate dangerous in the first
 * place. This was found by this module's own negative-control test (a
 * dot-segment candidate was reported "linked"), not assumed correct.
 */
export function validateRawLink(candidate: string): RawLinkResult {
	if (
		/%2e%2e|%2f|%5c/i.test(candidate) ||
		/(^|\/)\.\.?(\/|$)/.test(candidate)
	) {
		return {
			status: "rejected",
			reason: "path contains an encoded separator or dot-segment ambiguity",
		};
	}
	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return { status: "rejected", reason: "not a parseable URL" };
	}
	if (url.protocol !== "https:") {
		return {
			status: "rejected",
			reason: `scheme must be https, got ${url.protocol}`,
		};
	}
	if (url.hostname !== EVIDENCE_HOST) {
		return {
			status: "rejected",
			reason: `host must be ${EVIDENCE_HOST}, got ${url.hostname}`,
		};
	}
	if (url.port !== "") {
		return { status: "rejected", reason: "non-default port not allowed" };
	}
	if (url.username !== "" || url.password !== "") {
		return {
			status: "rejected",
			reason: "credentials not allowed in a raw link",
		};
	}
	if (url.search !== "") {
		return {
			status: "rejected",
			reason: "query string not allowed in a raw link",
		};
	}
	if (url.hash !== "") {
		return { status: "rejected", reason: "fragment not allowed in a raw link" };
	}
	if (url.pathname.includes("//")) {
		return {
			status: "rejected",
			reason: "path contains a doubled separator",
		};
	}
	if (url.toString() !== candidate) {
		return {
			status: "rejected",
			reason:
				"candidate was not already in normalized form — refusing to link a URL that differs from what it will actually resolve to",
		};
	}
	return { status: "linked", url: url.toString() };
}

/** Builds and validates the fixed-layout URL for a locked ledger entry object. */
export function entryUrl(product: string, version: string): RawLinkResult {
	return validateRawLink(
		`https://${EVIDENCE_HOST}/releases/${product}/v/${version}/ledger-entry.json`,
	);
}

export function entrySigUrl(product: string, version: string): RawLinkResult {
	return validateRawLink(
		`https://${EVIDENCE_HOST}/releases/${product}/v/${version}/ledger-entry.json.minisig`,
	);
}

/** Manifests/proofs live under the same version directory, by their own real retained filename — never a singular invented `manifest.json`/`proof.json`. */
export function versionMemberUrl(
	product: string,
	version: string,
	filename: string,
): RawLinkResult {
	return validateRawLink(
		`https://${EVIDENCE_HOST}/releases/${product}/v/${version}/${filename}`,
	);
}

/** The mutable pointer pair binds only to the tip entry, never per-version. */
export function latestUrl(product: string): RawLinkResult {
	return validateRawLink(
		`https://${EVIDENCE_HOST}/releases/${product}/latest.json`,
	);
}

export function latestSigUrl(product: string): RawLinkResult {
	return validateRawLink(
		`https://${EVIDENCE_HOST}/releases/${product}/latest.json.minisig`,
	);
}

/** The derived ledger binds at product scope, never per-version. */
export function ledgerUrl(product: string): RawLinkResult {
	return validateRawLink(
		`https://${EVIDENCE_HOST}/releases/${product}/ledger.jsonl`,
	);
}

export function keyUrl(filename: string): RawLinkResult {
	return validateRawLink(`https://${EVIDENCE_HOST}/releases/keys/${filename}`);
}

export function aboutUrl(): RawLinkResult {
	return validateRawLink(`https://${EVIDENCE_HOST}/releases/ABOUT.txt`);
}
