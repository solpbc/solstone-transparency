#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
	JournalAdapterError,
	type JournalClaims,
	type JournalLane,
	adaptJournalReleaseSet,
} from "../src/v2/journal-adapter";

try {
	const { values } = parseArgs({
		options: {
			manifest: { type: "string", multiple: true },
			version: { type: "string" },
			lane: { type: "string" },
			claims: { type: "string" },
			out: { type: "string" },
			help: { type: "boolean" },
		},
		strict: true,
		allowPositionals: false,
	});
	if (values.help) {
		console.log(`Usage: bun bin/journal-artifacts.ts --manifest FILE [--manifest FILE ...] --version VERSION --lane release|staging|dev --claims FILE [--out FILE]

Prepare release-record input from local journal distribution manifests and their adjacent files.
Repeat --manifest for every target in the release. Only explicitly supplied targets are included.
Lengths and SHA256 values are measured from the artifact bytes. The manifest, release declaration,
and checksum sidecar must agree. Claims JSON supplies _comment, does_prove, and does_not_prove.
Output covers manifest members and the manifest itself; minisign signatures are not included or verified.
This command checks local consistency; it does not authenticate the producer or verify remote delivery.
JSON goes to stdout unless --out selects a new file. Existing output files are refused.`);
	} else {
		if (!values.manifest || !values.version || !values.lane || !values.claims) {
			throw new JournalAdapterError(
				"missing-input",
				"Supply --manifest, --version, --lane, and --claims. Use --help for the input contract.",
			);
		}
		const result = await adaptJournalReleaseSet({
			manifestPaths: values.manifest,
			version: values.version,
			lane: values.lane as JournalLane,
			claims: JSON.parse(
				await readFile(values.claims, "utf8"),
			) as JournalClaims,
		});
		const output = `${JSON.stringify(result, null, 2)}\n`;
		if (values.out) await writeFile(values.out, output, { flag: "wx" });
		else process.stdout.write(output);
	}
} catch (error) {
	console.error(
		JSON.stringify({
			ok: false,
			reason:
				error instanceof JournalAdapterError
					? error.reason
					: "input-output-failed",
			message:
				error instanceof JournalAdapterError
					? error.message
					: "Check the input files and arguments, and choose a new output file. Use --help for usage.",
		}),
	);
	process.exitCode = 1;
}
