#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile, writeFile } from "node:fs/promises";
import { readCeremonyKey } from "../src/v2/ceremony-key";
import {
	loadPassphraseProvider,
	passphraseProviderOption,
} from "../src/v2/passphrase-provider";
import {
	mergeRootRenewal,
	prepareRootRenewal,
	signRootRenewal,
} from "../src/v2/root-renewal";

const args = process.argv.slice(2);
if (args[0] === "--help" && args.length === 1) {
	console.log(
		"Usage: bun bin/root-renew.ts prepare PREVIOUS_ROOT PAYLOAD_OUT\n       bun bin/root-renew.ts sign PREVIOUS_ROOT PAYLOAD ENCRYPTED_KEY SIGNATURE_OUT [--passphrase-provider MODULE]\n       bun bin/root-renew.ts merge PREVIOUS_ROOT PAYLOAD ROOT_OUT SIGNATURE...\nUse a previously trusted local root file. Each sign invocation decrypts one encrypted PKCS#8 key. Passphrases default to terminal input without echo.\nMODULE selects trusted local code whose default function accepts a key path and returns Promise<Buffer>. The reader clears that Buffer after use. Never put a passphrase in arguments or environment variables.\nTransfer the public payload and detached signatures between signing hosts. Merge requires two distinct root signers.\nOutput files must not exist; renewal preserves the root key set and roles.",
	);
} else {
	try {
		const selected = passphraseProviderOption(args);
		const [verb, previousPath, payloadPath, ...rest] = selected.args;
		if (!previousPath || !payloadPath) throw new Error("root-renew-usage");
		if (selected.modulePath !== undefined && verb !== "sign")
			throw new Error(
				"passphrase-provider-usage: only sign accepts a provider",
			);
		const previous = new Uint8Array(await readFile(previousPath));
		let out: string;
		let bytes: Uint8Array | string;
		if (verb === "prepare" && rest.length === 0) {
			out = payloadPath;
			bytes = await prepareRootRenewal(previous, new Date());
		} else if (verb === "sign" && rest.length === 2 && rest[0] && rest[1]) {
			out = rest[1];
			const payload = new Uint8Array(await readFile(payloadPath));
			const source = await loadPassphraseProvider(selected.modulePath);
			const key = await readCeremonyKey(rest[0], source);
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
