#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
	JournalAdapterError,
	type JournalClaims,
	type JournalLane,
	prepareJournalReleaseRecord,
} from "../src/v2/journal-adapter";

async function readJsonInput(
	path: string | undefined,
	reason: string,
	flag: string,
): Promise<unknown> {
	if (path === undefined) return undefined;
	let text: string;
	try {
		text = await readFile(path, "utf8");
	} catch {
		throw new JournalAdapterError(reason, `Could not read the ${flag} file.`);
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new JournalAdapterError(reason, `The ${flag} file is not JSON.`);
	}
}

try {
	const { values } = parseArgs({
		options: {
			manifest: { type: "string", multiple: true },
			version: { type: "string" },
			lane: { type: "string" },
			claims: { type: "string" },
			components: { type: "string", multiple: true },
			transitions: { type: "string" },
			"previous-record": { type: "string" },
			out: { type: "string" },
			help: { type: "boolean" },
		},
		strict: true,
		allowPositionals: false,
	});
	if (values.help) {
		console.log(`Usage: bun bin/journal-artifacts.ts --manifest FILE [--manifest FILE ...] --version VERSION --lane release|staging|dev --claims FILE [--components FILE ...] [--transitions FILE] [--previous-record FILE] [--out FILE]

Prepare release-record input from local journal distribution manifests and their adjacent files.
Pass the output file directly as --release-record to release prepare.
Repeat --manifest for every target in the release. Only explicitly supplied targets are included.
Lengths and SHA256 values are measured from the artifact bytes. The manifest, release declaration,
and checksum sidecar must agree. A windows-x86_64 manifest has no release declaration: it lists the
Setup, the full package and the checksum file naming those two, all under the Windows origin
prefix, and is accepted only for the release lane.
Claims JSON supplies _comment, does_prove, and does_not_prove.
A target's third-party components are listed either in its manifest, under a components key, or
in a components file given with --components. Each component is delivered either inside the release
package (bundled, with the installed paths and SHA256 of its files) or fetched after installation
(runtime-downloaded).
--components FILE is a JSON object with exactly product (solstone-journal), version (the requested
version), target and components (a list following the same rules as a manifest's). Repeat it for
each target that has one. Its target must have a supplied manifest, and no target may have
components from both its manifest and a file, or from two files. The file is an input to this
command only; it is not a release artifact and is not included in the output's artifacts.
When any target has a components list, even an empty one, the output carries component_targets
(the targets that have one), their rows as one components list sorted by target and id, and
component_baseline (the previous record's version). A target with no components list is left out
of component_targets.
Component rows are checked for shape and order and copied from their manifest or file; this command
does not open the packages to compare the listed files with their contents.
--transitions FILE is a JSON array of {target, id, from, to} objects declaring each component whose
delivery changed since the previous release; from and to are bundled, runtime-downloaded or absent.
It is accepted only when components are listed; each target must be in
component_targets, and each to state must match the listed component (absent means not listed).
--previous-record FILE is the previous release's record predicate, or an earlier output of this
command (its releasePredicate member is used). It is required when components are listed, and
must be for the same product and a different version. When that record lists
components, the declared transitions must equal exactly the delivery changes between the two
records over the targets in both records' component_targets; with no --transitions, there must be
none. When it lists no components, as for the first release to list them, no comparison is made.
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
		const result = await prepareJournalReleaseRecord({
			manifestPaths: values.manifest,
			version: values.version,
			lane: values.lane as JournalLane,
			claims: JSON.parse(
				await readFile(values.claims, "utf8"),
			) as JournalClaims,
			componentsPaths: values.components ?? [],
			transitions: await readJsonInput(
				values.transitions,
				"invalid-transitions",
				"--transitions",
			),
			previousRecord: await readJsonInput(
				values["previous-record"],
				"invalid-previous-record",
				"--previous-record",
			),
		});
		const output = `${JSON.stringify(
			{
				product: result.product,
				version: result.version,
				releasePredicate: result,
				artifactDescriptors: result.artifacts,
			},
			null,
			2,
		)}\n`;
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
