// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { HTML_LANG, t } from "../../i18n/lookup";

/**
 * Per-route HTML renderers for the portal. No JavaScript ships; CSS is
 * served from the model-independent /static/portal.css route. No
 * third-party URLs except already-allowlisted evidence links and sol pbc's
 * own witness page.
 *
 * Two models feed every page: the v1 register (`PortalModel`) and the v2
 * register view (`V2Model`). When the v2 model is `absent` every renderer
 * produces exactly the Wave 1 page; the v2 branches below are reached only
 * when a pinned v2 root exists, so nothing on the live portal can say a v2
 * root exists before one does.
 */

import {
	ABOUT_READABLE_BODY,
	FOOTER_OWNERSHIP_LINE,
	HOME_HERO_EXPLAINER,
	HOME_PUBLICATION_DECLARATION,
	HOME_REGISTER_SUMMARY_LEAD,
	KEYS_ROLE_STATEMENT,
	NOT_FOUND_GENERIC,
	NOT_FOUND_VERSION_SHAPED,
	PRODUCT_GAP_NOTE,
	SOFTWARE_COVERAGE_CAVEAT,
	SOFTWARE_INDEX_LEAD,
	VERIFY_METHOD_INTRO,
	VERIFY_OUTCOME_FAIL,
	VERIFY_OUTCOME_PASS,
	VERIFY_OUTCOME_UNREACHABLE,
	VERSION_DOES_NOT_PROVE,
	VERSION_DOES_PROVE,
	VERSION_PLAIN_SUMMARY,
	WINDOWS_ABSENCE_EXPLAINER,
	homeRegisterSummaryRow,
	productDoesNotProve,
	productDoesProve,
	productPlainSummary,
	productPlainSummaryUnfilled,
} from "../legacy/copy";
import { aboutUrl, validateRawLink } from "../legacy/rawlink";
import type {
	ArtifactRef,
	AxisBlock,
	EntryRecord,
	EvidenceLinkStatus,
	GapRecord,
	ModelConstructionFailure,
	ModelDegraded,
	PortalModel,
	ProductSlug,
	SubjectModel,
	TimelineEntry,
} from "../legacy/types";
import {
	ABOUT_READABLE_BODY_LEAD,
	APPS_SEPARATE_LINE,
	APP_PAGE_SCOPE_LINE,
	AXIS_PUBLICATION_A,
	AXIS_PUBLICATION_B,
	HOME_PUBLICATION_DECLARATION_A,
	HOME_PUBLICATION_DECLARATION_A_PARTIAL,
	HOME_PUBLICATION_DECLARATION_A_UNBOUND,
	HOME_PUBLICATION_DECLARATION_B,
	HOME_PUBLICATION_DECLARATION_UNVERIFIED,
	HOME_REGISTER_SUMMARY_ROW_V1_CLOSED,
	HOME_REGISTER_SUMMARY_ROW_V1_CLOSED_UNCHECKED,
	HOME_REGISTER_SUMMARY_ROW_V2,
	JOURNAL_PLATFORMS_LINE,
	KEYS_V1_ROLE_STATEMENT_A,
	KEYS_V1_STATUS,
	KEYS_V2_ROOT_INTRO,
	KEYS_V2_ROOT_INTRO_SINGLE,
	KEYS_WITNESS_LEAD,
	LEGACY_BINDING_BOUND,
	LEGACY_BINDING_NOT_VERIFIED,
	LEGACY_BINDING_PARTIAL,
	PRODUCT_EXPECTED_GAP,
	PRODUCT_GAP_NOTE_V1_TO_V2,
	PRODUCT_NO_V1_SUMMARY_B,
	PRODUCT_PLAIN_SUMMARY_A,
	PRODUCT_PLAIN_SUMMARY_B,
	PRODUCT_RECORD_FAILED,
	SOFTWARE_COVERAGE_CAVEAT_B,
	SOFTWARE_UNMAPPED_PRODUCTS,
	V2_EXPIRED,
	V2_UNVERIFIED,
	VERIFY_METHOD_INTRO_V2,
	VERIFY_METHOD_INTRO_V3,
	VERIFY_OUTCOME_V2_ACCEPTED,
	VERIFY_OUTCOME_V2_COULD_NOT_RUN,
	VERIFY_OUTCOME_V2_REJECTED,
	VERIFY_OUTCOME_V3_ACCEPTED,
	VERIFY_OUTCOME_V3_COULD_NOT_RUN,
	VERIFY_OUTCOME_V3_REJECTED,
	VERIFY_TWO_METHODS_LEAD,
	VERSION_PLAIN_SUMMARY_V1_CLOSED,
	VERSION_PLAIN_SUMMARY_V2,
	VERSION_RECORD_CLAIMS_LEAD,
	WINDOWS_ABSENCE_EXPLAINER_STATE_A,
} from "../v2view/copy";
import {
	type V2Model,
	type V2ReleaseRecord,
	type V2SoftwareEntry,
	type V2UnverifiedModel,
	type V2VerifiedModel,
	slugForProduct,
} from "../v2view/types";
import { htmlCatalog, substituteCopy } from "./copyfill";
import { escapeHtml, trustedText, untrustedText } from "./escape";
import {
	type EvidenceRow,
	type PublicationOverride,
	type StateTone,
	axisBlock,
	declaration,
	evidenceTable,
	kindTag,
	stateSpan,
	v2AxisBlock,
} from "./primitives";
import { STYLESHEET_PATH, versionPath } from "./routes";
import {
	HEADING_RECORD_CLAIMS,
	HEADING_V1_DOES_NOT_PROVE,
	HEADING_V1_KEY,
	HEADING_V1_METHOD,
	HEADING_V1_PROVES,
	HEADING_V1_TIMELINE_CLOSED,
	HEADING_V2_METHOD,
	HEADING_V2_RECORDS,
	HEADING_V2_ROOT,
	HEADING_V3_METHOD,
	HEADING_WITNESS_LINES,
	KEYS_PAGE_TITLE_V2,
	PRODUCT_DISPLAY,
	SOFTWARE_SCOPE_LINE,
	STATE_COULD_NOT_BE_CHECKED,
	STATE_DID_NOT_VERIFY,
	STATE_NO_RECORD_YET,
	STATE_V2_NOT_CHECKED,
	V1_RECORD_TAG,
	V2_RECORD_TAG,
	VERIFY_LEAD_IN,
	VERIFY_V2_LEAD_IN,
	VERIFY_V3_LEAD_IN,
	VERSION_SUMMARY_NOT_TIME_BOUND,
	VERSION_SUMMARY_NOT_TIME_BOUND_V2,
	VERSION_SUMMARY_UNAVAILABLE,
	WINDOWS_ONE_FACT,
	readerReason,
	verifyCommand,
	verifyReleaseCommand,
	verifyReleaseRecordCommand,
	verifyV2Command,
} from "./vocab";

type NavCurrent = "home" | "software" | "verify" | "keys" | "about" | "none";

function navLink(
	href: string,
	label: string,
	section: "home" | "software" | "verify" | "keys",
	current: NavCurrent,
): string {
	let aria = "";
	if (section === "home" && current === "home") aria = ` aria-current="page"`;
	else if (section !== "home" && current === section)
		aria = ` aria-current="true"`;
	return `<a href="${escapeHtml(href)}"${aria}>${trustedText(label)}</a>`;
}

function verificationTone(
	state: "valid" | "invalid" | "unavailable",
): StateTone {
	if (state === "valid") return "success";
	if (state === "invalid") return "danger";
	return "warn";
}

function shell(args: {
	title: string;
	current: NavCurrent;
	path: string;
	breadcrumbs?: { href?: string; label: string }[];
	main: string;
}): string {
	const crumbs =
		args.breadcrumbs && args.breadcrumbs.length > 0
			? `<nav class="breadcrumbs" aria-label="${t("trust.page.breadcrumb")}"><ol>${args.breadcrumbs
					.map((c, i) => {
						const last = i === (args.breadcrumbs?.length ?? 0) - 1;
						if (last) {
							return `<li><span aria-current="page">${trustedText(c.label)}</span></li>`;
						}
						const href = c.href ?? "/";
						return `<li><a href="${escapeHtml(href)}">${trustedText(c.label)}</a></li>`;
					})
					.join("")}</ol></nav>`
			: "";
	return `<!DOCTYPE html>
<html lang="${HTML_LANG}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${trustedText(args.title)}</title>
<link rel="icon" href="/static/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="${STYLESHEET_PATH}">
<link rel="canonical" href="https://trust.solstone.app${escapeHtml(args.path)}">
</head>
<body>
<a href="#main" class="skip-link">${trustedText(t("trust.page.skiptocontent"))}</a>
<header class="shell-header">
<div class="shell-header__inner">
<a class="lockup" href="/">${trustedText(t("trust.page.trustsolstoneapp"))}</a>
<nav class="primary-nav" aria-label="${t("trust.page.mainnavigation")}">
${navLink("/", t("trust.page.home"), "home", args.current)}
${navLink("/software/", t("trust.page.software"), "software", args.current)}
${navLink("/verify/", t("trust.page.verify"), "verify", args.current)}
${navLink("/keys/", t("trust.page.keys"), "keys", args.current)}
</nav>
</div>
</header>
${crumbs}
<main id="main">${args.main}</main>
<footer class="shell-footer">
<div class="inner">
<div>${trustedText(FOOTER_OWNERSHIP_LINE)}</div>
<nav aria-label="${t("trust.page.footer")}"><ul>
<li><a href="/software/">${trustedText(t("trust.page.software"))}</a></li>
<li><a href="/verify/">${trustedText(t("trust.page.verify"))}</a></li>
<li><a href="/keys/">${trustedText(t("trust.page.keys"))}</a></li>
<li><a href="/about/">${trustedText(t("trust.page.aboutthisregister"))}</a></li>
<li><a href="https://transparency.solstone.app/">${trustedText(t("trust.page.rawevidence"))}</a></li>
</ul></nav>
</div>
</footer>
</body>
</html>`;
}

