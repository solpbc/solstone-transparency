// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { VERSION } from "./index";
import { buildPortalModel } from "./legacy/adapter";

const HELP = `solstone-transparency ${VERSION}

Usage: solstone-transparency [--version] [--help]
       solstone-transparency legacy-model --out <path>

This build implements the read-side v1 legacy verifier/adapter, its typed
portal model (src/legacy/), and a read-only HTML presentation layer
(src/portal/). It does not serve trust.solstone.app. It makes no public
claim beyond: these are historical records of what sol pbc published.

Options:
  --version           Print the installed version and exit
  --help              Show this help text and exit
  legacy-model --out  Fetch and verify the live v1 register from
                      transparency.solstone.app and write the resulting
                      typed portal model as JSON to the given path.
                      Read-only: makes no write to the evidence host.
`;

/** Runs the CLI against argv (excluding the node/bun/script entries) and returns the process exit code. */
export async function run(argv: string[]): Promise<number> {
	if (argv[0] === "--version") {
		console.log(VERSION);
		return 0;
	}
	if (argv[0] === "legacy-model") {
		const outIdx = argv.indexOf("--out");
		const outPath = outIdx >= 0 ? argv[outIdx + 1] : undefined;
		if (!outPath) {
			console.error("legacy-model requires --out <path>");
			return 1;
		}
		const result = await buildPortalModel();
		if (!result.ok) {
			console.error(
				`model degraded (http ${result.degraded.httpStatus}): ${result.degraded.reason}`,
			);
			return 1;
		}
		// Write the complete PortalModelResult (the `{ ok: true, model }` shape),
		// not just the bare model -- this is what `handle()`/`renderAll()` in
		// `src/portal` consume directly, with no re-wrapping required by whoever
		// builds and deploys the portal from this output.
		await Bun.write(outPath, `${JSON.stringify(result, null, 2)}\n`);
		console.log(`wrote portal model to ${outPath}`);
		return 0;
	}
	console.log(HELP);
	return 0;
}
