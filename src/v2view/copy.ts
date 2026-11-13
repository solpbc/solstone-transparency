// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { msg, t } from "../../i18n/lookup";

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

export const HOME_PUBLICATION_DECLARATION_A = t(
	"trust.copy.solpbchascreateditsv2signingrootandboundth1",
);

export const HOME_PUBLICATION_DECLARATION_B = msg(
	"trust.copy.solpbcpublishesreleaserecordsunderitsv2signi",
);

/** Home declaration when the pinned root is known but the repository did not verify at build time. Rendered beside V2_UNVERIFIED. */
export const HOME_PUBLICATION_DECLARATION_UNVERIFIED = t(
	"trust.copy.solpbchascreateditsv2signingrooteveryv1rec",
);

export const AXIS_PUBLICATION_A = t("trust.copy.nonepublishedyet");

export const AXIS_PUBLICATION_B = t("trust.copy.publishingrecords");

export const HOME_REGISTER_SUMMARY_ROW_V2 = msg(
	"trust.copy.newestrecordedreleaseversionsigneddate",
);

export const HOME_REGISTER_SUMMARY_ROW_V1_CLOSED = msg(
	"trust.copy.v1chainclosedatversionnov2recordinthisregi",
);

/** The same row when the v2 register could not be checked: the negative is not asserted. */
export const HOME_REGISTER_SUMMARY_ROW_V1_CLOSED_UNCHECKED = msg(
	"trust.copy.v1chainclosedatversionv2registernotchecked",
);

export const SOFTWARE_COVERAGE_CAVEAT_B = t(
	"trust.copy.eachproductbelowshowswhetherithasasignedrec",
);

export const PRODUCT_PLAIN_SUMMARY_A = msg(
	"trust.copy.thev1chainofproductclosedatversionitishist",
);

export const PRODUCT_PLAIN_SUMMARY_B = msg(
	"trust.copy.thisregisterholdsav2releaserecordofproductv2",
);

export const PRODUCT_NO_V1_SUMMARY_B = msg(
	"trust.copy.thisregisterholdsav2releaserecordofproductv1",
);

export const PRODUCT_GAP_NOTE_V1_TO_V2 = msg(
	"trust.copy.theregistermovesfromthev1tipprevtothefirst",
);

export const PRODUCT_EXPECTED_GAP = msg(
	"trust.copy.arecordofproductversionwasexpectedbasisandi",
);

export const PRODUCT_RECORD_FAILED = msg(
	"trust.copy.therecordforversiondidnotverifyreasonsonoth",
);

export const VERSION_PLAIN_SUMMARY_V2 = msg(
	"trust.copy.thisisthev2releaserecordofproductversionsig",
);

/** Replaces `VERSION_PLAIN_SUMMARY` on every v1 version page once the v2 root exists: the window passed and the chain is closed, with no pause. */
export const VERSION_PLAIN_SUMMARY_V1_CLOSED = msg(
	"trust.copy.thisisthesignedrecordofproductversionpublish1",
);

export const VERSION_RECORD_CLAIMS_LEAD = t(
	"trust.copy.therecordstateswhatitdoesanddoesnotprovebo",
);

export const VERIFY_METHOD_INTRO_V2 = t(
	"trust.copy.v2recordsarecoveredbyverifyv2whichchecksthe",
);

export const VERIFY_TWO_METHODS_LEAD = t(
	"trust.copy.therearethreewaystocheckwhatisherev1record",
);

export const VERIFY_METHOD_INTRO_V3 = t(
	"trust.copy.verifyreleasechecksonev2recorditwalksfromyo",
);

export const VERIFY_OUTCOME_V3_ACCEPTED = t(
	"trust.copy.thecommandprintedacceptedreleaserecordandexit",
);
export const VERIFY_OUTCOME_V3_REJECTED = t(
	"trust.copy.thecommandprintedrejectedwithareasonandexite2",
);
export const VERIFY_OUTCOME_V3_COULD_NOT_RUN = t(
	"trust.copy.thecommandexited2becauseitcouldntreaditsinp",
);

