#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile } from "node:fs/promises";
import { runCeremony } from "../src/v2/ceremony-driver";

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
	console.log(
		"Usage: bun bin/tuf-ceremony.ts genesis CONFIG.json OUTPUT_DIRECTORY\nCONFIG names encrypted PKCS#8 key files by role and public target files by logical path.\nPassphrases are read only from an interactive terminal without echo.\nThe output directory must not exist. A fresh trust store verifies the result.",
	);
} else {
	try {
		if (args.length !== 3 || args[0] !== "genesis" || !args[1] || !args[2])
			throw new Error(
				"usage: tuf-ceremony.ts genesis CONFIG.json OUTPUT_DIRECTORY",
			);
		const config = JSON.parse(await readFile(args[1], "utf8"));
		console.log(JSON.stringify(await runCeremony(config, args[2])));
	} catch (error) {
		console.error(
			JSON.stringify({
				ok: false,
				reason: error instanceof Error ? error.message : "ceremony-failed",
			}),
		);
		process.exitCode = 1;
	}
}
