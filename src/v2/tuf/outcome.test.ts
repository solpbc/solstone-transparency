// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { TUF_REJECTION_REASONS, type TufResult } from "./outcome";
import { allRejectionFixtures } from "./rejection-fixtures.test-support";

const EXPECTED_REASONS = [
	"malformed",
	"invalid-encoding",
	"byte-length-changed",
	"unpaired-surrogate",
	"non-finite-number",
	"non-integer-number",
	"undefined-value",
	"oversized",
	"too-deep",
	"duplicate-key",
	"integer-not-round-trippable",
	"malformed-key",
	"wrong-key-length",
	"wrong-signature-length",
	"unsupported-key-type",
	"signature-invalid",
	"keyid-mismatch",
	"threshold-unmet",
	"key-not-in-role",
	"dangling-keyid",
	"degenerate-role-configuration",
	"role-not-authorized",
	"delegation-too-deep",
	"unsafe-target-path",
	"metadata-type-mismatch",
	"filename-version-mismatch",
	"unavailable",
	"retrieval-failed",
	"version-rollback",
	"snapshot-role-dropped",
	"snapshot-mismatch",
	"length-mismatch",
	"hash-mismatch",
	"expired",
	"unsupported-spec-version",
	"trust-store-corrupt",
] as const;

function assertMeaningful(value: unknown): void {
	expect(value).not.toBeUndefined();
	if (typeof value === "string") expect(value.length).toBeGreaterThan(0);
	if (Array.isArray(value)) expect(value.length).toBeGreaterThan(0);
	if (value !== null && typeof value === "object")
		expect(Object.keys(value).length).toBeGreaterThan(0);
}

function recordFailure(result: TufResult<unknown>, observed: string[]): void {
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(Object.keys(result.detail).length).toBeGreaterThan(0);
	expect(result.detail).toHaveProperty("expected");
	expect(result.detail).toHaveProperty("observed");
	assertMeaningful(result.detail.expected);
	assertMeaningful(result.detail.observed);
	observed.push(result.reason);
}

test("the reason vocabulary is complete, duplicate-free, and independently reachable", async () => {
	expect(TUF_REJECTION_REASONS).toEqual(EXPECTED_REASONS);
	expect(new Set(TUF_REJECTION_REASONS).size).toBe(EXPECTED_REASONS.length);

	const observed: string[] = [];
	for (const fixture of await allRejectionFixtures()) {
		recordFailure(await fixture.invoke(), observed);
	}
	expect(new Set(observed)).toEqual(new Set(EXPECTED_REASONS));
	expect(observed).toHaveLength(EXPECTED_REASONS.length);
});
