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
export const STATE_NOT_TIME_BOUND = "not time-bound";
export const STATE_NOT_ATTEMPTED = "not attempted";
export const STATE_COULD_NOT_BE_CHECKED = "could not be checked";
export const STATE_SIGNATURE_DID_NOT_VERIFY = "signature did not verify";