export const VERIFY_OUTCOME_V2_ACCEPTED = t(
	"trust.copy.thecommandprintedacceptedandexited0theregist",
);
export const VERIFY_OUTCOME_V2_REJECTED = t(
	"trust.copy.thecommandprintedrejectedwithareasonandexite1",
);
export const VERIFY_OUTCOME_V2_COULD_NOT_RUN = t(
	"trust.copy.thecommandexited2becausethepinnedrootcouldnt",
);

export const KEYS_V1_ROLE_STATEMENT_A = t(
	"trust.copy.thiskeyverifiesthev1chainonlyitsignsnothing",
);

export const KEYS_V1_STATUS = t("trust.copy.v1onlynonewsignatures");

export const KEYS_V2_ROOT_INTRO = msg("trust.keys.rootintro");

/** The root intro when the root has exactly one key (the 1-of-1 design). */
export const KEYS_V2_ROOT_INTRO_SINGLE = msg("trust.keys.rootintro", {
	key_count: 1,
	threshold: 1,
});

export const KEYS_WITNESS_LEAD = t(
	"trust.copy.theselinesarepublishedatmorethanonelocation",
);

export const ABOUT_READABLE_BODY_LEAD = t(
	"trust.copy.thisfiledescribesthev1chaininthev1chainsow",
);

export const LEGACY_BINDING_BOUND = msg(
	"trust.copy.thev1releaserecordscountobjectsareboundinto",
);

/** When the manifests that verified do not cover every product in the v1 register: the claim is scoped to what they cover. */
export const LEGACY_BINDING_PARTIAL = msg(
	"trust.copy.thev1releaserecordsofproductscountobjectsare",
);

/** State (a) declaration when no legacy binding verified (manifests absent or failed): the root exists, nothing is claimed about the binding. */
export const HOME_PUBLICATION_DECLARATION_A_UNBOUND = t(
	"trust.copy.solpbchascreateditsv2signingrootnoreleaser",
);

/** State (a) declaration when the binding covers only part of the v1 register. */
export const HOME_PUBLICATION_DECLARATION_A_PARTIAL = msg(
	"trust.copy.solpbchascreateditsv2signingrootandboundth2",
);

export const LEGACY_BINDING_NOT_VERIFIED = msg(
	"trust.copy.amanifestbindingthev1releaserecordsintothev",
);

export const V2_UNVERIFIED = msg(
	"trust.copy.thev2registerdidnotverifywhenthispagewasbu",
);

export const V2_EXPIRED = msg(
	"trust.copy.asignedvaliditywindowonthisregisterhadpassed",
);

export const SOFTWARE_UNMAPPED_PRODUCTS = msg(
	"trust.copy.thisregisteralsoholdsrecordsforproductsthisp",
);

/**
 * Windows framing once a v2 root exists: the closed-fact form, no promise of
 * a date. Decided 2026-09-07; changing it again is an edit to this one
 * string, not a code change.
 */
export const WINDOWS_ABSENCE_EXPLAINER_STATE_A = t(
	"trust.copy.thev1chainrecordednoreleaseofsolstoneforwin",
);

/**
 * Coverage beside the per-OS app rows: the journal is one product across
 * platforms, and its platforms are read from its newest record's file names.
 * Without this, "solstone for windows: no records" reads as "nothing for
 * windows" beside a journal record that names windows files.
 */
export const JOURNAL_PLATFORMS_LINE = msg("trust.software.journalplatforms");

export const APPS_SEPARATE_LINE = t(
	"trust.copy.solstoneforlinuxandsolstoneforwindowsaresepa",
);

/** The same scope on an app's own page. */
export const APP_PAGE_SCOPE_LINE = msg(
	"trust.copy.thispageisaboutproductthesolstoneappthejour",
);
