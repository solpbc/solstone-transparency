// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/** v1 discovery-manifest validation and read-only legacy byte/minisign walk. */

import { verifyMinisig } from "../../legacy/minisign";
import {
	type TufFailure,
	type TufFailureDetail,
	type TufJsonValue,
	type TufRejectionReason,
	type TufResult,
	rejection,
} from "../tuf/outcome";
import { EVIDENCE_HOST, validateEvidenceHostLink } from "./evidence-host-link";

export const MIGRATION_MANIFEST_SCHEMA =
	"solstone-transparency/migration-manifest/v1-to-v2";

export interface MigrationVerificationContract {
	v1_algorithm: "minisign";
	v1_public_key: string;
	note: string;
}

export interface MigrationProduct {
	product: string;
	chain_length: number;
	chain_tip_version: string | null;
	declared_gap_versions: readonly string[];
	object_count: number;
	corpus_sha256: string;
}

export interface MigrationObject {
	url: string;
	length: number;
	sha256: string;
}

export interface MigrationManifestPredicate {
	_comment: readonly string[];
	schema: typeof MIGRATION_MANIFEST_SCHEMA;
	verification_contract: MigrationVerificationContract;
	corpus_sha256: string;
	object_count: number;
	products: readonly MigrationProduct[];
	objects: readonly MigrationObject[];
}

export type MigrationFetchResponse =
	| { kind: "not-found" }
	| { kind: "error"; error: unknown }
	| { kind: "ok"; bytes: Uint8Array };

export interface MigrationObjectFetcher {
	fetch(url: string): Promise<MigrationFetchResponse>;
}

export interface MigrationWalkObjectResult {
	url: string;
	state: "verified" | "rejected";
	reason?: string;
}

export interface MigrationManifestWalkResult {
	verdict: TufResult<undefined>;
	objects: readonly MigrationWalkObjectResult[];
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
	return rejection("predicate-malformed", { path, expected, observed });
}

