// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readCeremonyKey } from "./ceremony-key";
import {
	type RepositorySigningKeys,
	type TufTargetDescription,
	buildRepository,
} from "./tuf/builder";
import { updateTufRepository } from "./tuf/client";
import type { Ed25519SigningKey } from "./tuf/ed25519";
import { DELEGATED_ROLES } from "./tuf/role-config";
import { validateTargetPath } from "./tuf/role-graph";
import { serializeRepository } from "./tuf/serializer";
import { openFileTrustStore } from "./tuf/trust-store";

export interface CeremonyConfiguration {
	keys: {
		root: string[];
		targets: string[];
		snapshot: string[];
		timestamp: string[];
		delegated: Record<string, string[]>;
	};
	targets: Record<string, string>;
}

/** Create genesis from encrypted key paths and caller-supplied public targets. */
export async function runCeremony(
	config: CeremonyConfiguration,
	output: string,
	now = new Date(),
): Promise<{ rootSha256: string; keyids: Record<string, string[]> }> {
	const expectedRoles = DELEGATED_ROLES.map((role) => role.name).sort();
	if (
		!config ||
		Object.keys(config.keys ?? {})
			.sort()
			.join() !==
			["delegated", "root", "snapshot", "targets", "timestamp"].join() ||
		Object.keys(config.keys.delegated ?? {})
			.sort()
			.join() !== expectedRoles.join()
	)
		throw new Error("ceremony-key-roles-invalid");
	const entries: [string, string[]][] = [
		["root", config.keys.root],
		["targets", config.keys.targets],
		["snapshot", config.keys.snapshot],
		["timestamp", config.keys.timestamp],
		...Object.entries(config.keys.delegated),
	];
	for (const [role, paths] of entries)
		if (
			!Array.isArray(paths) ||
			paths.length !== (role === "root" ? 3 : 1) ||
			paths.some((path) => typeof path !== "string" || !path)
		)
			throw new Error("ceremony-key-count-invalid");
	const allPaths = entries.flatMap(([, paths]) => paths);
	if (new Set(allPaths).size !== allPaths.length)
		throw new Error("ceremony-duplicate-key-path");
	const targetBytes: Record<string, Uint8Array> = {};
	const descriptions: Record<string, TufTargetDescription> = {};
	for (const [path, file] of Object.entries(config.targets ?? {})) {
		if (!validateTargetPath(path).ok || typeof file !== "string")
			throw new Error("ceremony-target-path-invalid");
		const bytes = new Uint8Array(await readFile(file));
		targetBytes[path] = bytes;
		descriptions[path] = {
			length: bytes.length,
			hashes: { sha256: createHash("sha256").update(bytes).digest("hex") },
		};
	}
	const loaded: Record<string, Ed25519SigningKey[]> = {};
	const keyids: Record<string, string[]> = {};
	for (const [role, paths] of entries) {
		loaded[role] = [];
		keyids[role] = [];
		for (const path of paths) {
			const key = await readCeremonyKey(path);
			loaded[role]?.push(key);
			keyids[role]?.push(key.keyId);
			process.stderr.write(`${role} keyid ${key.keyId}\n`);
		}
	}
	const signingKeys: RepositorySigningKeys = {
		root: loaded.root ?? [],
		targets: loaded.targets ?? [],
		snapshot: loaded.snapshot ?? [],
		timestamp: loaded.timestamp ?? [],
		delegated: Object.fromEntries(
			expectedRoles.map((role) => [role, loaded[role] ?? []]),
		),
	};
	const built = await buildRepository({
		signingKeys,
		targets: descriptions,
		consistentSnapshot: true,
		now,
	});
	if (!built.ok) throw new Error(`ceremony-build-${built.reason}`);
	// Exclusive creation makes a prior or partially written ceremony impossible to overwrite.
	await mkdir(output);
	const serialized = await serializeRepository(
		built.value,
		join(output, "metadata"),
	);
	if (!serialized.ok) throw new Error(`ceremony-write-${serialized.reason}`);
	for (const [path, bytes] of Object.entries(targetBytes)) {
		const slash = path.lastIndexOf("/");
		const storage = `${path.slice(0, slash + 1)}${descriptions[path]?.hashes.sha256}.${path.slice(slash + 1)}`;
		const destination = join(output, "targets", storage);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, bytes, { flag: "wx" });
	}
	const scratch = await mkdtemp(join(tmpdir(), "tuf-ceremony-verify-"));
	try {
		const verified = await updateTufRepository({
			bootstrapRoot: built.value.root.bytes,
			now,
			trustStore: openFileTrustStore(join(scratch, "trust.json")),
			fetcher: {
				async fetch(path, maxBytes) {
					try {
						if (!validateTargetPath(path).ok)
							return { kind: "error", error: "unsafe-path" };
						const kind = path.includes("/") ? "targets" : "metadata";
						const bytes = new Uint8Array(
							await readFile(join(output, kind, path)),
						);
						return bytes.length <= maxBytes
							? { kind: "ok", bytes }
							: { kind: "error", error: "oversize" };
					} catch (error) {
						if (
							error instanceof Error &&
							"code" in error &&
							error.code === "ENOENT"
						)
							return { kind: "not-found" };
						return { kind: "error", error: "read-failed" };
					}
				},
			},
		});
		if (!verified.ok)
			throw new Error(`ceremony-self-verification-${verified.reason}`);
	} finally {
		await rm(scratch, { recursive: true, force: true });
	}
	const receipt = {
		rootSha256: createHash("sha256")
			.update(built.value.root.bytes)
			.digest("hex"),
		keyids,
	};
	await writeFile(
		join(output, "ceremony-receipt.json"),
		`${JSON.stringify(receipt, null, 2)}\n`,
		{ flag: "wx" },
	);
	return receipt;
}
