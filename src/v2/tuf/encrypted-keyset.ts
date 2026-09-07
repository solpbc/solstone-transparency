// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { type PassphraseSource, readCeremonyKey } from "../ceremony-key";
import type { Ed25519SigningKey } from "./ed25519";
import { type TufResult, rejection } from "./outcome";

/** Production preparation inputs contain only exact role-to-encrypted-file paths. */
export async function loadEncryptedSigningKeys(
	json: unknown,
	fields: readonly string[],
	source: PassphraseSource,
): Promise<TufResult<Readonly<Record<string, Ed25519SigningKey>>>> {
	if (json === null || typeof json !== "object" || Array.isArray(json)) {
		return rejection("malformed", {
			path: [],
			expected: "an exact role-to-encrypted-key-path object",
			observed: "invalid key map",
		});
	}
	const paths = json as Record<string, unknown>;
	const actual = Object.keys(paths);
	if (
		actual.length !== fields.length ||
		actual.some((field) => !fields.includes(field))
	) {
		return rejection("malformed", {
			path: [],
			expected: fields,
			observed: "unexpected or missing signing roles",
		});
	}
	// Admit every value before opening any file or requesting any passphrase.
	for (const field of fields) {
		if (typeof paths[field] !== "string" || paths[field].trim() === "") {
			return rejection("malformed", {
				path: [field],
				expected:
					"a non-empty encrypted PKCS#8 file path; plaintext key JSON is refused",
				observed: "invalid encrypted key path",
			});
		}
	}
	const keys: Record<string, Ed25519SigningKey> = {};
	for (const field of fields) {
		try {
			keys[field] = await readCeremonyKey(paths[field] as string, source);
		} catch {
			// File-system and provider failures may include supplied secret values.
			return rejection("malformed-key", {
				path: [field],
				expected: "an encrypted Ed25519 PKCS#8 key and its valid passphrase",
				observed: "encrypted-key-read-failed",
			});
		}
	}
	return { ok: true, value: keys };
}
