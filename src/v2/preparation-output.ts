// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { constants } from "node:fs";
import { lstat, mkdir, open, rm, writeFile } from "node:fs/promises";
import { dirname, join, parse, relative, resolve, sep } from "node:path";
import type { PublicationManifest } from "./publication";
import { DEFAULT_MAX_METADATA_BYTES } from "./tuf/admission";
import { canonicalizeTufJson } from "./tuf/canonical";
import {
	parseClientMetadata,
	parseRootDeclarations,
} from "./tuf/client-metadata";
import type { TufClientSuccess } from "./tuf/client-result";
import { authenticateLocalRepository } from "./tuf/local-repository";
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
	verification: "unsigned-targets" | "tuf-verified";
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

/** Reject symlinks in every path component; create output directories one at a time. */
async function directories(path: string, create = false): Promise<void> {
	const absolute = resolve(path);
	let current = parse(absolute).root;
	for (const component of relative(current, absolute)
		.split(sep)
		.filter(Boolean)) {
		current = join(current, component);
		if (create) {
			try {
				await mkdir(current, { mode: 0o700 });
			} catch (error) {
				if (!hasCode(error, "EEXIST")) throw error;
			}
		}
		const details = await lstat(current);
		if (!details.isDirectory() || details.isSymbolicLink())
			throw new Error("unsafe-directory");
	}
}

function hasCode(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}

/** Bounded reads never follow the final path component or a checked parent symlink. */
async function readRegular(path: string, maximum: number): Promise<Uint8Array> {
	await directories(dirname(path));
	const file = await open(
		path,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
	);
	try {
		const info = await file.stat();
		if (!info.isFile() || info.size > maximum)
			throw new Error("file-size-or-type-invalid");
		const bytes = Buffer.alloc(info.size);
		let offset = 0;
		while (offset < bytes.length) {
			const read = await file.read(
				bytes,
				offset,
				bytes.length - offset,
				offset,
			);
			if (read.bytesRead === 0) throw new Error("file-truncated");
			offset += read.bytesRead;
		}
		if ((await file.read(Buffer.alloc(1), 0, 1, offset)).bytesRead !== 0)
			throw new Error("file-grew");
		return new Uint8Array(bytes);
	} finally {
		await file.close();
	}
}

async function sourceMatches(
	path: string,
	bytes: Uint8Array,
): Promise<boolean> {
	try {
		await directories(dirname(path));
		const details = await lstat(path);
		if (!details.isFile() || details.isSymbolicLink())
			throw new Error("unsafe-source-file");
		if (details.size !== bytes.length) return false;
		return Buffer.from(bytes).equals(
			Buffer.from(await readRegular(path, bytes.length)),
		);
	} catch (error) {
		if (hasCode(error, "ENOENT")) return false;
		throw error;
	}
}

export interface PreparationOutputInput {
	outputDirectory: string;
	files: readonly PreparationOutputEntry[];
	operation: string;
	expectedPriorTimestampSha256: string;
	newTimestampSha256: string | null;
	priorState?: TufClientSuccess;
	verification?: { repositoryDirectory: string; rootPath: string; now: Date };
}

