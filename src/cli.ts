// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { VERSION } from "./index";
import { buildPortalModel } from "./legacy/adapter";
import { buildSitemap } from "./portal/sitemap";
import { publishRepository } from "./v2/publish-cli";
import { verifyRepository } from "./v2/verify-cli";

const HELP = `solstone-transparency ${VERSION}

Usage: solstone-transparency [--version] [--help]
       solstone-transparency legacy-model --out <path>
       solstone-transparency sitemap --out <path>
       solstone-transparency verify-v2 [--metadata-base URL] [--targets-base URL]
                                       [--store PATH] [--json]
       solstone-transparency publish-v2 --artifacts <path> --product <name>
                                        --keys <path> --policy-sha256 <hex>
                                        --out <dir> [--now <iso-8601>]

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
  publish-v2          Build and publish a v2 TUF repository containing
                      the v1-to-v2 legacy migration manifest and a signed
                      release record for the specified release artifacts.
                      Writes <dir>/metadata/ with signed TUF metadata
                      (root, targets, snapshot, timestamp, and delegated
                      roles) and <dir>/targets/ with signed EvidenceRecord
                      payloads.
                      --product <name> selects which product's committed v1
                      inventory becomes the migration-manifest half; it must
                      be one of journal, linux, windows.
                      Input shapes:
                        --artifacts <path>: JSON object with fields:
                          - product (free-form string naming the release;
                            not limited to journal/linux/windows -- this is
                            independent of the --product flag above)
                          - version (string, e.g. 1.0.23)
                          - artifacts: array of { url, length, sha256 }
                          - does_prove: non-empty array of strings
                          - does_not_prove: non-empty array of strings
                          - _comment: array of explanatory strings
                        --keys <path>: JSON object with 11 signing keys:
                          - root: array of 3 key entries
                          - targets, snapshot, timestamp: array of 1 key each
                          - delegated: object with 1 key entry for each of
                            targets-software, targets-services,
                            targets-verification, targets-legacy
                          - dsseSigner: 1 key entry
                          Key entries are { keyid, public, pkcs8 } (hex keyid,
                          hex public key, base64-encoded PKCS8 private key).
                        --policy-sha256 <hex>: 64-character lowercase hex
                          digest (placeholder pending real policy publication).
                      Missing or malformed inputs or an unknown product name
                      fail closed writing nothing.

The v2 rail is under construction and represents no released product or
operated service. Every key on it is synthetic.
`;

/** Runs the CLI against argv (excluding the node/bun/script entries) and returns the process exit code. */
export async function run(argv: string[]): Promise<number> {
	if (argv[0] === "--version") {
		console.log(VERSION);
		return 0;
	}
	if (argv[0] === "publish-v2") {
		const flag = (name: string): string | undefined => {
			const index = argv.indexOf(name);
			return index >= 0 ? argv[index + 1] : undefined;
		};
		const artifactsPath = flag("--artifacts");
		if (!artifactsPath) {
			console.error("publish-v2 requires --artifacts <path>");
			return 1;
		}
		const product = flag("--product");
		if (!product) {
			console.error("publish-v2 requires --product <name>");
			return 1;
		}
		const keysPath = flag("--keys");
		if (!keysPath) {
			console.error("publish-v2 requires --keys <path>");
			return 1;
		}
		const policySha256 = flag("--policy-sha256");
		if (!policySha256) {
			console.error("publish-v2 requires --policy-sha256 <hex>");
			return 1;
		}
		const outDir = flag("--out");
		if (!outDir) {
			console.error("publish-v2 requires --out <dir>");
			return 1;
		}
		const nowStr = flag("--now");
		const now = nowStr ? new Date(nowStr) : undefined;
		return publishRepository({
			artifactsPath,
			product,
			keysPath,
			policySha256,
			outDir,
			now,
		});
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
