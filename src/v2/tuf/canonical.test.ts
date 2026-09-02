// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { admitTufJson } from "./admission";
import { canonicalizeTufJson } from "./canonical";
import type { TufRejectionReason } from "./outcome";
import { loadTufConformanceVectors } from "./testdata/vectors";

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function expectFailure(
	result: ReturnType<typeof canonicalizeTufJson>,
	reason: TufRejectionReason,
): void {
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(result.reason).toBe(reason);
	expect(Object.keys(result.detail).length).toBeGreaterThan(0);
}

describe("canonicalizeTufJson", () => {
	test("matches all independent canonical JSON vectors", async () => {
		const vectors = await loadTufConformanceVectors();
		for (const vector of vectors.canonical_json) {
			const result = canonicalizeTufJson(vector.input);
			expect(result.ok, vector.name).toBe(true);
			if (!result.ok) continue;
			expect(bytesToHex(result.value), vector.name).toBe(
				vector.canonical_utf8_hex,
			);
		}
	});

	test("is independent of object key insertion order", () => {
		const first = canonicalizeTufJson({ z: 1, a: { y: 2, b: 3 } });
		const second = canonicalizeTufJson({ a: { b: 3, y: 2 }, z: 1 });
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(first.value).toEqual(second.value);
	});

	test("round-trips a nested canonical fixture through admission", () => {
		const source = {
			signed: { roles: ["root", "targets"], version: 2 },
			signatures: [],
		};
		const canonical = canonicalizeTufJson(source);
		expect(canonical.ok).toBe(true);
		if (!canonical.ok) return;
		expect(admitTufJson(canonical.value)).toEqual({ ok: true, value: source });
	});

	test("returns named direct-value rejections with detail", () => {
		expectFailure(canonicalizeTufJson(undefined), "undefined-value");
		expectFailure(canonicalizeTufJson(Number.NaN), "non-finite-number");
		expectFailure(canonicalizeTufJson(1.5), "non-integer-number");
		expectFailure(canonicalizeTufJson("\ud800"), "unpaired-surrogate");
	});
});
