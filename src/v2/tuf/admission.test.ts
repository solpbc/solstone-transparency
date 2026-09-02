// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import {
	DEFAULT_MAX_JSON_DEPTH,
	DEFAULT_MAX_METADATA_BYTES,
	admitTufJson,
} from "./admission";
import { canonicalizeTufJson } from "./canonical";
import type { TufRejectionReason } from "./outcome";

const encoder = new TextEncoder();

function expectFailure(
	result: ReturnType<typeof admitTufJson>,
	reason: TufRejectionReason,
): void {
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(result.reason).toBe(reason);
	expect(Object.keys(result.detail).length).toBeGreaterThan(0);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.byteLength !== right.byteLength) return false;
	for (let index = 0; index < left.byteLength; index++) {
		if (left[index] !== right[index]) return false;
	}
	return true;
}

describe("admitTufJson", () => {
	test("rejects oversized bytes before attempting JSON or UTF-8 decoding", () => {
		// Precedence proof: these invalid UTF-8 bytes are oversized, so oversized wins.
		const bytes = new Uint8Array(DEFAULT_MAX_METADATA_BYTES + 1).fill(0xff);
		const result = admitTufJson(bytes);
		expectFailure(result, "oversized");
		if (!result.ok) {
			expect(result.detail.expected).toBe(DEFAULT_MAX_METADATA_BYTES);
			expect(result.detail.observed).toBe(DEFAULT_MAX_METADATA_BYTES + 1);
		}
	});

	test("rejects a 100,000-level fixture before content at depth 33", () => {
		const tooDeep = encoder.encode(`${"[".repeat(100_000)}`);
		const result = admitTufJson(tooDeep);
		expectFailure(result, "too-deep");
		if (!result.ok)
			expect(result.detail.observed).toBe(DEFAULT_MAX_JSON_DEPTH + 1);
	});

	test("depth rejection wins over syntax errors located inside the next container", () => {
		const bytes = encoder.encode(`${"[".repeat(DEFAULT_MAX_JSON_DEPTH + 1)}!`);
		expectFailure(admitTufJson(bytes), "too-deep");
	});

	test("depth rejection wins over duplicate keys inside the next container", () => {
		const bytes = encoder.encode(
			`${"[".repeat(DEFAULT_MAX_JSON_DEPTH)}{"a":1,"a":2}${"]".repeat(DEFAULT_MAX_JSON_DEPTH)}`,
		);
		expectFailure(admitTufJson(bytes), "too-deep");
	});

	test("detects duplicate object keys by decoded value at all nesting levels", () => {
		expectFailure(
			admitTufJson(encoder.encode('{"a":1,"a":2}')),
			"duplicate-key",
		);
		expectFailure(
			admitTufJson(encoder.encode('{"outer":{"a":1,"a":2}}')),
			"duplicate-key",
		);
		expectFailure(
			admitTufJson(encoder.encode('{"a":1,"\\u0061":2}')),
			"duplicate-key",
		);
	});

	test("rejects invalid UTF-8 before a replacement character can reach canonicalization", () => {
		// Precedence proof: if decoded as text, these bytes would not form valid JSON.
		const invalid = new Uint8Array([0xc3, 0x28]);
		const result = admitTufJson(invalid);
		expectFailure(result, "invalid-encoding");
		if (!result.ok) expect(result.reason).not.toBe("signature-invalid");
		expect(admitTufJson(encoder.encode('{"ok":"é"}'))).toEqual({
			ok: true,
			value: { ok: "é" },
		});
	});

	test("checks integer source text rather than a safe-integer magnitude shortcut", () => {
		expect(admitTufJson(encoder.encode("9007199254740992"))).toEqual({
			ok: true,
			value: 9007199254740992,
		});
		expectFailure(
			admitTufJson(encoder.encode("9007199254740993")),
			"integer-not-round-trippable",
		);
		expectFailure(admitTufJson(encoder.encode("1.0")), "non-integer-number");
		expectFailure(admitTufJson(encoder.encode("1e2")), "non-integer-number");
	});

	test("documents non-finite and undefined as direct-value canonicalizer failures", () => {
		const nonFinite = canonicalizeTufJson(Number.POSITIVE_INFINITY);
		expect(nonFinite.ok).toBe(false);
		if (!nonFinite.ok) expect(nonFinite.reason).toBe("non-finite-number");
		const undefinedValue = canonicalizeTufJson(undefined);
		expect(undefinedValue.ok).toBe(false);
		if (!undefinedValue.ok)
			expect(undefinedValue.reason).toBe("undefined-value");
	});

	test("detects a stripped BOM through byte-length round-trip comparison", () => {
		const bomPrefixed = new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]);
		const stripped = new TextDecoder("utf-8", { fatal: true }).decode(
			bomPrefixed,
		);
		const preserved = new TextDecoder("utf-8", {
			fatal: true,
			ignoreBOM: true,
		}).decode(bomPrefixed);
		expect(sameBytes(encoder.encode(stripped), bomPrefixed)).toBe(false);
		expect(sameBytes(encoder.encode(preserved), bomPrefixed)).toBe(true);
		expectFailure(admitTufJson(bomPrefixed), "byte-length-changed");
	});

	test("rejects lone surrogate escapes while accepting paired supplementary characters", () => {
		expectFailure(
			admitTufJson(encoder.encode('"\\ud800"')),
			"unpaired-surrogate",
		);
		expect(admitTufJson(encoder.encode('"😀"'))).toEqual({
			ok: true,
			value: "😀",
		});
	});

	test("rejects plain JSON syntax errors", () => {
		expectFailure(admitTufJson(encoder.encode("[1,]")), "malformed");
		expectFailure(admitTufJson(encoder.encode("{a:1}")), "malformed");
	});

	test("accepts realistic shallow TUF metadata nesting", () => {
		const metadata = {
			signed: {
				_delegations: {
					roles: [
						{ keyids: ["a"], name: "targets/releases", paths: ["releases/*"] },
					],
				},
				meta: { "targets.json": { length: 12, version: 1 } },
				roles: { root: { keyids: ["a"], threshold: 1 } },
				version: 1,
			},
			signatures: [{ keyid: "a", sig: "00" }],
		};
		const bytes = encoder.encode(JSON.stringify(metadata));
		const result = admitTufJson(bytes);
		expect(result).toEqual({ ok: true, value: metadata });
	});
});
