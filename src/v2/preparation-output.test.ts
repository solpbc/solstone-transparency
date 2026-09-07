// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { writePreparationOutput } from "./preparation-output";

async function directory(): Promise<string> {
	return mkdtemp("/var/tmp/solstone-preparation-output-");
}

test("writes a canonical manifest after every preparation file", async () => {
	const parent = await directory();
	const outputDirectory = join(parent, "out");
	try {
		const written = await writePreparationOutput({
			outputDirectory,
			files: [
				{
					relativePath: "metadata/2.snapshot.json",
					bytes: new TextEncoder().encode("snapshot"),
				},
				{
					relativePath: `targets/${"a".repeat(64)}.policy.json`,
					bytes: new TextEncoder().encode("policy"),
				},
			],
			operation: "test",
			expectedPriorTimestampSha256: "b".repeat(64),
			newTimestampSha256: "c".repeat(64),
		});
		expect(written.ok).toBe(true);
		if (!written.ok) return;
		const manifest = JSON.parse(
			await readFile(join(outputDirectory, "manifest.json"), "utf-8"),
		);
		expect(manifest).toEqual(written.value);
		expect(manifest.files).toHaveLength(2);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("refuses an existing output directory without merging files", async () => {
	const parent = await directory();
	try {
		const written = await writePreparationOutput({
			outputDirectory: parent,
			files: [],
			operation: "test",
			expectedPriorTimestampSha256: "b".repeat(64),
			newTimestampSha256: null,
		});
		expect(written).toMatchObject({ ok: false, reason: "malformed" });
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("leaves no manifest when a later output path cannot be created", async () => {
	const parent = await directory();
	const outputDirectory = join(parent, "out");
	try {
		const written = await writePreparationOutput({
			outputDirectory,
			files: [
				{
					relativePath: "targets/blocker",
					bytes: new TextEncoder().encode("first"),
				},
				{
					relativePath: "targets/blocker/child.json",
					bytes: new TextEncoder().encode("second"),
				},
			],
			operation: "test",
			expectedPriorTimestampSha256: "b".repeat(64),
			newTimestampSha256: null,
		});
		expect(written).toMatchObject({ ok: false, reason: "malformed" });
		await expect(
			stat(join(outputDirectory, "targets", "blocker")),
		).resolves.toBeDefined();
		await expect(
			stat(join(outputDirectory, "manifest.json")),
		).rejects.toBeDefined();
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});
