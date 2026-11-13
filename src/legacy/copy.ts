// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { type CatalogRef, msg, t } from "../../i18n/lookup";

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

type LegacyProductSlug = Exclude<ProductSlug, "macos" | "tmux">;

export const HOME_HERO_EXPLAINER = t(
	"trust.copy.trustsolstoneappiswheresolpbcexplainsinplai",
);

export const HOME_PUBLICATION_DECLARATION = t(
	"trust.copy.publicationtothisregisterispausedrightnowby",
);

export const HOME_REGISTER_SUMMARY_LEAD = t(
	"trust.copy.solpbchaspublishedsignedrecordsforsomeofits",
);

/** One row per product on the home page's at-a-glance table. */
export function homeRegisterSummaryRow(hasRecords: true): CatalogRef;
export function homeRegisterSummaryRow(hasRecords: false): string;
export function homeRegisterSummaryRow(
	hasRecords: boolean,
): string | CatalogRef {
	if (hasRecords) return msg("trust.home.registerrow", { state: "hasrecord" });
	// The empty line does not print the date or the version. The message
	// still requires both arguments, and they stay blank.
	return t("trust.home.registerrow", {
		state: "empty",
		date: "",
		version: "",
	});
}

export const SOFTWARE_COVERAGE_CAVEAT = t(
	"trust.copy.theproductsbelowaretheoneswevepublishedatle",
);

export const SOFTWARE_INDEX_LEAD = t(
	"trust.copy.solpbchaspublishedsignedrecordsforsomeofits",
);

const PRODUCT_PLAIN_SUMMARY: Record<LegacyProductSlug, string | CatalogRef> = {
	journal: msg("trust.product.summaryjournalcount"),
	linux: msg("trust.copy.thisregisterholdscountsignedrecordforsolstone"),
	windows: t("trust.copy.thisregisterholdsnosignedrecordsforsolstones"),
};
export function productPlainSummary(
	product: LegacyProductSlug,
): string | CatalogRef {
	return PRODUCT_PLAIN_SUMMARY[product];
}

/**
 * The sentence an empty journal or linux timeline used to show, with the
 * `{count}` tokens still unfilled. Filling them would change that page.
 */
export function productPlainSummaryUnfilled(
	product: Exclude<LegacyProductSlug, "windows">,
): string {
	if (product === "journal") {
		return "this register holds {count} signed records for solstone's journal release, most recently version {version}, signed {date}.";
	}
	return "this register holds {count} signed record for solstone's linux release, version {version}, signed {date}.";
}

const PRODUCT_DOES_PROVE: Record<LegacyProductSlug, string> = {
	journal: t("trust.copy.thatsolpbcsignedarecordnamingtheseexactarti"),
	linux: t("trust.copy.thatsolpbcsignedarecordnamingthisreleasesex"),
	windows: t("trust.copy.thatourregistercurrentlyhasnosignedrecordfor"),
};
export function productDoesProve(product: LegacyProductSlug): string {
	return PRODUCT_DOES_PROVE[product];
}

const PRODUCT_DOES_NOT_PROVE: Record<LegacyProductSlug, string> = {
	journal: t("trust.copy.thattheseareallthejournalversionsweverelease"),
	linux: t("trust.copy.thatthisistheonlylinuxreleasewevemadeortha"),
	windows: t("trust.copy.thatsolstonehasneverbeenreleasedforwindows"),
};
export function productDoesNotProve(product: LegacyProductSlug): string {
	return PRODUCT_DOES_NOT_PROVE[product];
}

export const PRODUCT_GAP_NOTE = msg(
	"trust.copy.theresnorecordhereforversionthechainrunsfro",
);

export const WINDOWS_ABSENCE_EXPLAINER = t(
	"trust.copy.thisregisterhasnosignedrecordsforawindowsre",
);

export const VERSION_PLAIN_SUMMARY = msg(
	"trust.copy.thisisthesignedrecordofproductversionpublish2",
);

export const VERSION_DOES_PROVE = t(
	"trust.copy.thatsolpbcssigningkeyattestedtheseexactartif",
);

export const VERSION_DOES_NOT_PROVE = t(
	"trust.copy.thatthesourcecodewepointtoproducedtheseexac",
);

export const VERSION_ARTIFACT_NOTE = t(
	"trust.copy.thedistributedfilesthemselvesarenthostedonthi",
);

export const VERIFY_METHOD_INTRO = t(
	"trust.copy.everyrecordonthissiteissignedandyoucanchec",
);

export const VERIFY_OUTCOME_PASS = t(
	"trust.copy.thesignaturechecksoutthisexactrecordmatchesw",
);
export const VERIFY_OUTCOME_FAIL = t(
	"trust.copy.thesignaturedoesntcheckoutdonttrustthiscopy",
);
export const VERIFY_OUTCOME_UNREACHABLE = t(
	"trust.copy.wecouldntcompletethecheckusuallyanetworkora",
);

export const KEYS_ROLE_STATEMENT = t(
	"trust.copy.thiskeyverifieseverysignedrecordpublishedint",
);

/**
 * Verbatim reflow of the live `releases/ABOUT.txt` object (fetched and
 * confirmed byte-for-byte, 2026-09-01). Re-fetch and diff against this text
 * at build time — the object is outside this repository's control and could
 * change before deploy; if it has, render the live bytes, not this copy.
 */
export const ABOUT_READABLE_BODY = t("trust.about.body");

export const NOT_FOUND_GENERIC = t(
	"trust.copy.theresnothingatthisaddressheadbacktothetrus",
);

export const NOT_FOUND_VERSION_SHAPED = t(
	"trust.copy.theresnorecordhereforthatversionthatisntevi",
);

export const FOOTER_OWNERSHIP_LINE = t(
	"trust.copy.solstoneisatrademarkofsolpbc",
);
