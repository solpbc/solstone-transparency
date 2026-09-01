// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { INVALID_SCHEME_CANDIDATES } from "./fixtures";
import {
	entrySigUrl,
	entryUrl,
	keyUrl,
	latestSigUrl,
	latestUrl,
	ledgerUrl,
	validateRawLink,
	versionMemberUrl,
} from "./rawlink";

describe("negative control 4 — invalid URL scheme / shape", () => {
	test("every hostile or malformed candidate is rejected, never clickable", () => {
		expect(INVALID_SCHEME_CANDIDATES.length).toBeGreaterThan(0);
		for (const candidate of INVALID_SCHEME_CANDIDATES) {
			const result = validateRawLink(candidate);
			expect(result.status).toBe("rejected");
		}
	});

	test("a plausible-looking but wrong host is rejected, not just a scheme mismatch", () => {
		expect(
			validateRawLink(
				"https://transparency.solstone.app.evil.example/releases/x",
			).status,
		).toBe("rejected");
	});
});

describe("exact v1 layout binding", () => {
	test("entryUrl binds to the real fixed layout", () => {
		const result = entryUrl("solstone-journal", "1.0.22");
		expect(result).toEqual({
			status: "linked",
			url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.22/ledger-entry.json",
		});
	});

	test("entrySigUrl is the entry URL plus .minisig, never a separate invented path", () => {
		const result = entrySigUrl("solstone-journal", "1.0.22");
		expect(result).toEqual({
			status: "linked",
			url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.22/ledger-entry.json.minisig",
		});
	});

	test("versionMemberUrl uses the real retained filename, never a singular manifest.json/proof.json", () => {
		const result = versionMemberUrl(
			"solstone-linux",
			"1.0.2",
			"solstone-linux-1.0.2-linux-x86_64.rust-release-manifest.json",
		);
		expect(result).toEqual({
			status: "linked",
			url: "https://transparency.solstone.app/releases/solstone-linux/v/1.0.2/solstone-linux-1.0.2-linux-x86_64.rust-release-manifest.json",
		});
	});

	test("latestUrl/latestSigUrl bind at product scope, not per-version", () => {
		expect(latestUrl("solstone-journal")).toEqual({
			status: "linked",
			url: "https://transparency.solstone.app/releases/solstone-journal/latest.json",
		});
		expect(latestSigUrl("solstone-journal")).toEqual({
			status: "linked",
			url: "https://transparency.solstone.app/releases/solstone-journal/latest.json.minisig",
		});
	});

	test("ledgerUrl binds at product scope, never per-version", () => {
		expect(ledgerUrl("solstone-journal")).toEqual({
			status: "linked",
			url: "https://transparency.solstone.app/releases/solstone-journal/ledger.jsonl",
		});
	});

	test("keyUrl binds under releases/keys/", () => {
		expect(keyUrl("solpbc-transparency-1.pub")).toEqual({
			status: "linked",
			url: "https://transparency.solstone.app/releases/keys/solpbc-transparency-1.pub",
		});
	});
});
