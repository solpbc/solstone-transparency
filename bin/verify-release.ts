#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { mkdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import {
	type ReleaseVerifierOptions,
	verifyRelease,
} from "../src/v2/release-verifier";
import { DEFAULT_MAX_METADATA_BYTES } from "../src/v2/tuf/admission";
import { openFileTrustStore } from "../src/v2/tuf/trust-store";

export async function verifierInputs(values: {
	root?: string;
	store?: string;
	"metadata-base"?: string;
	"targets-base"?: string;
}): Promise<ReleaseVerifierOptions> {
	if (!values.root) throw new Error("root-file-required");
	const info = await stat(values.root);
	if (!info.isFile() || info.size > DEFAULT_MAX_METADATA_BYTES)
		throw new Error("root-file-invalid");
	const bootstrapRoot = new Uint8Array(await readFile(values.root));
	if (bootstrapRoot.length > DEFAULT_MAX_METADATA_BYTES)
		throw new Error("root-file-invalid");
	const store =
		values.store ??
		join(homedir(), ".cache", "solstone-transparency", "trust.json");
	await mkdir(dirname(store), { recursive: true });
	return {
		bootstrapRoot,
		trustStore: openFileTrustStore(store),
		now: new Date(),
		metadataBase:
			values["metadata-base"] ??
			"https://transparency.solstone.app/v2/metadata/",
		targetsBase:
			values["targets-base"] ?? "https://transparency.solstone.app/v2/targets/",
	};
}

export async function runVerifyRelease(args: string[]): Promise<number> {
	try {
		const { values } = parseArgs({
			args,
			options: {
				root: { type: "string" },
				"metadata-base": { type: "string" },
				"targets-base": { type: "string" },
				store: { type: "string" },
				product: { type: "string" },
				version: { type: "string" },
				json: { type: "boolean" },
				help: { type: "boolean" },
			},
			strict: true,
			allowPositionals: false,
		});
		if (values.help) {
			console.log(`Usage: verify-release --root FILE --product PRODUCT --version VERSION [--metadata-base URL] [--targets-base URL] [--store FILE] [--json]

Check a release record through its pinned TUF root, authorization policy, DSSE signature,
subject binding and artifact bytes fetched from their recorded HTTPS URLs.
Supply a root file obtained independently. The local trust store retains accepted versions.
Exit 0 means these checks accepted; it does not establish that the software is safe.
Exit 1 means verification failed; exit 2 means the command could not read its inputs.`);
			return 0;
		}
		if (!values.product || !values.version)
			throw new Error("release-coordinate-required");
		const input = await verifierInputs(values);
		const result = await verifyRelease({
			...input,
			product: values.product,
			version: values.version,
		});
		console.log(
			values.json
				? JSON.stringify(result, null, 2)
				: result.ok
					? `accepted release record: ${result.product} ${result.version}`
					: `rejected: ${result.link}/${result.reason}`,
		);
		return result.ok ? 0 : 1;
	} catch {
		console.error(
			JSON.stringify({
				ok: false,
				reason: "input-unavailable",
				message:
					"Supply a readable local --root file and --product/--version. Use --help for options.",
			}),
		);
		return 2;
	}
}

if (import.meta.main)
	process.exitCode = await runVerifyRelease(process.argv.slice(2));
