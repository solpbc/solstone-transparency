// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { validateEvidenceHostLink } from "./evidence-host-link";

describe("evidence-host link validation", () => {
	test("AC 17: accepts the exact evidence host shape", () => {
		expect(
			validateEvidenceHostLink(
				"https://transparency.solstone.app/releases/example/object",
			),
		).toEqual({
			ok: true,
			value: "https://transparency.solstone.app/releases/example/object",
		});
	});

	test("AC 17 and 18: rejects the proven raw dot-segment attack before URL normalization", () => {
		expect(
			validateEvidenceHostLink(
				"https://transparency.solstone.app/releases/example-product/v/../../../etc/passwd",
			),
		).toMatchObject({ ok: false, reason: "unsafe-target-path" });
		for (const candidate of [
			"http://transparency.solstone.app/releases/x",
			"https://evil.example/releases/x",
			"https://user:pass@transparency.solstone.app/releases/x",
			"https://transparency.solstone.app/releases/x?query=1",
			"https://transparency.solstone.app/releases/x#fragment",
			"https://transparency.solstone.app/releases/%2f/x",
		]) {
			expect(validateEvidenceHostLink(candidate)).toMatchObject({
				ok: false,
				reason: "unsafe-target-path",
			});
		}
	});
});
