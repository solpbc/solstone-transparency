#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile, writeFile } from "node:fs/promises";
import { readCeremonyKey } from "../src/v2/ceremony-key";
import {
	mergeRootRenewal,
	prepareRootRenewal,
	signRootRenewal,
} from "../src/v2/root-renewal";

const args = process.argv.slice(2);
if (args[0] === "--help" && args.length === 1) {
	console.log(
		"Usage: bun bin/root-renew.ts prepare PREVIOUS_ROOT PAYLOAD_OUT\n       bun bin/root-renew.ts sign PREVIOUS_ROOT PAYLOAD ENCRYPTED_KEY SIGNATURE_OUT\n       bun bin/root-renew.ts merge PREVIOUS_ROOT PAYLOAD ROOT_OUT SIGNATURE...\nUse a previously trusted local root file. Each sign invocation decrypts one encrypted PKCS#8 key at a terminal.\nTransfer the public payload and detached signatures between signing hosts. Merge requires two distinct root signers.\nOutput files must not exist; renewal preserves the root key set and roles.",
	);
} else {
	try {
		const [verb, previousPath, payloadPath, ...rest] = args;
		if (!previousPath || !payloadPath) throw new Error("root-renew-usage");
		const previous = new Uint8Array(await readFile(previousPath));
		let out: string;
		let bytes: Uint8Array | string;
		if (verb === "prepare" && rest.length === 0) {
			out = payloadPath;
			bytes = await prepareRootRenewal(previous, new Date());
		} else if (verb === "sign" && rest.length === 2 && rest[0] && rest[1]) {
			out = rest[1];
			const payload = new Uint8Array(await readFile(payloadPath));
			const key = await readCeremonyKey(rest[0]);
			process.stderr.write(`root keyid ${key.keyId}\n`);
			bytes = `${JSON.stringify(await signRootRenewal(previous, payload, key))}\n`;
		} else if (verb === "merge" && rest.length >= 2 && rest[0]) {
			out = rest[0];
			const payload = new Uint8Array(await readFile(payloadPath));
			const signatures = await Promise.all(
				rest
					.slice(1)
					.map(async (path) => JSON.parse(await readFile(path, "utf8"))),
			);
			bytes = await mergeRootRenewal(previous, payload, signatures, new Date());
		} else throw new Error("root-renew-usage");
		await writeFile(out, bytes, { flag: "wx" });
		console.log(JSON.stringify({ ok: true, path: out }));
	} catch (error) {
		console.error(
			JSON.stringify({
				ok: false,
				reason: error instanceof Error ? error.message : "root-renew-failed",
			}),
		);
		process.exitCode = 1;
	}
}