// ---- v2 model helpers ------------------------------------------------------

function v2Known(v2: V2Model): v2 is V2VerifiedModel | V2UnverifiedModel {
	return v2.state !== "absent";
}

/** Valid v2 release records for a portal slug, in builder order (product, then numeric version). */
function v2ValidReleases(v2: V2Model, slug: ProductSlug): V2ReleaseRecord[] {
	if (v2.state !== "verified") return [];
	return v2.software.filter(
		(s): s is V2ReleaseRecord =>
			s.kind === "release" &&
			s.slug === slug &&
			s.verification.state === "valid",
	);
}

function v2EntriesFor(v2: V2Model, slug: ProductSlug): V2SoftwareEntry[] {
	if (v2.state !== "verified") return [];
	return v2.software.filter((s) => s.slug === slug);
}

function appRecordState(v2: V2Model, slug: ProductSlug): string {
	if (v2.state === "absent") return t("trust.vocab.notattempted");
	if (v2.state === "unverified") return STATE_COULD_NOT_BE_CHECKED;
	const entries = v2EntriesFor(v2, slug);
	const record = entries.find((entry) => entry.kind === "release");
	if (record?.kind === "release")
		return record.verification.state === "invalid"
			? STATE_DID_NOT_VERIFY
			: STATE_COULD_NOT_BE_CHECKED;
	return entries.length > 0
		? t("trust.page.expectedrecordmissing")
		: t("trust.page.norecordsinthisregister");
}

function latestV2(v2: V2Model, slug: ProductSlug): V2ReleaseRecord | undefined {
	const valid = v2ValidReleases(v2, slug);
	return valid[valid.length - 1];
}

function anyValidV2(v2: V2Model): boolean {
	return (
		v2.state === "verified" &&
		v2.software.some(
			(s) => s.kind === "release" && s.verification.state === "valid",
		)
	);
}

/** The earliest-issued valid record: the one the state (b) declaration names as "the first". */
function firstValidV2(v2: V2Model): V2ReleaseRecord | undefined {
	if (v2.state !== "verified") return undefined;
	const valid = v2.software.filter(
		(s): s is V2ReleaseRecord =>
			s.kind === "release" && s.verification.state === "valid",
	);
	return [...valid].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))[0];
}

function displayFor(record: {
	slug: ProductSlug | undefined;
	product: string;
}): string {
	return record.slug === undefined
		? record.product
		: PRODUCT_DISPLAY[record.slug];
}

/**
 * How the publication axis reads for one subject once a v2 root is known.
 * Undefined keeps the v1 `paused` row. The axis answers "is sol pbc
 * publishing records for THIS subject right now?", so the register-wide
 * state (b) declaration is never rendered as a per-subject fact: a subject
 * without a v2 record reads "no record yet" while another has one.
 */
function publicationOverride(
	v2: V2Model,
	slug?: ProductSlug,
): PublicationOverride | undefined {
	if (v2.state === "absent") return undefined;
	if (v2.state === "unverified") {
		return {
			kind: "declaration",
			label: STATE_V2_NOT_CHECKED,
			tone: "neutral",
			basis: unverifiedReason(v2),
		};
	}
	if (!anyValidV2(v2)) {
		return { kind: "declaration", label: AXIS_PUBLICATION_A, tone: "neutral" };
	}
	if (slug !== undefined && latestV2(v2, slug) === undefined) {
		return { kind: "declaration", label: STATE_NO_RECORD_YET, tone: "neutral" };
	}
	return { kind: "declaration", label: AXIS_PUBLICATION_B, tone: "neutral" };
}

/** The verifier's reason in reader words; the reason code stays in the model. */
function unverifiedReason(v2: V2UnverifiedModel): string {
	return readerReason(v2.failure.reason);
}

/** The verifier's own report about a repository that did not verify; rendered wherever the v2 register would otherwise appear. */
function unverifiedCallout(v2: V2UnverifiedModel): string {
	const unverified = substituteCopy(V2_UNVERIFIED, {
		reason: unverifiedReason(v2),
	});
	const expired =
		v2.freshness === undefined
			? ""
			: `<p>${substituteCopy(V2_EXPIRED, { date: v2.freshness.expiredAt })}</p>`;
	return `<div class="declaration state-warn">${kindTag("verifier")}<p>${unverified}</p>${expired}</div>`;
}

/** The products a legacy binding covers, as display names for `{products}`. */
function boundProducts(v2: V2VerifiedModel): string {
	if (v2.legacy.state !== "bound") return "";
	const names = v2.legacy.products.map((p) => {
		const slug = slugForProduct(p.product);
		return slug === undefined ? p.product : PRODUCT_DISPLAY[slug];
	});
	return andList(names);
}

