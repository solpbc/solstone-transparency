// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import {
	type JsonPath,
	type TufFailure,
	type TufResult,
	rejection,
} from "./outcome";

function compareCodePoints(left: string, right: string): number {
	let leftIndex = 0;
	let rightIndex = 0;
	while (leftIndex < left.length && rightIndex < right.length) {
		const leftPoint = left.codePointAt(leftIndex);
		const rightPoint = right.codePointAt(rightIndex);
		if (leftPoint === undefined || rightPoint === undefined) break;
		if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
		leftIndex += leftPoint > 0xffff ? 2 : 1;
		rightIndex += rightPoint > 0xffff ? 2 : 1;
	}
	return leftIndex === left.length ? (rightIndex === right.length ? 0 : -1) : 1;
}

function unpairedSurrogate(
	value: string,
): { index: number; codeUnit: string } | undefined {
	for (let index = 0; index < value.length; index++) {
		const codeUnit = value.charCodeAt(index);
		if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff)) {
				return { index, codeUnit: `U+${codeUnit.toString(16).toUpperCase()}` };
			}
			index++;
			continue;
		}
		if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
			return { index, codeUnit: `U+${codeUnit.toString(16).toUpperCase()}` };
		}
	}
	return undefined;
}

function escapeString(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function encodeValue(
	value: unknown,
	path: JsonPath,
	ancestors: WeakSet<object>,
): string | TufFailure {
	if (value === null) return "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "string") {
		const invalid = unpairedSurrogate(value);
		if (invalid !== undefined) {
			return rejection("unpaired-surrogate", {
				path,
				expected: "paired UTF-16 surrogate code units",
				observed: invalid.codeUnit,
				offset: invalid.index,
			});
		}
		return `"${escapeString(value)}"`;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			return rejection("non-finite-number", {
				path,
				expected: "a finite JSON number",
				observed: String(value),
			});
		}
		if (!Number.isInteger(value)) {
			return rejection("non-integer-number", {
				path,
				expected: "an integer JSON number",
				observed: String(value),
			});
		}
		return String(value);
	}
	if (value === undefined) {
		return rejection("undefined-value", {
			path,
			expected: "a defined JSON value",
			observed: "undefined",
		});
	}
	if (typeof value !== "object") {
		return rejection("malformed", {
			path,
			expected: "a JSON-compatible value",
			observed: typeName(value),
		});
	}
	if (ancestors.has(value)) {
		return rejection("malformed", {
			path,
			expected: "an acyclic JSON value",
			observed: "cyclic object",
		});
	}

	ancestors.add(value);
	let encoded: string | TufFailure;
	if (Array.isArray(value)) {
		const parts: string[] = [];
		for (let index = 0; index < value.length; index++) {
			const part = encodeValue(
				value[index],
				[...path, String(index)],
				ancestors,
			);
			if (typeof part !== "string") {
				ancestors.delete(value);
				return part;
			}
			parts.push(part);
		}
		encoded = `[${parts.join(",")}]`;
	} else {
		const object = value as Record<string, unknown>;
		const keys = Object.keys(object).sort(compareCodePoints);
		const parts: string[] = [];
		for (const key of keys) {
			const invalidKey = unpairedSurrogate(key);
			if (invalidKey !== undefined) {
				ancestors.delete(value);
				return rejection("unpaired-surrogate", {
					path: [...path, key],
					expected: "paired UTF-16 surrogate code units in an object key",
					observed: invalidKey.codeUnit,
					offset: invalidKey.index,
				});
			}
			const encodedValue = encodeValue(object[key], [...path, key], ancestors);
			if (typeof encodedValue !== "string") {
				ancestors.delete(value);
				return encodedValue;
			}
			parts.push(`"${escapeString(key)}":${encodedValue}`);
		}
		encoded = `{${parts.join(",")}}`;
	}
	ancestors.delete(value);
	return encoded;
}

/**
 * Canonical TUF JSON as compact UTF-8 bytes, without a trailing newline.
 * Call only with an admitted, depth-bounded value; admission owns hostile-depth handling.
 */
export function canonicalizeTufJson(value: unknown): TufResult<Uint8Array> {
	const encoded = encodeValue(value, [], new WeakSet<object>());
	if (typeof encoded !== "string") return encoded;
	return { ok: true, value: new TextEncoder().encode(encoded) };
}
