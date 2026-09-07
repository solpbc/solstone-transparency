// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Approved public copy for the portal's v2 states, (a) and (b) of the v2
 * claim-ceiling specification. Same contract as
 * `src/legacy/copy.ts`: every string here is reviewed content, the
 * presentation layer substitutes `{token}` values from the typed model and
 * never rewords the sentence around them. Nothing here renders until a
 * pinned v2 root exists; until then the portal shows `src/legacy/copy.ts`
 * and nothing about a v2 root.
 *
 * Tokens: {version} {date} {count} {product} {prev} {next} {published_utc}
 * {valid_until} {asserted_until} {issued_at} {basis} {products} {reason}
 * {root_version}. {product} is always the readable display name.
 *
 * ⛔ Imports nothing. Pure strings.
 */

export const HOME_PUBLICATION_DECLARATION_A =
	"sol pbc has created its v2 signing root and bound the whole v1 register into it. no release record has been published under it yet. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.";

export const HOME_PUBLICATION_DECLARATION_B =
	"sol pbc publishes release records under its v2 signing root. the first is {product} {version}. the software page lists which products have records here.";

/** Home declaration when the pinned root is known but the repository did not verify at build time. Rendered beside V2_UNVERIFIED. */
export const HOME_PUBLICATION_DECLARATION_UNVERIFIED =
	"sol pbc has created its v2 signing root. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.";

export const AXIS_PUBLICATION_A = "none published yet";

export const AXIS_PUBLICATION_B = "publishing records";

export const HOME_REGISTER_SUMMARY_ROW_V2 =
	"newest recorded release {version} (signed {date})";

export const HOME_REGISTER_SUMMARY_ROW_V1_CLOSED =
	"v1 chain closed at {version} · no v2 record in this register";

/** The same row when the v2 register could not be checked: the negative is not asserted. */
export const HOME_REGISTER_SUMMARY_ROW_V1_CLOSED_UNCHECKED =
	"v1 chain closed at {version} · v2 register not checked";

export const SOFTWARE_COVERAGE_CAVEAT_B =
	"the products below are the ones with at least one signed record in this register, v1 or v2, and each record lists the exact files it covers. surfaces shipped through app stores (ios, android) have no sol pbc artifact url and no record here; that is a fact about how those builds are delivered, not a statement about them. a product that isn't listed, or a version with no record, isn't evidence that nothing was released. it means this register has no record for it.";

export const PRODUCT_PLAIN_SUMMARY_A =
	"the v1 chain for {product} closed at {version}. it is history, still signed and still verifiable with the v1 key; nothing in it was re-signed or moved.";

export const PRODUCT_PLAIN_SUMMARY_B =
	"this register holds a v2 release record for {product} {version}, signed {issued_at}. the v1 history for {product} stays below, unchanged and still verifiable with the v1 key.";

export const PRODUCT_GAP_NOTE_V1_TO_V2 =
	"the register moves from the v1 tip, {prev}, to the first v2 record, {next}. versions between the two have no record here; that is a fact about this register, not about what was released.";

export const PRODUCT_EXPECTED_GAP =
	"a record for {product} {version} was expected ({basis}) and is not in this register. that is a gap in the register, not evidence about the release.";

export const PRODUCT_RECORD_FAILED =
	"the record for {version} did not verify ({reason}), so nothing it claims is shown here.";

export const VERSION_PLAIN_SUMMARY_V2 =
	"this is the v2 release record for {product} {version}, signed {issued_at}. it names the exact final bytes sol pbc recorded as this release: each file's url, length, and sha256. the register's freshness is asserted until {asserted_until}.";

/** Replaces `VERSION_PLAIN_SUMMARY` on every v1 version page once the v2 root exists: the window passed and the chain is closed, with no pause. */
export const VERSION_PLAIN_SUMMARY_V1_CLOSED =
	"this is the signed record for {product} {version}, published {published_utc}. sol pbc signed it as valid through {valid_until}; that window has since passed, and the v1 chain this record belongs to is closed, so no later v1 record renews it. the record and its signature remain exactly as published and remain verifiable today.";

export const VERSION_RECORD_CLAIMS_LEAD =
	"the record states what it does and does not prove; both lists below are rendered from the signed record, word for word.";