function andList(words: readonly string[]): string {
	const items =
		words.length <= 1
			? (words[0] ?? "")
			: `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
	// The catalog message is the list itself. The word "and" stays in the
	// joined argument, which is how this line was written.
	if (items.length === 0) return "";
	return t("trust.page.namesand", { items });
}

/** File-name platform tokens in reading order, with their reader words. */
const PLATFORM_WORDS = [
	["macos", t("trust.page.mac")],
	["windows", t("trust.page.windows")],
	["linux", t("trust.page.linux")],
] as const;

/**
 * The platforms a record's files are named for (`…-macos-…`, `…-windows-…`,
 * `…-linux-…`), read from the signed artifact list. A file with no platform
 * in its name adds nothing; a record with none yields an empty list.
 */
export function recordPlatforms(record: V2ReleaseRecord): string[] {
	const found = new Set<string>();
	for (const a of record.artifacts) {
		const name = a.url.slice(a.url.lastIndexOf("/") + 1);
		const m = /-(macos|windows|linux)-/.exec(name);
		if (m?.[1] !== undefined) found.add(m[1]);
	}
	return PLATFORM_WORDS.filter(([token]) => found.has(token)).map(
		([, word]) => word,
	);
}

/**
 * Coverage beside the per-OS app entries: which platforms the journal's
 * newest valid record names files for. Empty when there is no such record
 * or it names no platform, so the line is never asserted without evidence.
 */
function journalPlatformsLine(v2: V2Model): string {
	const latest = latestV2(v2, "journal");
	if (latest === undefined) return "";
	const platforms = recordPlatforms(latest);
	if (platforms.length === 0) return "";
	const text = substituteCopy(JOURNAL_PLATFORMS_LINE, {
		version: latest.version,
		platforms: andList(platforms),
	});
	return `<p>${kindTag("signed")} ${text}</p>`;
}

/** The platforms line and the apps-are-separate line, for the home register and the software index. */
function appRowsCoverage(v2: V2Model): string {
	const platforms = journalPlatformsLine(v2);
	if (platforms === "") return "";
	return `${platforms}\n<p>${trustedText(APPS_SEPARATE_LINE)}</p>`;
}

/** The same coverage at the top of an app's own page, with the way to the journal. */
function appPageCoverage(
	v2: V2Model,
	product: Exclude<ProductSlug, "journal">,
): string {
	const platforms = journalPlatformsLine(v2);
	if (platforms === "") return "";
	return `<p>${substituteCopy(APP_PAGE_SCOPE_LINE, { product: PRODUCT_DISPLAY[product] })}</p>\n${platforms}\n<p><a href="/software/journal/">${trustedText(t("trust.page.thejournalsrecords"))}</a></p>`;
}

function legacyBindingLine(v2: V2VerifiedModel): string {
	if (v2.legacy.state === "bound") {
		const count = String(v2.legacy.objectCount);
		const text =
			v2.legacy.coverage === "complete"
				? substituteCopy(LEGACY_BINDING_BOUND, { count })
				: substituteCopy(LEGACY_BINDING_PARTIAL, {
						count,
						products: boundProducts(v2),
					});
		return `<p>${kindTag("verifier")} ${text}</p>`;
	}
	if (v2.legacy.state === "not-verified") {
		return `<p>${kindTag("verifier")} ${substituteCopy(LEGACY_BINDING_NOT_VERIFIED, { reason: readerReason(v2.legacy.reasonCode) })}</p>`;
	}
	return "";
}

function rawLinkCell(link: EvidenceLinkStatus): string {
	if (link.status === "linked")
		return `<a class="raw-link" href="${escapeHtml(link.link.url)}">${untrustedText(link.link.url)}</a>`;
	if (link.status === "rejected")
		return htmlCatalog(
			"trust.page.unavailablereason",
			{ reason: link.rejected.reason },
			["reason"],
		);
	return trustedText(t("trust.page.notarawlink"));
}

function linkFromUrl(url: string): EvidenceLinkStatus {
	const checked = validateRawLink(url);
	return checked.status === "linked"
		? { status: "linked", link: { url: checked.url } }
		: { status: "rejected", rejected: { reason: checked.reason } };
}

// ---- v1 model helpers ------------------------------------------------------

type ProductHistory = Extract<SubjectModel, { timeline: TimelineEntry[] }>;

function historySubject(
	model: PortalModel,
	product: "journal" | "linux",
): ProductHistory {
	const s = model.subjects.find((x) => x.product === product);
	if (!s || !("timeline" in s)) {
		throw new Error(`portal model missing ${product} subject`);
	}
	return s;
}

function tipEntry(timeline: TimelineEntry[]): EntryRecord | undefined {
	return timeline.find((t): t is EntryRecord => t.kind === "entry" && t.isTip);
}

function entryCount(timeline: TimelineEntry[]): number {
	return timeline.filter((t) => t.kind === "entry").length;
}

function failureReason(f: ModelConstructionFailure): string {
	if (f.kind === "missing-subject") return t("trust.page.missingsubject");
	if (f.kind === "missing-object")
		return t("trust.page.noevidenceobjectatname", { name: f.declaredName });
	return f.reason;
}

function axesForProduct(
	model: PortalModel,
	subject: ProductHistory,
): AxisBlock {
	const tip = tipEntry(subject.timeline);
	if (tip) return tip.axes;
	const failure = [...subject.timeline]
		.reverse()
		.find(
			(t): t is ModelConstructionFailure =>
				t.kind === "missing-subject" ||
				t.kind === "missing-object" ||
				t.kind === "malformed",
		);
	const checkedAt = failure?.checkedAt ?? model.generatedAt;
	return {
		publication: {
			state: "paused",
			basis: model.registerDeclaration.basis,
			provenance: model.registerDeclaration.provenance,
		},
		freshness: {
			state: "unavailable",
			reason: t("trust.page.notcheckedbecausethetipentryitselfcouldnotb"),
			checkedAt,
			provenance: { kind: "verifier", checkedAt },
		},
		verification: {
			state: "unavailable",
			reason: failure
				? failureReason(failure)
				: t("trust.page.norecordwasconstructedforthisproduct"),
			checkedAt,
			provenance: { kind: "verifier", checkedAt },
		},
		rebuild: { state: "not-attempted", provenance: { kind: "register" } },
	};
}

function proveColumns(
	does: string,
	doesNot: string,
	headings: { does: string; doesNot: string } = {
		does: "what this proves",
		doesNot: "what this does not prove",
	},
): string {
	return `<div class="prove-columns"><div class="does"><h3>${trustedText(headings.does)}</h3><p>${does}</p></div><div class="does-not"><h3>${trustedText(headings.doesNot)}</h3><p>${doesNot}</p></div></div>`;
}

function pushLink(
	rows: EvidenceRow[],
	item: string,
	detail: string,
	link: EvidenceLinkStatus,
): void {
	if (link.status === "linked") {
		rows.push({ type: "linked", item, detail, url: link.link.url });
		return;
	}
	if (link.status === "rejected") {
		rows.push({ type: "rejected", item, reason: link.rejected.reason });
		return;
	}
	rows.push({ type: "unhosted", artifact: link.artifact });
}

function groupedMembers(
	label: string,
	members: { ref: ArtifactRef; link: EvidenceLinkStatus }[],
): EvidenceRow[] {
	const linked: { name: string; url: string }[] = [];
	const rest: EvidenceRow[] = [];
	for (const m of members) {
		if (m.link.status === "linked") {
			linked.push({ name: m.ref.name, url: m.link.link.url });
		} else if (m.link.status === "rejected") {
			rest.push({
				type: "rejected",
				item: m.ref.name,
				reason: m.link.rejected.reason,
			});
		} else {
			rest.push({ type: "unhosted", artifact: m.link.artifact });
		}
	}
	const rows: EvidenceRow[] = [];
	if (linked.length > 1) {
		rows.push({
			type: "group",
			item: t("trust.page.labelcount", { label: label, count: linked.length }),
			detail: t("trust.evidence.linkcount", { count: linked.length }),
			members: linked,
		});
	} else if (linked.length === 1 && linked[0] !== undefined) {
		rows.push({
			type: "linked",
			item: label,
			detail: linked[0].name,
			url: linked[0].url,
		});
	}
	rows.push(...rest);
	return rows;
}

function evidenceRows(model: PortalModel, entry: EntryRecord): EvidenceRow[] {
	const rows: EvidenceRow[] = [];
	pushLink(
		rows,
		t("trust.page.immutableentry"),
		t("trust.page.signedledgerentry"),
		entry.entryLink,
	);
	pushLink(
		rows,
		t("trust.page.entrysignature"),
		t("trust.page.minisignsignatureovertheentry"),
		entry.entrySigLink,
	);
	if (entry.isTip) {
		if (entry.latestLink)
			pushLink(
				rows,
				t("trust.page.signedpointer"),
				t("trust.page.mutablelatestpointer"),
				entry.latestLink,
			);
		if (entry.latestSigLink)
			pushLink(
				rows,
				t("trust.page.pointersignature"),
				t("trust.page.minisignsignatureoverthepointer"),
				entry.latestSigLink,
			);
	}
	rows.push(
		...groupedMembers(t("trust.page.releasemanifests"), entry.manifests),
	);
	rows.push(
		...groupedMembers(t("trust.page.nativeproofreceipts"), entry.proofs),
	);
	// Distributed artifacts are never independently hosted on the evidence
	// surface, by architectural invariant — they are always declared by
	// name/digest, never raw-linked (transition plan § 5, IA § 2 item 4).
	// This renders every artifact as "unhosted" from its own ref data
	// unconditionally, rather than branching on `a.link.status`: `pushLink`'s
	// "linked" row type treats `item` as a fixed, trusted label everywhere
	// else it's used (it always is one, e.g. "immutable entry", "signing
	// key"), but an artifact's own name is model-derived and must go through
	// the same untrusted-string path every other model-derived string does.
	// Branching on `a.link.status` here would make that safety property hold
	// only because today's adapter happens to always set it to "unhosted",
	// not by construction.
	for (const a of entry.artifacts) {
		rows.push({
			type: "unhosted",
			artifact: {
				name: a.ref.name,
				sha256: a.ref.sha256,
				bytes: a.ref.bytes,
				note: "not independently hosted; verify by hash comparison",
			},
		});
	}
	const key = model.keys[0];
	if (key) pushLink(rows, t("trust.page.signingkey"), key.filename, key.link);
	return rows;
}

function summaryForProduct(
	product: "journal" | "linux",
	timeline: TimelineEntry[],
	v2: V2Model,
): string {
	const tip = tipEntry(timeline);
	const count = String(entryCount(timeline));
	const latest = latestV2(v2, product);
	if (latest !== undefined) {
		return substituteCopy(PRODUCT_PLAIN_SUMMARY_B, {
			product: PRODUCT_DISPLAY[product],
			version: latest.version,
			issued_at: latest.issuedAt,
		});
	}
	if (v2Known(v2) && tip) {
		return substituteCopy(PRODUCT_PLAIN_SUMMARY_A, {
			product: PRODUCT_DISPLAY[product],
			version: tip.version,
		});
	}
	if (!tip) {
		return trustedText(productPlainSummaryUnfilled(product));
	}
	return substituteCopy(productPlainSummary(product), {
		count,
		version: tip.version,
		date: tip.publishedUtc,
	});
}

function timelineHtml(
	product: "journal" | "linux",
	timeline: TimelineEntry[],
): string {
	const items = timeline
		.map((item) => {
			if (item.kind === "gap") {
				return gapRow(item);
			}
			if (item.kind === "entry") {
				const href = versionPath(product, item.version);
				const fresh =
					item.axes.freshness.state === "expired"
						? ` ${stateSpan("neutral", trustedText(t("trust.vocab.expired")))}`
						: "";
				return `<li><span class="v">${untrustedText(item.version)}</span> · ${untrustedText(item.publishedUtc)} · ${kindTag(item.axes.verification.provenance.kind)} ${stateSpan(verificationTone(item.axes.verification.state), trustedText(t("trust.page.state", { state: item.axes.verification.state })))}${fresh} · <a href="${escapeHtml(href)}">${trustedText(t("trust.page.record"))}</a></li>`;
			}
			const href = versionPath(product, item.version);
			return `<li><span class="v">${untrustedText(item.version)}</span> · ${trustedText(t("trust.page.nopublishdate"))} · ${kindTag("verifier")} ${stateSpan("danger", untrustedText(failureReason(item)))} · <a href="${escapeHtml(href)}">${trustedText(t("trust.page.record"))}</a></li>`;
		})
		.join("");
	return `<ol class="timeline">${items}</ol>`;
}

function gapRow(gap: GapRecord): string {
	const note = substituteCopy(PRODUCT_GAP_NOTE, {
		version: gap.absentVersion,
		prev: gap.afterVersion,
		next: gap.beforeVersion,
	});
	return `<li class="is-gap"><span class="v">${untrustedText(gap.absentVersion)}</span> · ${kindTag("register")} ${stateSpan("neutral", trustedText(t("trust.page.norecord")))}<div class="gap-note">${note} <a href="/software/#coverage">${trustedText(t("trust.page.whycoverageisstatednotimplied"))}</a></div></li>`;
}

/** The v2 records section of a product page: the v1→v2 gap note, then every record and gap the register carries for this product. */
function v2RecordsSection(
	v2: V2Model,
	slug: ProductSlug,
	v1Tip: string | undefined,
): string {
	const entries = v2EntriesFor(v2, slug);
	if (v2.state !== "verified" || entries.length === 0) return "";
	const items: string[] = [];
	const firstValid = v2ValidReleases(v2, slug)[0];
	if (v1Tip !== undefined && firstValid !== undefined) {
		const note = substituteCopy(PRODUCT_GAP_NOTE_V1_TO_V2, {
			prev: v1Tip,
			next: firstValid.version,
		});
		items.push(
			`<li class="is-gap">${kindTag("register")} ${stateSpan("neutral", trustedText(t("trust.page.v1tiptofirstv2record")))}<div class="gap-note">${note} <a href="/software/#coverage">${trustedText(t("trust.page.whycoverageisstatednotimplied"))}</a></div></li>`,
		);
	}
	for (const entry of entries) {
		if (entry.kind === "gap") {
			const note = substituteCopy(PRODUCT_EXPECTED_GAP, {
				product: displayFor(entry),
				version: entry.version,
				basis: entry.basis,
			});
			items.push(
				`<li class="is-gap"><span class="v">${untrustedText(entry.version)}</span> · ${kindTag("declaration")} ${stateSpan("warn", trustedText(t("trust.page.expectedrecordmissing")))}<div class="gap-note">${note}</div></li>`,
			);
			continue;
		}
		const href = versionPath(slug, entry.version);
		if (entry.verification.state === "valid") {
			items.push(
				`<li><span class="v">${untrustedText(entry.version)}</span> · ${untrustedText(entry.issuedAt)} · ${kindTag("verifier")} ${stateSpan("success", trustedText(t("trust.page.valid")))} · <a href="${escapeHtml(href)}">${trustedText(t("trust.page.record"))}</a></li>`,
			);
			continue;
		}
		const failed = substituteCopy(PRODUCT_RECORD_FAILED, {
			version: entry.version,
			reason: readerReason(entry.verification.reasonCode),
		});
		items.push(
			`<li><span class="v">${untrustedText(entry.version)}</span> · ${kindTag("verifier")} ${stateSpan(verificationTone(entry.verification.state), trustedText(entry.verification.state === "invalid" ? STATE_DID_NOT_VERIFY : STATE_COULD_NOT_BE_CHECKED))}<div class="gap-note">${failed} <a href="${escapeHtml(href)}">${trustedText(t("trust.page.record"))}</a></div></li>`,
		);
	}
	return `<h2>${trustedText(HEADING_V2_RECORDS)}</h2><ol class="timeline">${items.join("")}</ol>`;
}

// ---- pages -------------------------------------------------------------------

export function renderHome(
	model: PortalModel,
	v2: V2Model,
	path: string,
): string {
	const journal = historySubject(model, "journal");
	const linux = historySubject(model, "linux");
	const jTip = tipEntry(journal.timeline);
	const lTip = tipEntry(linux.timeline);

	const declarationBlock = (() => {
		if (v2.state === "absent")
			return declaration({
				kind: "declaration",
				text: HOME_PUBLICATION_DECLARATION,
			});
		if (v2.state === "unverified") {
			return `${declaration({ kind: "declaration", text: HOME_PUBLICATION_DECLARATION_UNVERIFIED })}${unverifiedCallout(v2)}`;
		}
		const first = firstValidV2(v2);
		const stateA = () => {
			if (v2.legacy.state !== "bound")
				return trustedText(HOME_PUBLICATION_DECLARATION_A_UNBOUND);
			if (v2.legacy.coverage === "complete")
				return trustedText(HOME_PUBLICATION_DECLARATION_A);
			return substituteCopy(HOME_PUBLICATION_DECLARATION_A_PARTIAL, {
				products: boundProducts(v2),
			});
		};
		const text =
			first === undefined
				? stateA()
				: substituteCopy(HOME_PUBLICATION_DECLARATION_B, {
						product: displayFor(first),
						version: first.version,
					});
		return `<div class="declaration">${kindTag("declaration")}<p>${text}</p></div>${legacyBindingLine(v2)}`;
	})();

	const publicationCell = (slug: ProductSlug): string => {
		if (v2.state === "absent")
			return `${kindTag("declaration")} ${stateSpan("neutral", trustedText(t("trust.vocab.paused")))}`;
		const override = publicationOverride(v2, slug);
		if (override === undefined) return "";
		return `${kindTag(override.kind)} ${stateSpan(override.tone, trustedText(override.label))}`;
	};

	const rowFor = (
		slug: ProductSlug,
		tip: EntryRecord | undefined,
	): { publication: string; latest: string } => {
		const latest = latestV2(v2, slug);
		if (latest !== undefined) {
			return {
				publication: publicationCell(slug),
				latest: substituteCopy(HOME_REGISTER_SUMMARY_ROW_V2, {
					version: latest.version,
					date: latest.issuedAt,
				}),
			};
		}
		if (slug === "windows" || slug === "macos" || slug === "tmux") {
			if (slug === "windows" && v2.state === "absent")
				return {
					publication: `${kindTag("register")} ${stateSpan("neutral", trustedText(t("trust.page.norecordsinthisregister")))}`,
					latest: trustedText(homeRegisterSummaryRow(false)),
				};
			return {
				publication: `${kindTag("register")} ${stateSpan("neutral", trustedText(appRecordState(v2, slug)))}`,
				latest: trustedText(appRecordState(v2, slug)),
			};
		}
		if (v2.state === "absent") {
			return {
				publication: publicationCell(slug),
				latest: tip
					? substituteCopy(homeRegisterSummaryRow(true), {
							version: tip.version,
							date: tip.publishedUtc,
						})
					: trustedText(homeRegisterSummaryRow(false)),
			};
		}
		if (v2.state === "unverified" && tip === undefined) {
			return {
				publication: publicationCell(slug),
				latest: trustedText(STATE_COULD_NOT_BE_CHECKED),
			};
		}
		if (tip === undefined) {
			return {
				publication: `${kindTag("register")} ${stateSpan("neutral", trustedText(t("trust.page.norecordsinthisregister")))}`,
				latest: trustedText(t("trust.page.norecordsinthisregister")),
			};
		}
		return {
			publication: publicationCell(slug),
			latest: substituteCopy(
				v2.state === "unverified"
					? HOME_REGISTER_SUMMARY_ROW_V1_CLOSED_UNCHECKED
					: HOME_REGISTER_SUMMARY_ROW_V1_CLOSED,
				{ version: tip.version },
			),
		};
	};
	const j = rowFor("journal", jTip);
	const l = rowFor("linux", lTip);
	const w = rowFor("windows", undefined);
	const extraRows = (["macos"] as const)
		.map((slug) => {
			const row = rowFor(slug, undefined);
			return `<tr><td><a href="/software/${slug}/">${trustedText(PRODUCT_DISPLAY[slug])}</a></td><td>${row.publication}</td><td>${row.latest}</td></tr>`;
		})
		.join("");

	const main = `
<h1>${trustedText(t("trust.page.trustsolstoneapp"))}</h1>
<p>${trustedText(HOME_HERO_EXPLAINER)}</p>
${declarationBlock}
<h2>${trustedText(t("trust.page.theregisterataglance"))}</h2>
<p>${trustedText(HOME_REGISTER_SUMMARY_LEAD)}</p>
${appRowsCoverage(v2)}
<div class="table-scroll"><table class="register-table">
<caption class="sr-only">${trustedText(t("trust.page.softwarepublicationregistersummary"))}</caption>
<thead><tr><th scope="col">${trustedText(t("trust.page.product"))}</th><th scope="col">${trustedText(t("trust.vocab.publication"))}</th><th scope="col">${trustedText(t("trust.page.latestrecordedrelease"))}</th></tr></thead>
<tbody>
<tr><td><a href="/software/journal/">${trustedText(PRODUCT_DISPLAY.journal)}</a></td><td>${j.publication}</td><td>${j.latest}</td></tr>
<tr><td><a href="/software/linux/">${trustedText(PRODUCT_DISPLAY.linux)}</a></td><td>${l.publication}</td><td>${l.latest}</td></tr>
<tr><td><a href="/software/windows/">${trustedText(PRODUCT_DISPLAY.windows)}</a></td><td>${w.publication}</td><td>${w.latest}</td></tr>
${extraRows}
</tbody>
</table></div>
<h2>${trustedText(t("trust.page.godeeper"))}</h2>
<ul>
<li><a href="/software/">${trustedText(t("trust.page.softwareregister"))}</a></li>
<li><a href="/static/confidential-processing-whitepaper.pdf">${trustedText(t("trust.page.confidentialprocessingwhitepaper"))}</a></li>
<li><a href="https://transparency.solstone.app/software/spp/1630bf4/index.html">${trustedText(t("trust.page.confidentialprocessingappliancerecord1630bf4pub"))}</a></li>
<li><a href="https://transparency.solstone.app/software/spp/9968c21/index.html">${trustedText(t("trust.page.confidentialprocessingappliancerecord9968c21pub"))}</a></li>
<li><a href="https://transparency.solstone.app/software/spp/8e4291d/index.html">${trustedText(t("trust.page.confidentialprocessingappliancerecord8e4291dpub"))}</a></li>
<li><a href="https://transparency.solstone.app/software/spp/34a6c82/index.html">${trustedText(t("trust.page.confidentialprocessingappliance"))}</a> ${trustedText(t("trust.page.buildandverificationreportid", { id: "34a6c82" }))}</li>
<li><a href="/verify/">${trustedText(v2Known(v2) ? t("trust.home.verifylead", { lead: "v2" }) : t("trust.home.verifylead", { lead: "v1" }))}</a></li>
<li><a href="/keys/">${trustedText(v2Known(v2) ? t("trust.keys.linklabel", { label: "v2" }) : t("trust.keys.linklabel", { label: "v1" }))}</a></li>
<li><a href="/about/">${trustedText(t("trust.page.aboutthisregister"))}</a></li>
</ul>`;
	return shell({
		title: t("trust.page.trustsolstoneapp"),
		current: "home",
		path,
		main,
	});
}

export function renderSoftwareIndex(
	model: PortalModel,
	v2: V2Model,
	path: string,
): string {
	const journal = historySubject(model, "journal");
	const linux = historySubject(model, "linux");
	const jTip = tipEntry(journal.timeline);
	const lTip = tipEntry(linux.timeline);
	const card = (slug: ProductSlug, tip: EntryRecord | undefined): string => {
		const latest = latestV2(v2, slug);
		if (latest !== undefined)
			return `${kindTag("signed")} <span class="mono">${untrustedText(latest.version)}</span> ${trustedText(t("trust.page.latestrecorded"))}`;

		if (slug === "windows" || slug === "macos" || slug === "tmux")
			return `${kindTag("register")} ${stateSpan("neutral", trustedText(appRecordState(v2, slug)))}`;
		return tip
			? `${kindTag("signed")} <span class="mono">${untrustedText(tip.version)}</span> ${trustedText(t("trust.page.latestrecorded"))}`
			: kindTag("register");
	};
	const coverage = declaration({
		kind: "declaration",
		text:
			anyValidV2(v2) && v2.state === "verified"
				? SOFTWARE_COVERAGE_CAVEAT_B
				: SOFTWARE_COVERAGE_CAVEAT,
	}).replace(
		'<div class="declaration">',
		'<div class="declaration" id="coverage">',
	);
	const unmapped = (() => {
		if (v2.state !== "verified" || v2.unmappedProducts.length === 0) return "";
		const note = substituteCopy(SOFTWARE_UNMAPPED_PRODUCTS, {
			products: v2.unmappedProducts.join(", "),
		});
		const links = v2.software
			.filter((s) => s.slug === undefined && s.kind === "release")
			.map(
				(s) =>
					`<li>${untrustedText(`${s.product} ${s.version}`)} ${s.kind === "release" ? rawLinkCell(s.recordLink) : ""}</li>`,
			)
			.join("");
		return `<div class="declaration">${kindTag("register")}<p>${note}</p>${links === "" ? "" : `<ul>${links}</ul>`}</div>`;
	})();
	const main = `
<h1>${trustedText(t("trust.page.thesoftwareregister"))}</h1>
<p>${trustedText(SOFTWARE_INDEX_LEAD)}</p>
<p>${trustedText(SOFTWARE_SCOPE_LINE)}</p>
${coverage}${unmapped}
<h2>${trustedText(t("trust.page.products"))}</h2>
${appRowsCoverage(v2)}
<div class="card-grid">
<div class="card"><a class="card-link" href="/software/journal/"><h3>${trustedText(PRODUCT_DISPLAY.journal)}</h3><p>${card("journal", jTip)}</p></a></div>
<div class="card"><a class="card-link" href="/software/linux/"><h3>${trustedText(PRODUCT_DISPLAY.linux)}</h3><p>${card("linux", lTip)}</p></a></div>
<div class="card"><a class="card-link" href="/software/windows/"><h3>${trustedText(PRODUCT_DISPLAY.windows)}</h3><p>${card("windows", undefined)}</p></a></div>
${(["macos"] as const).map((slug) => `<div class="card"><a class="card-link" href="/software/${slug}/"><h3>${trustedText(PRODUCT_DISPLAY[slug])}</h3><p>${card(slug, undefined)}</p></a></div>`).join("")}
</div>`;
	return shell({
		title: t("trust.page.softwaretrustsolstoneapp"),
		current: "software",
		path,
		breadcrumbs: [
			{ href: "/", label: t("trust.page.home") },
			{ label: t("trust.page.software") },
		],
		main,
	});
}

/** The axis block a product page shows: the latest valid v2 record's axes when one exists, else the v1 tip's with the publication row re-read against the v2 model. */
function productAxes(
	model: PortalModel,
	v2: V2Model,
	slug: "journal" | "linux",
	subject: ProductHistory,
): string {
	const latest = latestV2(v2, slug);
	if (latest !== undefined && v2.state === "verified") {
		return v2AxisBlock({
			publication: {
				kind: "declaration",
				label: AXIS_PUBLICATION_B,
				tone: "neutral",
			},
			freshness: {
				state: "asserted",
				assertedUntil: v2.freshness.assertedUntil,
				sourceUrl: v2.freshness.provenance.sourceUrl,
			},
			verification: latest.verification,
			links: { verifyHref: "/verify/#v2" },
		});
	}
	return axisBlock(
		axesForProduct(model, subject),
		{ verifyHref: "/verify/" },
		publicationOverride(v2, slug),
	);
}

export function renderProduct(
	model: PortalModel,
	v2: V2Model,
	product: ProductSlug,
	path: string,
): string {
	const crumbs = [
		{ href: "/", label: t("trust.page.home") },
		{ href: "/software/", label: t("trust.page.software") },
		{ label: PRODUCT_DISPLAY[product] },
	];
	if (product === "windows" || product === "macos" || product === "tmux") {
		const latest = latestV2(v2, product);
		if (latest !== undefined && v2.state === "verified") {
			const main = `
<h1>${trustedText(PRODUCT_DISPLAY[product])}</h1>
${appPageCoverage(v2, product)}
<p>${substituteCopy(PRODUCT_NO_V1_SUMMARY_B, { product: PRODUCT_DISPLAY[product], version: latest.version, issued_at: latest.issuedAt })}</p>
${v2AxisBlock({
	publication: {
		kind: "declaration",
		label: AXIS_PUBLICATION_B,
		tone: "neutral",
	},
	freshness: {
		state: "asserted",
		assertedUntil: v2.freshness.assertedUntil,
		sourceUrl: v2.freshness.provenance.sourceUrl,
	},
	verification: latest.verification,
	links: { verifyHref: "/verify/#v2" },
})}
${v2RecordsSection(v2, product, undefined)}
<p><a href="/software/">${trustedText(t("trust.page.backtothesoftwareregister"))}</a></p>`;
			return shell({
				title: t("trust.page.producttrustsolstoneapp", {
					product: PRODUCT_DISPLAY[product],
				}),
				current: "software",
				path,
				breadcrumbs: crumbs,
				main,
			});
		}
		if (v2.state === "unverified") {
			return shell({
				title: `${PRODUCT_DISPLAY[product]} — trust.solstone.app`,
				current: "software",
				path,
				breadcrumbs: crumbs,
				main: `<h1>${trustedText(PRODUCT_DISPLAY[product])}</h1>${unverifiedCallout(v2)}`,
			});
		}
		const entries = v2EntriesFor(v2, product);
		const main = `
<h1>${trustedText(PRODUCT_DISPLAY[product])}</h1>
${appPageCoverage(v2, product)}
${entries.length === 0 ? declaration({ kind: "register", text: product === "windows" ? (v2.state === "absent" ? WINDOWS_ABSENCE_EXPLAINER : WINDOWS_ABSENCE_EXPLAINER_STATE_A) : appRecordState(v2, product), tone: "neutral" }) : ""}
${entries.length === 0 && (product === "windows" || v2.state === "verified") ? `<p>${trustedText(WINDOWS_ONE_FACT)}</p>` : ""}
${v2RecordsSection(v2, product, undefined)}
<p><a href="/software/">${trustedText(t("trust.page.backtothesoftwareregister"))}</a></p>`;
		return shell({
			title: `${PRODUCT_DISPLAY[product]} — trust.solstone.app`,
			current: "software",
			path,
			breadcrumbs: crumbs,
			main,
		});
	}
	const subject = historySubject(model, product);
	const tip = tipEntry(subject.timeline);
	const ledgerCell =
		subject.ledger.link.status === "linked"
			? `<a class="raw-link" href="${escapeHtml(subject.ledger.link.link.url)}">${untrustedText(subject.ledger.link.link.url)}</a>`
			: trustedText(t("trust.page.unavailable"));
	const timelineHeading = v2Known(v2)
		? HEADING_V1_TIMELINE_CLOSED
		: "release timeline";
	const main = `
<h1>${trustedText(PRODUCT_DISPLAY[product])}</h1>
${product === "linux" ? appPageCoverage(v2, "linux") : ""}
<p>${summaryForProduct(product, subject.timeline, v2)}</p>
${productAxes(model, v2, product, subject)}
${proveColumns(
	trustedText(productDoesProve(product)),
	trustedText(productDoesNotProve(product)),
	latestV2(v2, product) === undefined
		? undefined
		: { does: HEADING_V1_PROVES, doesNot: HEADING_V1_DOES_NOT_PROVE },
)}${v2RecordsSection(v2, product, tip?.version)}
<h2>${trustedText(timelineHeading)}</h2>
${timelineHtml(product, subject.timeline)}
<h2>${trustedText(t("trust.page.thederivedchainledger"))}</h2>
${kindTag("signed")}
<div class="table-scroll"><table class="evidence-table"><tbody><tr><td>${trustedText(t("trust.page.chainledgerderived"))}</td><td>${ledgerCell}</td></tr></tbody></table></div>`;
	return shell({
		title: `${PRODUCT_DISPLAY[product]} — trust.solstone.app`,
		current: "software",
		path,
		breadcrumbs: crumbs,
		main,
	});
}

function versionSummary(
	entry: EntryRecord,
	display: string,
	v2: V2Model,
): string {
	if (
		entry.axes.freshness.state === "fresh" ||
		entry.axes.freshness.state === "expired"
	) {
		// The closed-chain sentence says the window "has since passed", so it is
		// used only when it has; a still-fresh v1 tip keeps the Wave 1 sentence.
		return substituteCopy(
			v2Known(v2) && entry.axes.freshness.state === "expired"
				? VERSION_PLAIN_SUMMARY_V1_CLOSED
				: VERSION_PLAIN_SUMMARY,
			{
				product: display,
				version: entry.version,
				published_utc: entry.publishedUtc,
				valid_until: entry.axes.freshness.validUntil,
			},
		);
	}
	if (entry.axes.freshness.state === "not-time-bound") {
		return htmlCatalog(
			v2Known(v2)
				? VERSION_SUMMARY_NOT_TIME_BOUND_V2.id
				: VERSION_SUMMARY_NOT_TIME_BOUND.id,
			{
				product: display,
				version: entry.version,
				published_utc: entry.publishedUtc,
			},
			["product", "version", "published_utc"],
		);
	}
	return htmlCatalog(
		VERSION_SUMMARY_UNAVAILABLE.id,
		{
			product: display,
			version: entry.version,
			published_utc: entry.publishedUtc,
			reason: entry.axes.freshness.reason,
		},
		["product", "version", "published_utc", "reason"],
	);
}

export function renderVersion(
	model: PortalModel,
	v2: V2Model,
	entry: EntryRecord,
	path: string,
): string {
	const display = PRODUCT_DISPLAY[entry.product];
	const summary = versionSummary(entry, display, v2);
	const tag = v2Known(v2)
		? ` <span class="chain-tag">${trustedText(V1_RECORD_TAG)}</span>`
		: "";
	const tech = `<details class="tech" open><summary>${trustedText(t("trust.page.technicalfields"))}</summary><div class="body"><div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText(t("trust.page.subject"))}</td><td>${untrustedText(display)} ${untrustedText(entry.version)}</td></tr>
