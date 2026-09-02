// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import {
	type JsonPath,
	type TufFailure,
	type TufJsonValue,
	type TufResult,
	rejection,
} from "./outcome";

export const DEFAULT_MAX_METADATA_BYTES = 1_048_576;
export const DEFAULT_MAX_JSON_DEPTH = 32;

export interface TufAdmissionLimits {
	maxBytes?: number;
	maxDepth?: number;
}

type ArrayFrame = {
	kind: "array";
	path: JsonPath;
	state: "value-or-end" | "value-required" | "comma-or-end";
	nextIndex: number;
};

type ObjectFrame = {
	kind: "object";
	path: JsonPath;
	state: "key-or-end" | "key-required" | "colon" | "value" | "comma-or-end";
	keys: Map<string, number>;
	pendingKey?: string;
};

type Frame = ArrayFrame | ObjectFrame;

function isWhitespace(char: string | undefined): boolean {
	return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function isDigit(char: string | undefined): boolean {
	return char !== undefined && char >= "0" && char <= "9";
}

function isHex(char: string | undefined): boolean {
	return (
		char !== undefined &&
		((char >= "0" && char <= "9") ||
			(char >= "a" && char <= "f") ||
			(char >= "A" && char <= "F"))
	);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

class JsonAdmissionScanner {
	private readonly stack: Frame[] = [];
	private index = 0;
	private rootStarted = false;
	private rootComplete = false;

	constructor(
		private readonly text: string,
		private readonly maxDepth: number,
	) {}

	scan(): TufResult<undefined> {
		this.skipWhitespace();
		if (this.index === this.text.length) {
			return this.malformed([], "one JSON root value", "end of input");
		}

		while (true) {
			this.skipWhitespace();
			if (this.rootComplete) {
				if (this.index === this.text.length)
					return { ok: true, value: undefined };
				return this.malformed(
					[],
					"only trailing JSON whitespace",
					this.describeCurrent(),
				);
			}

			const frame = this.stack.at(-1);
			if (frame === undefined) {
				if (this.rootStarted) {
					return this.malformed(
						[],
						"only one JSON root value",
						this.describeCurrent(),
					);
				}
				this.rootStarted = true;
				const valueResult = this.scanValue([]);
				if (!valueResult.ok) return valueResult;
				continue;
			}

			if (frame.kind === "array") {
				if (frame.state === "comma-or-end") {
					if (this.current() === ",") {
						this.index++;
						frame.state = "value-required";
						continue;
					}
					if (this.current() === "]") {
						this.index++;
						this.stack.pop();
						this.completeValue();
						continue;
					}
					return this.malformed(
						frame.path,
						"a comma or closing ]",
						this.describeCurrent(),
					);
				}
				if (frame.state === "value-or-end" && this.current() === "]") {
					this.index++;
					this.stack.pop();
					this.completeValue();
					continue;
				}
				const valueResult = this.scanValue([
					...frame.path,
					String(frame.nextIndex),
				]);
				if (!valueResult.ok) return valueResult;
				continue;
			}

			if (frame.state === "comma-or-end") {
				if (this.current() === ",") {
					this.index++;
					frame.state = "key-required";
					continue;
				}
				if (this.current() === "}") {
					this.index++;
					this.stack.pop();
					this.completeValue();
					continue;
				}
				return this.malformed(
					frame.path,
					"a comma or closing }",
					this.describeCurrent(),
				);
			}
			if (frame.state === "colon") {
				if (this.current() !== ":") {
					return this.malformed(
						frame.path,
						"a colon after an object key",
						this.describeCurrent(),
					);
				}
				this.index++;
				frame.state = "value";
				continue;
			}
			if (frame.state === "value") {
				const pendingKey = frame.pendingKey;
				if (pendingKey === undefined) {
					return this.malformed(
						frame.path,
						"an object key before its value",
						"missing key",
					);
				}
				const valueResult = this.scanValue([...frame.path, pendingKey]);
				if (!valueResult.ok) return valueResult;
				continue;
			}
			if (frame.state === "key-or-end" && this.current() === "}") {
				this.index++;
				this.stack.pop();
				this.completeValue();
				continue;
			}
			if (this.current() !== '"') {
				return this.malformed(
					frame.path,
					"a double-quoted object key",
					this.describeCurrent(),
				);
			}
			const keyOffset = this.index;
			const keyResult = this.scanString(frame.path);
			if (!keyResult.ok) return keyResult;
			const firstOffset = frame.keys.get(keyResult.value);
			if (firstOffset !== undefined) {
				return rejection("duplicate-key", {
					path: frame.path,
					expected: "an object key not previously present in this object",
					observed: keyResult.value,
					key: keyResult.value,
					firstOffset,
					duplicateOffset: keyOffset,
				});
			}
			frame.keys.set(keyResult.value, keyOffset);
			frame.pendingKey = keyResult.value;
			frame.state = "colon";
		}
	}

	private scanValue(path: JsonPath): TufResult<undefined> {
		const char = this.current();
		if (char === "{") return this.openObject(path);
		if (char === "[") return this.openArray(path);
		if (char === '"') {
			const stringResult = this.scanString(path);
			if (!stringResult.ok) return stringResult;
			this.completeValue();
			return { ok: true, value: undefined };
		}
		if (char === "t") return this.scanKeyword("true", path);
		if (char === "f") return this.scanKeyword("false", path);
		if (char === "n") return this.scanKeyword("null", path);
		if (char === "-" || isDigit(char)) return this.scanNumber(path);
		return this.malformed(path, "a JSON value", this.describeCurrent());
	}

	private openObject(path: JsonPath): TufResult<undefined> {
		const depth = this.stack.length + 1;
		if (depth > this.maxDepth) {
			return rejection("too-deep", {
				path,
				expected: this.maxDepth,
				observed: depth,
				maxDepth: this.maxDepth,
				observedDepth: depth,
				offset: this.index,
			});
		}
		this.index++;
		this.stack.push({
			kind: "object",
			path,
			state: "key-or-end",
			keys: new Map(),
		});
		return { ok: true, value: undefined };
	}

	private openArray(path: JsonPath): TufResult<undefined> {
		const depth = this.stack.length + 1;
		if (depth > this.maxDepth) {
			return rejection("too-deep", {
				path,
				expected: this.maxDepth,
				observed: depth,
				maxDepth: this.maxDepth,
				observedDepth: depth,
				offset: this.index,
			});
		}
		this.index++;
		this.stack.push({
			kind: "array",
			path,
			state: "value-or-end",
			nextIndex: 0,
		});
		return { ok: true, value: undefined };
	}

	private scanKeyword(keyword: string, path: JsonPath): TufResult<undefined> {
		if (this.text.slice(this.index, this.index + keyword.length) !== keyword) {
			return this.malformed(path, keyword, this.describeCurrent());
		}
		this.index += keyword.length;
		this.completeValue();
		return { ok: true, value: undefined };
	}

	private scanNumber(path: JsonPath): TufResult<undefined> {
		const start = this.index;
		if (this.current() === "-") this.index++;
		if (this.current() === "0") {
			this.index++;
		} else if (isDigit(this.current()) && this.current() !== "0") {
			while (isDigit(this.current())) this.index++;
		} else {
			return this.malformed(path, "a digit after -", this.describeCurrent());
		}

		let hasDecimalSyntax = false;
		if (this.current() === ".") {
			hasDecimalSyntax = true;
			this.index++;
			if (!isDigit(this.current())) {
				return this.malformed(
					path,
					"a digit after decimal point",
					this.describeCurrent(),
				);
			}
			while (isDigit(this.current())) this.index++;
		}
		if (this.current() === "e" || this.current() === "E") {
			hasDecimalSyntax = true;
			this.index++;
			if (this.current() === "+" || this.current() === "-") this.index++;
			if (!isDigit(this.current())) {
				return this.malformed(
					path,
					"a digit in exponent",
					this.describeCurrent(),
				);
			}
			while (isDigit(this.current())) this.index++;
		}

		const token = this.text.slice(start, this.index);
		if (hasDecimalSyntax) {
			return rejection("non-integer-number", {
				path,
				expected: "an integer token without decimal or exponent syntax",
				observed: token,
				token,
				offset: start,
			});
		}
		const parsed = Number(token);
		let exact: bigint;
		try {
			exact = BigInt(token);
		} catch {
			return this.malformed(path, "an integer JSON number", token);
		}
		if (
			!Number.isFinite(parsed) ||
			!Number.isInteger(parsed) ||
			BigInt(parsed) !== exact
		) {
			return rejection("integer-not-round-trippable", {
				path,
				expected: "an integer exactly representable by JavaScript Number",
				observed: token,
				token,
				parsed: String(parsed),
				offset: start,
			});
		}
		this.completeValue();
		return { ok: true, value: undefined };
	}

	private scanString(path: JsonPath): TufResult<string> {
		const start = this.index;
		this.index++;
		let decoded = "";
		while (this.index < this.text.length) {
			const char = this.current();
			if (char === '"') {
				this.index++;
				return { ok: true, value: decoded };
			}
			if (char === "\\") {
				const escapeOffset = this.index;
				this.index++;
				const escapeChar = this.current();
				if (escapeChar === undefined) {
					return this.malformed(path, "a JSON string escape", "end of input");
				}
				if (escapeChar === "u") {
					const unitResult = this.scanUnicodeEscape(path, escapeOffset);
					if (!unitResult.ok) return unitResult;
					decoded += unitResult.value;
					continue;
				}
				const escaped = {
					'"': '"',
					"\\": "\\",
					"/": "/",
					b: "\b",
					f: "\f",
					n: "\n",
					r: "\r",
					t: "\t",
				}[escapeChar];
				if (escaped === undefined) {
					return this.malformed(
						path,
						"a valid JSON string escape",
						`\\${escapeChar}`,
					);
				}
				decoded += escaped;
				this.index++;
				continue;
			}
			if (char === undefined || char.charCodeAt(0) < 0x20) {
				return this.malformed(
					path,
					"a non-control JSON string character",
					this.describeCurrent(),
				);
			}
			const codeUnit = char.charCodeAt(0);
			if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
				const next = this.text.charCodeAt(this.index + 1);
				if (!(next >= 0xdc00 && next <= 0xdfff)) {
					return rejection("unpaired-surrogate", {
						path,
						expected: "a low surrogate after a high surrogate",
						observed: `U+${codeUnit.toString(16).toUpperCase()}`,
						offset: this.index,
					});
				}
				decoded += char + this.text[this.index + 1];
				this.index += 2;
				continue;
			}
			if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
				return rejection("unpaired-surrogate", {
					path,
					expected: "a high surrogate before a low surrogate",
					observed: `U+${codeUnit.toString(16).toUpperCase()}`,
					offset: this.index,
				});
			}
			decoded += char;
			this.index++;
		}
		return this.malformed(
			path,
			"a closing double quote",
			"end of input",
			start,
		);
	}

	private scanUnicodeEscape(
		path: JsonPath,
		escapeOffset: number,
	): TufResult<string> {
		const hexStart = this.index + 1;
		const digits = this.text.slice(hexStart, hexStart + 4);
		if (digits.length !== 4 || ![...digits].every(isHex)) {
			return this.malformed(
				path,
				"four hexadecimal digits after \\u",
				digits,
				escapeOffset,
			);
		}
		const codeUnit = Number.parseInt(digits, 16);
		this.index = hexStart + 4;
		if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
			if (this.text.slice(this.index, this.index + 2) !== "\\u") {
				return rejection("unpaired-surrogate", {
					path,
					expected: "an immediately following low-surrogate \\u escape",
					observed: `U+${codeUnit.toString(16).toUpperCase()}`,
					offset: escapeOffset,
				});
			}
			const lowDigits = this.text.slice(this.index + 2, this.index + 6);
			if (lowDigits.length !== 4 || ![...lowDigits].every(isHex)) {
				return rejection("unpaired-surrogate", {
					path,
					expected: "an immediately following low-surrogate \\u escape",
					observed: `U+${codeUnit.toString(16).toUpperCase()}`,
					offset: escapeOffset,
				});
			}
			const low = Number.parseInt(lowDigits, 16);
			if (low < 0xdc00 || low > 0xdfff) {
				return rejection("unpaired-surrogate", {
					path,
					expected: "a low-surrogate \\u escape",
					observed: `U+${low.toString(16).toUpperCase()}`,
					offset: escapeOffset,
				});
			}
			this.index += 6;
			return { ok: true, value: String.fromCharCode(codeUnit, low) };
		}
		if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
			return rejection("unpaired-surrogate", {
				path,
				expected: "a high-surrogate \\u escape before a low surrogate",
				observed: `U+${codeUnit.toString(16).toUpperCase()}`,
				offset: escapeOffset,
			});
		}
		return { ok: true, value: String.fromCharCode(codeUnit) };
	}

	private completeValue(): void {
		const parent = this.stack.at(-1);
		if (parent === undefined) {
			this.rootComplete = true;
			return;
		}
		if (parent.kind === "array") {
			parent.nextIndex++;
			parent.state = "comma-or-end";
			return;
		}
		parent.pendingKey = undefined;
		parent.state = "comma-or-end";
	}

	private skipWhitespace(): void {
		while (isWhitespace(this.current())) this.index++;
	}

	private current(): string | undefined {
		return this.text[this.index];
	}

	private describeCurrent(): string {
		const char = this.current();
		return char === undefined ? "end of input" : JSON.stringify(char);
	}

	private malformed(
		path: JsonPath,
		expected: string,
		observed: string,
		offset = this.index,
	): TufFailure<"malformed"> {
		return rejection("malformed", { path, expected, observed, offset });
	}
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.byteLength !== right.byteLength) return false;
	for (let index = 0; index < left.byteLength; index++) {
		if (left[index] !== right[index]) return false;
	}
	return true;
}

