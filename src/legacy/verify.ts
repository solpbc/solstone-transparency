// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Read-side verification of a single v1 ledger entry or latest pointer:
 * schema shape, ASCII/canonicalization conformance, trusted-comment binding,
 * chain linkage, and minisign signature verification. This module never
 * signs or publishes — it only checks what has already been published.
 */

import {
	GENESIS_SHA256,
	findNonAsciiStrings,
	isCanonicalTimestamp,
	parseTrustedComment,
	sha256Hex,
	trustedCommentMatchesEntry,
} from "./canonical";
import { verifyMinisig } from "./minisign";

export interface RawArtifactRef {
	name: string;
	sha256: string;
	bytes: number;
}

/** The fixed v1 ledger-entry shape, as received over the wire (not yet trusted). */
export interface LedgerEntryV1Raw {
	artifacts?: RawArtifactRef[];
	manifests?: RawArtifactRef[];
	proofs?: RawArtifactRef[];
	prev_sha256?: string;
	prev_version?: string;
	product?: string;
	published_utc?: string;
	schema?: string;
	seq?: number;
	source_commit?: string;
	version?: string;
}

export interface LatestPointerV1Raw {
	chain_length?: number;
	product?: string;
	schema?: string;
	signed_at?: string;
	tip_sha256?: string;
	valid_until?: string;
	version?: string;
}

/** The subset of `LedgerEntryV1Raw` proven present and well-typed once `checkEntryFields` returns `ok: true` — callers read from here instead of re-asserting non-null on the raw, possibly-absent fields. */
export interface ValidatedEntryFields {
	product: string;
	seq: number;
	version: string;
	prevSha256: string;
	prevVersion: string;
	publishedUtc: string;
}

export type EntryFieldCheck =
	| { ok: true; fields: ValidatedEntryFields }
	| { ok: false; problem: "missing-subject"; detail: string }
	| { ok: false; problem: "malformed"; detail: string };

/**
 * Checks the fixed v1 ledger-entry field contract. `version` is the entry's
 * subject identity; its absence is `missing-subject`, distinct from every
 * other field's absence or wrong type, which is `malformed`.
 */
export function checkEntryFields(raw: LedgerEntryV1Raw): EntryFieldCheck {
	if (raw.version === undefined || raw.version === "") {
		return {
			ok: false,
			problem: "missing-subject",
			detail: "entry has no version field",
		};
	}
	if (raw.product === undefined || raw.product === "") {
		return {
			ok: false,
			problem: "malformed",
			detail: "entry has no product field",
		};
	}
	if (
		typeof raw.seq !== "number" ||
		!Number.isInteger(raw.seq) ||
		raw.seq < 1
	) {
		return {
			ok: false,
			problem: "malformed",
			detail: `seq must be a positive integer, got ${JSON.stringify(raw.seq)}`,
		};
	}
	if (
		raw.prev_sha256 === undefined ||
		!/^[0-9a-f]{64}$/.test(raw.prev_sha256)
	) {
		return {
			ok: false,
			problem: "malformed",
			detail: "prev_sha256 must be exactly 64 lowercase hex characters",
		};
	}
	if (raw.prev_version === undefined) {
		return {
			ok: false,
			problem: "malformed",
			detail: "prev_version field missing (use empty string at genesis)",
		};
	}
	if (
		raw.published_utc === undefined ||
		!isCanonicalTimestamp(raw.published_utc)
	) {
		return {
			ok: false,
			problem: "malformed",
			detail: `published_utc must be exactly YYYY-MM-DDTHH:MM:SSZ, got ${JSON.stringify(raw.published_utc)}`,
		};
	}
	if (
		!Array.isArray(raw.artifacts) ||
		!Array.isArray(raw.manifests) ||
		!Array.isArray(raw.proofs)
	) {
		return {
			ok: false,
			problem: "malformed",
			detail: "artifacts/manifests/proofs must each be arrays",
		};
	}
	const nonAscii = findNonAsciiStrings(raw);
	if (nonAscii.length > 0) {
		return {
			ok: false,
			problem: "malformed",
			detail: `non-ASCII value at ${nonAscii.join(", ")}`,
		};
	}
	if (raw.seq === 1) {
		if (raw.prev_sha256 !== GENESIS_SHA256 || raw.prev_version !== "") {
			return {
				ok: false,
				problem: "malformed",
				detail:
					"seq=1 must be genesis: prev_sha256 all-zero and prev_version empty",
			};
		}
	}
	return {
		ok: true,
		fields: {
			product: raw.product,
			seq: raw.seq,
			version: raw.version,
			prevSha256: raw.prev_sha256,
			prevVersion: raw.prev_version,
			publishedUtc: raw.published_utc,
		},
	};
}

export interface EntryVerificationInput {
	/** Raw entry bytes exactly as fetched — signature and sha256 are computed over these bytes, never a re-serialization. */
	entryBytes: Uint8Array;
	entrySigText: string;
	pubKeyText: string;
	/** The previous entry's own computed sha256, or the genesis all-zero value at seq=1. Pass null if unknown/unavailable — a chain-linkage check without it degrades to "unavailable", never a silent pass. */
	expectedPrevSha256: string | null;
	checkedAt: string;
}

