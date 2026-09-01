// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import {
	GENESIS_SHA256,
	canonicalize,
	findNonAsciiStrings,
	isAsciiOnly,
	isCanonicalTimestamp,
	parseTrustedComment,
	trustedCommentMatchesEntry,
} from "./canonical";

describe("isAsciiOnly / findNonAsciiStrings", () => {
	test("plain ASCII passes", () => {
		expect(isAsciiOnly("solstone-journal-1.0.22")).toBe(true);
	});

	test("a non-ASCII character fails", () => {
		expect(isAsciiOnly("solstone-café")).toBe(false);
	});

	test("findNonAsciiStrings walks nested structures and reports the path", () => {
		const hits = findNonAsciiStrings({ artifacts: [{ name: "café" }] });
		expect(hits.length).toBe(1);
		expect(hits[0]).toContain("artifacts[0].name");
	});

	test("findNonAsciiStrings flags a non-integer number", () => {
		const hits = findNonAsciiStrings({ seq: 1.5 });
		expect(hits.length).toBe(1);
	});
});

describe("isCanonicalTimestamp", () => {
	test("accepts the exact fixed shape", () => {
		expect(isCanonicalTimestamp("2026-08-02T00:57:05Z")).toBe(true);
	});

	test("rejects an offset form", () => {
		expect(isCanonicalTimestamp("2026-08-02T00:57:05+00:00")).toBe(false);
	});

	test("rejects fractional seconds", () => {
		expect(isCanonicalTimestamp("2026-08-02T00:57:05.123Z")).toBe(false);
	});
});

describe("parseTrustedComment", () => {
	test("parses a real entry-shaped trusted comment", () => {
		const parsed = parseTrustedComment(
			"solpbc-transparency-v1 entry product=solstone-journal seq=10 version=1.0.22 sha256=abc prev=def",
		);
		expect(parsed).toEqual({
			recordKind: "entry",
			fields: {
				product: "solstone-journal",
				seq: "10",
				version: "1.0.22",
				sha256: "abc",
				prev: "def",
			},
		});
	});

	test("fails closed on a comment with the wrong fixed prefix", () => {
		expect(
			parseTrustedComment("some other tool's comment product=x"),
		).toBeNull();
	});

	test("fails closed on a token with no '='", () => {
		expect(
			parseTrustedComment("solpbc-transparency-v1 entry product"),
		).toBeNull();
	});
});

describe("trustedCommentMatchesEntry", () => {
	test("matches when every field agrees", () => {
		const result = trustedCommentMatchesEntry(
			{
				product: "solstone-journal",
				seq: "10",
				version: "1.0.22",
				sha256: "abc",
				prev: "def",
			},
			{
				product: "solstone-journal",
				seq: 10,
				version: "1.0.22",
				sha256: "abc",
				prevSha256: "def",
			},
		);
		expect(result).toEqual({ ok: true });
	});

	test("catches a seq mismatch between the trusted comment and the signed body", () => {
		const result = trustedCommentMatchesEntry(
			{
				product: "solstone-journal",
				seq: "5",
				version: "1.0.22",
				sha256: "abc",
				prev: "def",
			},
			{
				product: "solstone-journal",
				seq: 6,
				version: "1.0.22",
				sha256: "abc",
				prevSha256: "def",
			},
		);
		expect(result.ok).toBe(false);
	});
});

describe("canonicalize", () => {
	test("sorts keys bytewise and produces compact separators with a trailing newline", () => {
		const bytes = canonicalize({ b: 1, a: 2 });
		expect(new TextDecoder().decode(bytes)).toBe('{"a":2,"b":1}\n');
	});

	test("sorts nested object keys too", () => {
		const bytes = canonicalize({ outer: { z: 1, a: 2 } });
		expect(new TextDecoder().decode(bytes)).toBe('{"outer":{"a":2,"z":1}}\n');
	});
});

test("GENESIS_SHA256 is exactly 64 zero characters", () => {
	expect(GENESIS_SHA256).toBe("0".repeat(64));
	expect(GENESIS_SHA256.length).toBe(64);
});