<tr><td>${trustedText(t("trust.page.entrysha256"))}</td><td class="mono">${untrustedText(entry.entrySha256)}</td></tr>
<tr><td>${trustedText(t("trust.page.issuetime"))}</td><td>${untrustedText(entry.publishedUtc)}</td></tr>
<tr><td>${trustedText(t("trust.page.chainposition"))}</td><td>${entry.prevVersion ? htmlCatalog("trust.page.seqseqpreviousversion", { seq: entry.seq, version: entry.prevVersion }, ["version"]) : trustedText(t("trust.page.seqseqgenesis", { seq: entry.seq }))}</td></tr>
</tbody></table></div></div></details>`;
	const main = `
<h1>${trustedText(display)} <span class="mono">${untrustedText(entry.version)}</span>${tag}</h1>
<p>${summary}</p>
${axisBlock(entry.axes, { keysHref: "/keys/" }, publicationOverride(v2, entry.product))}
${proveColumns(trustedText(VERSION_DOES_PROVE), trustedText(VERSION_DOES_NOT_PROVE))}
<h2>${trustedText(t("trust.page.rawevidence"))}</h2>
${evidenceTable(evidenceRows(model, entry))}
${tech}
<p><a href="/verify/">${trustedText(t("trust.page.verifythisrecordyourself"))}</a></p>`;
	return shell({
		title: t("trust.page.productversiontrustsolstoneapp", {
			product: display,
			version: entry.version,
		}),
		current: "software",
		path,
		breadcrumbs: [
			{ href: "/", label: t("trust.page.home") },
			{ href: "/software/", label: t("trust.page.software") },
			{ href: `/software/${entry.product}/`, label: display },
			{ label: entry.version },
		],
		main,
	});
}

/** A v2 release record's page. A record that did not verify shows its identity, the verifier's reason, and its raw link — none of its claims. */
export function renderV2Version(
	_model: PortalModel,
	v2: V2Model,
	record: V2ReleaseRecord,
	path: string,
): string {
	const display = displayFor(record);
	const slug = record.slug ?? "journal";
	const crumbs = [
		{ href: "/", label: t("trust.page.home") },
		{ href: "/software/", label: t("trust.page.software") },
		{ href: `/software/${slug}/`, label: display },
		{ label: record.version },
	];
	const title = `${display} ${record.version} — trust.solstone.app`;
	const heading = `<h1>${trustedText(display)} <span class="mono">${untrustedText(record.version)}</span> <span class="chain-tag">${trustedText(V2_RECORD_TAG)}</span></h1>`;
	if (record.verification.state !== "valid" || v2.state !== "verified") {
		const reason =
			record.verification.state === "valid"
				? "the register did not verify"
				: readerReason(record.verification.reasonCode);
		const failed = substituteCopy(PRODUCT_RECORD_FAILED, {
			version: record.version,
			reason,
		});
		const main = `
