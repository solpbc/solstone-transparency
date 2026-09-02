// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BuiltMetadata, BuiltRepository } from "./builder";
import { type TufResult, rejection } from "./outcome";
import { validateDelegatedRoleName, validateTargetPath } from "./role-graph";

export interface SerializedRepository {
	directory: string;
	filenames: readonly string[];
}

function validVersion(version: number): boolean {
	return Number.isSafeInteger(version) && version > 0;
}

/** Returns the unversioned logical metadata name used inside signed meta objects. */
export function metadataLogicalName(roleName: string): TufResult<string> {
	if (
		roleName === "root" ||
		roleName === "timestamp" ||
		roleName === "snapshot" ||
		roleName === "targets"
	) {
		return { ok: true, value: `${roleName}.json` };
	}
	const role = validateDelegatedRoleName(roleName);
	if (!role.ok) return role;
	return { ok: true, value: `${encodeURIComponent(role.value)}.json` };
}

/** Maps one trusted role name and version to its on-disk metadata filename. */
export function metadataFilename(
	roleName: string,
	version: number,
	consistentSnapshot: boolean,
): TufResult<string> {
	if (!validVersion(version)) {
		return rejection("malformed", {
			path: ["version"],
			expected: "a positive safe integer metadata version",
			observed: version,
		});
	}
	if (roleName === "root") return { ok: true, value: `${version}.root.json` };
	if (roleName === "timestamp") return { ok: true, value: "timestamp.json" };
	const logical = metadataLogicalName(roleName);
	if (!logical.ok) return logical;
	return {
		ok: true,
		value: consistentSnapshot ? `${version}.${logical.value}` : logical.value,
	};
}

function allMetadata(repository: BuiltRepository): readonly BuiltMetadata[] {
	return [
		repository.root,
		repository.targets,
		...repository.delegatedTargets,
		repository.snapshot,
		repository.timestamp,
	];
}

/** Writes canonical builder bytes after all names, paths, and collisions are preflighted. */
export async function serializeRepository(
	repository: BuiltRepository,
	directory: string,
): Promise<TufResult<SerializedRepository>> {
	const planned: { filename: string; bytes: Uint8Array }[] = [];
	for (const metadata of allMetadata(repository)) {
		const filename = metadataFilename(
			metadata.roleName,
			metadata.version,
			repository.consistentSnapshot,
		);
		if (!filename.ok) return filename;
		planned.push({ filename: filename.value, bytes: metadata.bytes });
	}
	for (const targetPath of Object.keys(repository.targetsByPath)) {
		const safe = validateTargetPath(targetPath);
		if (!safe.ok) return safe;
	}
	const filenames = planned.map((entry) => entry.filename);
	if (new Set(filenames).size !== filenames.length) {
		return rejection("malformed", {
			path: [],
			expected: "unique serialized metadata filenames",
			observed: filenames,
		});
	}
	try {
		await mkdir(directory, { recursive: true });
		const existing = new Set(await readdir(directory));
		const collisions = filenames.filter((filename) => existing.has(filename));
		if (collisions.length > 0) {
			return rejection("malformed", {
				path: [],
				expected: "a caller directory without planned metadata filenames",
				observed: collisions,
			});
		}
		for (const entry of planned) {
			await writeFile(join(directory, entry.filename), entry.bytes, {
				flag: "wx",
			});
		}
		return { ok: true, value: { directory, filenames: filenames.sort() } };
	} catch (error) {
		return rejection("malformed", {
			path: [],
			expected:
				"all preflighted metadata files to write to an empty caller directory",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}
