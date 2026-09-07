#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile } from "node:fs/promises";
import { generateDiscovery } from "../src/v2/discovery";

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help")
	console.log(
		"Usage: bun bin/discovery.ts ROOT_FILE [HTTPS_V2_BASE]\nWrites a discovery document to stdout. The default base is https://transparency.solstone.app/v2/.\nRoot version, digest and consistent-snapshot setting come from the supplied signed envelope.",
	);
else {
	try {
		if (!args[0] || args.length > 2) throw new Error("discovery-usage");
		console.log(
			JSON.stringify(
				await generateDiscovery(
					new Uint8Array(await readFile(args[0])),
					args[1],
				),
				null,
				2,
			),
		);
	} catch (error) {
		console.error(
			JSON.stringify({
				ok: false,
				reason: error instanceof Error ? error.message : "discovery-failed",
			}),
		);
		process.exitCode = 1;
	}
}
