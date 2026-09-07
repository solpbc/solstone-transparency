// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Closed structural vocabulary for the Wave 1 portal. These strings are not
 * CMO copy — they come from the CPO state-semantics table and the IA
 * primitives. Do not rephrase.
 */

import type { ProductSlug } from "../legacy/types";

export const AXIS_PUBLICATION = "publication";
export const AXIS_FRESHNESS = "evidence freshness";
export const AXIS_VERIFICATION = "verification";
export const AXIS_REBUILD = "rebuild";

export const KIND_SIGNED = "✓ signed";
export const KIND_REGISTER = "▤ register";
export const KIND_DECLARATION = "◆ sol pbc says";
export const KIND_VERIFIER = "⟳ verifier";

export const PRODUCT_DISPLAY: Record<ProductSlug, string> = {
	journal: "solstone journal",
	linux: "solstone linux",
	windows: "solstone windows",
};

export const WINDOWS_ONE_FACT =
	"this page shows one fact rather than four separate axes: with no records, there is no freshness window, nothing to verify, and nothing to rebuild.";

/** Structural summary for a superseded (non-tip) version page. Placeholders: product, version, published_utc. */
export const VERSION_SUMMARY_NOT_TIME_BOUND =
	"this is the signed record for {product} {version}, published {published_utc}. superseded entries like this one are not assigned their own freshness window — only the current tip of the chain carries a separately signed freshness assertion. this entry's own signature remains exactly as published and is independently verifiable today.";

/** Structural summary for a tip whose freshness pointer could not be checked. Placeholders: product, version, published_utc, reason. */
export const VERSION_SUMMARY_UNAVAILABLE =
	"this is the signed record for {product} {version}, published {published_utc}. this is the current tip of the chain, but its separately signed freshness pointer could not be checked ({reason}); that is a statement about this check, not about the entry's own signature, which remains exactly as published and independently verifiable today.";

export const VERIFY_LEAD_IN =
	"from any release's raw-evidence table, download ledger-entry.json, ledger-entry.json.minisig, and the pinned key file named on /keys/. then run:";

export function verifyCommand(filename: string): string {
	return `minisign -Vm ledger-entry.json -p ${filename} -x ledger-entry.json.minisig`;
}

export const STATE_PAUSED = "paused";

// ---- v2 structural vocabulary (not CMO copy; headings, labels, command shapes) ----

export const HEADING_V2_RECORDS = "v2 release records";
export const HEADING_V1_TIMELINE_CLOSED = "v1 release timeline (closed chain)";
export const HEADING_V1_METHOD = "method 1: a v1 record, with minisign";
export const HEADING_V2_METHOD = "method 2: a v2 record, with verify-v2";
export const HEADING_V1_KEY = "the v1 signing key";
export const HEADING_V2_ROOT = "the v2 signing root";
export const HEADING_WITNESS_LINES = "the two fingerprint lines";
export const HEADING_RECORD_CLAIMS = "what the record says it proves";
export const KEYS_PAGE_TITLE_V2 = "signing keys";
export const V2_RECORD_TAG = "v2 record";
export const V1_RECORD_TAG = "v1 record";
export const STATE_ASSERTED_UNTIL = "asserted until";
export const STATE_EXPIRED = "expired";
export const STATE_NO_RECORD_YET = "no record yet";
export const STATE_V2_NOT_CHECKED = "v2 register not checked";
export const HEADING_V1_PROVES = "what the v1 records prove";
export const HEADING_V1_DOES_NOT_PROVE = "what the v1 records do not prove";

/** Structural summary for a non-tip v1 version page once a v2 root exists: chain position without a status word on the chain. Placeholders: product, version, published_utc. */
export const VERSION_SUMMARY_NOT_TIME_BOUND_V2 =
	"this is the signed record for {product} {version}, published {published_utc}. it is not the last entry in the v1 chain, so it carries no freshness window of its own; only the chain's last entry does. its signature remains exactly as published and is verifiable today.";

/** The verifier's rejection reason in reader words. The code itself stays in the model and the packet, never on the page. */
export function readerReason(reason: string): string {
	switch (reason) {
		case "expired":
			return "its freshness assertion had expired";
		case "unavailable":
		case "retrieval-failed":
			return "part of the repository could not be fetched";
		case "hash-mismatch":
		case "length-mismatch":
		case "snapshot-mismatch":
			return "a file did not match its signed description";
		case "signature-invalid":
		case "threshold-unmet":
		case "key-not-in-role":
		case "unknown-key":
		case "keyid-mismatch":
			return "a signature did not check out";
		case "version-rollback":
			return "an older version was served than one already seen";
		default:
			return `the check reported "${reason}"`;
	}
}

export const VERIFY_V2_LEAD_IN =
	"save the root shown on /keys/ as tuf-root.json; that saved copy is your pin. compare its two fingerprint lines against the published copies first, then run:";

export function verifyV2Command(
	metadataBase: string,
	targetsBase: string,
): string {
	return `solstone-transparency verify-v2 --root tuf-root.json --metadata-base ${metadataBase} --targets-base ${targetsBase}`;
}
export const STATE_NOT_TIME_BOUND = "not time-bound";
export const STATE_NOT_ATTEMPTED = "not attempted";
export const STATE_COULD_NOT_BE_CHECKED = "could not be checked";
export const STATE_SIGNATURE_DID_NOT_VERIFY = "signature did not verify";