export type VerificationOutcome =
	| { state: "valid"; entrySha256: string }
	| { state: "invalid"; reason: string }
	| { state: "unavailable"; reason: string }
	| { state: "missing-subject" }
	| { state: "malformed"; reason: string };

/** Verifies one ledger entry end to end: schema shape, ASCII/canonicalization, chain linkage, minisign signature, and trusted-comment binding. */
export async function verifyEntry(
	input: EntryVerificationInput,
): Promise<VerificationOutcome> {
	let raw: LedgerEntryV1Raw;
	try {
		raw = JSON.parse(new TextDecoder().decode(input.entryBytes));
	} catch {
		return { state: "malformed", reason: "entry body is not valid JSON" };
	}
	const fieldCheck = checkEntryFields(raw);
	if (!fieldCheck.ok) {
		if (fieldCheck.problem === "missing-subject")
			return { state: "missing-subject" };
		return { state: "malformed", reason: fieldCheck.detail };
	}
	const fields = fieldCheck.fields;

	const entrySha256 = await sha256Hex(input.entryBytes);

	if (
		input.expectedPrevSha256 !== null &&
		fields.prevSha256 !== input.expectedPrevSha256
	) {
		return {
			state: "invalid",
			reason: `broken chain link: entry declares prev_sha256=${fields.prevSha256} but the actual previous entry hashes to ${input.expectedPrevSha256}`,
		};
	}

	const sigResult = await verifyMinisig(
		input.pubKeyText,
		input.entrySigText,
		input.entryBytes,
	);
	if (!sigResult.verified) {
		if (sigResult.toolUnavailable) {
			return {
				state: "unavailable",
				reason: `could not run the verifier: ${sigResult.stderr ?? "unknown error"}`,
			};
		}
		return {
			state: "invalid",
			reason: `minisign verification failed: ${sigResult.stderr ?? "unknown error"}`,
		};
	}
	if (sigResult.trustedComment === undefined) {
		return {
			state: "invalid",
			reason: "signature verified but no trusted comment was returned",
		};
	}
	const parsed = parseTrustedComment(sigResult.trustedComment);
	if (parsed === null || parsed.recordKind !== "entry") {
		return {
			state: "invalid",
			reason: `trusted comment is not a v1 entry comment: ${sigResult.trustedComment}`,
		};
	}
	const binding = trustedCommentMatchesEntry(parsed.fields, {
		product: fields.product,
		seq: fields.seq,
		version: fields.version,
		sha256: entrySha256,
		prevSha256: fields.prevSha256,
	});
	if (!binding.ok) {
		return {
			state: "invalid",
			reason: `trusted-comment binding failed: ${binding.reason}`,
		};
	}

	return { state: "valid", entrySha256 };
}

export interface PointerVerificationInput {
	pointerBytes: Uint8Array;
	pointerSigText: string;
	pubKeyText: string;
	checkedAt: string;
}

export type PointerVerificationOutcome =
	| {
			state: "valid";
			tipSha256: string;
			chainLength: number;
			signedAt: string;
			validUntil: string;
	  }
	| { state: "invalid"; reason: string }
	| { state: "malformed"; reason: string };

export async function verifyPointer(
	input: PointerVerificationInput,
): Promise<PointerVerificationOutcome> {
	let raw: LatestPointerV1Raw;
	try {
		raw = JSON.parse(new TextDecoder().decode(input.pointerBytes));
	} catch {
		return { state: "malformed", reason: "pointer body is not valid JSON" };
	}
	if (
		raw.tip_sha256 === undefined ||
		raw.chain_length === undefined ||
		raw.signed_at === undefined ||
		raw.valid_until === undefined
	) {
		return {
			state: "malformed",
			reason: "pointer is missing a required field",
		};
	}
	if (
		!isCanonicalTimestamp(raw.signed_at) ||
		!isCanonicalTimestamp(raw.valid_until)
	) {
		return {
			state: "malformed",
			reason: "signed_at/valid_until must be exactly YYYY-MM-DDTHH:MM:SSZ",
		};
	}
	const sigResult = await verifyMinisig(
		input.pubKeyText,
		input.pointerSigText,
		input.pointerBytes,
	);
	if (!sigResult.verified) {
		if (sigResult.toolUnavailable) {
			return {
				state: "invalid",
				reason: `could not run the verifier: ${sigResult.stderr ?? "unknown error"}`,
			};
		}
		return {
			state: "invalid",
			reason: `minisign verification failed: ${sigResult.stderr ?? "unknown error"}`,
		};
	}
	return {
		state: "valid",
		tipSha256: raw.tip_sha256,
		chainLength: raw.chain_length,
		signedAt: raw.signed_at,
		validUntil: raw.valid_until,
	};
}

/** Freshness is judged independently of signature validity — an expired pointer is never re-labeled invalid. */
export function computeFreshness(
	validUntil: string,
	now: Date,
): "fresh" | "expired" {
	return new Date(validUntil).getTime() >= now.getTime() ? "fresh" : "expired";
}
