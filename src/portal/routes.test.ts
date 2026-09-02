// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { buildPortalModel } from "../legacy/adapter";
import { JOURNAL_GAP } from "../legacy/inventory";
import {
	FakeFetcher,
	TEST_KEY_FILENAME,
	generateThrowawayKeypair,
	seedProductChain,
} from "../legacy/test-helpers";
import { handle } from "./handle";
import {
	STYLESHEET_PATH,
	buildRouteTable,
	normalizePath,
	parsePath,
	versionPath,
} from "./routes";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("AC-2 route identity is collision-safe", () => {
	test("visually similar versions keep distinct routes; no case-fold alias", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "journal", "solstone-journal", {
			versions: ["Aa", "aa"],
		});
		const result = await buildPortalModel(fetcher, NOW, {
			journal: ["Aa", "aa"],
			linux: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const table = buildRouteTable(result.model);
		expect(table.ok).toBe(true);
		if (!table.ok) return;
		expect(table.versions.has(versionPath("journal", "Aa"))).toBe(true);
		expect(table.versions.has(versionPath("journal", "aa"))).toBe(true);
		expect(versionPath("journal", "Aa")).not.toBe(versionPath("journal", "aa"));
		const upper = handle("/software/journal/Aa/", result);
		const lower = handle("/software/journal/aa/", result);
		expect(upper.status).toBe(200);
		expect(lower.status).toBe(200);
		expect(upper.body).toContain("Aa");
		expect(lower.body).toContain("aa");
		expect(upper.body).not.toBe(lower.body);
	});

	test("percent-looking version string is a distinct route, not a decode alias of 1.0.22", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "journal", "solstone-journal", {
			versions: ["1.0.22", "1.0%2e22"],
		});
		const result = await buildPortalModel(fetcher, NOW, {
			journal: ["1.0.22", "1.0%2e22"],
			linux: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const table = buildRouteTable(result.model);
		expect(table.ok).toBe(true);
		if (!table.ok) return;
		expect(table.versions.size).toBe(2);
		expect(versionPath("journal", "1.0.22")).not.toBe(
			versionPath("journal", "1.0%2e22"),
		);
	});

	test("byte-identical duplicate versions fail closed naming both, neither aliased to 200", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "journal", "solstone-journal", {
			versions: ["0.0.1"],
		});
		const result = await buildPortalModel(fetcher, NOW, {
			journal: ["0.0.1", "0.0.1"],
			linux: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const table = buildRouteTable(result.model);
		expect(table.ok).toBe(false);
		if (table.ok) return;
		expect(table.collision.left.version).toBe("0.0.1");
		expect(table.collision.right.version).toBe("0.0.1");
		expect(table.collision.left.product).toBe("journal");
		expect(table.collision.right.product).toBe("journal");
		const res = handle("/software/journal/0.0.1/", result);
		expect(res.status).toBe(500);
		expect(res.headers["Cache-Control"]).toBe("no-store");
		expect(res.body).toContain("0.0.1");
		expect(res.body).toContain("journal");
		expect(res.body).not.toContain("axis-block");
	});

	test("the curated absent version is not a special route matcher", async () => {
		expect(JOURNAL_GAP.absentVersion).toBeDefined();
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "journal", "solstone-journal");
		await seedProductChain(fetcher, kp, "linux", "solstone-linux");
		const result = await buildPortalModel(fetcher, NOW);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const table = buildRouteTable(result.model);
		expect(table.ok).toBe(true);
		if (!table.ok) return;
		expect(
			table.versions.has(versionPath("journal", JOURNAL_GAP.absentVersion)),
		).toBe(false);
	});
});

describe("stylesheet path matching", () => {
	test("normalizePath keeps the stylesheet path extension and drops a trailing slash", () => {
		expect(normalizePath(STYLESHEET_PATH)).toBe(STYLESHEET_PATH);
		expect(normalizePath(`${STYLESHEET_PATH}/`)).toBe(STYLESHEET_PATH);
		expect(normalizePath(`${STYLESHEET_PATH}?v=1`)).toBe(STYLESHEET_PATH);
		expect(normalizePath("/software/journal/1.2.3")).toBe(
			"/software/journal/1.2.3/",
		);
	});

	test("parsePath recognizes the stylesheet before HTML matching", () => {
		expect(parsePath(STYLESHEET_PATH)).toEqual({ page: "stylesheet" });
		expect(parsePath(`${STYLESHEET_PATH}/`)).toEqual({ page: "stylesheet" });
		expect(parsePath("/static/other.css")).toEqual({
			page: "not-found-generic",
		});
	});
});