${heading}
<p>${kindTag("verifier")} ${stateSpan(record.verification.state === "invalid" ? "danger" : "warn", trustedText(record.verification.state === "invalid" ? STATE_DID_NOT_VERIFY : STATE_COULD_NOT_BE_CHECKED))}</p>
<p>${failed}</p>
<div class="table-scroll"><table class="evidence-table"><tbody><tr><td>${trustedText(t("trust.page.releaserecord"))}</td><td>${rawLinkCell(record.recordLink)}</td></tr></tbody></table></div>
<p><a href="/software/${escapeHtml(slug)}/">${trustedText(t("trust.chrome.backto", { product: display }))}</a></p>`;
		return shell({
			title,
			current: "software",
			path,
			breadcrumbs: crumbs,
			main,
		});
	}
	const summary = substituteCopy(VERSION_PLAIN_SUMMARY_V2, {
		product: display,
		version: record.version,
		issued_at: record.issuedAt,
		asserted_until: v2.freshness.assertedUntil,
	});
	const axes = v2AxisBlock({
		publication: {
			kind: "declaration",
			label: AXIS_PUBLICATION_B,
			tone: "neutral",
		},
		freshness: {
			state: "asserted",
			assertedUntil: v2.freshness.assertedUntil,
			sourceUrl: v2.freshness.provenance.sourceUrl,
		},
		verification: record.verification,
		links: { keysHref: "/keys/", verifyHref: "/verify/#v2" },
	});
	const list = (
		items: readonly string[],
		id: "trust.claims.doesprove" | "trust.claims.doesnotprove",
	) =>
		`<ul>${items.map((i) => `<li>${untrustedText(i.length === 0 ? i : t(id, { claim: i }))}</li>`).join("")}</ul>`;
	const claims = `<h2>${trustedText(HEADING_RECORD_CLAIMS)}</h2><p>${trustedText(VERSION_RECORD_CLAIMS_LEAD)}</p><div class="prove-columns"><div class="does"><h3>${trustedText(t("trust.page.whatthisproves"))}</h3>${list(record.doesProve, "trust.claims.doesprove")}</div><div class="does-not"><h3>${trustedText(t("trust.page.whatthisdoesnotprove"))}</h3>${list(record.doesNotProve, "trust.claims.doesnotprove")}</div></div>`;
	const rows: EvidenceRow[] = [];
	pushLink(
		rows,
		t("trust.page.releaserecord"),
		t("trust.page.signedrecorddsseenvelopeinside"),
		record.recordLink,
	);
	if (v2.policy.state === "loaded")
		pushLink(
			rows,
			t("trust.page.authorizationpolicy"),
			t("trust.page.versionversion", {
				version: String(v2.policy.version),
			}),
			v2.policy.link,
		);
	if (v2.dsseKeys !== undefined)
		pushLink(
			rows,
			t("trust.page.signingkeyset"),
			v2.dsseKeys.targetPath,
			v2.dsseKeys.link,
		);
	pushLink(
		rows,
		t("trust.page.pinnedroot"),
		t("trust.page.versionversion", { version: String(v2.root.version) }),
		v2.root.rootLink,
	);
	pushLink(
		rows,
		t("trust.page.freshnessassertion"),
		t("trust.page.timestamprole"),
		linkFromUrl(v2.freshness.provenance.sourceUrl),
	);
	for (const artifact of record.artifacts) {
		if (artifact.link.status === "linked") {
			rows.push({
				type: "linked",
				item: t("trust.page.recordedbytes"),
				detail: t("trust.page.sha256digestlengthbytes", {
					digest: artifact.sha256,
					length: artifact.length,
				}),
				url: artifact.link.link.url,
			});
		} else if (artifact.link.status === "rejected") {
			rows.push({
				type: "rejected",
				item: artifact.url,
				reason: artifact.link.rejected.reason,
			});
		}
	}
	const tech = `<details class="tech" open><summary>${trustedText(t("trust.page.technicalfields"))}</summary><div class="body"><div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText(t("trust.page.recordproduct"))}</td><td class="mono">${untrustedText(record.product)}</td></tr>
