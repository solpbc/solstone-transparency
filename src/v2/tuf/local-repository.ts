// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_MAX_METADATA_BYTES } from "./admission";
import { DEFAULT_ROLE_CONFIGURATION, type RoleConfiguration } from "./builder";
import { updateTufRepository } from "./client";
import type { TufClientSuccess } from "./client-result";
import type { TufFetchResponse, TufFetcher } from "./fetch";
import { type TufResult, rejection } from "./outcome";
import { bytesToHex } from "./prepared-metadata";
import { validateTargetPath } from "./role-graph";
import { isMetadataFilename } from "./serializer";
import type {
	TrustStoreRead,
	TrustStoreState,
	TufTrustStore,
} from "./trust-store";

function errorName(error: unknown): string {
	return error instanceof Error ? error.name : typeof error;
}

function isNotFound(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function readBounded(
	path: string,
	maxBytes: number,
): Promise<TufFetchResponse> {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
		return {
			kind: "error",
			error: new Error(`invalid ${maxBytes}-byte retrieval ceiling`),
		};
	}
	try {
		const details = await stat(path);
		if (details.size > maxBytes) {
			return {
				kind: "error",
				error: new Error(
					`file exceeds the ${maxBytes}-byte ceiling (${details.size})`,
				),
			};
		}
		const bytes = new Uint8Array(await readFile(path));
		if (bytes.byteLength > maxBytes) {
			return {
				kind: "error",
				error: new Error(
					`file exceeds the ${maxBytes}-byte ceiling (${bytes.byteLength})`,
				),
			};
		}
		return { kind: "ok", bytes };
	} catch (error) {
		if (isNotFound(error)) return { kind: "not-found" };
		return { kind: "error", error };
	}
}

function ephemeralTrustStore(): TufTrustStore {
	let stored: TrustStoreRead | undefined;
	let nextRevision = 1;
	return {
		async read(): Promise<TufResult<TrustStoreRead | undefined>> {
			return { ok: true, value: stored };
		},
		async replace(
			expectedRevision: string | undefined,
			next: TrustStoreState,
		): Promise<TufResult<undefined>> {
			if (stored?.revision !== expectedRevision) {
				return rejection("malformed", {
					path: ["trustStore"],
					expected: stored?.revision ?? "missing",
					observed: expectedRevision ?? "missing",
				});
			}
			stored = { state: next, revision: String(nextRevision++) };
			return { ok: true, value: undefined };
		},
	};
}

/** Creates a bounded local repository fetcher for an already-selected repository directory. */
export function createLocalRepositoryFetcher(
	repositoryDirectory: string,
): TufFetcher {
	return {
		async fetch(
			relativePath: string,
			maxBytes: number,
		): Promise<TufFetchResponse> {
			const safePath = validateTargetPath(relativePath);
			if (!safePath.ok) {
				return {
					kind: "error",
					error: new Error(`unsafe repository path: ${relativePath}`),
				};
			}
			const parent = isMetadataFilename(safePath.value)
				? "metadata"
				: "targets";
			return readBounded(
				join(repositoryDirectory, parent, safePath.value),
				maxBytes,
			);
		},
	};
}

/** Authenticates one local repository from an out-of-band root and timestamp pin. */
export async function authenticateLocalRepository(input: {
	repositoryDirectory: string;
	rootPath: string;
	expectedTimestampSha256: string;
	now: Date;
	roleConfiguration?: RoleConfiguration;
}): Promise<TufResult<TufClientSuccess>> {
	const root = await readBounded(input.rootPath, DEFAULT_MAX_METADATA_BYTES);
	if (root.kind !== "ok") {
		return rejection("retrieval-failed", {
			path: [input.rootPath],
			expected:
				"a readable local root metadata file within the metadata ceiling",
			observed: root.kind === "not-found" ? "missing" : errorName(root.error),
		});
	}
	const result = await updateTufRepository({
		fetcher: createLocalRepositoryFetcher(input.repositoryDirectory),
		bootstrapRoot: root.bytes,
		trustStore: ephemeralTrustStore(),
		now: input.now,
		roleConfiguration: input.roleConfiguration ?? DEFAULT_ROLE_CONFIGURATION,
	});
	if (!result.ok) return result;
	const timestamp = result.value.authenticatedMetadata.timestamp;
	if (timestamp === undefined) {
		return rejection("unavailable", {
			path: ["authenticatedMetadata", "timestamp"],
			expected: "authenticated timestamp metadata",
			observed: "missing",
		});
	}
	try {
		const actual = bytesToHex(
			new Uint8Array(
				await crypto.subtle.digest("SHA-256", new Uint8Array(timestamp.bytes)),
			),
		);
		if (actual !== input.expectedTimestampSha256) {
			return rejection("hash-mismatch", {
				path: ["expectedTimestampSha256"],
				expected: actual,
				observed: input.expectedTimestampSha256,
			});
		}
		return result;
	} catch (error) {
		return rejection("malformed", {
			path: ["authenticatedMetadata", "timestamp", "bytes"],
			expected: "timestamp bytes accepted by SHA-256",
			observed: errorName(error),
		});
	}
}