/** Verify persisted output before completing the package; the publication delta is written last. */
export async function writePreparationOutput(
	input: PreparationOutputInput,
): Promise<TufResult<PreparationOutputManifest>> {
	// Snapshot mutable caller bytes and coordinates before the first filesystem await.
	const outputDirectory = resolve(input.outputDirectory);
	const files: PreparationOutputEntry[] = input.files.map((file) => ({
		relativePath: file.relativePath,
		bytes: new Uint8Array(file.bytes),
	}));
	const operation = input.operation;
	const expectedPriorTimestampSha256 = input.expectedPriorTimestampSha256;
	const newTimestampSha256 = input.newTimestampSha256;
	const verification = input.verification && {
		repositoryDirectory: resolve(input.verification.repositoryDirectory),
		rootPath: resolve(input.verification.rootPath),
		now: new Date(input.verification.now.getTime()),
	};
	const priorRootVersion = input.priorState?.versions.root;
	const priorRootBytes =
		input.priorState?.authenticatedMetadata.root?.bytes.slice();
	const priorFiles =
		input.priorState &&
		composeRepositoryFiles({
			priorState: input.priorState,
			replacedMetadata: [],
		});
	if (priorFiles && !priorFiles.ok) return priorFiles;
	const priorPaths = new Set(
		priorFiles?.value.map((file) => file.relativePath),
	);
	if (
		newTimestampSha256 !== null &&
		(!verification || priorRootVersion === undefined || !priorRootBytes)
	) {
		return rejection("malformed", {
			path: ["verification"],
			expected:
				"priorState and original-root verification context for a signed repository",
			observed: "missing",
		});
	}
	if (
		!/^[0-9a-f]{64}$/.test(expectedPriorTimestampSha256) ||
		(newTimestampSha256 !== null && !/^[0-9a-f]{64}$/.test(newTimestampSha256))
	)
		return rejection("malformed", {
			path: ["timestampSha256"],
			expected: "SHA256 digests",
			observed: "invalid",
		});
	for (const file of files) {
		const safe = validOutputPath(file.relativePath);
		if (!safe.ok) return safe;
		if (
			newTimestampSha256 === null &&
			!file.relativePath.startsWith("targets/")
		)
			return rejection("malformed", {
				path: [file.relativePath],
				expected: "unsigned target files only without a new timestamp",
				observed: "metadata",
			});
	}
	if (new Set(files.map((file) => file.relativePath)).size !== files.length)
		return rejection("malformed", {
			path: ["files"],
			expected: "distinct preparation output paths",
			observed: "duplicates",
		});

	let pinnedRootPath: string | undefined;
	const retainedRoots = new Set<string>();
	const changed = new Set<string>();
	try {
		await directories(dirname(outputDirectory));
		if (
			newTimestampSha256 !== null &&
			verification &&
			priorRootVersion !== undefined &&
			priorRootBytes
		) {
			if (!Number.isFinite(verification.now.getTime()))
				throw new Error("invalid-time");
			await directories(verification.repositoryDirectory);
			const pinBytes = await readRegular(
				verification.rootPath,
				DEFAULT_MAX_METADATA_BYTES,
			);
			const pin = parseClientMetadata("root", "pinned.root.json", pinBytes);
			if (!pin.ok) return pin;
			// Copy an explicit bounded chain, never a directory scan or a highest-file guess.
			if (
				!Number.isSafeInteger(priorRootVersion) ||
				priorRootVersion < pin.value.version ||
				priorRootVersion - pin.value.version > 128
			)
				return rejection("malformed", {
					path: ["priorState", "versions", "root"],
					expected: "at most 128 root transitions from the original pin",
					observed: priorRootVersion,
				});
			for (
				let version = pin.value.version;
				version <= priorRootVersion;
				version++
			) {
				const path = `metadata/${version}.root.json`;
				const bytes =
					version === pin.value.version
						? pinBytes
						: await readRegular(
								join(verification.repositoryDirectory, path),
								DEFAULT_MAX_METADATA_BYTES,
							);
				const existing = files.find((file) => file.relativePath === path);
				if (existing && !Buffer.from(existing.bytes).equals(Buffer.from(bytes)))
					return rejection("hash-mismatch", {
						path: [path],
						expected: "the original pinned root or retained source root bytes",
						observed: "changed root",
					});
				if (!existing) files.push({ relativePath: path, bytes });
				retainedRoots.add(path);
			}
			const currentRoot = files.find(
				(file) =>
					file.relativePath === `metadata/${priorRootVersion}.root.json`,
			);
			if (
				!currentRoot ||
				!Buffer.from(currentRoot.bytes).equals(Buffer.from(priorRootBytes))
			)
				return rejection("hash-mismatch", {
					path: ["priorState", "root"],
					expected: "the authenticated current root bytes",
					observed: "changed",
				});
			pinnedRootPath = join(
				outputDirectory,
				`metadata/${pin.value.version}.root.json`,
			);
			const priorTimestamp = await readRegular(
				join(verification.repositoryDirectory, "metadata/timestamp.json"),
				DEFAULT_MAX_METADATA_BYTES,
			);
			const oldDigest = await sha256(priorTimestamp);
			if (!oldDigest.ok) return oldDigest;
			if (oldDigest.value !== expectedPriorTimestampSha256)
				return rejection("hash-mismatch", {
					path: ["expectedPriorTimestampSha256"],
					expected: expectedPriorTimestampSha256,
					observed: oldDigest.value,
				});
			for (const file of files) {
				if (
					!retainedRoots.has(file.relativePath) &&
					(!priorPaths.has(file.relativePath) ||
						!(await sourceMatches(
							join(verification.repositoryDirectory, file.relativePath),
							file.bytes,
						)))
				)
					changed.add(file.relativePath);
			}
		}
		await mkdir(outputDirectory, { recursive: false, mode: 0o700 });
	} catch (error) {
		return failure(
			error,
			"a fresh output directory and regular bounded source files without symlinks",
		);
	}

	const manifestFiles: PreparationManifestFile[] = [];
	try {
		for (const file of files) {
			const path = join(outputDirectory, file.relativePath);
			await directories(dirname(path), true);
			await writeFile(path, file.bytes, { flag: "wx", mode: 0o600 });
			const readBack = await readRegular(path, file.bytes.byteLength);
			if (!Buffer.from(readBack).equals(Buffer.from(file.bytes)))
				return rejection("hash-mismatch", {
					path: [file.relativePath],
					expected: "exact snapshotted input bytes",
					observed: "persisted bytes differ",
				});
			const digest = await sha256(readBack);
			if (!digest.ok) return digest;
			manifestFiles.push({
				path: file.relativePath,
				length: readBack.length,
				sha256: digest.value,
			});
		}
		if (newTimestampSha256 !== null && verification && pinnedRootPath) {
			const verified = await authenticateLocalRepository({
				repositoryDirectory: outputDirectory,
				rootPath: pinnedRootPath,
				expectedTimestampSha256: newTimestampSha256,
				now: verification.now,
			});
			if (!verified.ok) return verified;
			if (verified.value.versions.root !== priorRootVersion)
				return rejection("version-rollback", {
					path: ["root"],
					expected: priorRootVersion,
					observed: verified.value.versions.root,
				});
			const authenticatedFiles = composeRepositoryFiles({
				priorState: verified.value,
				replacedMetadata: [],
			});
			if (!authenticatedFiles.ok) return authenticatedFiles;
			const authenticatedPaths = new Set(
				authenticatedFiles.value.map((file) => file.relativePath),
			);
			for (const file of files)
				if (
					!authenticatedPaths.has(file.relativePath) &&
					!retainedRoots.has(file.relativePath)
				)
					return rejection("malformed", {
						path: [file.relativePath],
						expected: "an authenticated repository object or retained root",
						observed: "unreferenced output",
					});
		}
		const manifest: PreparationOutputManifest = {
			schema: "solstone-transparency/tuf-preparation-manifest/v1",
			verification:
				newTimestampSha256 === null ? "unsigned-targets" : "tuf-verified",
			operation,
			expected_prior_timestamp_sha256: expectedPriorTimestampSha256,
			new_timestamp_sha256: newTimestampSha256,
			files: manifestFiles,
		};
		const bytes = canonicalizeTufJson(manifest);
		if (!bytes.ok) return bytes;
		let publicationBytes: Uint8Array | undefined;
		if (newTimestampSha256 !== null && changed.size > 0) {
			if (!changed.has("metadata/timestamp.json"))
				return rejection("malformed", {
					path: ["files"],
					expected: "a changed timestamp for a publication delta",
					observed: "unchanged timestamp",
				});
			const publication: PublicationManifest = {
				schema: "publication-manifest-v1",
				files: manifestFiles.filter((file) => changed.has(file.path)),
				expectedTimestampSha256: expectedPriorTimestampSha256,
			};
			const serialized = canonicalizeTufJson(publication);
			if (!serialized.ok) return serialized;
			publicationBytes = serialized.value;
		}
		await writeFile(join(outputDirectory, "manifest.json"), bytes.value, {
			flag: "wx",
			mode: 0o600,
		});
		if (publicationBytes)
			await writeFile(
				join(outputDirectory, "publication-manifest.json"),
				publicationBytes,
				{ flag: "wx", mode: 0o600 },
			);
		return { ok: true, value: manifest };
	} catch (error) {
		await rm(join(outputDirectory, "publication-manifest.json"), {
			force: true,
		});
		await rm(join(outputDirectory, "manifest.json"), { force: true });
		return failure(
			error,
			"persisted repository verification before completed manifests",
		);
	}
}