<tr><td>${trustedText(t("trust.page.subject"))}</td><td class="mono">${untrustedText(`software/${record.product}/${record.version}`)}</td></tr>
<tr><td>${trustedText(t("trust.page.targetpath"))}</td><td class="mono">${untrustedText(record.targetPath)}</td></tr>
<tr><td>${trustedText(t("trust.page.targetsha256"))}</td><td class="mono">${untrustedText(record.targetSha256)}</td></tr>
<tr><td>${trustedText(t("trust.page.issuedat"))}</td><td class="mono">${untrustedText(record.issuedAt)}</td></tr>
<tr><td>${trustedText(t("trust.page.signerkeyids"))}</td><td class="mono">${record.signerKeyids.map((k) => untrustedText(k)).join("<br>")}</td></tr>
${v2.policy.state === "loaded" ? `<tr><td>${trustedText(t("trust.page.policysha256"))}</td><td class="mono">${untrustedText(v2.policy.sha256)}</td></tr>` : ""}
</tbody></table></div></div></details>`;
	const verifyRecord = verifyReleaseRecordCommand(
		v2.metadataBase,
		v2.targetsBase,
		record.product,
		record.version,
	);
	const main = `
${heading}
<p>${summary}</p>
${axes}
${claims}
<h2>${trustedText(t("trust.page.rawevidence"))}</h2>
${evidenceTable(rows)}
${tech}
<h2>${trustedText(t("trust.page.verifythisrecordyourself"))}</h2>
<pre class="mono">${untrustedText(verifyRecord)}</pre>
<p><a href="/verify/#v3">${trustedText(t("trust.page.readingtheresult"))}</a></p>`;
	return shell({ title, current: "software", path, breadcrumbs: crumbs, main });
}

export function renderVersionFailure(
	_model: PortalModel,
	failure: ModelConstructionFailure,
	path: string,
): string {
	const display = PRODUCT_DISPLAY[failure.product];
	const main = `
