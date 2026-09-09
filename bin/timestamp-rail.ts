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
				[
					"timestamp-rail --config FILE",
					"authenticate the live repository, renew its timestamp and publish only that file.",
					"the config file is a JSON object with schema timestamp-rail-config-v1 and these fields; every path is absolute:",
					"  repositoryBase       https URL of the published repository, ending in /",
					"  prefix               object-key prefix the publication writes under: v2/, staging/v2/ or under it; repositoryBase's path must equal it",
					"  rootPath             path of the independently obtained root file",
					"  timestampKeysPath    path of the JSON mapping the timestamp role to the path of its encrypted PKCS#8 key file",
					"  credentialsPath      path of the object-store credentials file",
					"  bucket               object-store bucket name",
					"  stateDir             directory for the trust store, scratch directories and receipts",
					"  runtimePath          path of the bun executable used for the refresh subprocess",
					"  cliPath              path of bin/solstone-transparency.ts",
					"  passphraseProviderPath  optional path of a local module whose default export returns the",
					"                       timestamp key passphrase; without it the refresh subprocess prompts on a terminal,",
					"                       so an unattended run needs this field",
					"  alertArgv            optional argv run on failure or advisory; {message} in an argument receives the summary; no shell is used",
					"failed runs retain their scratch directory and receipts. output is always JSON; --json is accepted and changes nothing.",
					"exit 0: refreshed; 1: failed; 2: invalid arguments; 3: refreshed with an advisory.",
				].join("\n"),
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
