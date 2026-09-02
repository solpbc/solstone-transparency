// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const RECORDS_DIRECTORY = import.meta.dir;

async function recordSources(): Promise<readonly [string, string][]> {
	const names = (await readdir(RECORDS_DIRECTORY))
		.filter((name) => name.endsWith(".ts"))
		.sort();
	return Promise.all(
		names.map(
			async (name) =>
				[name, await readFile(join(RECORDS_DIRECTORY, name), "utf8")] as const,
		),
	);
}

async function changedPaths(paths: readonly string[]): Promise<string> {
	const process = Bun.spawn(
		["git", "diff", "--name-only", "beea289", "--", ...paths],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [exitCode, output] = await Promise.all([
		process.exited,
		new Response(process.stdout).text(),
	]);
	expect(exitCode).toBe(0);
	return output.trim();
}

test("AC 23 and 25: records sources carry SPDX headers and no literal private key material", async () => {
	const sources = await recordSources();
	const privateKeyMarker = ["-----BEGIN", " PRIVATE KEY-----"].join("");
	const minisignSecretMarker = [
		"untrusted comment:",
		" minisign secret key",
	].join("");
	expect(sources.length).toBeGreaterThan(0);
	for (const [name, source] of sources) {
		expect(
			source.startsWith(
				"// SPDX-License-Identifier: AGPL-3.0-only\n// Copyright (c) 2026 sol pbc\n",
			),
		).toBe(true);
		expect({
			name,
			hasPrivateKeyMarker: source.includes(privateKeyMarker),
		}).toEqual({
			name,
			hasPrivateKeyMarker: false,
		});
		expect({
			name,
			hasMinisignSecret: source.includes(minisignSecretMarker),
		}).toEqual({
			name,
			hasMinisignSecret: false,
		});
	}
});

test("AC 22, 24, and 26: this lode does not mutate protected v1 surfaces or dependencies", async () => {
	expect(
		await changedPaths([
			"src/legacy",
			"src/portal",
			"worker.ts",
			"wrangler.toml",
			"public",
		]),
	).toBe("");
	expect(await changedPaths(["package.json", "bun.lock"])).toBe("");
});