function validHash(value: unknown): value is string {
	return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validCount(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseObject(
	value: unknown,
	index: number,
): TufResult<MigrationObject> {
	const path = ["objects", String(index)];
	if (
		!isRecord(value) ||
		typeof value.url !== "string" ||
		!validCount(value.length) ||
		!validHash(value.sha256)
	) {
		return malformed(
			path,
			"an object with url, non-negative length, and SHA-256",
			value,
		);
	}
	return {
		ok: true,
		value: { url: value.url, length: value.length, sha256: value.sha256 },
	};
}

function parseProduct(
	value: unknown,
	index: number,
): TufResult<MigrationProduct> {
	const path = ["products", String(index)];
	if (
		!isRecord(value) ||
		typeof value.product !== "string" ||
		!validCount(value.chain_length) ||
		!validCount(value.object_count) ||
		!validHash(value.corpus_sha256)
	) {
		return malformed(path, "a complete migration product entry", value);
	}
	if (
		value.chain_tip_version !== null &&
		typeof value.chain_tip_version !== "string"
	)
		return malformed(
			[...path, "chain_tip_version"],
			"a version string or null",
			value.chain_tip_version,
		);
	if (
		!Array.isArray(value.declared_gap_versions) ||
		value.declared_gap_versions.some((gap) => typeof gap !== "string")
	)
		return malformed(
			[...path, "declared_gap_versions"],
			"an array of version strings",
			value.declared_gap_versions,
		);
	return {
		ok: true,
		value: {
			product: value.product,
			chain_length: value.chain_length,
			chain_tip_version: value.chain_tip_version,
			declared_gap_versions: value.declared_gap_versions as string[],
			object_count: value.object_count,
			corpus_sha256: value.corpus_sha256,
		},
	};
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function descriptorDigest(
	objects: readonly MigrationObject[],
): Promise<string> {
	const text = objects
		.slice()
		.sort((left, right) => left.url.localeCompare(right.url))
		.map((object) => `${object.url}\n${object.length}\n${object.sha256}\n`)
		.join("");
	return bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
		),
	);
}

/** Validates the already-signed predicate body; URL safety is enforced by the walker before fetch. */
export async function validateMigrationManifestPredicate(
	value: TufJsonValue,
): Promise<TufResult<MigrationManifestPredicate>> {
	if (!isRecord(value))
		return malformed([], "a migration-manifest object", typeName(value));
	if (
		!Array.isArray(value._comment) ||
		value._comment.some((entry) => typeof entry !== "string")
	)
		return malformed(
			["_comment"],
			"an array of explanatory strings",
			value._comment === undefined ? typeName(value._comment) : value._comment,
		);
	if (value.schema !== MIGRATION_MANIFEST_SCHEMA)
		return malformed(["schema"], MIGRATION_MANIFEST_SCHEMA, value.schema);
	if (!isRecord(value.verification_contract))
		return malformed(
			["verification_contract"],
			"a verification contract object",
			value.verification_contract,
		);
	if (
		value.verification_contract.v1_algorithm !== "minisign" ||
		typeof value.verification_contract.v1_public_key !== "string" ||
		typeof value.verification_contract.note !== "string"
	) {
		return malformed(
			["verification_contract"],
			"the v1 minisign verification contract",
			value.verification_contract,
		);
	}
	if (!validHash(value.corpus_sha256) || !validCount(value.object_count))
		return malformed([], "a corpus SHA-256 and object count", value);
	if (!Array.isArray(value.objects) || !Array.isArray(value.products))
		return malformed([], "objects and products arrays", value);
	const objects: MigrationObject[] = [];
	for (const [index, object] of value.objects.entries()) {
		const parsed = parseObject(object, index);
		if (!parsed.ok) return parsed;
		objects.push(parsed.value);
	}
	if (
		objects.length !== value.object_count ||
		new Set(objects.map((object) => object.url)).size !== objects.length
	) {
		return malformed(["objects"], "unique objects matching object_count", {
			expected: value.object_count,
			observed: objects.length,
		});
	}
	if (
		objects.some(
			(object, index) =>
				index > 0 &&
				(objects[index - 1]?.url.localeCompare(object.url) ?? -1) >= 0,
		)
	)
		return malformed(
			["objects"],
			"objects sorted by URL",
			objects.map((object) => object.url),
		);
	if ((await descriptorDigest(objects)) !== value.corpus_sha256)
		return malformed(
			["corpus_sha256"],
			"the recomputed corpus descriptor SHA-256",
			value.corpus_sha256,
		);
	const products: MigrationProduct[] = [];
	for (const [index, product] of value.products.entries()) {
		const parsed = parseProduct(product, index);
		if (!parsed.ok) return parsed;
		const prefix = `https://${EVIDENCE_HOST}/releases/solstone-${parsed.value.product}/`;
		const mine = objects.filter((object) => object.url.startsWith(prefix));
		if (
			mine.length !== parsed.value.object_count ||
			(await descriptorDigest(mine)) !== parsed.value.corpus_sha256
		) {
			return malformed(
				["products", String(index)],
				"product count and digest matching listed objects",
				parsed.value,
			);
		}
		products.push(parsed.value);
	}
	return {
		ok: true,
		value: {
			_comment: value._comment as string[],
			schema: MIGRATION_MANIFEST_SCHEMA,
			verification_contract: {
				v1_algorithm: "minisign",
				v1_public_key: value.verification_contract.v1_public_key as string,
				note: value.verification_contract.note as string,
			},
			corpus_sha256: value.corpus_sha256,
			object_count: value.object_count,
			products,
			objects,
		},
	};
}

function failure<R extends TufRejectionReason>(
	reason: R,
	detail: TufFailureDetail,
): TufFailure<R> {
	return rejection(reason, detail);
}

/**
 * Validates every referenced URL before the first fetch. Minisign is required only
 * where the manifest contains an exact .minisig sibling for an object.
 */
export async function walkMigrationManifest(
	predicate: MigrationManifestPredicate,
	fetcher: MigrationObjectFetcher,
): Promise<MigrationManifestWalkResult> {
	const allUrls = [
		predicate.verification_contract.v1_public_key,
		...predicate.objects.map((object) => object.url),
	];
	for (const url of allUrls) {
		const safe = validateEvidenceHostLink(url);
		if (!safe.ok) return { verdict: safe, objects: [] };
	}
	const cache = new Map<string, Uint8Array>();
	const results: MigrationWalkObjectResult[] = [];
	const fetchBytes = async (
		url: string,
		descriptor?: MigrationObject,
	): Promise<TufResult<Uint8Array>> => {
		let bytes = cache.get(url);
		if (bytes === undefined) {
			let response: MigrationFetchResponse;
			try {
				response = await fetcher.fetch(url);
			} catch (error) {
				return failure("retrieval-failed", {
					path: [url],
					expected: "a successful migration object fetch",
					observed: error instanceof Error ? error.name : typeName(error),
				});
			}
			if (response.kind === "not-found")
				return failure("unavailable", {
					path: [url],
					expected: "a fetchable object",
					observed: "not found",
				});
			if (response.kind === "error")
				return failure("retrieval-failed", {
					path: [url],
					expected: "a successful migration object fetch",
					observed:
						response.error instanceof Error
							? response.error.name
							: typeName(response.error),
				});
			bytes = response.bytes;
			cache.set(url, bytes);
		}
		if (descriptor !== undefined) {
			const hash = bytesToHex(
				new Uint8Array(
					await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
				),
			);
			if (
				bytes.byteLength !== descriptor.length ||
				hash !== descriptor.sha256
			) {
				return failure("migration-target-mismatch", {
					path: [url],
					expected: { length: descriptor.length, sha256: descriptor.sha256 },
					observed: { length: bytes.byteLength, sha256: hash },
				});
			}
		}
		return { ok: true, value: bytes };
	};
	const key = await fetchBytes(predicate.verification_contract.v1_public_key);
	if (!key.ok) return { verdict: key, objects: results };
	const byUrl = new Map(
		predicate.objects.map((object) => [object.url, object]),
	);
	for (const object of predicate.objects) {
		const body = await fetchBytes(object.url, object);
		if (!body.ok) {
			results.push({ url: object.url, state: "rejected", reason: body.reason });
			return { verdict: body, objects: results };
		}
		if (!object.url.endsWith(".minisig")) {
			const sibling = byUrl.get(`${object.url}.minisig`);
			if (sibling !== undefined) {
				const signature = await fetchBytes(sibling.url, sibling);
				if (!signature.ok) {
					results.push({
						url: object.url,
						state: "rejected",
						reason: signature.reason,
					});
					return { verdict: signature, objects: results };
				}
				const checked = await verifyMinisig(
					new TextDecoder().decode(key.value),
					new TextDecoder().decode(signature.value),
					body.value,
				);
				if (checked.toolUnavailable) {
					const unavailable = failure("unavailable", {
						path: [object.url],
						expected: "an available minisign verifier",
						observed: checked.stderr ?? "tool unavailable",
					});
					results.push({
						url: object.url,
						state: "rejected",
						reason: unavailable.reason,
					});
					return { verdict: unavailable, objects: results };
				}
				if (!checked.verified) {
					const invalid = failure("signature-invalid", {
						path: [object.url],
						expected: "a valid v1 minisign signature",
						observed: checked.stderr ?? "verification returned false",
					});
					results.push({
						url: object.url,
						state: "rejected",
						reason: invalid.reason,
					});
					return { verdict: invalid, objects: results };
				}
			}
		}
		results.push({ url: object.url, state: "verified" });
	}
	return { verdict: { ok: true, value: undefined }, objects: results };
}
