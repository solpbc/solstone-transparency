// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Release-record predicate admission and validation.
 * Represents sol pbc's assertion of built release artifacts for a product version.
 */

import {
	type TufFailure,
	type TufJsonValue,
	type TufResult,
	rejection,
} from "../tuf/outcome";

export const RELEASE_RECORD_SCHEMA = "solstone-transparency/release-record/v1";

export interface ReleaseArtifact {
	url: string;
	length: number;
	sha256: string;
}

export interface ReleaseRecordPredicate {
	_comment: readonly string[];
	schema: typeof RELEASE_RECORD_SCHEMA;
	product: string;
	version: string;
	artifacts: readonly ReleaseArtifact[];
	does_prove: readonly string[];
	does_not_prove: readonly string[];
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
): TufFailure<"malformed"> {
	return rejection("malformed", { path, expected, observed });
}

function validHash(value: unknown): value is string {
	return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validCount(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseArtifact(
	value: unknown,
	index: number,
): TufResult<ReleaseArtifact> {
	const path = ["artifacts", String(index)];
	if (
		!isRecord(value) ||
		typeof value.url !== "string" ||
		value.url === "" ||
		!validCount(value.length) ||
		!validHash(value.sha256)
	) {
		return malformed(
			path,
			"an artifact with non-empty url, non-negative length, and 64-character lowercase hex sha256",
			value,
		);
	}
	return {
		ok: true,
		value: { url: value.url, length: value.length, sha256: value.sha256 },
	};
}

/**
 * Validates a candidate release-record predicate body.
 * Fails closed on any shape or claim violation.
 */
export async function validateReleaseRecordPredicate(
	value: TufJsonValue,
): Promise<TufResult<ReleaseRecordPredicate>> {
	if (!isRecord(value)) {
		return malformed([], "a release-record object", typeName(value));
	}
	if (
		!Array.isArray(value._comment) ||
		value._comment.some((entry) => typeof entry !== "string")
	) {
		return malformed(
			["_comment"],
			"an array of explanatory strings",
			value._comment === undefined ? typeName(value._comment) : value._comment,
		);
	}
	if (value.schema !== RELEASE_RECORD_SCHEMA) {
		return malformed(["schema"], RELEASE_RECORD_SCHEMA, value.schema);
	}
	if (typeof value.product !== "string" || value.product === "") {
		return malformed(
			["product"],
			"a non-empty product string",
			typeName(value.product),
		);
	}
	if (typeof value.version !== "string" || value.version === "") {
		return malformed(
			["version"],
			"a non-empty version string",
			typeName(value.version),
		);
	}
	if (!Array.isArray(value.artifacts)) {
		return malformed(
			["artifacts"],
			"an array of release artifacts",
			typeName(value.artifacts),
		);
	}
	const artifacts: ReleaseArtifact[] = [];
	for (const [index, candidate] of value.artifacts.entries()) {
		const parsed = parseArtifact(candidate, index);
		if (!parsed.ok) return parsed;
		artifacts.push(parsed.value);
	}
	const urls = new Set<string>();
	for (const artifact of artifacts) {
		if (urls.has(artifact.url)) {
			return malformed(
				["artifacts"],
				"artifacts with unique URLs",
				artifact.url,
			);
		}
		urls.add(artifact.url);
	}
	if (
		!Array.isArray(value.does_prove) ||
		value.does_prove.length === 0 ||
		value.does_prove.some((entry) => typeof entry !== "string")
	) {
		return malformed(
			["does_prove"],
			"a non-empty array of claim strings",
			value.does_prove,
		);
	}
	if (
		!Array.isArray(value.does_not_prove) ||
		value.does_not_prove.length === 0 ||
		value.does_not_prove.some((entry) => typeof entry !== "string")
	) {
		return malformed(
			["does_not_prove"],
			"a non-empty array of non-claim strings",
			value.does_not_prove,
		);
	}
	return {
		ok: true,
		value: {
			_comment: value._comment as string[],
			schema: RELEASE_RECORD_SCHEMA,
			product: value.product,
			version: value.version,
			artifacts,
			does_prove: value.does_prove as string[],
			does_not_prove: value.does_not_prove as string[],
		},
	};
}
