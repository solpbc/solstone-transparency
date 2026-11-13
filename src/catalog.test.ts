// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ARG_TYPES } from "../i18n/catalog-table";
import { MESSAGE_IDS, t } from "../i18n/lookup";

const root = join(import.meta.dir, "..");
const sourceFtl = readFileSync(
	join(root, "i18n/catalog/source/en-US.ftl"),
	"utf8",
);
const generatedFtl = readFileSync(
	join(root, "i18n/generated/esm/transparency/en-US.ftl"),
	"utf8",
);
const cases = JSON.parse(
	readFileSync(join(root, "i18n/generated/cases.json"), "utf8"),
) as {
	cases: {
		message_id: string;
		resource_key: string;
		logical_expected: string | null;
		inputs: Record<string, unknown>;
	}[];
};

function messageIds(ftl: string): string[] {
	const ids: string[] = [];
	for (const line of ftl.split("\n")) {
		const match = /^(trust\.[A-Za-z0-9.]+) =/.exec(line);
		if (match?.[1] !== undefined) ids.push(match[1]);
	}
	return ids;
}

function sampleArgs(
	id: (typeof MESSAGE_IDS)[number],
): Record<string, string | number> {
	const args: Record<string, string | number> = {};
	for (const [name, kind] of Object.entries(ARG_TYPES[id])) {
		args[name] = kind === "string" ? "sample" : 2;
	}
	return args;
}

describe("catalog sync", () => {
	test("source, generated cases, and the id table name the same messages", () => {
		const source = messageIds(sourceFtl);
		const fromCases = cases.cases.map((row) => row.message_id);
		expect(new Set(source).size).toBe(source.length);
		expect(source.sort()).toEqual([...MESSAGE_IDS].sort());
		expect(fromCases.sort()).toEqual([...MESSAGE_IDS].sort());
		expect(Object.keys(ARG_TYPES).sort()).toEqual([...MESSAGE_IDS].sort());
	});

	test("the generated runtime carries every message and renders it", () => {
		for (const row of cases.cases) {
			expect(generatedFtl).toContain(row.resource_key);
		}
		for (const id of MESSAGE_IDS) {
			const text = t(id, sampleArgs(id));
			expect(text.length).toBeGreaterThan(0);
			expect(text).not.toContain("\u2068");
			expect(text).not.toContain("\u2069");
		}
	});

	test("a message with no arguments matches the compiled expectation", () => {
		for (const row of cases.cases) {
			if (row.logical_expected === null) continue;
			if (Object.keys(row.inputs).length !== 0) continue;
			if (
				Object.keys(ARG_TYPES[row.message_id as (typeof MESSAGE_IDS)[number]])
					.length !== 0
			) {
				continue;
			}
			expect(t(row.message_id as (typeof MESSAGE_IDS)[number])).toBe(
				row.logical_expected,
			);
		}
	});

	test("the legal line is the published sentence and no translation is shipped", () => {
		const legal = "solstone is a trademark of sol pbc.";
		const sourceLine = sourceFtl
			.split("\n")
			.find((line) =>
				line.startsWith("trust.copy.solstoneisatrademarkofsolpbc ="),
			);
		const generatedLine = generatedFtl
			.split("\n")
			.find((line) => line.endsWith(`= ${legal}`));
		expect(sourceLine).toBe(
			`trust.copy.solstoneisatrademarkofsolpbc = ${legal}`,
		);
		expect(generatedLine?.endsWith(`= ${legal}`)).toBe(true);
		expect(t("trust.copy.solstoneisatrademarkofsolpbc")).toBe(legal);
		expect(existsSync(join(root, "i18n/catalog/translations"))).toBe(false);
	});
});
