// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { VERSION } from "./index";
import { buildPortalModel } from "./legacy/adapter";
import { buildSitemap } from "./portal/sitemap";
import { verifyRepository } from "./v2/verify-cli";

const HELP = `solstone-transparency ${VERSION}

Usage: solstone-transparency [--version] [--help]
       solstone-transparency legacy-model --out <path>
       solstone-transparency sitemap --out <path>
       solstone-transparency verify-v2 [--metadata-base URL] [--targets-base URL]
                                       [--store PATH] [--json]

This build implements the read-side v1 legacy verifier/adapter, its typed
portal model (src/legacy/), a read-only HTML presentation layer
(src/portal/), and the Cloudflare Worker (worker.ts) that serves
trust.solstone.app from a build-time snapshot of that model.

Options:
  --version           Print the installed version and exit
  --help              Show this help text and exit
  legacy-model --out  Fetch and verify the live v1 register from
                      transparency.solstone.app and write the resulting
                      typed portal model as JSON to the given path.
                      Read-only: makes no write to the evidence host.
  sitemap --out       Fetch and verify the live v1 register (same as
                      legacy-model) and write sitemap.xml listing every
                      HTML route the portal actually serves with a 200
                      response.
  verify-v2           Bootstrap from a pinned v2 root and verify a TUF
                      repository end to end: root, timestamp, snapshot,
                      targets, every delegated role, and each target's
                      recorded digest. Prints the accepted repository
                      fingerprint, per-role state, and any renewal
                      advisories. Read-only; holds no credential and never
                      writes to the evidence host.
                      --metadata-base / --targets-base default to the v2
                      staging prefix. --json emits a machine-readable result.
                      Exit 0 accepted, 1 rejected, 2 could not run.

The v2 rail is under construction and represents no released product or
operated service. Every key on it is synthetic.
`;

/** Runs the CLI against argv (excluding the node/bun/script entries) and returns the process exit code. */
export async function run(argv: string[]): Promise<number> {
	if (argv[0] === "--version") {
		console.log(VERSION);
		return 0;
	}
	if (argv[0] === "verify-v2") {
		const flag = (name: string): string | undefined => {
			const index = argv.indexOf(name);
			return index >= 0 ? argv[index + 1] : undefined;
		};
		const base = "https://transparency.solstone.app/staging/v2";
		return verifyRepository({
			metadataBase: flag("--metadata-base") ?? `${base}/metadata`,
			targetsBase: flag("--targets-base") ?? `${base}/targets`,
			rootPath: flag("--root"),
			storePath: flag("--store") ?? ".solstone-transparency-trust.json",
			json: argv.includes("--json"),
		});
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
	if (argv[0] === "sitemap") {
		const outIdx = argv.indexOf("--out");
		const outPath = outIdx >= 0 ? argv[outIdx + 1] : undefined;
		if (!outPath) {
			console.error("sitemap requires --out <path>");
			return 1;
		}
		const result = await buildPortalModel();
		if (!result.ok) {
			console.error(
				`model degraded (http ${result.degraded.httpStatus}): ${result.degraded.reason}`,
			);
			return 1;
		}
		await Bun.write(outPath, buildSitemap(result));
		console.log(`wrote sitemap to ${outPath}`);
		return 0;
	}
	console.log(HELP);
	return 0;
}
