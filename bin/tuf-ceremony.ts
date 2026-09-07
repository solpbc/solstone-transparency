#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile } from "node:fs/promises";
import { runCeremony } from "../src/v2/ceremony-driver";
import {
	loadPassphraseProvider,
	passphraseProviderOption,
} from "../src/v2/passphrase-provider";

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
	console.log(
		"Usage: bun bin/tuf-ceremony.ts genesis CONFIG.json OUTPUT_DIRECTORY [--passphrase-provider MODULE]\nCONFIG names encrypted PKCS#8 key files by role and public target files by logical path.\nPassphrases default to terminal input without echo. MODULE selects trusted local code whose default function accepts a key path and returns Promise<Buffer>. The reader clears that Buffer after use.\nThe module path selects code; never put a passphrase in arguments or environment variables.\nThe output directory must not exist. A fresh trust store verifies the result.",
	);
} else {
	try {
		const selected = passphraseProviderOption(args);
		const positional = selected.args;
		if (
			positional.length !== 3 ||
			positional[0] !== "genesis" ||
			!positional[1] ||
			!positional[2]
		)
			throw new Error(
				"usage: tuf-ceremony.ts genesis CONFIG.json OUTPUT_DIRECTORY [--passphrase-provider MODULE]",
			);
		const config = JSON.parse(await readFile(positional[1], "utf8"));
		const source = await loadPassphraseProvider(selected.modulePath);
		console.log(
			JSON.stringify(
				await runCeremony(config, positional[2], new Date(), source),
			),
		);
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
