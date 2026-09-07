// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import type { Ed25519SigningKey } from "./ed25519";
import { loadEd25519SigningKeyEntry } from "./keyset";
import { type TufResult, rejection } from "./outcome";

export interface IncrementalSigningKeys {
	targetsSoftware: Ed25519SigningKey;
	snapshot: Ed25519SigningKey;
	timestamp: Ed25519SigningKey;
	producerRelease: Ed25519SigningKey;
}

export const RELEASE_SIGNING_KEY_FIELDS = [
	"targets-software",
	"snapshot",
	"timestamp",
	"producer.release",
] as const;
const KEY_ENTRY_FIELDS = ["keyid", "public", "pkcs8"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function exactFields(
	value: Record<string, unknown>,
	expected: readonly string[],
	path: readonly string[],
): TufResult<undefined> {
	const keys = Object.keys(value);
	if (
		keys.length !== expected.length ||
		keys.some((key) => !expected.includes(key))
	) {
		return rejection("malformed", {
			path,
			expected: expected,
			observed: keys,
		});
	}
	return { ok: true, value: undefined };
}

async function loadRequiredKey(
	json: Record<string, unknown>,
	field: string,
): Promise<TufResult<Ed25519SigningKey>> {
	const entry = json[field];
	if (!isRecord(entry)) {
		return rejection("malformed", {
			path: [field],
			expected: "a key entry with exactly keyid, public, and pkcs8",
			observed: typeName(entry),
		});
	}
	const fields = exactFields(entry, KEY_ENTRY_FIELDS, [field]);
	if (!fields.ok) return fields;
	return loadEd25519SigningKeyEntry(entry, [field]);
}

async function loadExactKeySet(
	json: unknown,
	fields: readonly string[],
	label: string,
): Promise<TufResult<Readonly<Record<string, Ed25519SigningKey>>>> {
	if (!isRecord(json)) {
		return rejection("malformed", {
			path: [],
			expected: `an exact ${label} key-set object`,
			observed: typeName(json),
		});
	}
	const topLevel = exactFields(json, fields, []);
	if (!topLevel.ok) return topLevel;
	const keys: Record<string, Ed25519SigningKey> = {};
	for (const field of fields) {
		const loaded = await loadRequiredKey(json, field);
		if (!loaded.ok) return loaded;
		keys[field] = loaded.value;
	}
	return { ok: true, value: keys };
}

/** Loads the deliberately narrow, exact signing-key shape for one release preparation. */
export async function loadIncrementalReleaseSigningKeys(
	json: unknown,
): Promise<TufResult<IncrementalSigningKeys>> {
	const loaded = await loadExactKeySet(
		json,
		RELEASE_SIGNING_KEY_FIELDS,
		"incremental release",
	);
	if (!loaded.ok) return loaded;
	return { ok: true, value: incrementalSigningKeys(loaded.value) };
}

/** Maps an already validated exact role map to the release library's field names. */
export function incrementalSigningKeys(
	keys: Readonly<Record<string, Ed25519SigningKey>>,
): IncrementalSigningKeys {
	const targetsSoftware = keys["targets-software"];
	const snapshot = keys.snapshot;
	const timestamp = keys.timestamp;
	const producerRelease = keys["producer.release"];
	if (
		targetsSoftware === undefined ||
		snapshot === undefined ||
		timestamp === undefined ||
		producerRelease === undefined
	) {
		throw new Error(
			"exact incremental release key-set unexpectedly omitted a key",
		);
	}

	return { targetsSoftware, snapshot, timestamp, producerRelease };
}

/** Loads exactly one timestamp signing key for a timestamp-only refresh. */
export async function loadTimestampSigningKey(
	json: unknown,
): Promise<TufResult<Ed25519SigningKey>> {
	const loaded = await loadExactKeySet(
		json,
		["timestamp"],
		"timestamp renewal",
	);
	if (!loaded.ok) return loaded;
	const timestamp = loaded.value.timestamp;
	if (timestamp === undefined)
		throw new Error("exact timestamp key-set unexpectedly omitted timestamp");
	return { ok: true, value: timestamp };
}

/** Loads the exact signing-key shape approved for the selected metadata renewal. */
export type MetadataRenewalRole =
	| "snapshot"
	| "targets"
	| "targets-software"
	| "targets-services"
	| "targets-verification"
	| "targets-legacy";

export function metadataRenewalKeyFields(
	roleName: MetadataRenewalRole,
): readonly string[] {
	return roleName === "snapshot"
		? ["snapshot", "timestamp"]
		: [roleName, "snapshot", "timestamp"];
}

export async function loadMetadataRenewalSigningKeys(
	json: unknown,
	roleName: MetadataRenewalRole,
): Promise<TufResult<Readonly<Record<string, Ed25519SigningKey>>>> {
	return loadExactKeySet(
		json,
		metadataRenewalKeyFields(roleName),
		`${roleName} renewal`,
	);
}