export const VERIFY_METHOD_INTRO_V2 =
	"v2 records are covered by verify-v2, which checks the whole register against a pinned copy of sol pbc's v2 signing root. a passing check tells you the register you fetched matches what the keys your pinned root authorizes signed, that every record's bytes match their signed description, and that none of sol pbc's signed validity windows had passed when you ran it. it does not open a record's own signature; that is a separate record-level check, and this page will carry its command when it ships. it does not tell you the root you pinned is the right one; you compare that yourself against the fingerprint lines published elsewhere, listed on the keys page. and it speaks only to the register, not to the software the records name.";

export const VERIFY_TWO_METHODS_LEAD =
	"there are two ways to check what is here, one per chain. v1 records are checked with minisign and the v1 key; v2 records are covered by verify-v2, which checks the whole register against the pinned v2 root, and each record's page says which chain it belongs to.";

export const VERIFY_OUTCOME_V2_ACCEPTED =
	"the command printed ACCEPTED and exited 0: the register you fetched matches what the keys your pinned root authorizes signed, every record's bytes match their signed description, and no signed validity window had passed when you ran it.";
export const VERIFY_OUTCOME_V2_REJECTED =
	'the command printed REJECTED with a reason and exited 1; read the reason. "expired" means one of sol pbc\'s signed validity windows has passed (a fact about our assertion, not about any record\'s signature). "unavailable" or "retrieval-failed" means an object couldn\'t be fetched and the check did not complete. "trust-store-corrupt" points at a file on your machine, not at the register; "malformed" on a first run most often means the root file you saved did not parse. any other reason means what the evidence host served did not check out, and we\'d like to hear about it.';
export const VERIFY_OUTCOME_V2_COULD_NOT_RUN =
	"the command exited 2 because the pinned root couldn't be read; the check didn't happen, which is different from a failed check and isn't evidence about the record.";

export const KEYS_V1_ROLE_STATEMENT_A =
	"this key verifies the v1 chain only; it signs nothing new.";

export const KEYS_V1_STATUS = "v1 only, no new signatures";

export const KEYS_V2_ROOT_INTRO =
	"this is sol pbc's v2 signing root, version {root_version}: three key ids, of which two must sign. it is renewed yearly, and every prior fingerprint line stays published when it is.";

export const KEYS_WITNESS_LEAD =
	"the root's two fingerprint lines are published at more than one location sol pbc controls, listed below; they are a cross-check for a root you have already pinned, not a trust root themselves.";

export const ABOUT_READABLE_BODY_LEAD =
	"this file describes the v1 chain, in the v1 chain's own words, and is shown exactly as published.";

export const LEGACY_BINDING_BOUND =
	"the v1 register ({count} objects) is bound into the v2 root by a signed manifest, and that manifest checked out when this page was built.";

/** When the manifests that verified do not cover every product in the v1 register: the claim is scoped to what they cover. */
export const LEGACY_BINDING_PARTIAL =
	"the v1 register for {products} ({count} objects) is bound into the v2 root by a signed manifest that checked out when this page was built; the rest of the v1 register is not yet bound.";

/** State (a) declaration when the binding covers only part of the v1 register. */
export const HOME_PUBLICATION_DECLARATION_A_PARTIAL =
	"sol pbc has created its v2 signing root and bound the v1 register for {products} into it; the rest of the v1 register is not yet bound. no release record has been published under it yet. every v1 record stays published, unchanged, and verifiable exactly as it is, with the v1 key.";

export const LEGACY_BINDING_NOT_VERIFIED =
	"the manifest binding the v1 register into the v2 root did not verify when this page was built ({reason}); that is a statement about this check, not about any v1 record, which stays verifiable on its own with the v1 key.";

export const V2_UNVERIFIED =
	"the v2 register did not verify when this page was built ({reason}), so nothing from it is shown here. that is a statement about this check, not about any record.";

export const V2_EXPIRED =
	"a signed validity window on this register had passed by {date}; records have not been re-checked past that date. that is a statement about how old our assertion is, not about any record's signature.";

export const SOFTWARE_UNMAPPED_PRODUCTS =
	"this register also holds records for {products}; this portal has no page for them yet, so it links the raw records instead.";

/**
 * Windows framing in states (a)/(b). How windows is framed once a v2 root
 * exists is a pending product decision, so this is today's approved framing
 * verbatim. When that decision lands, the switch is an edit to this one
 * string, not a code change.
 */
export const WINDOWS_ABSENCE_EXPLAINER_STATE_A =
	"this register has no signed records for a windows release. that's a fact about what we've published to this register, not a claim about whether solstone runs on windows. zero records here means we haven't recorded one yet, not that none exists to record.";
