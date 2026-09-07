// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
	RELEASE_RECORD_SCHEMA,
	type ReleaseArtifact,
	type ReleaseRecordPredicate,
	validateReleaseRecordPredicate,
} from "./records/release-record";
import { admitTufJson } from "./tuf/admission";
import type { TufJsonValue } from "./tuf/outcome";

export type JournalLane = "release" | "staging" | "dev";
export type JournalClaims = Pick<
	ReleaseRecordPredicate,
	"_comment" | "does_prove" | "does_not_prove"
>;

export interface JournalAdapterInput {
	manifestPath: string;
	version: string;
	lane: JournalLane;
	claims: JournalClaims;
}

/** Combines the explicitly supplied target sets into one product/version record. */
export async function adaptJournalReleaseSet(
	input: Omit<JournalAdapterInput, "manifestPath"> & {
		manifestPaths: readonly string[];
	},
): Promise<ReleaseRecordPredicate> {
	if (input.manifestPaths.length === 0) {
		refuse(
			"missing-manifest",
			"Supply at least one journal producer manifest.",
		);
	}
	let combined: ReleaseRecordPredicate | undefined;
	const urls = new Set<string>();
	for (const manifestPath of input.manifestPaths) {
		const release = await adaptJournalRelease({ ...input, manifestPath });
		for (const artifact of release.artifacts) {
			if (urls.has(artifact.url)) {
				refuse(
					"duplicate-target",
					"Supply each journal target manifest once for this release.",
				);
			}
			urls.add(artifact.url);
		}
		combined =
			combined === undefined
				? release
				: {
						...combined,
						artifacts: [...combined.artifacts, ...release.artifacts],
					};
	}
	if (combined === undefined)
		refuse(
			"missing-manifest",
			"Supply at least one journal producer manifest.",
		);
	return {
		...combined,
		artifacts: [...combined.artifacts].sort((left, right) =>
			left.url < right.url ? -1 : left.url > right.url ? 1 : 0,
		),
	};
}

export class JournalAdapterError extends Error {
	constructor(
		readonly reason: string,
		message: string,
	) {
		super(message);
		this.name = "JournalAdapterError";
	}
}

function refuse(reason: string, message: string): never {
	throw new JournalAdapterError(reason, message);
}

