// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

export interface CanonicalJsonVector {
	name: string;
	input: unknown;
	canonical_utf8_hex: string;
	canonical_sha256: string;
}

export interface KeyIdVector {
	name: string;
	key_object: {
		keytype: string;
		scheme: string;
		keyval: { public: string; [key: string]: unknown };
		[key: string]: unknown;
	};
	canonical_utf8_hex: string;
	keyid: string;
}

export interface TufConformanceVectors {
	canonical_json: CanonicalJsonVector[];
	keyid: KeyIdVector[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, label: string): string {
	if (typeof value !== "string") throw new Error(`${label} must be a string`);
	return value;
}

function hexToBytes(hex: string): Uint8Array {
	if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) {
		throw new Error("canonical_utf8_hex must be even-length hexadecimal");
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function canonicalVector(value: unknown, index: number): CanonicalJsonVector {
	if (!isRecord(value))
		throw new Error(`canonical_json[${index}] must be an object`);
	return {
		name: asString(value.name, `canonical_json[${index}].name`),
		input: value.input,
		canonical_utf8_hex: asString(
			value.canonical_utf8_hex,
			`canonical_json[${index}].canonical_utf8_hex`,
		),
		canonical_sha256: asString(
			value.canonical_sha256,
			`canonical_json[${index}].canonical_sha256`,
		),
	};
}

function keyIdVector(value: unknown, index: number): KeyIdVector {
	if (
		!isRecord(value) ||
		!isRecord(value.key_object) ||
		!isRecord(value.key_object.keyval)
	) {
		throw new Error(`keyid[${index}] must contain key_object.keyval`);
	}
	return {
		name: asString(value.name, `keyid[${index}].name`),
		key_object: {
			...value.key_object,
			keytype: asString(value.key_object.keytype, `keyid[${index}].keytype`),
			scheme: asString(value.key_object.scheme, `keyid[${index}].scheme`),
			keyval: {
				...value.key_object.keyval,
				public: asString(
					value.key_object.keyval.public,
					`keyid[${index}].keyval.public`,
				),
			},
		},
		canonical_utf8_hex: asString(
			value.canonical_utf8_hex,
			`keyid[${index}].canonical_utf8_hex`,
		),
		keyid: asString(value.keyid, `keyid[${index}].keyid`),
	};
}

async function assertDigest(
	hex: string,
	expected: string,
	label: string,
): Promise<void> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new Uint8Array(hexToBytes(hex)),
	);
	const actual = bytesToHex(new Uint8Array(digest));
	if (actual !== expected) {
		throw new Error(
			`${label} digest mismatch: expected ${expected}, got ${actual}`,
		);
	}
}

/** Loads independently generated conformance vectors and checks their own integrity. */
export async function loadTufConformanceVectors(): Promise<TufConformanceVectors> {
	const raw: unknown = await Bun.file(
		new URL("./tuf-conformance-vectors.json", import.meta.url),
	).json();
	if (
		!isRecord(raw) ||
		!Array.isArray(raw.canonical_json) ||
		!Array.isArray(raw.keyid)
	) {
		throw new Error(
			"TUF conformance vector file has an invalid top-level shape",
		);
	}
	if (raw.canonical_json.length !== 9 || raw.keyid.length !== 3) {
		throw new Error(
			"expected exactly 9 canonical_json vectors and 3 keyid vectors",
		);
	}
	const vectors = {
		canonical_json: raw.canonical_json.map(canonicalVector),
		keyid: raw.keyid.map(keyIdVector),
	};
	const names = new Set(vectors.canonical_json.map((vector) => vector.name));
	if (!names.has("astral-key-sort") || !names.has("control-chars-raw")) {
		throw new Error(
			"required astral-key-sort and control-chars-raw vectors are missing",
		);
	}
	for (const vector of vectors.canonical_json) {
		await assertDigest(
			vector.canonical_utf8_hex,
			vector.canonical_sha256,
			`canonical vector ${vector.name}`,
		);
	}
	for (const vector of vectors.keyid) {
		await assertDigest(
			vector.canonical_utf8_hex,
			vector.keyid,
			`keyid vector ${vector.name}`,
		);
	}
	return vectors;
}
