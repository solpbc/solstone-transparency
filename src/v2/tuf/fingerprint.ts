// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { canonicalizeTufJson } from "./canonical";
import type { RoleStatus } from "./client-result";
import { type TufJsonValue, type TufResult, rejection } from "./outcome";

export const TUF_CLIENT_FINGERPRINT_DOMAIN =
	"solstone-transparency:tuf-client-fingerprint:v1";

export interface FingerprintMetadata {
	version: number;
	signed: Record<string, TufJsonValue>;
}

export interface FingerprintTarget {
	length: number;
	hashes: Readonly<Record<string, string>>;
}

export interface TufFingerprintView {
	metadata: Readonly<Record<string, FingerprintMetadata>>;
	targets: Readonly<
		Record<string, Readonly<Record<string, FingerprintTarget>>>
	>;
	roleStatuses: readonly RoleStatus[];
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function fingerprintValue(view: TufFingerprintView): TufJsonValue {
	const metadata: Record<string, TufJsonValue> = {};
	for (const [roleName, value] of Object.entries(view.metadata)) {
		metadata[roleName] = { version: value.version, signed: value.signed };
	}
	const targets: Record<string, TufJsonValue> = {};
	for (const [roleName, roleTargets] of Object.entries(view.targets)) {
		const paths: Record<string, TufJsonValue> = {};
		for (const [targetPath, target] of Object.entries(roleTargets)) {
			paths[targetPath] = {
				length: target.length,
				hashes: { ...target.hashes },
			};
		}
		targets[roleName] = paths;
	}
	const statuses: Record<string, TufJsonValue> = {};
	for (const status of view.roleStatuses) {
		statuses[status.roleName] =
			status.state === "verified"
				? { state: status.state, version: status.version }
				: status.state === "failed"
					? { state: status.state, reason: status.reason }
					: { state: status.state };
	}
	return {
		metadata,
		targets,
		roleStatuses: statuses,
	};
}

/** Fingerprints only canonical accepted metadata, recorded target descriptors, and states. */
export async function computeTufFingerprint(
	view: TufFingerprintView,
): Promise<TufResult<string>> {
	const canonical = canonicalizeTufJson(fingerprintValue(view));
	if (!canonical.ok) return canonical;
	const domain = new TextEncoder().encode(`${TUF_CLIENT_FINGERPRINT_DOMAIN}\0`);
	const input = new Uint8Array(domain.byteLength + canonical.value.byteLength);
	input.set(domain);
	input.set(canonical.value, domain.byteLength);
	try {
		const digest = await crypto.subtle.digest("SHA-256", input);
		return { ok: true, value: bytesToHex(new Uint8Array(digest)) };
	} catch (error) {
		return rejection("malformed", {
			path: [],
			expected: "canonical fingerprint bytes accepted by SHA-256",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}