function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeComponent(value: string): boolean {
	return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

// Hash the same open file whose bytes are counted; large archives stay streamed.
async function measure(path: string, capture = false) {
	const file = await open(
		path,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
	);
	try {
		if (!(await file.stat()).isFile()) {
			refuse(
				"not-regular-file",
				"Use regular artifact files without symlinks.",
			);
		}
		const hash = createHash("sha256");
		let length = 0;
		const chunks: Buffer[] = [];
		for await (const chunk of file.createReadStream({ autoClose: false })) {
			const bytes = Buffer.from(chunk);
			length += bytes.length;
			if (!Number.isSafeInteger(length) || (capture && length > 1024 * 1024)) {
				refuse(
					"input-too-large",
					"Supply a manifest or sidecar smaller than 1 MiB.",
				);
			}
			hash.update(bytes);
			if (capture) chunks.push(bytes);
		}
		return { length, sha256: hash.digest("hex"), bytes: Buffer.concat(chunks) };
	} finally {
		await file.close();
	}
}

/** Measures local producer output. Signing authority and remote publication are separate checks. */
export async function adaptJournalRelease(
	input: JournalAdapterInput,
): Promise<ReleaseRecordPredicate> {
	try {
		return await adapt(input);
	} catch (error) {
		if (error instanceof JournalAdapterError) throw error;
		refuse(
			"artifact-read-failed",
			"Could not read the release set. Supply the complete local producer output as regular files.",
		);
	}
}

async function adapt(
	input: JournalAdapterInput,
): Promise<ReleaseRecordPredicate> {
	if (!safeComponent(input.version)) {
		refuse(
			"unsafe-version",
			"Supply a version containing only letters, digits, dots, underscores, and hyphens.",
		);
	}
	if (!["release", "staging", "dev"].includes(input.lane)) {
		refuse("invalid-lane", "Choose release, staging, or dev.");
	}
	const manifest = await measure(input.manifestPath, true);
	const admitted = admitTufJson(manifest.bytes);
	if (!admitted.ok || !object(admitted.value)) {
		refuse(
			"invalid-manifest",
			"Supply the producer's JSON manifest with unique member names.",
		);
	}
	const body = admitted.value;
	if (
		Object.keys(body).sort().join(",") !== "files,product,target,version" ||
		body.product !== "solstone-journal" ||
		body.version !== input.version ||
		typeof body.target !== "string" ||
		!object(body.files)
	) {
		refuse(
			"manifest-identity-mismatch",
			"Supply a solstone-journal manifest matching the requested version and producer schema.",
		);
	}
	const extensions =
		body.target === "macos-arm64"
			? ["tar.gz", "pkg", "release", "signing.json", "sha256"]
			: ["linux-x86_64", "linux-aarch64"].includes(body.target)
				? ["tar.gz", "deb", "rpm", "release", "sha256"]
				: undefined;
	if (extensions === undefined) {
		refuse(
			"unsupported-target",
			"Supply a Linux or macOS journal producer manifest. Windows production is not supported.",
		);
	}
	const base = `solstone-journal-${input.version}-${body.target}`;
	const manifestName = `${base}.manifest.json`;
	if (basename(input.manifestPath) !== manifestName) {
		refuse(
			"manifest-filename-mismatch",
			"Keep the manifest filename emitted by the producer for this version and target.",
		);
	}
	const files = body.files;
	const names = Object.keys(files).sort();
	const expectedNames = extensions
		.map((extension) => `${base}.${extension}`)
		.sort();
	if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
		refuse(
			"artifact-set-mismatch",
			"Supply exactly the manifest members emitted for this target, without renamed, missing, or extra members.",
		);
	}
	const urlBase = `https://updates.solstone.app/solstone-journal/${input.lane}/${input.version}/`;
	const artifacts: ReleaseArtifact[] = [];
	let releaseBytes: Buffer | undefined;
	let checksumBytes: Buffer | undefined;
	for (const name of names) {
		const expectedHash = files[name];
		if (
			typeof expectedHash !== "string" ||
			!/^[0-9a-f]{64}$/.test(expectedHash)
		) {
			refuse(
				"invalid-artifact-hash",
				"Supply lowercase SHA256 hashes from the producer manifest.",
			);
		}
		const capture = name.endsWith(".release") || name.endsWith(".sha256");
		const artifact = await measure(
			join(dirname(input.manifestPath), name),
			capture,
		);
		if (artifact.sha256 !== expectedHash) {
			refuse(
				"artifact-hash-mismatch",
				`Artifact ${name} differs from its manifest. Restore the matching producer output before preparing evidence.`,
			);
		}
		if (name.endsWith(".release")) releaseBytes = artifact.bytes;
		if (name.endsWith(".sha256")) checksumBytes = artifact.bytes;
		artifacts.push({
			url: urlBase + name,
			length: artifact.length,
			sha256: artifact.sha256,
		});
	}
	const releaseFields = new Map<string, string>();
	for (const line of releaseBytes?.toString("utf8").trimEnd().split("\n") ??
		[]) {
		const separator = line.indexOf("=");
		const key = line.slice(0, separator);
		if (separator < 1 || releaseFields.has(key)) {
			refuse(
				"release-declaration-mismatch",
				"Supply the producer's release declaration with unique fields.",
			);
		}
		releaseFields.set(key, line.slice(separator + 1));
	}
	for (const key of ["product", "version", "target"]) {
		if (releaseFields.get(key) !== body[key]) {
			refuse(
				"release-declaration-mismatch",
				"The release declaration and manifest must identify the same product, version, and target.",
			);
		}
	}
	const checksumLines = checksumBytes
		?.toString("utf8")
		.trimEnd()
		.split("\n")
		.sort();
	const expectedLines = names
		.filter((name) => name !== `${base}.sha256`)
		.map((name) => `${files[name]}  ${name}`)
		.sort();
	if (JSON.stringify(checksumLines) !== JSON.stringify(expectedLines)) {
		refuse(
			"checksum-sidecar-mismatch",
			"Supply the checksum sidecar matching the manifest members.",
		);
	}
	artifacts.push({
		url: urlBase + manifestName,
		length: manifest.length,
		sha256: manifest.sha256,
	});
	artifacts.sort((left, right) =>
		left.url < right.url ? -1 : left.url > right.url ? 1 : 0,
	);
	const candidate = {
		...input.claims,
		schema: RELEASE_RECORD_SCHEMA,
		product: "journal",
		version: input.version,
		artifacts,
	};
	const validated = await validateReleaseRecordPredicate(
		candidate as unknown as TufJsonValue,
	);
	if (!validated.ok) {
		refuse(
			"invalid-release-claims",
			"Supply _comment, does_prove, and does_not_prove arrays using the release's approved claim text.",
		);
	}
	return validated.value;
}
