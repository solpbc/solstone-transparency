// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Test-only helpers: generate a throwaway minisign keypair and sign
 * synthetic fixture bytes with it. Nothing here is ever a real signing key
 * or real evidence — every keypair is freshly generated per call and never
 * persisted outside a short-lived temp directory. Used only from `*.test.ts`
 * files.
 */

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ThrowawayKeypair {
	pubKeyText: string;
	sign(dataBytes: Uint8Array, trustedComment: string): Promise<string>;
}

/** Generates a fresh, unencrypted, throwaway minisign keypair for this test only. */
export async function generateThrowawayKeypair(): Promise<ThrowawayKeypair> {
	const dir = await mkdtemp(join(tmpdir(), "solstone-transparency-testkey-"));
	const secPath = join(dir, "test.key");
	const pubPath = join(dir, "test.pub");
	const gen = Bun.spawn(
		["minisign", "-G", "-f", "-W", "-s", secPath, "-p", pubPath],
		{ stdout: "pipe", stderr: "pipe" },
	);
	await gen.exited;
	if (gen.exitCode !== 0) {
		throw new Error(
			`minisign -G failed: ${await new Response(gen.stderr).text()}`,
		);
	}
	const pubKeyText = await readFile(pubPath, "utf8");

	return {
		pubKeyText,
		async sign(dataBytes: Uint8Array, trustedComment: string): Promise<string> {
			const dataPath = join(dir, `data-${crypto.randomUUID()}`);
			const sigPath = `${dataPath}.minisig`;
			await writeFile(dataPath, dataBytes);
			const proc = Bun.spawn(
				[
					"minisign",
					"-S",
					"-s",
					secPath,
					"-x",
					sigPath,
					"-t",
					trustedComment,
					"-m",
					dataPath,
				],
				{
					stdin: "pipe",
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			proc.stdin.end();
			await proc.exited;
			if (proc.exitCode !== 0) {
				throw new Error(
					`minisign -S failed: ${await new Response(proc.stderr).text()}`,
				);
			}
			return readFile(sigPath, "utf8");
		},
	};
}
