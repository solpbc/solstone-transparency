// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The v2 verify command: bootstrap from a pinned root and verify a repository,
 * fetching bytes over HTTPS and trusting nothing else.
 *
 * This exists so the claim "anyone can check our work" is something a stranger can
 * actually run, not an assertion about a library. Without a reachable command, a
 * third party would have to write this wiring themselves before they could verify
 * anything -- and a verification system whose verifier nobody can invoke defeats its
 * own purpose.
 *
 * ⛔ Read-only. It fetches and verifies; it never writes to the evidence host, never
 * signs, and holds no credential.
 */

import { DEFAULT_MAX_METADATA_BYTES } from "./tuf/admission";
import { updateTufRepository } from "./tuf/client";
import type { TufFetchResponse, TufFetcher } from "./tuf/fetch";
import { openFileTrustStore } from "./tuf/trust-store";

/**
 * Routes a repository-relative path to its base URL.
 *
 * 🔴 Two deployment facts are encoded here rather than left to the caller, because
 * getting either wrong produces a 404 that reads as missing evidence:
 *
 *  1. Metadata and targets live under different bases, which is what the discovery
 *     document's `metadata_base` and `targets_base` describe.
 *  2. A delegated role name contains "/", so its FILENAME is URL-encoded and the
 *     percent must itself be escaped in the request -- otherwise the host decodes
 *     `%2F` back to a separator and looks for a path that does not exist.
 */
export function resolveObjectUrl(
	metadataBase: string,
	targetsBase: string,
	relativePath: string,
): string {
	const isMetadata =
		/(^|\.)(root|timestamp|snapshot|targets(%2F[^.]+)?)\.json$/.test(
			relativePath,
		);
	const base = isMetadata ? metadataBase : targetsBase;
	const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
	return `${trimmed}/${relativePath.replace(/%/g, "%25")}`;
}

/** An HTTPS fetcher bounded by the byte ceiling the client supplies. */
export function httpsFetcher(
	metadataBase: string,
	targetsBase: string,
	onRequest?: (path: string) => void,
): TufFetcher {
	return {
		async fetch(
			relativePath: string,
			maxBytes: number,
		): Promise<TufFetchResponse> {
			onRequest?.(relativePath);
			const url = resolveObjectUrl(metadataBase, targetsBase, relativePath);
			try {
				const response = await fetch(url);
				if (response.status === 404) return { kind: "not-found" };
				if (!response.ok) {
					return { kind: "error", error: new Error(`HTTP ${response.status}`) };
				}
				// The ceiling is enforced here, before the bytes are handed on, so an
				// oversized body cannot reach the parser.
				const bytes = new Uint8Array(await response.arrayBuffer());
				if (bytes.byteLength > maxBytes) {
					return {
						kind: "error",
						error: new Error(
							`response exceeds the ${maxBytes}-byte ceiling (${bytes.byteLength})`,
						),
					};
				}
				return { kind: "ok", bytes };
			} catch (error) {
				return { kind: "error", error };
			}
		},
	};
}

export interface VerifyOptions {
	metadataBase: string;
	targetsBase: string;
	rootPath?: string;
	storePath: string;
	json: boolean;
}

/** Verifies a repository and prints a human or machine-readable result. */
export async function verifyRepository(
	options: VerifyOptions,
): Promise<number> {
	const requested: string[] = [];
	const fetcher = httpsFetcher(options.metadataBase, options.targetsBase, (p) =>
		requested.push(p),
	);

	// The pinned root is the one input a verifier must obtain out of band. Fetching
	// it over the same channel is a convenience for a first look, not a trust
	// bootstrap -- a real verifier pins it.
	const rootUrl =
		options.rootPath ??
		resolveObjectUrl(options.metadataBase, options.targetsBase, "1.root.json");
	let bootstrapRoot: Uint8Array;
	try {
		const response = await fetch(rootUrl);
		if (!response.ok) {
			console.error(`could not fetch the pinned root: HTTP ${response.status}`);
			return 2;
		}
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (bytes.byteLength > DEFAULT_MAX_METADATA_BYTES) {
			console.error("pinned root exceeds the metadata byte ceiling");
			return 2;
		}
		bootstrapRoot = bytes;
	} catch (error) {
		console.error(
			`could not fetch the pinned root: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 2;
	}

	const result = await updateTufRepository({
		fetcher,
		bootstrapRoot,
		trustStore: openFileTrustStore(options.storePath),
		now: new Date(),
	});

	if (options.json) {
		console.log(
			JSON.stringify(
				result.ok
					? { accepted: true, requested, ...result.value }
					: {
							accepted: false,
							requested,
							reason: (result as { reason: string }).reason,
							detail: (result as { detail: unknown }).detail,
						},
				null,
				2,
			),
		);
		return result.ok ? 0 : 1;
	}

	if (!result.ok) {
		const failure = result as unknown as { reason: string; detail: unknown };
		console.log(`REJECTED: ${failure.reason}`);
		console.log(`  detail: ${JSON.stringify(failure.detail)}`);
		console.log(`  fetched ${requested.length} object(s) before rejecting`);
		return 1;
	}

	const value = result.value;
	console.log("ACCEPTED");
	console.log(`  fetched ${requested.length} object(s)`);
	console.log(`  evaluated at   ${value.evaluatedAt}`);
	console.log(`  fingerprint    ${value.fingerprint}`);
	const advisories = value.advisories ?? [];
	console.log(
		`  advisories     ${advisories.length === 0 ? "none" : JSON.stringify(advisories)}`,
	);
	// RoleStatus is a discriminated union: a verified role carries a version, a
	// failed one carries a reason, and a never-checked one carries neither. Printing
	// them the same way would erase exactly the three-state distinction the client
	// preserves, so each arm is rendered on its own terms.
	for (const status of value.roleStatuses ?? []) {
		const name = String(status.roleName).padEnd(24);
		if (status.state === "failed") {
			console.log(`    ${name} failed (${status.reason})`);
		} else if ("version" in status && status.version !== undefined) {
			console.log(`    ${name} ${status.state} (v${status.version})`);
		} else {
			console.log(`    ${name} ${status.state}`);
		}
	}
	return 0;
}
