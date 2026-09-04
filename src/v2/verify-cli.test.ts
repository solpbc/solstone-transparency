// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { resolveObjectUrl } from "./verify-cli";

describe("resolveObjectUrl", () => {
	const metadataBase = "https://transparency.solstone.app/metadata";
	const targetsBase = "https://transparency.solstone.app/targets";

	test("resolves top-level metadata filenames against metadataBase", () => {
		for (const filename of [
			"root.json",
			"1.root.json",
			"42.root.json",
			"timestamp.json",
			"snapshot.json",
			"1.snapshot.json",
			"targets.json",
			"1.targets.json",
		]) {
			expect(resolveObjectUrl(metadataBase, targetsBase, filename)).toBe(
				`${metadataBase}/${filename}`,
			);
		}
	});

	test("resolves delegated role metadata filenames against metadataBase", () => {
		for (const filename of [
			"targets-software.json",
			"1.targets-software.json",
			"targets-services.json",
			"1.targets-services.json",
			"targets-verification.json",
			"1.targets-verification.json",
			"targets-legacy.json",
			"1.targets-legacy.json",
		]) {
			expect(resolveObjectUrl(metadataBase, targetsBase, filename)).toBe(
				`${metadataBase}/${filename}`,
			);
		}
	});

	test("resolves normal target paths against targetsBase", () => {
		for (const relativePath of [
			"software/release-1.0.0.json",
			"services/gateway/config.json",
			"verification/report.json",
			"legacy/artifact.json",
			"policy/authorization.json",
			"keys/signing-key.json",
		]) {
			expect(resolveObjectUrl(metadataBase, targetsBase, relativePath)).toBe(
				`${targetsBase}/${relativePath}`,
			);
		}
	});

	test("resolves adversarial target paths shaped like targets-* under prefixes against targetsBase", () => {
		for (const relativePath of [
			"software/targets-software.json",
			"software/nested/targets-services.json",
			"verification/targets-verification.json",
			"legacy/targets-legacy.json",
			"services/sub/targets-custom.json",
		]) {
			expect(resolveObjectUrl(metadataBase, targetsBase, relativePath)).toBe(
				`${targetsBase}/${relativePath}`,
			);
		}
	});

	test("trims trailing slashes on metadataBase and targetsBase", () => {
		expect(
			resolveObjectUrl(
				"https://example.com/meta/",
				"https://example.com/targ/",
				"1.targets-software.json",
			),
		).toBe("https://example.com/meta/1.targets-software.json");
		expect(
			resolveObjectUrl(
				"https://example.com/meta/",
				"https://example.com/targ/",
				"software/item.json",
			),
		).toBe("https://example.com/targ/software/item.json");
	});
});
