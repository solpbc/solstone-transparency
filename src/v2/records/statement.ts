// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/** Strict in-toto Statement v1 admission and SHA-256 subject binding. */

import { admitTufJson } from "../tuf/admission";
import { type TufJsonValue, type TufResult, rejection } from "../tuf/outcome";
import { validateTargetPath } from "../tuf/role-graph";

export const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1";

export interface InTotoSubject {
	name: string;
	digest: Readonly<Record<string, string>>;
}

export interface InTotoStatementV1 {
	type: typeof IN_TOTO_STATEMENT_V1;
	subject: readonly InTotoSubject[];
	predicateType: string;
	predicate: TufJsonValue;
	selfDeclaredRole?: string;
	selfDeclaredSigner?: string;
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

function parseSubject(value: unknown, index: number): TufResult<InTotoSubject> {
	const path = ["subject", String(index)];
	if (!isRecord(value))
		return malformed(path, "a subject object", typeName(value));
	if (typeof value.name !== "string")
		return malformed(
			[...path, "name"],
			"a subject name string",
			typeName(value.name),
		);
	const safeName = validateTargetPath(value.name);
	if (!safeName.ok) return safeName;
	if (!isRecord(value.digest))
		return malformed(
			[...path, "digest"],
			"a digest object",
			typeName(value.digest),
		);
	const digest: Record<string, string> = {};
	for (const [algorithm, encoded] of Object.entries(value.digest)) {
		if (typeof encoded !== "string")
			return malformed(
				[...path, "digest", algorithm],
				"a digest string",
				typeName(encoded),
			);
		digest[algorithm] = encoded;
	}
	return { ok: true, value: { name: safeName.value, digest } };
}

export function parseInTotoStatementV1(
	payload: Uint8Array,
): TufResult<InTotoStatementV1> {
	const admitted = admitTufJson(payload);
	if (!admitted.ok) return admitted;
	const value = admitted.value;
	if (!isRecord(value))
		return malformed([], "an in-toto Statement object", typeName(value));
	if (value._type !== IN_TOTO_STATEMENT_V1) {
		return rejection("metadata-type-mismatch", {
			path: ["_type"],
			expected: IN_TOTO_STATEMENT_V1,
			observed:
				typeof value._type === "string" ? value._type : typeName(value._type),
		});
	}
	if (!Array.isArray(value.subject))
		return malformed(["subject"], "a subject array", typeName(value.subject));
	if (typeof value.predicateType !== "string")
		return malformed(
			["predicateType"],
			"a predicateType string",
			typeName(value.predicateType),
		);
	if (!("predicate" in value))
		return malformed(["predicate"], "a predicate value", "missing");
	const subject: InTotoSubject[] = [];
	for (const [index, entry] of value.subject.entries()) {
		const parsed = parseSubject(entry, index);
		if (!parsed.ok) return parsed;
		subject.push(parsed.value);
	}
	if (value.role !== undefined && typeof value.role !== "string")
		return malformed(
			["role"],
			"an informational role string",
			typeName(value.role),
		);
	if (value.signer !== undefined && typeof value.signer !== "string")
		return malformed(
			["signer"],
			"an informational signer string",
			typeName(value.signer),
		);
	return {
		ok: true,
		value: {
			type: IN_TOTO_STATEMENT_V1,
			subject,
			predicateType: value.predicateType,
			predicate: value.predicate,
			selfDeclaredRole: value.role,
			selfDeclaredSigner: value.signer,
		},
	};
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/** Every subject must have a matching, supported SHA-256 binding; unsupported-only sets fail closed. */
export async function verifyStatementSubjects(
	statement: InTotoStatementV1,
	subjectBytes: ReadonlyMap<string, Uint8Array>,
): Promise<TufResult<undefined>> {
	if (statement.subject.length === 0) {
		return rejection("subject-mismatch", {
			path: ["subject"],
			expected: "at least one SHA-256-bound subject",
			observed: 0,
		});
	}
	for (const [index, subject] of statement.subject.entries()) {
		const expected = subject.digest.sha256;
		const bytes = subjectBytes.get(subject.name);
		if (
			expected === undefined ||
			!/^[0-9a-f]{64}$/.test(expected) ||
			bytes === undefined
		) {
			return rejection("subject-mismatch", {
				path: ["subject", String(index)],
				expected: "a supported SHA-256 digest and supplied subject bytes",
				observed: {
					name: subject.name,
					digestAlgorithms: Object.keys(subject.digest),
					bytesSupplied: bytes !== undefined,
				},
			});
		}
		const actual = bytesToHex(
			new Uint8Array(
				await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
			),
		);
		if (actual !== expected) {
			return rejection("subject-mismatch", {
				path: ["subject", String(index), "digest", "sha256"],
				expected,
				observed: actual,
				name: subject.name,
			});
		}
	}
	return { ok: true, value: undefined };
}
