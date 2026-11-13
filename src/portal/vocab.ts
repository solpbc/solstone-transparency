// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { msg, t } from "../../i18n/lookup";

/**
 * Closed structural vocabulary for the Wave 1 portal. These strings are not
 * CMO copy — they come from the CPO state-semantics table and the IA
 * primitives. Do not rephrase.
 */

import type { ProductSlug } from "../legacy/types";

export const AXIS_PUBLICATION = t("trust.vocab.publication");
export const AXIS_FRESHNESS = t("trust.vocab.evidencefreshness");
export const AXIS_VERIFICATION = t("trust.vocab.verification");
export const AXIS_REBUILD = t("trust.vocab.rebuild");

export const KIND_SIGNED = t("trust.vocab.signed");
export const KIND_REGISTER = t("trust.vocab.register");
export const KIND_DECLARATION = t("trust.vocab.solpbcsays");
export const KIND_VERIFIER = t("trust.vocab.verifier");

/**
 * Display names, per sol pbc brand canon: the journal is
 * "the journal", never "solstone journal"; an app for a platform is
 * "solstone for <os>", never a "solstone <noun>" compound. Future surfaces
 * follow the same rule; the operated-services layer is named by mechanism.
 */
export const PRODUCT_DISPLAY: Record<ProductSlug, string> = {
	journal: t("trust.vocab.thejournal"),
	linux: t("trust.vocab.solstoneforlinux"),
	windows: t("trust.vocab.solstoneforwindows"),
	macos: t("trust.vocab.solstoneformacos"),
	tmux: t("trust.vocab.solstonefortmux"),
};

/** One line above the coverage caveat on /software/: this portal is for all of solstone. */
export const SOFTWARE_SCOPE_LINE = t(
	"trust.vocab.thisportalisforallofsolstonenotonlythejour",
);

export const WINDOWS_ONE_FACT = t(
	"trust.vocab.thispageshowsonefactratherthanfourseparatea",
);

/** Structural summary for a superseded (non-tip) version page. Placeholders: product, version, published_utc. */
export const VERSION_SUMMARY_NOT_TIME_BOUND = msg(
	"trust.vocab.thisisthesignedrecordofproductversionpublish2",
);

/** Structural summary for a tip whose freshness pointer could not be checked. Placeholders: product, version, published_utc, reason. */
export const VERSION_SUMMARY_UNAVAILABLE = msg(
	"trust.vocab.thisisthesignedrecordofproductversionpublish3",
);

export const VERIFY_LEAD_IN = t(
	"trust.vocab.fromanyreleasesrawevidencetabledownloadledger",
);

export function verifyCommand(filename: string): string {
	return t("trust.vocab.minisignvmledgerentryjsonpfilenamexledgeren", {
		filename: filename,
	});
}

export const STATE_PAUSED = t("trust.vocab.paused");

// ---- v2 structural vocabulary (not CMO copy; headings, labels, command shapes) ----

export const HEADING_V2_RECORDS = t("trust.vocab.v2releaserecords");
export const HEADING_V1_TIMELINE_CLOSED = t(
	"trust.vocab.v1releasetimelineclosedchain",
);
export const HEADING_V1_METHOD = t("trust.vocab.method1av1recordwithminisign");
export const HEADING_V2_METHOD = t(
	"trust.vocab.method2thev2registerwithverifyv2",
);
export const HEADING_V3_METHOD = t(
	"trust.vocab.method3onev2recordwithverifyrelease",
);
export const HEADING_V1_KEY = t("trust.vocab.thev1signingkey");
export const HEADING_V2_ROOT = t("trust.vocab.thev2signingroot");
export const HEADING_WITNESS_LINES = t(
	"trust.vocab.thewitnessloglinesforthisroot",
);
export const HEADING_RECORD_CLAIMS = t("trust.vocab.whattherecordsaysitproves");
export const KEYS_PAGE_TITLE_V2 = t("trust.vocab.signingkeys");
export const V2_RECORD_TAG = t("trust.vocab.v2record");
export const V1_RECORD_TAG = t("trust.vocab.v1record");
export const STATE_ASSERTED_UNTIL = t("trust.vocab.asserteduntil");
export const STATE_EXPIRED = t("trust.vocab.expired");
export const STATE_NO_RECORD_YET = t("trust.vocab.norecordyet");
export const STATE_V2_NOT_CHECKED = t("trust.vocab.v2registernotchecked");
/** A v2 record that failed its check for any reason; the reason phrase beside it says which. Never "signature", because some failures leave the signature valid. */
export const STATE_DID_NOT_VERIFY = t("trust.vocab.didnotverify");
export const HEADING_V1_PROVES = t("trust.vocab.whatthev1recordsprove");
export const HEADING_V1_DOES_NOT_PROVE = t(
	"trust.vocab.whatthev1recordsdonotprove",
);

