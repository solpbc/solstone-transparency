// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { TUF_REJECTION_REASONS } from "./outcome";
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
	"payload-type-mismatch",
	"unrecognized-predicate",
	"predicate-malformed",
	"subject-mismatch",
	"outside-issuance-window",
	"unknown-key",
	"migration-target-mismatch",
] as const;

test("A3 fixture-to-reason oracle reaches every declared rejection reason", async () => {
	const fixtures = await allRejectionFixtures();
	const observed = new Set<string>();
	for (const fixture of fixtures) {
		const result = await fixture.invoke();
		expect(result.ok, fixture.reason).toBe(false);
		if (!result.ok) {
			expect(result.reason, fixture.reason).toBe(fixture.reason);
			observed.add(result.reason);
		}
	}
	expect(observed).toEqual(new Set(TUF_REJECTION_REASONS));
});

test("A3 complete rejection vocabulary is an independent literal", () => {
	expect(TUF_REJECTION_REASONS).toEqual(EXPECTED_REASONS);
	expect(new Set(EXPECTED_REASONS).size).toBe(EXPECTED_REASONS.length);
});
