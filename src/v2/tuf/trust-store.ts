// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { admitTufJson } from "./admission";
import type { TufEnvelope } from "./builder";
import { canonicalizeTufJson } from "./canonical";
import { type TufJsonValue, type TufResult, rejection } from "./outcome";

/** The serializable part of builder's envelope; raw bytes and a filename are not trust state. */
export interface PersistedRootEnvelope
	extends Pick<TufEnvelope, "signed" | "signatures"> {
	signed: Record<string, TufJsonValue>;
}

export interface TrustStoreState {
	schemaVersion: 1;
	trustedRoot: {
		version: number;
		envelope: PersistedRootEnvelope;
	};
	versions: {
		root: number;
		timestamp: number;
		snapshot: number;
		targets: number;
		delegatedTargets: Readonly<Record<string, number>>;
	};
}

export interface TrustStoreRead {
	state: TrustStoreState;
	revision: string;
}

export interface TufTrustStore {
	read(): Promise<TufResult<TrustStoreRead | undefined>>;
	replace(
		expectedRevision: string | undefined,
		next: TrustStoreState,
	): Promise<TufResult<undefined>>;
}

function isRecord(value: unknown): value is Record<string, TufJsonValue> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.byteLength !== right.byteLength) return false;
	for (let index = 0; index < left.byteLength; index++) {
		if (left[index] !== right[index]) return false;
	}
	return true;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function positiveVersion(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function schemaFailure(expected: string, observed: unknown): TufResult<never> {
	return rejection("trust-store-corrupt", { path: [], expected, observed });
}

function parseStore(value: TufJsonValue): TufResult<TrustStoreState> {
	if (!isRecord(value) || value.schemaVersion !== 1) {
		return schemaFailure("a version 1 TUF trust store object", value);
	}
	if (!isRecord(value.trustedRoot) || !isRecord(value.versions)) {
		return schemaFailure("trustedRoot and versions objects", value);
	}
	const root = value.trustedRoot;
	const versions = value.versions;
	if (
		!positiveVersion(root.version) ||
		!isRecord(root.envelope) ||
		!isRecord(root.envelope.signed) ||
		!Array.isArray(root.envelope.signatures) ||
		!root.envelope.signatures.every(
			(signature) =>
				isRecord(signature) &&
				typeof signature.keyid === "string" &&
				typeof signature.sig === "string",
		) ||
		!positiveVersion(versions.root) ||
		!positiveVersion(versions.timestamp) ||
		!positiveVersion(versions.snapshot) ||
		!positiveVersion(versions.targets) ||
		!isRecord(versions.delegatedTargets)
	) {
		return schemaFailure("a complete positive-version trust store", value);
	}
	for (const version of Object.values(versions.delegatedTargets)) {
		if (!positiveVersion(version)) {
			return schemaFailure("positive delegated target versions", version);
		}
	}
	if (root.version !== versions.root) {
		return schemaFailure("matching trusted-root and root-ledger versions", {
			trustedRoot: root.version,
			root: versions.root,
		});
	}
	return {
		ok: true,
		value: {
			schemaVersion: 1,
			trustedRoot: {
				version: root.version,
				envelope: {
					signed: root.envelope.signed,
					signatures: root.envelope.signatures.map((signature) => {
						if (!isRecord(signature)) {
							throw new Error("validated signature unexpectedly changed shape");
						}
						return {
							keyid: String(signature.keyid),
							sig: String(signature.sig),
						};
					}),
				},
			},
			versions: {
				root: versions.root,
				timestamp: versions.timestamp,
				snapshot: versions.snapshot,
				targets: versions.targets,
				delegatedTargets: Object.fromEntries(
					Object.entries(versions.delegatedTargets).map(([name, version]) => [
						name,
						version as number,
					]),
				),
			},
		},
	};
}

async function decodeStore(
	bytes: Uint8Array,
): Promise<TufResult<TrustStoreRead>> {
	const admitted = admitTufJson(bytes);
	if (!admitted.ok) {
		return rejection("trust-store-corrupt", {
			path: admitted.detail.path,
			expected: "admitted canonical trust store JSON",
			observed: admitted.reason,
		});
	}
	const canonical = canonicalizeTufJson(admitted.value);
	if (!canonical.ok || !sameBytes(bytes, canonical.value)) {
		return rejection("trust-store-corrupt", {
			path: [],
			expected: "canonical trust store JSON bytes",
			observed: "non-canonical trust store bytes",
		});
	}
	const parsed = parseStore(admitted.value);
	if (!parsed.ok) return parsed;
	return {
		ok: true,
		value: { state: parsed.value, revision: bytesToHex(bytes) },
	};
}

function versionLowered(
	next: TrustStoreState,
	current: TrustStoreState,
): { roleName: string; expected: number; observed: number } | undefined {
	const currentVersions = current.versions;
	const nextVersions = next.versions;
	for (const roleName of [
		"root",
		"timestamp",
		"snapshot",
		"targets",
	] as const) {
		if (nextVersions[roleName] < currentVersions[roleName]) {
			return {
				roleName,
				expected: currentVersions[roleName],
				observed: nextVersions[roleName],
			};
		}
	}
	for (const [roleName, currentVersion] of Object.entries(
		currentVersions.delegatedTargets,
	)) {
		const nextVersion = nextVersions.delegatedTargets[roleName];
		if (nextVersion === undefined || nextVersion < currentVersion) {
			return {
				roleName,
				expected: currentVersion,
				observed: nextVersion ?? 0,
			};
		}
	}
	return undefined;
}

async function readCurrent(
	path: string,
): Promise<TufResult<TrustStoreRead | undefined>> {
	try {
		return await decodeStore(new Uint8Array(await readFile(path)));
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return { ok: true, value: undefined };
		}
		return rejection("malformed", {
			path: [path],
			expected: "a readable trust store path",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}

/** Opens a canonical, compare-and-replace file trust store at the caller-owned path. */
export function openFileTrustStore(path: string): TufTrustStore {
	return {
		read: () => readCurrent(path),
		async replace(expectedRevision, next): Promise<TufResult<undefined>> {
			const requested = canonicalizeTufJson(next);
			if (!requested.ok) return requested;
			const admitted = admitTufJson(requested.value);
			if (!admitted.ok) {
				return rejection("trust-store-corrupt", {
					path: admitted.detail.path,
					expected: "a canonical trust store state",
					observed: admitted.reason,
				});
			}
			const validatedNext = parseStore(admitted.value);
			if (!validatedNext.ok) return validatedNext;
			const canonical = canonicalizeTufJson(validatedNext.value);
			if (!canonical.ok) return canonical;
			const lockPath = `${path}.lock`;
			const temporaryPath = `${path}.tmp-${crypto.randomUUID()}`;
			let lock: Awaited<ReturnType<typeof open>> | undefined;
			let result: TufResult<undefined>;
			try {
				lock = await open(lockPath, "wx");
				const current = await readCurrent(path);
				if (!current.ok) {
					result = current;
				} else if (current.value?.revision !== expectedRevision) {
					result = rejection("malformed", {
						path: [path],
						expected: "the trust store revision read at update start",
						observed: current.value?.revision ?? "missing",
					});
				} else if (current.value !== undefined) {
					const lowered = versionLowered(
						validatedNext.value,
						current.value.state,
					);
					if (lowered !== undefined) {
						result = rejection("version-rollback", {
							path: ["versions", lowered.roleName],
							expected: lowered.expected,
							observed: lowered.observed,
						});
					} else {
						await writeFile(temporaryPath, canonical.value, { flag: "wx" });
						await rename(temporaryPath, path);
						result = { ok: true, value: undefined };
					}
				} else {
					await writeFile(temporaryPath, canonical.value, { flag: "wx" });
					await rename(temporaryPath, path);
					result = { ok: true, value: undefined };
				}
			} catch (error) {
				result = rejection("malformed", {
					path: [path],
					expected: "an atomically replaceable trust store path",
					observed: error instanceof Error ? error.name : typeof error,
				});
			}
			let cleanupError: unknown;
			if (lock !== undefined) {
				try {
					await lock.close();
				} catch (error) {
					cleanupError = error;
				}
			}
			try {
				await rm(temporaryPath, { force: true });
			} catch (error) {
				cleanupError ??= error;
			}
			if (lock !== undefined) {
				try {
					await rm(lockPath, { force: true });
				} catch (error) {
					cleanupError ??= error;
				}
			}
			if (cleanupError !== undefined) {
				return rejection("malformed", {
					path: [path],
					expected: "temporary trust-store artifacts cleaned after replacement",
					observed:
						cleanupError instanceof Error
							? cleanupError.name
							: typeof cleanupError,
				});
			}
			return result;
		},
	};
}
