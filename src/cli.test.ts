// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { run } from "./cli";

async function capture(
	fn: () => Promise<number>,
): Promise<{ code: number; out: string[] }> {
	const out: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => {
		out.push(args.join(" "));
	};
	try {
		const code = await fn();
		return { code, out };
	} finally {
		console.log = original;
	}
}

describe("run", () => {
	test("--help prints usage and exits 0", async () => {
		const { code, out } = await capture(() => run(["--help"]));
		expect(code).toBe(0);
		expect(out.join("\n")).toContain("Usage: solstone-transparency");
	});

	test("no arguments also prints usage and exits 0", async () => {
		const { code, out } = await capture(() => run([]));
		expect(code).toBe(0);
		expect(out.join("\n")).toContain("Usage: solstone-transparency");
	});

	test("--version prints the installed version and exits 0", async () => {
		const { code, out } = await capture(() => run(["--version"]));
		expect(code).toBe(0);
		expect(out[0]).toMatch(/^\d+\.\d+\.\d+/);
	});

	test("legacy-model without --out fails with a clear message and exits 1", async () => {
		const code = await run(["legacy-model"]);
		expect(code).toBe(1);
	});

	test("--help includes publish-v2 usage and options", async () => {
		const { code, out } = await capture(() => run(["--help"]));
		expect(code).toBe(0);
		const fullText = out.join("\n");
		expect(fullText).toContain("publish-v2 --artifacts <path>");
		expect(fullText).toContain(
			"publish-v2          Build and publish a v2 TUF repository",
		);
	});

	test("publish-v2 missing required flags fails with exit code 1", async () => {
		expect(await run(["publish-v2"])).toBe(1);
		expect(await run(["publish-v2", "--artifacts", "foo.json"])).toBe(1);
		expect(
			await run([
				"publish-v2",
				"--artifacts",
				"foo.json",
				"--product",
				"journal",
			]),
		).toBe(1);
		expect(
			await run([
				"publish-v2",
				"--artifacts",
				"foo.json",
				"--product",
				"journal",
				"--keys",
				"keys.json",
			]),
		).toBe(1);
		expect(
			await run([
				"publish-v2",
				"--artifacts",
				"foo.json",
				"--product",
				"journal",
				"--keys",
				"keys.json",
				"--policy-sha256",
				"a".repeat(64),
			]),
		).toBe(1);
	});
});
