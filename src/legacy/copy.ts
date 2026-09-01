// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Approved public copy for the Wave 1 legacy trust portal. Every string here
 * is reviewed content, not a draft — the portal-presentation layer renders
 * these values (substituting `{placeholder}` tokens from the typed model)
 * without rewording the surrounding sentence. This stage's entire public
 * claim is: "These are historical records of what sol pbc published."
 * Nothing here may be read to assert more.
 *
 * `{version}`, `{date}`, `{count}`, `{product}`, `{prev}`, `{next}`, and
 * `{published_utc}` / `{valid_until}` are literal placeholder tokens the
 * presentation layer substitutes from the typed model at render time. The
 * sentence around each token is the approved copy; only the token itself is
 * ever replaced.
 */

import type { ProductSlug } from "./types";

export const HOME_HERO_EXPLAINER =
	"trust.solstone.app is where sol pbc explains, in plain language, what we've published about our own software. the actual signed records live at transparency.solstone.app; this site walks through them and links straight back to the originals. if anything here ever disagrees with a record at transparency.solstone.app, that record is the one to believe.";

export const HOME_PUBLICATION_DECLARATION =
	"publication to this register is paused right now, by deliberate decision, not because of an incident or an outage. sol pbc is holding new signed records until we ship one coordinated release across every solstone surface, and we'll re-evaluate publication at that point. every record already published here stays published, unchanged, and verifiable exactly as it is.";

export const HOME_REGISTER_SUMMARY_LEAD =
	"sol pbc has published signed records for some of its software, not necessarily all of it.";

/** One row per product on the home page's at-a-glance table. */
export function homeRegisterSummaryRow(hasRecords: boolean): string {
	return hasRecords
		? "publication paused · latest recorded release {version} (signed {date})"
		: "publication paused · no records in this register";
}

export const SOFTWARE_COVERAGE_CAVEAT =
	"the products below are the ones we've published at least one signed record for. a product that isn't listed, or a gap between two recorded versions of a product that is, isn't evidence that nothing was released. it means our register doesn't have a record for it, which is a fact about our register, not about what we shipped.";

export const SOFTWARE_INDEX_LEAD =
	"sol pbc has published signed records for some of its software, not necessarily all of it.";

const PRODUCT_PLAIN_SUMMARY: Record<ProductSlug, string> = {
	journal:
		"this register holds {count} signed records for solstone's journal software, most recently version {version}, signed {date}.",
	linux:
		"this register holds {count} signed record for solstone's linux release, version {version}, signed {date}.",
	windows:
		"this register holds no signed records for solstone's windows release.",
};
export function productPlainSummary(product: ProductSlug): string {
	return PRODUCT_PLAIN_SUMMARY[product];
}

const PRODUCT_DOES_PROVE: Record<ProductSlug, string> = {
	journal:
		"that sol pbc signed a record naming these exact artifacts, their digests, and their release date, and that each entry is correctly linked to the one before it in the chain.",
	linux:
		"that sol pbc signed a record naming this release's exact artifacts, digests, and release date.",
	windows:
		"that our register currently has no signed record for a windows build.",
};
export function productDoesProve(product: ProductSlug): string {
	return PRODUCT_DOES_PROVE[product];
}

const PRODUCT_DOES_NOT_PROVE: Record<ProductSlug, string> = {
	journal:
		"that these are all the journal versions we've released, or that the recorded version is the one you're currently running.",
	linux:
		"that this is the only linux release we've made, or that it's what you're running now.",
	windows: "that solstone has never been released for windows.",
};
export function productDoesNotProve(product: ProductSlug): string {
	return PRODUCT_DOES_NOT_PROVE[product];
}

export const PRODUCT_GAP_NOTE =
	"there's no record here for {version}; the chain runs from {prev} to {next} without it, and a gap in this register is not evidence that {version} was never released.";