/**
 * Admits a bounded, unambiguous JSON byte sequence before parsing it exactly once.
 * Checked in this order, with each earlier check short-circuiting later checks:
 * 1. Raw byte length against the ceiling -> oversized.
 * 2. Fatal UTF-8 decoding -> invalid-encoding.
 * 3. Decode/re-encode byte-for-byte round trip -> byte-length-changed when the
 *    length differs, otherwise invalid-encoding when same-length bytes differ.
 * 4. Stack-based JSON grammar, string-surrogate, and number scanning -> malformed,
 *    unpaired-surrogate, non-integer-number, or integer-not-round-trippable.
 *    Every container opening checks depth before that container's content, so
 *    too-deep wins over a duplicate key or syntax error inside that container.
 * 5. Decoded object-key uniqueness -> duplicate-key.
 * 6. One JSON.parse over accepted text -> malformed on unexpected disagreement.
 * Expected malformed input is returned as a named rejection rather than thrown.
 */
export function admitTufJson(
	bytes: Uint8Array,
	limits: TufAdmissionLimits = {},
): TufResult<TufJsonValue> {
	const maxBytes = limits.maxBytes ?? DEFAULT_MAX_METADATA_BYTES;
	const maxDepth = limits.maxDepth ?? DEFAULT_MAX_JSON_DEPTH;
	if (bytes.byteLength > maxBytes) {
		return rejection("oversized", {
			path: [],
			expected: maxBytes,
			observed: bytes.byteLength,
			maxBytes,
			observedBytes: bytes.byteLength,
		});
	}

	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch (error) {
		return rejection("invalid-encoding", {
			path: [],
			expected: "valid UTF-8 bytes",
			observed: error instanceof Error ? error.name : typeName(error),
			inputBytes: bytes.byteLength,
		});
	}

	const reencoded = new TextEncoder().encode(text);
	if (reencoded.byteLength !== bytes.byteLength) {
		return rejection("byte-length-changed", {
			path: [],
			expected: bytes.byteLength,
			observed: reencoded.byteLength,
			originalBytes: bytes.byteLength,
			reencodedBytes: reencoded.byteLength,
		});
	}
	if (!sameBytes(bytes, reencoded)) {
		return rejection("invalid-encoding", {
			path: [],
			expected: "UTF-8 bytes stable under fatal decode and re-encode",
			observed: "same-length byte sequence changed",
			inputBytes: bytes.byteLength,
		});
	}

	const scanner = new JsonAdmissionScanner(text, maxDepth);
	const scanned = scanner.scan();
	if (!scanned.ok) return scanned;
	try {
		return { ok: true, value: JSON.parse(text) as TufJsonValue };
	} catch (error) {
		return rejection("malformed", {
			path: [],
			expected: "JSON.parse to accept scanner-validated JSON",
			observed: error instanceof Error ? error.name : typeName(error),
		});
	}
}
