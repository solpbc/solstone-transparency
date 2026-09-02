// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { beforeAll, describe, expect, test } from "bun:test";
import { buildPortalModel } from "../legacy/adapter";
import {
	FakeFetcher,
	TEST_KEY_FILENAME,
	generateThrowawayKeypair,
	seedProductChain,
} from "../legacy/test-helpers";
import type { PortalModelResult } from "../legacy/types";
import {
	collectActiveResourceUrls,
	foreignActiveResources,
} from "./active-resources";
import { handle } from "./handle";
import { STYLESHEET_PATH } from "./routes";

const NOW = new Date("2026-06-01T00:00:00Z");

let defaultResult: PortalModelResult;

beforeAll(async () => {
	const kp = await generateThrowawayKeypair();
	const fetcher = new FakeFetcher();
	fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
	await seedProductChain(fetcher, kp, "journal", "solstone-journal");
	await seedProductChain(fetcher, kp, "linux", "solstone-linux");
	defaultResult = await buildPortalModel(fetcher, NOW);
});

describe("active-resource checker", () => {
	test("negative control: a foreign img src is reported", () => {
		const html = `<html><img src="https://evil.example/x.png"></html>`;
		expect(foreignActiveResources(html)).toEqual([
			"https://evil.example/x.png",
		]);
		expect(foreignActiveResources(html).length).toBeGreaterThan(0);
	});

	test("evidence-host img src is foreign for this checker", () => {
		const html = `<html><img src="https://transparency.solstone.app/x.png"></html>`;
		expect(foreignActiveResources(html)).toEqual([
			"https://transparency.solstone.app/x.png",
		]);
	});

	test("stylesheet path is same-origin; canonical is not an active resource", () => {
		const html = `<link rel="stylesheet" href="${STYLESHEET_PATH}"><link rel="canonical" href="https://trust.solstone.app/"><a href="https://transparency.solstone.app/x">raw</a>`;
		expect(collectActiveResourceUrls(html)).toEqual([STYLESHEET_PATH]);
		expect(foreignActiveResources(html)).toEqual([]);
	});

	test("protocol-relative src is foreign", () => {
		expect(
			foreignActiveResources(`<script src="//evil.example/x.js"></script>`),
		).toEqual(["//evil.example/x.js"]);
	});

	test("real rendered pages have no foreign active resources", () => {
		expect(defaultResult.ok).toBe(true);
		if (!defaultResult.ok) return;
		const home = handle("/", defaultResult).body;
		const product = handle("/software/journal/", defaultResult).body;
		const degraded = handle("/", {
			ok: false,
			degraded: {
				httpStatus: 503,
				marker: "degraded",
				reason: "fixture",
				neverStale: true,
			},
		}).body;
		expect(foreignActiveResources(home)).toEqual([]);
		expect(foreignActiveResources(product)).toEqual([]);
		expect(foreignActiveResources(degraded)).toEqual([]);
		expect(collectActiveResourceUrls(home)).toContain(STYLESHEET_PATH);
	});
});