<h1>${trustedText(display)} <span class="mono">${untrustedText(failure.version)}</span></h1>
<p>${kindTag("verifier")} ${untrustedText(failureReason(failure))}</p>
<p>${trustedText(t("trust.page.thisrecordcouldnotbeconstructednofieldsfrom"))}</p>
<p><a href="/software/${escapeHtml(failure.product)}/">${trustedText(t("trust.chrome.backto", { product: display }))}</a></p>`;
	return shell({
		title: `${display} ${failure.version} — trust.solstone.app`,
		current: "software",
		path,
		breadcrumbs: [
			{ href: "/", label: t("trust.page.home") },
			{ href: "/software/", label: t("trust.page.software") },
			{ href: `/software/${failure.product}/`, label: display },
			{ label: failure.version },
		],
		main,
	});
}

export function renderVerify(
	model: PortalModel,
	v2: V2Model,
	path: string,
): string {
	const filename = model.keys[0]?.filename ?? "solpbc-transparency-1.pub";
	const cmd = verifyCommand(filename);
	const v1Table = `<div class="table-scroll"><table class="evidence-table">
<thead><tr><th>${trustedText(t("trust.page.outcome"))}</th><th>${trustedText(t("trust.page.whatitmeans"))}</th></tr></thead>
<tbody>
<tr><td>${trustedText(t("trust.page.signatureverifies"))}</td><td>${trustedText(VERIFY_OUTCOME_PASS)}</td></tr>
<tr><td>${trustedText(t("trust.page.signaturefailstoverify"))}</td><td>${trustedText(VERIFY_OUTCOME_FAIL)}</td></tr>
<tr><td>${trustedText(t("trust.page.curlorfetchfails"))}</td><td>${trustedText(VERIFY_OUTCOME_UNREACHABLE)}</td></tr>
</tbody>
</table></div>`;
	if (!v2Known(v2)) {
		const main = `
<h1>${trustedText(t("trust.page.verifyarecordyourself"))}</h1>
<p>${trustedText(VERIFY_METHOD_INTRO)}</p>
<h2>${trustedText(t("trust.page.thecommand"))}</h2>
<p>${trustedText(VERIFY_LEAD_IN)}</p>
<pre class="mono">${trustedText(cmd)}</pre>
<h2>${trustedText(t("trust.page.readingtheresult"))}</h2>
${v1Table}
<p><a href="/keys/">${trustedText(t("trust.keys.linklabel", { label: "v1" }))}</a></p>`;
		return shell({
			title: t("trust.page.verifytrustsolstoneapp"),
			current: "verify",
			path,
			breadcrumbs: [
				{ href: "/", label: t("trust.page.home") },
				{ label: t("trust.page.verify") },
			],
			main,
		});
	}
	const v2cmd = verifyV2Command(v2.metadataBase, v2.targetsBase);
	const v3cmd = verifyReleaseCommand(v2.metadataBase, v2.targetsBase);
	const main = `
<h1>${trustedText(t("trust.page.verifywhatishereyourself"))}</h1>
<p>${trustedText(VERIFY_TWO_METHODS_LEAD)}</p>
<h2 id="v1">${trustedText(HEADING_V1_METHOD)}</h2>
<p>${trustedText(VERIFY_METHOD_INTRO)}</p>
<p>${trustedText(VERIFY_LEAD_IN)}</p>
<pre class="mono">${trustedText(cmd)}</pre>
<h3>${trustedText(t("trust.page.readingtheresult"))}</h3>
${v1Table}
<h2 id="v2">${trustedText(HEADING_V2_METHOD)}</h2>
<p>${trustedText(VERIFY_METHOD_INTRO_V2)}</p>
<p>${trustedText(VERIFY_V2_LEAD_IN)}</p>
<pre class="mono">${untrustedText(v2cmd)}</pre>
<h3>${trustedText(t("trust.page.readingtheresult"))}</h3>
<div class="table-scroll"><table class="evidence-table">
<thead><tr><th>${trustedText(t("trust.page.outcome"))}</th><th>${trustedText(t("trust.page.whatitmeans"))}</th></tr></thead>
<tbody>
<tr><td>${trustedText(t("trust.page.acceptedexit0"))}</td><td>${trustedText(VERIFY_OUTCOME_V2_ACCEPTED)}</td></tr>
<tr><td>${trustedText(t("trust.page.rejectedexit11"))}</td><td>${trustedText(VERIFY_OUTCOME_V2_REJECTED)}</td></tr>
<tr><td>${trustedText(t("trust.page.couldnotrunexit2"))}</td><td>${trustedText(VERIFY_OUTCOME_V2_COULD_NOT_RUN)}</td></tr>
</tbody>
</table></div>
<h2 id="v3">${trustedText(HEADING_V3_METHOD)}</h2>
<p>${trustedText(VERIFY_METHOD_INTRO_V3)}</p>
<p>${trustedText(VERIFY_V3_LEAD_IN)}</p>
<pre class="mono">${untrustedText(v3cmd)}</pre>
<h3>${trustedText(t("trust.page.readingtheresult"))}</h3>
<div class="table-scroll"><table class="evidence-table">
<thead><tr><th>${trustedText(t("trust.page.outcome"))}</th><th>${trustedText(t("trust.page.whatitmeans"))}</th></tr></thead>
<tbody>
<tr><td>${trustedText(t("trust.page.acceptedreleaserecordexit0"))}</td><td>${trustedText(VERIFY_OUTCOME_V3_ACCEPTED)}</td></tr>
<tr><td>${trustedText(t("trust.page.rejectedexit12"))}</td><td>${trustedText(VERIFY_OUTCOME_V3_REJECTED)}</td></tr>
<tr><td>${trustedText(t("trust.page.couldnotrunexit2"))}</td><td>${trustedText(VERIFY_OUTCOME_V3_COULD_NOT_RUN)}</td></tr>
</tbody>
</table></div>
<p><a href="/keys/">${trustedText(t("trust.keys.linklabel", { label: "v2" }))}</a></p>`;
	return shell({
		title: t("trust.page.verifytrustsolstoneapp"),
		current: "verify",
		path,
		breadcrumbs: [
			{ href: "/", label: t("trust.page.home") },
			{ label: t("trust.page.verify") },
		],
		main,
	});
}

export function renderKeys(
	model: PortalModel,
	v2: V2Model,
	path: string,
): string {
	const key = model.keys[0];
	const fingerprint =
		key === undefined
			? trustedText(t("trust.page.unavailable"))
			: key.fingerprint.status === "known"
				? untrustedText(key.fingerprint.value)
				: `${kindTag("verifier")} ${untrustedText(key.fingerprint.reason)}`;
	const raw =
		key?.link.status === "linked"
			? `<a class="raw-link" href="${escapeHtml(key.link.link.url)}">${untrustedText(key.link.link.url)}</a>`
			: trustedText(t("trust.page.unavailable"));
	const keyText = key ? untrustedText(key.publicKeyText) : trustedText("");
	const algorithm = trustedText(t("trust.page.ed25519"));
	const crumbs = [
		{ href: "/", label: t("trust.page.home") },
		{ label: t("trust.page.keys") },
	];
	if (!v2Known(v2)) {
		const status =
			key === undefined || key.status === "active"
				? trustedText(t("trust.page.active"))
				: trustedText(key.status);
		const main = `