/** Structural summary for a non-tip v1 version page once a v2 root exists: chain position without a status word on the chain. Placeholders: product, version, published_utc. */
export const VERSION_SUMMARY_NOT_TIME_BOUND_V2 = msg(
	"trust.vocab.thisisthesignedrecordofproductversionpublish1",
);

/** The verifier's rejection reason in reader words. The code itself stays in the model and the packet, never on the page. */
export function readerReason(reason: string): string {
	switch (reason) {
		case "expired":
			return t("trust.vocab.oneofitssignedvaliditywindowshadpassed");
		case "unavailable":
		case "retrieval-failed":
			return t("trust.vocab.partoftheregistercouldnotbefetchedorchecked");
		case "hash-mismatch":
		case "length-mismatch":
		case "snapshot-mismatch":
			return t("trust.vocab.afiledidnotmatchitssigneddescription");
		case "signature-invalid":
		case "threshold-unmet":
		case "key-not-in-role":
		case "unknown-key":
		case "keyid-mismatch":
			return t("trust.vocab.asignaturedidnotcheckout");
		case "version-rollback":
			return t("trust.vocab.anolderversionwasservedthanonealreadyseen");
		case "migration-target-mismatch":
			return t("trust.vocab.av1objectdidnotmatchthemanifest");
		case "trust-store-corrupt":
			return t("trust.vocab.thecheckersownsavedstatedidnotreadback");
		case "compromised":
			return t("trust.vocab.itssigningkeyismarkedcompromisedinthepolicy");
		case "subject-mismatch":
			return t("trust.vocab.therecorddoesnotnamewhatitwaspublishedas");
		case "unrecognized-predicate":
		case "predicate-malformed":
		case "malformed":
		case "oversized":
		case "too-deep":
		case "duplicate-key":
		case "invalid-encoding":
		case "byte-length-changed":
		case "unpaired-surrogate":
		case "non-finite-number":
		case "non-integer-number":
		case "undefined-value":
		case "integer-not-round-trippable":
		case "malformed-key":
		case "wrong-key-length":
		case "wrong-signature-length":
		case "unsupported-key-type":
		case "unsupported-spec-version":
			return t("trust.vocab.afiledidnotparse");
		case "metadata-type-mismatch":
		case "payload-type-mismatch":
		case "filename-version-mismatch":
		case "snapshot-role-dropped":
			return t("trust.vocab.afiledidnotmatchitssigneddescription");
		case "dangling-keyid":
		case "degenerate-role-configuration":
		case "unsafe-target-path":
		case "delegation-too-deep":
			return t("trust.vocab.therootsrolesetupdidnotcheckout");
		case "outside-issuance-window":
		case "role-not-authorized":
			return t("trust.vocab.thesigningkeywasnotauthorizedforthisrecord");
		default:
			return t("trust.vocab.thecheckreportedreason", { reason: reason });
	}
}

export const VERIFY_V2_LEAD_IN = t(
	"trust.vocab.savetherawrootfilelinkedonkeysastufrootjs",
);

export const VERIFY_V3_LEAD_IN = t(
	"trust.vocab.withthesamepinnedtufrootjsonnametherecordb",
);

export function verifyV2Command(
	metadataBase: string,
	targetsBase: string,
): string {
	return t("trust.vocab.solstonetransparencyverifyv2roottufrootjsonm", {
		metadata: metadataBase,
		targets: targetsBase,
	});
}
/** The record-level command. PRODUCT and VERSION are the record's own values as shown on its page. */
export function verifyReleaseCommand(
	metadataBase: string,
	targetsBase: string,
): string {
	return t("trust.vocab.solstonetransparencyverifyreleaseroottufrootj1", {
		metadata: metadataBase,
		targets: targetsBase,
	});
}

function shellArgument(value: string): string {
	if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) return value;
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function verifyReleaseRecordCommand(
	metadataBase: string,
	targetsBase: string,
	product: string,
	version: string,
): string {
	return t("trust.vocab.solstonetransparencyverifyreleaseroottufrootj2", {
		product: shellArgument(product),
		version: shellArgument(version),
		metadata: metadataBase,
		targets: targetsBase,
	});
}
export const STATE_NOT_TIME_BOUND = t("trust.vocab.nottimebound");
export const STATE_NOT_ATTEMPTED = t("trust.vocab.notattempted");
export const STATE_COULD_NOT_BE_CHECKED = t("trust.vocab.couldnotbechecked");
/** Retired 2026-09-07 in favour of `STATE_DID_NOT_VERIFY`: an invalid outcome is not always a signature failure. Kept exported for one release so nothing outside this tree breaks. */
export const STATE_SIGNATURE_DID_NOT_VERIFY = t(
	"trust.vocab.signaturedidnotverify",
);
