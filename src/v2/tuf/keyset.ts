// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Multi-role TUF and DSSE signing key set parsing, loading, and synthetic generation.
 * Reconstructs Ed25519SigningKeys from PKCS8-encoded private keys with cross-checked key IDs.
 */

import type { RepositorySigningKeys } from "./builder";
import {
	type Ed25519SigningKey,
	computeKeyId,
	generateEd25519SigningKey,
	importEd25519SigningKey,
} from "./ed25519";
import { type TufResult, rejection } from "./outcome";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";

export interface KeySetEntry {
	keyid: string;
	public: string;
	pkcs8: string;
}

export interface KeySetJson {
	root: KeySetEntry[];
	targets: KeySetEntry[];
	snapshot: KeySetEntry[];
	timestamp: KeySetEntry[];
	delegated: Record<string, KeySetEntry[]>;
	dsseSigner: KeySetEntry;
}

export interface LoadedKeySet {
	signingKeys: RepositorySigningKeys;
	dsseSigner: Ed25519SigningKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function malformed(
	path: readonly string[],
	expected: string,
	observed: unknown,
) {
	return rejection("malformed", { path, expected, observed });
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64ToBytes(
	base64: string,
	path: readonly string[],
): TufResult<Uint8Array> {
	if (
		!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
			base64,
		)
	) {
		return malformed(path, "valid standard base64", base64);
	}
	try {
		const binary = atob(base64);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return { ok: true, value: bytes };
	} catch (error) {
		return malformed(
			path,
			"valid base64 string",
			error instanceof Error ? error.name : typeName(error),
		);
	}
}

async function parseKeyEntry(
	entry: unknown,
	path: readonly string[],
): Promise<TufResult<Ed25519SigningKey>> {
	if (!isRecord(entry)) {
		return malformed(path, "a key entry object", typeName(entry));
	}
	if (typeof entry.keyid !== "string" || !/^[0-9a-f]{64}$/.test(entry.keyid)) {
		return malformed(
			[...path, "keyid"],
			"a 64-character lowercase hex key ID",
			entry.keyid,
		);
	}
	if (
		typeof entry.public !== "string" ||
		!/^[0-9a-f]{64}$/.test(entry.public)
	) {
		return malformed(
			[...path, "public"],
			"a 64-character lowercase hex public key",
			entry.public,
		);
	}
	if (typeof entry.pkcs8 !== "string" || entry.pkcs8 === "") {
		return malformed(
			[...path, "pkcs8"],
			"a base64-encoded pkcs8 private key string",
			entry.pkcs8,
		);
	}

	const pkcs8Bytes = base64ToBytes(entry.pkcs8, [...path, "pkcs8"]);
	if (!pkcs8Bytes.ok) return pkcs8Bytes;

	const privateKey = await importEd25519SigningKey(pkcs8Bytes.value);
	if (!privateKey.ok) return privateKey;

	const keyObject = {
		keytype: "ed25519" as const,
		scheme: "ed25519" as const,
		keyval: { public: entry.public },
	};

	const computedKeyId = await computeKeyId(keyObject);
	if (!computedKeyId.ok) return computedKeyId;

	if (computedKeyId.value !== entry.keyid) {
		return rejection("malformed-key", {
			path: [...path, "keyid"],
			expected: computedKeyId.value,
			observed: entry.keyid,
		});
	}

	return {
		ok: true,
		value: {
			privateKey: privateKey.value,
			keyObject,
			keyId: computedKeyId.value,
		},
	};
}

async function parseKeyArray(
	candidate: unknown,
	expectedCount: number,
	path: readonly string[],
): Promise<TufResult<Ed25519SigningKey[]>> {
	if (!Array.isArray(candidate) || candidate.length !== expectedCount) {
		return malformed(
			path,
			`an array of exactly ${expectedCount} key(s)`,
			Array.isArray(candidate) ? candidate.length : typeName(candidate),
		);
	}
	const keys: Ed25519SigningKey[] = [];
	for (const [index, entry] of candidate.entries()) {
		const parsed = await parseKeyEntry(entry, [...path, String(index)]);
		if (!parsed.ok) return parsed;
		keys.push(parsed.value);
	}
	return { ok: true, value: keys };
}

/**
 * Parses and validates an on-disk signing-key-set JSON object.
 * Reconstructs Ed25519SigningKey instances for each TUF role and the DSSE envelope signer.
 */
export async function loadRepositorySigningKeys(
	json: unknown,
): Promise<TufResult<LoadedKeySet>> {
	if (!isRecord(json)) {
		return malformed([], "a key-set object", typeName(json));
	}

	const root = await parseKeyArray(json.root, TOP_LEVEL_ROLES.root.keyCount, [
		"root",
	]);
	if (!root.ok) return root;

	const targets = await parseKeyArray(
		json.targets,
		TOP_LEVEL_ROLES.targets.keyCount,
		["targets"],
	);
	if (!targets.ok) return targets;

	const snapshot = await parseKeyArray(
		json.snapshot,
		TOP_LEVEL_ROLES.snapshot.keyCount,
		["snapshot"],
	);
	if (!snapshot.ok) return snapshot;

	const timestamp = await parseKeyArray(
		json.timestamp,
		TOP_LEVEL_ROLES.timestamp.keyCount,
		["timestamp"],
	);
	if (!timestamp.ok) return timestamp;

	if (!isRecord(json.delegated)) {
		return malformed(
			["delegated"],
			"a delegated roles object",
			typeName(json.delegated),
		);
	}

	const delegated: Record<string, Ed25519SigningKey[]> = {};
	for (const role of DELEGATED_ROLES) {
		const roleKeys = await parseKeyArray(
			json.delegated[role.name],
			role.keyCount,
			["delegated", role.name],
		);
		if (!roleKeys.ok) return roleKeys;
		delegated[role.name] = roleKeys.value;
	}

	const dsseSignerKey = await parseKeyEntry(json.dsseSigner, ["dsseSigner"]);
	if (!dsseSignerKey.ok) return dsseSignerKey;

	return {
		ok: true,
		value: {
			signingKeys: {
				root: root.value,
				targets: targets.value,
				snapshot: snapshot.value,
				timestamp: timestamp.value,
				delegated,
			},
			dsseSigner: dsseSignerKey.value,
		},
	};
}

async function exportKeyEntry(key: Ed25519SigningKey): Promise<KeySetEntry> {
	const pkcs8 = new Uint8Array(
		await crypto.subtle.exportKey("pkcs8", key.privateKey),
	);
	return {
		keyid: key.keyId,
		public: key.keyObject.keyval.public,
		pkcs8: bytesToBase64(pkcs8),
	};
}

/**
 * Generates a complete, synthetic 11-key signing key set for testing or staging.
 * Every key is freshly generated in-memory.
 */
export async function generateSyntheticKeySet(): Promise<KeySetJson> {
	const gen = async (count: number): Promise<KeySetEntry[]> => {
		const entries: KeySetEntry[] = [];
		for (let i = 0; i < count; i++) {
			const key = await generateEd25519SigningKey();
			if (!key.ok) {
				throw new Error(`synthetic key generation failed: ${key.reason}`);
			}
			entries.push(await exportKeyEntry(key.value));
		}
		return entries;
	};

	const root = await gen(TOP_LEVEL_ROLES.root.keyCount);
	const targets = await gen(TOP_LEVEL_ROLES.targets.keyCount);
	const snapshot = await gen(TOP_LEVEL_ROLES.snapshot.keyCount);
	const timestamp = await gen(TOP_LEVEL_ROLES.timestamp.keyCount);

	const delegated: Record<string, KeySetEntry[]> = {};
	for (const role of DELEGATED_ROLES) {
		delegated[role.name] = await gen(role.keyCount);
	}

	const dsseSignerKey = await generateEd25519SigningKey();
	if (!dsseSignerKey.ok) {
		throw new Error(
			`synthetic dsse key generation failed: ${dsseSignerKey.reason}`,
		);
	}
	const dsseSigner = await exportKeyEntry(dsseSignerKey.value);

	return {
		root,
		targets,
		snapshot,
		timestamp,
		delegated,
		dsseSigner,
	};
}
