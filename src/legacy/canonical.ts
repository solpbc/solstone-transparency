// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Canonicalization and trusted-comment helpers for the v1 ledger-entry /
 * latest-pointer wire format. This module is read-side only: it checks that
 * a fetched record conforms to the fixed v1 shape, it does not build or sign
 * new records.
 */

/** SHA-256 of `bytes`, lowercase hex. Copies into a fresh `ArrayBuffer`-backed view first, since a view over a `SharedArrayBuffer`-capable `ArrayBufferLike` is not accepted by `crypto.subtle.digest`'s stricter DOM lib type. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const owned = new Uint8Array(bytes);
	const digest = await crypto.subtle.digest("SHA-256", owned);
	return Buffer.from(digest).toString("hex");
}

/** True only if every character in `s` is in the printable ASCII range. */
export function isAsciiOnly(s: string): boolean {
	for (let i = 0; i < s.length; i++) {
		if (s.charCodeAt(i) > 0x7f) return false;
	}
	return true;
}

/** Recursively walks a parsed JSON value and returns every non-ASCII string found, or an empty array if none. */
export function findNonAsciiStrings(value: unknown, path = "$"): string[] {
	const hits: string[] = [];
	if (typeof value === "string") {
		if (!isAsciiOnly(value)) hits.push(path);
		return hits;
	}
	if (typeof value === "number" && !Number.isInteger(value)) {
		hits.push(`${path} (non-integer number)`);
		return hits;
	}
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			hits.push(...findNonAsciiStrings(value[i], `${path}[${i}]`));
		}
		return hits;
	}
	if (value && typeof value === "object") {
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			hits.push(...findNonAsciiStrings(v, `${path}.${k}`));
		}
	}
	return hits;
}

/** Parsed fields of a v1 trusted comment (entry or pointer form). */
export type TrustedCommentFields = Record<string, string>;

/**
 * Parses a minisign trusted comment of the fixed v1 shape:
 *   solpbc-transparency-v1 entry product=<p> seq=<n> version=<v> sha256=<h> prev=<h>
 *   solpbc-transparency-v1 latest product=<p> chain_length=<n> tip=<h> valid_until=<t>
 * Returns the key=value pairs after the fixed `solpbc-transparency-v1 <kind>` prefix.
 * Fails closed (returns null) on any shape that doesn't match key=value tokens.
 */
export function parseTrustedComment(
	comment: string,
): { recordKind: string; fields: TrustedCommentFields } | null {
	const tokens = comment.trim().split(/\s+/);
	if (tokens.length < 2 || tokens[0] !== "solpbc-transparency-v1") return null;
	const recordKind = tokens[1];
	if (recordKind === undefined) return null;
	const fields: TrustedCommentFields = {};
	for (const tok of tokens.slice(2)) {
		const eq = tok.indexOf("=");
		if (eq < 0) return null;
		fields[tok.slice(0, eq)] = tok.slice(eq + 1);
	}
	return { recordKind, fields };
}

/**
 * Binds a parsed entry trusted comment against the entry body it accompanies.
 * A mismatch here (e.g. comment says seq=5, body says seq=6) means the
 * signature covers different semantics than the body claims — the signature
 * bytes may verify while the binding is still forged, so this check is
 * separate from, and in addition to, minisign's own verification.
 */
export function trustedCommentMatchesEntry(
	fields: TrustedCommentFields,
	body: {
		product: string;
		seq: number;
		version: string;
		sha256: string;
		prevSha256: string;
	},
): { ok: true } | { ok: false; reason: string } {
	if (fields.product !== body.product)
		return {
			ok: false,
			reason: `product mismatch: comment=${fields.product} body=${body.product}`,
		};
	if (fields.seq !== String(body.seq))
		return {
			ok: false,
			reason: `seq mismatch: comment=${fields.seq} body=${body.seq}`,
		};
	if (fields.version !== body.version)
		return {
			ok: false,
			reason: `version mismatch: comment=${fields.version} body=${body.version}`,
		};
	if (fields.sha256 !== body.sha256)
		return {
			ok: false,
			reason: `sha256 mismatch: comment=${fields.sha256} body=${body.sha256}`,
		};
	if (fields.prev !== body.prevSha256)
		return {
			ok: false,
			reason: `prev mismatch: comment=${fields.prev} body=${body.prevSha256}`,
		};
	return { ok: true };
}

/** `published_utc` / `signed_at` / `valid_until` must be exactly `YYYY-MM-DDTHH:MM:SSZ` — no offset form, no fractional seconds. */
export function isCanonicalTimestamp(s: string): boolean {
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s);
}

/** The fixed 64-character all-zero sha256 used at chain genesis. */
export const GENESIS_SHA256 = "0".repeat(64);

function sortKeysDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeysDeep);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
		}
		return out;
	}
	return value;
}

/**
 * Canonical-JSON bytes for a fixture object: bytewise-sorted keys (recursive),
 * compact `(",", ":")` separators (`JSON.stringify`'s default has no
 * whitespace already), exactly one trailing `\n`. Used only to build test
 * fixtures in this repository's own tests — it is not the production
 * publisher's canonicalization function, which lives in each product repo.
 */
export function canonicalize(obj: unknown): Uint8Array {
	const sorted = sortKeysDeep(obj);
	return new TextEncoder().encode(`${JSON.stringify(sorted)}\n`);
}
