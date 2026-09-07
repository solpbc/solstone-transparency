// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalizeTufJson } from "./tuf/canonical";
import { parseRootDeclarations } from "./tuf/client-metadata";
import type { TufClientSuccess } from "./tuf/client-result";
import { type TufResult, rejection } from "./tuf/outcome";
import { type PreparedMetadata, sha256 } from "./tuf/prepared-metadata";
import { validateTargetPath } from "./tuf/role-graph";
import { isMetadataFilename, metadataFilename } from "./tuf/serializer";
import { targetStoragePath } from "./tuf/target-storage";

export interface PreparationOutputEntry {
	relativePath: string;
	bytes: Uint8Array;
}

export interface PreparationManifestFile {
	path: string;
	length: number;
	sha256: string;
}

export interface PreparationOutputManifest {
	schema: "solstone-transparency/tuf-preparation-manifest/v1";
	operation: string;
	expected_prior_timestamp_sha256: string;
	new_timestamp_sha256: string | null;
	files: readonly PreparationManifestFile[];
}

export interface ReplacedMetadata {
	roleName: string;
	metadata: PreparedMetadata;
}

export interface NewPreparationTarget {
	logicalPath: string;
	bytes: Uint8Array;
	sha256: string;
}

function validOutputPath(relativePath: string): TufResult<string> {
	const prefix = relativePath.startsWith("metadata/")
		? "metadata/"
		: relativePath.startsWith("targets/")
			? "targets/"
			: undefined;
	if (prefix === undefined) {
		return rejection("malformed", {
			path: ["relativePath"],
			expected: "a metadata/<filename> or targets/<storage-path> output path",
			observed: relativePath,
		});
	}
	const tail = relativePath.slice(prefix.length);
	const safe = validateTargetPath(tail);
	if (!safe.ok) return safe;
	if (prefix === "metadata/" && !isMetadataFilename(safe.value)) {
		return rejection("malformed", {
			path: ["relativePath"],
			expected: "a recognized TUF metadata filename under metadata/",
			observed: relativePath,
		});
	}
	return { ok: true, value: `${prefix}${safe.value}` };
}

function failure(error: unknown, expected: string): TufResult<never> {
	return rejection("malformed", {
		path: [],
		expected,
		observed: error instanceof Error ? error.name : typeof error,
	});
}

/** Composes every authenticated retained object with the metadata and targets being replaced. */
export function composeRepositoryFiles(input: {
	priorState: TufClientSuccess;
	replacedMetadata: readonly ReplacedMetadata[];
	newTargets?: readonly NewPreparationTarget[];
}): TufResult<PreparationOutputEntry[]> {
	const rootMetadata = input.priorState.authenticatedMetadata.root;
	if (rootMetadata === undefined) {
		return rejection("unavailable", {
			path: ["authenticatedMetadata", "root"],
			expected: "authenticated root metadata",
			observed: "missing",
		});
	}
	const root = parseRootDeclarations({ ...rootMetadata.envelope.signed });
	if (!root.ok) return root;
	const replacements = new Map<string, PreparedMetadata>();
	for (const replacement of input.replacedMetadata) {
		if (replacements.has(replacement.roleName)) {
			return rejection("malformed", {
				path: ["replacedMetadata", replacement.roleName],
				expected: "one replacement for each metadata role",
				observed: "duplicate role name",
			});
		}
		replacements.set(replacement.roleName, replacement.metadata);
	}
	const files: PreparationOutputEntry[] = [];
	for (const [roleName, metadata] of Object.entries(
		input.priorState.authenticatedMetadata,
	)) {
		const replacement = replacements.get(roleName);
		const retainedFilename = metadataFilename(
			roleName,
			metadata.version,
			root.value.consistentSnapshot,
		);
		if (!retainedFilename.ok) return retainedFilename;
		const filename = replacement?.filename ?? retainedFilename.value;
		files.push({
			relativePath: `metadata/${filename}`,
			bytes: replacement?.bytes ?? metadata.bytes,
		});
	}
	for (const targets of Object.values(input.priorState.authenticatedTargets)) {
		for (const target of Object.values(targets)) {
			const storage = targetStoragePath(target.logicalPath, {
				sha256: target.descriptor.hashes.sha256 ?? "",
				consistentSnapshot: root.value.consistentSnapshot,
			});
			if (!storage.ok) return storage;
			files.push({
				relativePath: `targets/${storage.value}`,
				bytes: target.bytes,
			});
		}
	}
	for (const target of input.newTargets ?? []) {
		const storage = targetStoragePath(target.logicalPath, {
			sha256: target.sha256,
			consistentSnapshot: root.value.consistentSnapshot,
		});
		if (!storage.ok) return storage;
		files.push({
			relativePath: `targets/${storage.value}`,
			bytes: target.bytes,
		});
	}
	const paths = files.map((file) => file.relativePath);
	if (new Set(paths).size !== paths.length) {
		return rejection("malformed", {
			path: ["files"],
			expected: "distinct composed repository paths",
			observed: paths,
		});
	}
	return { ok: true, value: files };
}

/** Writes a create-only prepared repository package, publishing its manifest last. */
export async function writePreparationOutput(input: {
	outputDirectory: string;
	files: readonly PreparationOutputEntry[];
	operation: string;
	expectedPriorTimestampSha256: string;
	newTimestampSha256: string | null;
}): Promise<TufResult<PreparationOutputManifest>> {
	const paths: string[] = [];
	for (const file of input.files) {
		const safe = validOutputPath(file.relativePath);
		if (!safe.ok) return safe;
		paths.push(safe.value);
	}
	if (new Set(paths).size !== paths.length) {
		return rejection("malformed", {
			path: ["files"],
			expected: "distinct preparation output paths",
			observed: paths,
		});
	}
	try {
		await mkdir(input.outputDirectory, { recursive: false });
	} catch (error) {
		return failure(
			error,
			"a fresh output directory that does not already exist",
		);
	}

	const manifestFiles: PreparationManifestFile[] = [];
	try {
		for (const file of input.files) {
			const path = join(input.outputDirectory, file.relativePath);
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, file.bytes, { flag: "wx" });
			const readBack = new Uint8Array(await readFile(path));
			const digest = await sha256(readBack);
			if (!digest.ok) return digest;
			const intended = await sha256(file.bytes);
			if (!intended.ok) return intended;
			if (
				readBack.byteLength !== file.bytes.byteLength ||
				digest.value !== intended.value
			) {
				return rejection("hash-mismatch", {
					path: [file.relativePath],
					expected: {
						length: file.bytes.byteLength,
						sha256: intended.value,
					},
					observed: { length: readBack.byteLength, sha256: digest.value },
				});
			}
			manifestFiles.push({
				path: file.relativePath,
				length: file.bytes.byteLength,
				sha256: digest.value,
			});
		}
		const manifest: PreparationOutputManifest = {
			schema: "solstone-transparency/tuf-preparation-manifest/v1",
			operation: input.operation,
			expected_prior_timestamp_sha256: input.expectedPriorTimestampSha256,
			new_timestamp_sha256: input.newTimestampSha256,
			files: manifestFiles,
		};
		const bytes = canonicalizeTufJson(manifest);
		if (!bytes.ok) return bytes;
		await writeFile(join(input.outputDirectory, "manifest.json"), bytes.value, {
			flag: "wx",
		});
		return { ok: true, value: manifest };
	} catch (error) {
		return failure(
			error,
			"all preparation bytes to write before manifest.json",
		);
	}
}
