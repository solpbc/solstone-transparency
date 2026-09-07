#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { runTimestampRail } from "../src/v2/timestamp-rail";

export async function timestampRailMain(args: string[]): Promise<number> {
	try {
		const { values } = parseArgs({
			args,
			strict: true,
			allowPositionals: false,
			options: {
				config: { type: "string" },
				json: { type: "boolean" },
				help: { type: "boolean" },
			},
		});
		if (values.help) {
			console.log(
				"timestamp-rail --config FILE [--json]\nauthenticate the live repository, renew its timestamp and publish only that file.\nconfiguration supplies local paths, repository base, prefix, bucket and optional alert argv.\n{message} in an alert argument receives the failure or advisory summary; no shell is used.\nfailed runs retain their scratch directory and receipts. output is always JSON.\nexit 0: refreshed; 1: failed; 2: invalid arguments; 3: refreshed with an advisory.",
			);
			return 0;
		}
		if (!values.config) throw new Error("config required");
		const result = await runTimestampRail(
			JSON.parse(await readFile(values.config, "utf8")),
		);
		console.log(JSON.stringify(result));
		return result.ok ? (result.advisories.length > 0 ? 3 : 0) : 1;
	} catch {
		console.log(JSON.stringify({ ok: false, reason: "invalid-arguments" }));
		return 2;
	}
}
if (import.meta.main)
	process.exitCode = await timestampRailMain(process.argv.slice(2));