export const WINDOWS_ABSENCE_EXPLAINER =
	"this register has no signed records for a windows build. that's a fact about what we've published to this register, not a claim about whether solstone runs on windows. zero records here means we haven't recorded one yet, not that none exists to record.";

export const VERSION_PLAIN_SUMMARY =
	"this is the signed record for {product} {version}, published {published_utc}. sol pbc signed it as valid through {valid_until}; that window has since passed, which reflects our publication pause, not a problem with the record itself. the record and its signature remain exactly as published and remain verifiable today.";

export const VERSION_DOES_PROVE =
	"that sol pbc's signing key attested these exact artifacts, named, sized, and hashed in the record, at the stated time, and that this entry is correctly linked to the one before it in the chain.";

export const VERSION_DOES_NOT_PROVE =
	"that the source code we point to produced these exact bytes (that's a reproducible-build claim we don't make), or that this is the version currently installed or available to download.";

export const VERSION_ARTIFACT_NOTE =
	"the distributed files themselves aren't hosted on this evidence surface. their names and digests are declared in the signed record above. verify them by hashing the file you have and comparing it to the digest here, not by following a link.";

export const VERIFY_METHOD_INTRO =
	"every record on this site is signed, and you can check that signature yourself using the public key we publish alongside it. a valid signature tells you the record hasn't been altered since we signed it; it doesn't tell you anything about whether the software itself is safe or behaves as described.";

export const VERIFY_OUTCOME_PASS =
	"the signature checks out. this exact record matches what we signed and hasn't been altered.";
export const VERIFY_OUTCOME_FAIL =
	"the signature doesn't check out. don't trust this copy, and let us know how you got it.";
export const VERIFY_OUTCOME_UNREACHABLE =
	"we couldn't complete the check, usually a network or availability issue on our end; that's different from a failed check and isn't evidence the record is wrong.";

export const KEYS_ROLE_STATEMENT =
	"this key verifies every signed record published in this register.";

/**
 * Verbatim reflow of the live `releases/ABOUT.txt` object (fetched and
 * confirmed byte-for-byte, 2026-09-01). Re-fetch and diff against this text
 * at build time — the object is outside this repository's control and could
 * change before deploy; if it has, render the live bytes, not this copy.
 */
export const ABOUT_READABLE_BODY = `sol pbc release transparency — https://transparency.solstone.app/releases/

what this surface attests:
- what sol pbc released: for each product release, a signed ledger entry
  naming the exact artifacts, their sizes, and their SHA-256 digests, plus
  the companion release manifests and install/smoke proof receipts.
- that it is immutable: release entries and keys live under create-only,
  indefinitely retained object paths; nothing under releases/<product>/v/
  or releases/keys/ is ever overwritten or deleted.
- that history is publicly reconstructible: entries are hash-chained,
  signed with the key below, and independently witnessed; anyone can
  re-derive and verify the full chain from this surface alone.

what this surface does NOT claim:
- it does not claim the released binaries provably match their source (no
  reproducible-build claim). the guarantee is that any later rewrite of
  history is detectable, not that the original attestation is infallible.

signing key: releases/keys/solpbc-transparency-1.pub (minisign). rotation
publishes a successor key cross-signed by its predecessor in the same
directory.

delivery surfaces (where the attested bytes are actually served):
- solstone-journal: https://pypi.org/project/solstone-journal/ (with the
  solstone, solstone-core, solstone-journal-cuda, and
  solstone-journal-models packages on the same index)
- solstone-windows: https://solstone.app/download/windows
- solstone-linux: https://github.com/solpbc/solstone-linux/releases

note: "schema" URLs inside ledger entries are version identifiers, not
dereferenceable documents.`;

export const NOT_FOUND_GENERIC =
	"there's nothing at this address. head back to the trust portal home, or check the software register for a specific product.";

export const NOT_FOUND_VERSION_SHAPED =
	"there's no record here for that version. that isn't evidence it wasn't released, only that our register has no signed entry for it.";

export const FOOTER_OWNERSHIP_LINE = "solstone is a trademark of sol pbc.";