<h1>${trustedText(t("trust.vocab.thev1signingkey"))}</h1>
${declaration({ kind: "declaration", text: KEYS_ROLE_STATEMENT })}
<div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText(t("trust.page.algorithm"))}</td><td>${algorithm}</td></tr>
<tr><td>${trustedText(t("trust.page.fingerprint"))}</td><td class="mono">${fingerprint}</td></tr>
<tr><td>${trustedText(t("trust.page.status"))}</td><td>${status}</td></tr>
<tr><td>${trustedText(t("trust.page.rawkeyfile"))}</td><td>${raw}</td></tr>
</tbody></table></div>
<details class="tech" open><summary>${trustedText(t("trust.page.fullpublickeytext"))}</summary><div class="body"><pre class="mono">${keyText}</pre></div></details>`;
		return shell({
			title: t("trust.page.keystrustsolstoneapp"),
			current: "keys",
			path,
			breadcrumbs: crumbs,
			main,
		});
	}
	const root = v2.root;
	const witnessItems = root.witnesses
		.map((w) => {
			// sol pbc's own host is linked; any other location is named and
			// shown as text, so this surface adds no third-party href.
			const own =
				w.url === "https://solpbc.org" ||
				w.url.startsWith("https://solpbc.org/");
			const location = own
				? `<a class="raw-link" href="${escapeHtml(w.url)}">${untrustedText(w.url)}</a>`
				: `<span class="mono">${untrustedText(w.url)}</span>`;
			return `<li>${untrustedText(w.label)}: ${location}</li>`;
		})
		.join("");
	const main = `
<h1>${trustedText(KEYS_PAGE_TITLE_V2)}</h1>
<h2>${trustedText(HEADING_V1_KEY)}</h2>
${declaration({ kind: "declaration", text: KEYS_V1_ROLE_STATEMENT_A })}
<div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText(t("trust.page.algorithm"))}</td><td>${algorithm}</td></tr>
<tr><td>${trustedText(t("trust.page.fingerprint"))}</td><td class="mono">${fingerprint}</td></tr>
<tr><td>${trustedText(t("trust.page.status"))}</td><td>${trustedText(KEYS_V1_STATUS)}</td></tr>
<tr><td>${trustedText(t("trust.page.rawkeyfile"))}</td><td>${raw}</td></tr>
</tbody></table></div>
<details class="tech" open><summary>${trustedText(t("trust.page.fullpublickeytext"))}</summary><div class="body"><pre class="mono">${keyText}</pre></div></details>
<h2 id="v2">${trustedText(HEADING_V2_ROOT)}</h2>
<div class="declaration">${kindTag("declaration")}<p>${
		root.keyids.length === 1
			? substituteCopy(KEYS_V2_ROOT_INTRO_SINGLE, {
					root_version: String(root.version),
				})
			: substituteCopy(KEYS_V2_ROOT_INTRO, {
					root_version: String(root.version),
					key_count: String(root.keyids.length),
					threshold: String(root.threshold),
				})
	}</p></div>
<div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText(t("trust.page.rootversion"))}</td><td>${untrustedText(String(root.version))}</td></tr>
<tr><td>${trustedText(t("trust.page.signingthreshold"))}</td><td>${untrustedText(t("trust.page.thresholdofkeycount", { threshold: root.threshold, key_count: root.keyids.length }))}</td></tr>
<tr><td>${trustedText(t("trust.page.rootkeyids"))}</td><td class="mono">${root.keyids.map((k) => untrustedText(k)).join("<br>")}</td></tr>
<tr><td>${trustedText(t("trust.page.rootfilesha256"))}</td><td class="mono">${untrustedText(root.rootSha256)}</td></tr>
<tr><td>${trustedText(t("trust.page.rawrootfile"))}</td><td>${rawLinkCell(root.rootLink)}</td></tr>
</tbody></table></div>
<h3>${trustedText(HEADING_WITNESS_LINES)}</h3>
<pre class="mono">${untrustedText(root.keyidLine)}
${untrustedText(root.digestLine)}</pre>
<div class="declaration">${kindTag("declaration")}<p>${trustedText(KEYS_WITNESS_LEAD)}</p><ul>${witnessItems}</ul></div>`;
	return shell({
		title: t("trust.page.keystrustsolstoneapp"),
		current: "keys",
		path,
		breadcrumbs: crumbs,
		main,
	});
}

export function renderAbout(v2: V2Model, path: string): string {
	const link = aboutUrl();
	const raw =
		link.status === "linked"
			? `<a class="raw-link" href="${escapeHtml(link.url)}">${untrustedText(link.url)}</a>`
			: trustedText(t("trust.page.unavailable"));
	const lead = v2Known(v2)
		? `<p>${kindTag("declaration")} ${trustedText(ABOUT_READABLE_BODY_LEAD)}</p>`
		: "";
	const main = `
<h1>${trustedText(t("trust.page.aboutthisregister"))}</h1>
${lead}<pre class="mono">${trustedText(ABOUT_READABLE_BODY)}</pre>
<p>${raw}</p>`;
	return shell({
		title: t("trust.page.aboutthisregistertrustsolstoneapp"),
		current: "about",
		path,
		breadcrumbs: [
			{ href: "/", label: t("trust.page.home") },
			{ label: t("trust.page.aboutthisregister") },
		],
		main,
	});
}

export function renderNotFound(
	variant: "generic" | "version-shaped",
	path: string,
	product?: ProductSlug,
): string {
	if (variant === "version-shaped" && product !== undefined) {
		const display = PRODUCT_DISPLAY[product];
		const main = `
<h1>${trustedText(t("trust.page.norecordatthisversion"))}</h1>
<p>${trustedText(NOT_FOUND_VERSION_SHAPED)}</p>
<p><a href="/software/${escapeHtml(product)}/">${trustedText(t("trust.page.viewproduct", { product: display }))}</a></p>`;
		return shell({
			title: t("trust.page.norecordatthisversiontrustsolstoneapp"),
			current: "none",
			path,
			main,
		});
	}
	const main = `
<h1>${trustedText(t("trust.page.wedonthaveapageatthataddress"))}</h1>
<p>${trustedText(NOT_FOUND_GENERIC)}</p>
<p><a href="/">${trustedText(t("trust.page.trustportalhome"))}</a> · <a href="/software/">${trustedText(t("trust.page.softwareregister"))}</a></p>`;
	return shell({
		title: t("trust.page.notfoundtrustsolstoneapp"),
		current: "none",
		path,
		main,
	});
}

function degradedLine(marker: "degraded", reason: string): string {
	return `<span class="marker">${trustedText(marker)}</span> ${untrustedText(reason)}`;
}

export function renderDegraded(degraded: ModelDegraded, path: string): string {
	const main = `
<h1>${trustedText(t("trust.page.thisportalcannotpresenttheregisterrightnow"))}</h1>
<p>${degradedLine(degraded.marker, degraded.reason)}</p>
<p>${trustedText(t("trust.page.thisisnotastatementaboutanyrecordtherawevi"))}</p>`;
	return shell({
		title: t("trust.page.unavailabletrustsolstoneapp"),
		current: "none",
		path,
		main,
	});
}

export function renderCollision(
	left: { product: string; version: string },
	right: { product: string; version: string },
	path: string,
): string {
	const main = `
<h1>${trustedText(t("trust.page.thisportalcannotpresentcollidingrecords"))}</h1>
<p>${htmlCatalog("trust.page.tworecordsresolvedtothesamerouteleftleftver", { left: left.product, left_version: left.version, right: right.product, right_version: right.version }, ["left", "left_version", "right", "right_version"])}</p>`;
	return shell({
		title: t("trust.page.thisportalcannotpresentcollidingrecordstrusts"),
		current: "none",
		path,
		main,
	});
}
