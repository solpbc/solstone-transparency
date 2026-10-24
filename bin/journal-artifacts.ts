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
			changes: { type: "string" },
			"previous-record": { type: "string" },
			"initialize-target": { type: "string", multiple: true },
			out: { type: "string" },
			help: { type: "boolean" },
		},
		strict: true,
		allowPositionals: false,
	});
	if (values.help) {
		console.log(`Usage: bun bin/journal-artifacts.ts --manifest FILE [--manifest FILE ...] --version VERSION --lane release|staging|dev --claims FILE [--components FILE ...] [--changes FILE] [--previous-record FILE] [--initialize-target TARGET ...] [--out FILE]

Prepare release-record input from local journal distribution manifests and their adjacent files.
Pass the output file directly as --release-record to release prepare.
Repeat --manifest for every target in the release. Only explicitly supplied targets are included.
Lengths and SHA256 values are measured from the artifact bytes. The manifest, release declaration,
and checksum sidecar must agree. A Windows x86_64 or ARM64 manifest has no release declaration: it lists the
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
--changes FILE is a JSON array of {target, id, from, to} objects. from and to
are each null or {version, delivery, source, inputs, members}. null means that
release lists no such component; it is not the string absent. Equal snapshots,
or both null, are invalid. One entry is the whole change for that key.
When components are listed, omitted --changes or [] is accepted only when nothing
changed, and the output still has component_changes: []. This command does not
fill in a diff the operator omitted.
--previous-record FILE is the baseline release's record predicate, or an earlier
output of this command (its releasePredicate member is used). It is required when
components are listed, and must be for the same product and a different version.
Both component_targets lists must be non-empty, and every target in this release's
list must be in the baseline's. A baseline target this release omits is not compared.
A target the baseline does not cover is refused unless --initialize-target names it, and is
never read as absence, so a release covering a target again after one that omitted it names a
baseline that covers all of its targets. This command checks that supplied local predicate. It
does not authenticate it. Authentication of the public baseline belongs to independent
verification.
--initialize-target TARGET states that target's component inventory without comparing it to the
baseline. Only windows-aarch64 may be initialized, and only against a baseline that does not cover
it; this command does not check that it is the target's first public release. The target must
have a components list here. At least one other target is still compared, and --changes must not
name the initialized target. The output lists it in component_initialized_targets and makes no
statement about earlier inventory for it. A later release compares it as usual.
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
			changes: await readJsonInput(
				values.changes,
				"invalid-changes",
				"--changes",
			),
			previousRecord: await readJsonInput(
				values["previous-record"],
				"invalid-previous-record",
				"--previous-record",
			),
			...(values["initialize-target"] === undefined
				? {}
				: { initializeTargets: values["initialize-target"] }),
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
