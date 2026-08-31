// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { run } from "./cli";

function capture(fn: () => number): { code: number; out: string[] } {
	const out: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => {
		out.push(args.join(" "));
	};
	try {
		const code = fn();
		return { code, out };
	} finally {
		console.log = original;
	}
}

describe("run", () => {
	test("--help prints usage and exits 0", () => {
		const { code, out } = capture(() => run(["--help"]));
		expect(code).toBe(0);
		expect(out.join("\n")).toContain("Usage: solstone-transparency");
	});

	test("no arguments also prints usage and exits 0", () => {
		const { code, out } = capture(() => run([]));
		expect(code).toBe(0);
		expect(out.join("\n")).toContain("Usage: solstone-transparency");
	});

	test("--version prints the installed version and exits 0", () => {
		const { code, out } = capture(() => run(["--version"]));
		expect(code).toBe(0);
		expect(out[0]).toMatch(/^\d+\.\d+\.\d+/);
	});
});
