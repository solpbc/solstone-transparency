// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Thin wrapper around the system `minisign` binary. This project does not
 * reimplement Ed25519 verification; it shells out to the same tool the v1
 * publisher contract already assumes, and reads its exit code and
 * trusted-comment output. Read-side verification only — this module never
 * signs.
 */

export interface MinisignResult {
	verified: boolean;
	trustedComment?: string;
	stderr?: string;
	/** True only when the `minisign` binary itself could not be run (e.g. not installed) — distinct from the binary running and reporting a failed verification. Callers must render this as "could not be checked", never as "invalid". */
	toolUnavailable?: boolean;
}

/** Spawns `cmd` with piped stdout/stderr, or reports why the process itself could not start (e.g. the binary is not on `PATH`) — distinct from the process starting and exiting non-zero. */
function trySpawnPiped(cmd: string[]) {
	try {
		return { proc: Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" }) };
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
}

/** Verifies `dataBytes` against `sigText` using the public key in `pubKeyText`. All inputs are in-memory; this writes short-lived temp files because minisign operates on the filesystem, not stdin. */
export async function verifyMinisig(
	pubKeyText: string,
	sigText: string,
	dataBytes: Uint8Array,
): Promise<MinisignResult> {
	const dir = await mkdtemp(join(tmpdir(), "solstone-transparency-minisign-"));
	const pubPath = join(dir, "key.pub");
	const sigPath = join(dir, "data.minisig");
	const dataPath = join(dir, "data");
	try {
		await writeFile(pubPath, pubKeyText);
		await writeFile(sigPath, sigText);
		await writeFile(dataPath, dataBytes);
		const spawned = trySpawnPiped([
			"minisign",
			"-V",
			"-x",
			sigPath,
			"-p",
			pubPath,
			"-m",
			dataPath,
		]);
		if ("error" in spawned) {
			return { verified: false, toolUnavailable: true, stderr: spawned.error };
		}
		const { proc } = spawned;
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		if (exitCode !== 0) {
			return { verified: false, stderr: stderr || stdout };
		}
		const commentLine = stdout
			.split("\n")
			.find((line) => line.startsWith("Trusted comment: "));
		return {
			verified: true,
			trustedComment: commentLine?.slice("Trusted comment: ".length),
		};
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}
