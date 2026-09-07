// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

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
	AXIS_PUBLICATION_A,
	AXIS_PUBLICATION_B,
	HOME_PUBLICATION_DECLARATION_A,
	HOME_PUBLICATION_DECLARATION_A_PARTIAL,
	HOME_PUBLICATION_DECLARATION_B,
	HOME_PUBLICATION_DECLARATION_UNVERIFIED,
	HOME_REGISTER_SUMMARY_ROW_V1_CLOSED,
	HOME_REGISTER_SUMMARY_ROW_V1_CLOSED_UNCHECKED,
	HOME_REGISTER_SUMMARY_ROW_V2,
	KEYS_V1_ROLE_STATEMENT_A,
	KEYS_V1_STATUS,
	KEYS_V2_ROOT_INTRO,
	KEYS_WITNESS_LEAD,
	LEGACY_BINDING_BOUND,
	LEGACY_BINDING_NOT_VERIFIED,
	LEGACY_BINDING_PARTIAL,
	PRODUCT_EXPECTED_GAP,
	PRODUCT_GAP_NOTE_V1_TO_V2,
	PRODUCT_PLAIN_SUMMARY_A,
	PRODUCT_PLAIN_SUMMARY_B,
	PRODUCT_RECORD_FAILED,
	SOFTWARE_COVERAGE_CAVEAT_B,
	SOFTWARE_UNMAPPED_PRODUCTS,
	V2_EXPIRED,
	V2_UNVERIFIED,
	VERIFY_METHOD_INTRO_V2,
	VERIFY_OUTCOME_V2_ACCEPTED,
	VERIFY_OUTCOME_V2_COULD_NOT_RUN,
	VERIFY_OUTCOME_V2_REJECTED,
	VERIFY_TWO_METHODS_LEAD,
	VERSION_PLAIN_SUMMARY_V1_CLOSED,
	VERSION_PLAIN_SUMMARY_V2,
	VERSION_RECORD_CLAIMS_LEAD,
	WINDOWS_ABSENCE_EXPLAINER_STATE_A,
} from "../v2view/copy";
import type {
	V2Model,
	V2ReleaseRecord,
	V2SoftwareEntry,
	V2UnverifiedModel,
	V2VerifiedModel,
} from "../v2view/types";
import { substituteCopy } from "./copyfill";
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
	HEADING_WITNESS_LINES,
	KEYS_PAGE_TITLE_V2,
	PRODUCT_DISPLAY,
	STATE_COULD_NOT_BE_CHECKED,
	STATE_DID_NOT_VERIFY,
	STATE_NO_RECORD_YET,
	STATE_V2_NOT_CHECKED,
	V1_RECORD_TAG,
	V2_RECORD_TAG,
	VERIFY_LEAD_IN,
	VERIFY_V2_LEAD_IN,
	VERSION_SUMMARY_NOT_TIME_BOUND,
	VERSION_SUMMARY_NOT_TIME_BOUND_V2,
	VERSION_SUMMARY_UNAVAILABLE,
	WINDOWS_ONE_FACT,
	readerReason,
	verifyCommand,
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
			? `<nav class="breadcrumbs" aria-label="breadcrumb"><ol>${args.breadcrumbs
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
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${trustedText(args.title)}</title>
<link rel="stylesheet" href="${STYLESHEET_PATH}">
<link rel="canonical" href="https://trust.solstone.app${escapeHtml(args.path)}">
</head>
<body>
<a href="#main" class="skip-link">${trustedText("skip to content")}</a>
<header class="shell-header">
<div class="shell-header__inner">
<a class="lockup" href="/">${trustedText("trust.solstone.app")}</a>
<nav class="primary-nav" aria-label="main navigation">
${navLink("/", "home", "home", args.current)}
${navLink("/software/", "software", "software", args.current)}
${navLink("/verify/", "verify", "verify", args.current)}
${navLink("/keys/", "keys", "keys", args.current)}
</nav>
</div>
</header>
${crumbs}
<main id="main">${args.main}</main>
<footer class="shell-footer">
<div class="inner">
<div>${trustedText(FOOTER_OWNERSHIP_LINE)}</div>
<nav aria-label="footer"><ul>
<li><a href="/software/">${trustedText("software")}</a></li>
<li><a href="/verify/">${trustedText("verify")}</a></li>
<li><a href="/keys/">${trustedText("keys")}</a></li>
<li><a href="/about/">${trustedText("about this register")}</a></li>
<li><a href="https://transparency.solstone.app/">${trustedText("raw evidence")}</a></li>
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
	return v2.legacy.products
		.map((p) =>
			p.product === "journal" ||
			p.product === "linux" ||
			p.product === "windows"
				? PRODUCT_DISPLAY[p.product]
				: p.product,
		)
		.join(", ");
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
		return `${trustedText("unavailable")} ${untrustedText(link.rejected.reason)}`;
	return trustedText("not a raw link");
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
	if (f.kind === "missing-subject") return "missing subject";
	if (f.kind === "missing-object")
		return `no evidence object at ${f.declaredName}`;
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
			reason:
				"not checked because the tip entry itself could not be constructed",
			checkedAt,
			provenance: { kind: "verifier", checkedAt },
		},
		verification: {
			state: "unavailable",
			reason: failure
				? failureReason(failure)
				: "no record was constructed for this product",
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
			item: `${label} (×${linked.length})`,
			detail: `${linked.length} exact links below`,
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
	pushLink(rows, "immutable entry", "signed ledger entry", entry.entryLink);
	pushLink(
		rows,
		"entry signature",
		"minisign signature over the entry",
		entry.entrySigLink,
	);
	if (entry.isTip) {
		if (entry.latestLink)
			pushLink(
				rows,
				"signed pointer",
				"mutable latest pointer",
				entry.latestLink,
			);
		if (entry.latestSigLink)
			pushLink(
				rows,
				"pointer signature",
				"minisign signature over the pointer",
				entry.latestSigLink,
			);
	}
	rows.push(...groupedMembers("release manifests", entry.manifests));
	rows.push(...groupedMembers("native proof receipts", entry.proofs));
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
	if (key) pushLink(rows, "signing key", key.filename, key.link);
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
		return trustedText(productPlainSummary(product));
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
						? ` ${stateSpan("neutral", trustedText("expired"))}`
						: "";
				return `<li><span class="v">${untrustedText(item.version)}</span> · ${untrustedText(item.publishedUtc)} · ${kindTag(item.axes.verification.provenance.kind)} ${stateSpan(verificationTone(item.axes.verification.state), trustedText(item.axes.verification.state))}${fresh} · <a href="${escapeHtml(href)}">${trustedText("record")}</a></li>`;
			}
			const href = versionPath(product, item.version);
			return `<li><span class="v">${untrustedText(item.version)}</span> · ${trustedText("no publish date")} · ${kindTag("verifier")} ${stateSpan("danger", untrustedText(failureReason(item)))} · <a href="${escapeHtml(href)}">${trustedText("record")}</a></li>`;
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
	return `<li class="is-gap"><span class="v">${untrustedText(gap.absentVersion)}</span> · ${kindTag("register")} ${stateSpan("neutral", trustedText("no record"))}<div class="gap-note">${note} <a href="/software/#coverage">${trustedText("why coverage is stated, not implied")}</a></div></li>`;
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
			`<li class="is-gap">${kindTag("register")} ${stateSpan("neutral", trustedText("v1 tip to first v2 record"))}<div class="gap-note">${note} <a href="/software/#coverage">${trustedText("why coverage is stated, not implied")}</a></div></li>`,
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
				`<li class="is-gap"><span class="v">${untrustedText(entry.version)}</span> · ${kindTag("declaration")} ${stateSpan("warn", trustedText("expected record missing"))}<div class="gap-note">${note}</div></li>`,
			);
			continue;
		}
		const href = versionPath(slug, entry.version);
		if (entry.verification.state === "valid") {
			items.push(
				`<li><span class="v">${untrustedText(entry.version)}</span> · ${untrustedText(entry.issuedAt)} · ${kindTag("verifier")} ${stateSpan("success", trustedText("valid"))} · <a href="${escapeHtml(href)}">${trustedText("record")}</a></li>`,
			);
			continue;
		}
		const failed = substituteCopy(PRODUCT_RECORD_FAILED, {
			version: entry.version,
			reason: readerReason(entry.verification.reasonCode),
		});
		items.push(
			`<li><span class="v">${untrustedText(entry.version)}</span> · ${kindTag("verifier")} ${stateSpan(verificationTone(entry.verification.state), trustedText(entry.verification.state === "invalid" ? STATE_DID_NOT_VERIFY : STATE_COULD_NOT_BE_CHECKED))}<div class="gap-note">${failed} <a href="${escapeHtml(href)}">${trustedText("record")}</a></div></li>`,
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
		const fullyBound =
			v2.legacy.state === "bound" && v2.legacy.coverage === "complete";
		const text =
			first === undefined
				? fullyBound
					? trustedText(HOME_PUBLICATION_DECLARATION_A)
					: substituteCopy(HOME_PUBLICATION_DECLARATION_A_PARTIAL, {
							products: boundProducts(v2),
						})
				: substituteCopy(HOME_PUBLICATION_DECLARATION_B, {
						product: displayFor(first),
						version: first.version,
					});
		return `<div class="declaration">${kindTag("declaration")}<p>${text}</p></div>${legacyBindingLine(v2)}`;
	})();

	const publicationCell = (slug: ProductSlug): string => {
		if (v2.state === "absent")
			return `${kindTag("declaration")} ${stateSpan("neutral", trustedText("paused"))}`;
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
		if (v2.state === "absent") {
			return {
				publication:
					slug === "windows"
						? `${kindTag("register")} ${stateSpan("neutral", trustedText("no records in this register"))}`
						: publicationCell(slug),
				latest: tip
					? substituteCopy(homeRegisterSummaryRow(true), {
							version: tip.version,
							date: tip.publishedUtc,
						})
					: trustedText(homeRegisterSummaryRow(false)),
			};
		}
		if (slug === "windows" || tip === undefined) {
			return {
				publication: `${kindTag("register")} ${stateSpan("neutral", trustedText("no records in this register"))}`,
				latest: trustedText("no records in this register"),
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

	const main = `
<h1>${trustedText("trust.solstone.app")}</h1>
<p>${trustedText(HOME_HERO_EXPLAINER)}</p>
${declarationBlock}
<h2>${trustedText("the register, at a glance")}</h2>
<p>${trustedText(HOME_REGISTER_SUMMARY_LEAD)}</p>
<table class="register-table">
<caption class="sr-only">${trustedText("software publication register summary")}</caption>
<thead><tr><th scope="col">${trustedText("product")}</th><th scope="col">${trustedText("publication")}</th><th scope="col">${trustedText("latest recorded release")}</th></tr></thead>
<tbody>
<tr><td><a href="/software/journal/">${trustedText(PRODUCT_DISPLAY.journal)}</a></td><td>${j.publication}</td><td>${j.latest}</td></tr>
<tr><td><a href="/software/linux/">${trustedText(PRODUCT_DISPLAY.linux)}</a></td><td>${l.publication}</td><td>${l.latest}</td></tr>
<tr><td><a href="/software/windows/">${trustedText(PRODUCT_DISPLAY.windows)}</a></td><td>${w.publication}</td><td>${w.latest}</td></tr>
</tbody>
</table>
<h2>${trustedText("go deeper")}</h2>
<ul>
<li><a href="/software/">${trustedText("software register")}</a></li>
<li><a href="/verify/">${trustedText(v2Known(v2) ? "how to verify what is here yourself" : "how to verify a record yourself")}</a></li>
<li><a href="/keys/">${trustedText(v2Known(v2) ? "the signing keys" : "the public key")}</a></li>
<li><a href="/about/">${trustedText("about this register")}</a></li>
</ul>`;
	return shell({
		title: "trust.solstone.app",
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
			return `${kindTag("signed")} <span class="mono">${untrustedText(latest.version)}</span> ${trustedText("latest recorded")}`;
		if (slug === "windows")
			return `${kindTag("register")} ${stateSpan("neutral", trustedText("no records in this register"))}`;
		return tip
			? `${kindTag("signed")} <span class="mono">${untrustedText(tip.version)}</span> ${trustedText("latest recorded")}`
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
<h1>${trustedText("the software register")}</h1>
<p>${trustedText(SOFTWARE_INDEX_LEAD)}</p>
${coverage}${unmapped}
<h2>${trustedText("products")}</h2>
<div class="card-grid">
<div class="card"><a class="card-link" href="/software/journal/"><h3>${trustedText(PRODUCT_DISPLAY.journal)}</h3><p>${card("journal", jTip)}</p></a></div>
<div class="card"><a class="card-link" href="/software/linux/"><h3>${trustedText(PRODUCT_DISPLAY.linux)}</h3><p>${card("linux", lTip)}</p></a></div>
<div class="card"><a class="card-link" href="/software/windows/"><h3>${trustedText(PRODUCT_DISPLAY.windows)}</h3><p>${card("windows", undefined)}</p></a></div>
</div>`;
	return shell({
		title: "software — trust.solstone.app",
		current: "software",
		path,
		breadcrumbs: [{ href: "/", label: "home" }, { label: "software" }],
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
		{ href: "/", label: "home" },
		{ href: "/software/", label: "software" },
		{ label: PRODUCT_DISPLAY[product] },
	];
	if (product === "windows") {
		const latest = latestV2(v2, "windows");
		if (latest !== undefined && v2.state === "verified") {
			const main = `
<h1>${trustedText(PRODUCT_DISPLAY.windows)}</h1>
<p>${substituteCopy(PRODUCT_PLAIN_SUMMARY_B, { product: PRODUCT_DISPLAY.windows, version: latest.version, issued_at: latest.issuedAt })}</p>
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
${v2RecordsSection(v2, "windows", undefined)}
<p><a href="/software/">${trustedText("back to the software register")}</a></p>`;
			return shell({
				title: `${PRODUCT_DISPLAY.windows} — trust.solstone.app`,
				current: "software",
				path,
				breadcrumbs: crumbs,
				main,
			});
		}
		const explainer = v2Known(v2)
			? WINDOWS_ABSENCE_EXPLAINER_STATE_A
			: WINDOWS_ABSENCE_EXPLAINER;
		const main = `
<h1>${trustedText(PRODUCT_DISPLAY.windows)}</h1>
${declaration({ kind: "register", text: explainer, tone: "neutral" })}
<p>${trustedText(WINDOWS_ONE_FACT)}</p>${v2RecordsSection(v2, "windows", undefined)}
<p><a href="/software/">${trustedText("back to the software register")}</a></p>`;
		return shell({
			title: `${PRODUCT_DISPLAY.windows} — trust.solstone.app`,
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
			: trustedText("unavailable");
	const timelineHeading = v2Known(v2)
		? HEADING_V1_TIMELINE_CLOSED
		: "release timeline";
	const main = `
<h1>${trustedText(PRODUCT_DISPLAY[product])}</h1>
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
<h2>${trustedText("the derived chain ledger")}</h2>
${kindTag("signed")}
<div class="table-scroll"><table class="evidence-table"><tbody><tr><td>${trustedText("chain ledger (derived)")}</td><td>${ledgerCell}</td></tr></tbody></table></div>`;
	return shell({
		title: `${PRODUCT_DISPLAY[product]} — trust.solstone.app`,
		current: "software",
		path,
		breadcrumbs: crumbs,
		main,
	});
}

/** Fill a structural vocab template. Static segments are trusted; `{name}` values are already-escaped HTML. */
function fillStructural(
	template: string,
	values: Record<string, string>,
): string {
	return template
		.split(/\{(\w+)\}/)
		.map((part, i) => (i % 2 === 0 ? trustedText(part) : (values[part] ?? "")))
		.join("");
}

function versionSummary(
	entry: EntryRecord,
	display: string,
	v2: V2Model,
): string {
	const product = untrustedText(display);
	const version = untrustedText(entry.version);
	const published = untrustedText(entry.publishedUtc);
	if (
		entry.axes.freshness.state === "fresh" ||
		entry.axes.freshness.state === "expired"
	) {
		return substituteCopy(
			v2Known(v2) ? VERSION_PLAIN_SUMMARY_V1_CLOSED : VERSION_PLAIN_SUMMARY,
			{
				product: display,
				version: entry.version,
				published_utc: entry.publishedUtc,
				valid_until: entry.axes.freshness.validUntil,
			},
		);
	}
	if (entry.axes.freshness.state === "not-time-bound") {
		return fillStructural(
			v2Known(v2)
				? VERSION_SUMMARY_NOT_TIME_BOUND_V2
				: VERSION_SUMMARY_NOT_TIME_BOUND,
			{
				product,
				version,
				published_utc: published,
			},
		);
	}
	return fillStructural(VERSION_SUMMARY_UNAVAILABLE, {
		product,
		version,
		published_utc: published,
		reason: untrustedText(entry.axes.freshness.reason),
	});
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
	const tech = `<details class="tech" open><summary>${trustedText("technical fields")}</summary><div class="body"><div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText("subject")}</td><td>${untrustedText(display)} ${untrustedText(entry.version)}</td></tr>
<tr><td>${trustedText("entry sha256")}</td><td class="mono">${untrustedText(entry.entrySha256)}</td></tr>
<tr><td>${trustedText("issue time")}</td><td>${untrustedText(entry.publishedUtc)}</td></tr>
<tr><td>${trustedText("chain position")}</td><td>${trustedText("seq")} ${trustedText(String(entry.seq))}${entry.prevVersion ? ` ${trustedText("previous")} ${untrustedText(entry.prevVersion)}` : ` ${trustedText("genesis")}`}</td></tr>
</tbody></table></div></div></details>`;
	const main = `
<h1>${trustedText(display)} <span class="mono">${untrustedText(entry.version)}</span>${tag}</h1>
<p>${summary}</p>
${axisBlock(entry.axes, { keysHref: "/keys/" }, publicationOverride(v2, entry.product))}
${proveColumns(trustedText(VERSION_DOES_PROVE), trustedText(VERSION_DOES_NOT_PROVE))}
<h2>${trustedText("raw evidence")}</h2>
${evidenceTable(evidenceRows(model, entry))}
${tech}
<p><a href="/verify/">${trustedText("verify this record yourself")}</a></p>`;
	return shell({
		title: `${display} ${entry.version} — trust.solstone.app`,
		current: "software",
		path,
		breadcrumbs: [
			{ href: "/", label: "home" },
			{ href: "/software/", label: "software" },
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
		{ href: "/", label: "home" },
		{ href: "/software/", label: "software" },
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
<div class="table-scroll"><table class="evidence-table"><tbody><tr><td>${trustedText("release record")}</td><td>${rawLinkCell(record.recordLink)}</td></tr></tbody></table></div>
<p><a href="/software/${escapeHtml(slug)}/">${trustedText("back to")} ${trustedText(display)}</a></p>`;
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
	const list = (items: readonly string[]) =>
		`<ul>${items.map((i) => `<li>${untrustedText(i)}</li>`).join("")}</ul>`;
	const claims = `<h2>${trustedText(HEADING_RECORD_CLAIMS)}</h2><p>${trustedText(VERSION_RECORD_CLAIMS_LEAD)}</p><div class="prove-columns"><div class="does"><h3>${trustedText("what this proves")}</h3>${list(record.doesProve)}</div><div class="does-not"><h3>${trustedText("what this does not prove")}</h3>${list(record.doesNotProve)}</div></div>`;
	const rows: EvidenceRow[] = [];
	pushLink(
		rows,
		"release record",
		"signed record (DSSE envelope inside)",
		record.recordLink,
	);
	if (v2.policy.state === "loaded")
		pushLink(
			rows,
			"authorization policy",
			`version ${v2.policy.version}`,
			v2.policy.link,
		);
	if (v2.dsseKeys !== undefined)
		pushLink(rows, "signing key set", v2.dsseKeys.targetPath, v2.dsseKeys.link);
	pushLink(rows, "pinned root", `version ${v2.root.version}`, v2.root.rootLink);
	pushLink(
		rows,
		"freshness assertion",
		"timestamp role",
		linkFromUrl(v2.freshness.provenance.sourceUrl),
	);
	for (const artifact of record.artifacts) {
		if (artifact.link.status === "linked") {
			rows.push({
				type: "linked",
				item: "recorded bytes",
				detail: `sha256 ${artifact.sha256} · ${artifact.length} bytes`,
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
	const tech = `<details class="tech" open><summary>${trustedText("technical fields")}</summary><div class="body"><div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText("subject")}</td><td class="mono">${untrustedText(`software/${record.product}/${record.version}`)}</td></tr>
<tr><td>${trustedText("target path")}</td><td class="mono">${untrustedText(record.targetPath)}</td></tr>
<tr><td>${trustedText("target sha256")}</td><td class="mono">${untrustedText(record.targetSha256)}</td></tr>
<tr><td>${trustedText("issued at")}</td><td>${untrustedText(record.issuedAt)}</td></tr>
<tr><td>${trustedText("signer key ids")}</td><td class="mono">${record.signerKeyids.map((k) => untrustedText(k)).join("<br>")}</td></tr>
${v2.policy.state === "loaded" ? `<tr><td>${trustedText("policy sha256")}</td><td class="mono">${untrustedText(v2.policy.sha256)}</td></tr>` : ""}
</tbody></table></div></div></details>`;
	const main = `
${heading}
<p>${summary}</p>
${axes}
${claims}
<h2>${trustedText("raw evidence")}</h2>
${evidenceTable(rows)}
${tech}
<p><a href="/verify/">${trustedText("verify this record yourself")}</a></p>`;
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
<p>${trustedText("this record could not be constructed. no fields from the failed body are shown.")}</p>
<p><a href="/software/${escapeHtml(failure.product)}/">${trustedText("back to")} ${trustedText(display)}</a></p>`;
	return shell({
		title: `${display} ${failure.version} — trust.solstone.app`,
		current: "software",
		path,
		breadcrumbs: [
			{ href: "/", label: "home" },
			{ href: "/software/", label: "software" },
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
	const v1Table = `<table class="evidence-table">
<thead><tr><th>${trustedText("outcome")}</th><th>${trustedText("what it means")}</th></tr></thead>
<tbody>
<tr><td>${trustedText("signature verifies")}</td><td>${trustedText(VERIFY_OUTCOME_PASS)}</td></tr>
<tr><td>${trustedText("signature fails to verify")}</td><td>${trustedText(VERIFY_OUTCOME_FAIL)}</td></tr>
<tr><td>${trustedText("curl or fetch fails")}</td><td>${trustedText(VERIFY_OUTCOME_UNREACHABLE)}</td></tr>
</tbody>
</table>`;
	if (!v2Known(v2)) {
		const main = `
<h1>${trustedText("verify a record yourself")}</h1>
<p>${trustedText(VERIFY_METHOD_INTRO)}</p>
<h2>${trustedText("the command")}</h2>
<p>${trustedText(VERIFY_LEAD_IN)}</p>
<pre class="mono">${trustedText(cmd)}</pre>
<h2>${trustedText("reading the result")}</h2>
${v1Table}
<p><a href="/keys/">${trustedText("the public key")}</a></p>`;
		return shell({
			title: "verify — trust.solstone.app",
			current: "verify",
			path,
			breadcrumbs: [{ href: "/", label: "home" }, { label: "verify" }],
			main,
		});
	}
	const v2cmd = verifyV2Command(v2.metadataBase, v2.targetsBase);
	const main = `
<h1>${trustedText("verify what is here yourself")}</h1>
<p>${trustedText(VERIFY_TWO_METHODS_LEAD)}</p>
<h2 id="v1">${trustedText(HEADING_V1_METHOD)}</h2>
<p>${trustedText(VERIFY_METHOD_INTRO)}</p>
<p>${trustedText(VERIFY_LEAD_IN)}</p>
<pre class="mono">${trustedText(cmd)}</pre>
<h3>${trustedText("reading the result")}</h3>
${v1Table}
<h2 id="v2">${trustedText(HEADING_V2_METHOD)}</h2>
<p>${trustedText(VERIFY_METHOD_INTRO_V2)}</p>
<p>${trustedText(VERIFY_V2_LEAD_IN)}</p>
<pre class="mono">${untrustedText(v2cmd)}</pre>
<h3>${trustedText("reading the result")}</h3>
<table class="evidence-table">
<thead><tr><th>${trustedText("outcome")}</th><th>${trustedText("what it means")}</th></tr></thead>
<tbody>
<tr><td>${trustedText("ACCEPTED, exit 0")}</td><td>${trustedText(VERIFY_OUTCOME_V2_ACCEPTED)}</td></tr>
<tr><td>${trustedText("REJECTED, exit 1")}</td><td>${trustedText(VERIFY_OUTCOME_V2_REJECTED)}</td></tr>
<tr><td>${trustedText("could not run, exit 2")}</td><td>${trustedText(VERIFY_OUTCOME_V2_COULD_NOT_RUN)}</td></tr>
</tbody>
</table>
<p><a href="/keys/">${trustedText("the signing keys")}</a></p>`;
	return shell({
		title: "verify — trust.solstone.app",
		current: "verify",
		path,
		breadcrumbs: [{ href: "/", label: "home" }, { label: "verify" }],
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
			? trustedText("unavailable")
			: key.fingerprint.status === "known"
				? untrustedText(key.fingerprint.value)
				: `${kindTag("verifier")} ${untrustedText(key.fingerprint.reason)}`;
	const raw =
		key?.link.status === "linked"
			? `<a class="raw-link" href="${escapeHtml(key.link.link.url)}">${untrustedText(key.link.link.url)}</a>`
			: trustedText("unavailable");
	const keyText = key ? untrustedText(key.publicKeyText) : trustedText("");
	const algorithm = key ? trustedText(key.algorithm) : trustedText("ed25519");
	const crumbs = [{ href: "/", label: "home" }, { label: "keys" }];
	if (!v2Known(v2)) {
		const status = key ? trustedText(key.status) : trustedText("active");
		const main = `
<h1>${trustedText("the v1 signing key")}</h1>
${declaration({ kind: "declaration", text: KEYS_ROLE_STATEMENT })}
<div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText("algorithm")}</td><td>${algorithm}</td></tr>
<tr><td>${trustedText("fingerprint")}</td><td class="mono">${fingerprint}</td></tr>
<tr><td>${trustedText("status")}</td><td>${status}</td></tr>
<tr><td>${trustedText("raw key file")}</td><td>${raw}</td></tr>
</tbody></table></div>
<details class="tech" open><summary>${trustedText("full public key text")}</summary><div class="body"><pre class="mono">${keyText}</pre></div></details>`;
		return shell({
			title: "keys — trust.solstone.app",
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
<tr><td>${trustedText("algorithm")}</td><td>${algorithm}</td></tr>
<tr><td>${trustedText("fingerprint")}</td><td class="mono">${fingerprint}</td></tr>
<tr><td>${trustedText("status")}</td><td>${trustedText(KEYS_V1_STATUS)}</td></tr>
<tr><td>${trustedText("raw key file")}</td><td>${raw}</td></tr>
</tbody></table></div>
<details class="tech" open><summary>${trustedText("full public key text")}</summary><div class="body"><pre class="mono">${keyText}</pre></div></details>
<h2 id="v2">${trustedText(HEADING_V2_ROOT)}</h2>
<div class="declaration">${kindTag("declaration")}<p>${substituteCopy(KEYS_V2_ROOT_INTRO, { root_version: String(root.version), key_count: String(root.keyids.length), threshold: String(root.threshold) })}</p></div>
<div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText("root version")}</td><td>${untrustedText(String(root.version))}</td></tr>
<tr><td>${trustedText("signing threshold")}</td><td>${untrustedText(`${root.threshold} of ${root.keyids.length}`)}</td></tr>
<tr><td>${trustedText("root key ids")}</td><td class="mono">${root.keyids.map((k) => untrustedText(k)).join("<br>")}</td></tr>
<tr><td>${trustedText("root file sha256")}</td><td class="mono">${untrustedText(root.rootSha256)}</td></tr>
<tr><td>${trustedText("raw root file")}</td><td>${rawLinkCell(root.rootLink)}</td></tr>
</tbody></table></div>
<h3>${trustedText(HEADING_WITNESS_LINES)}</h3>
<pre class="mono">${untrustedText(root.witnessLines[0])}
${untrustedText(root.witnessLines[1])}</pre>
<div class="declaration">${kindTag("declaration")}<p>${trustedText(KEYS_WITNESS_LEAD)}</p><ul>${witnessItems}</ul></div>`;
	return shell({
		title: "keys — trust.solstone.app",
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
			: trustedText("unavailable");
	const lead = v2Known(v2)
		? `<p>${kindTag("declaration")} ${trustedText(ABOUT_READABLE_BODY_LEAD)}</p>`
		: "";
	const main = `
<h1>${trustedText("about this register")}</h1>
${lead}<pre class="mono">${trustedText(ABOUT_READABLE_BODY)}</pre>
<p>${raw}</p>`;
	return shell({
		title: "about this register — trust.solstone.app",
		current: "about",
		path,
		breadcrumbs: [
			{ href: "/", label: "home" },
			{ label: "about this register" },
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
<h1>${trustedText("no record at this version")}</h1>
<p>${trustedText(NOT_FOUND_VERSION_SHAPED)}</p>
<p><a href="/software/${escapeHtml(product)}/">${trustedText("view")} ${trustedText(display)}</a></p>`;
		return shell({
			title: "no record at this version — trust.solstone.app",
			current: "none",
			path,
			main,
		});
	}
	const main = `
<h1>${trustedText("we don't have a page at that address")}</h1>
<p>${trustedText(NOT_FOUND_GENERIC)}</p>
<p><a href="/">${trustedText("trust portal home")}</a> · <a href="/software/">${trustedText("software register")}</a></p>`;
	return shell({
		title: "not found — trust.solstone.app",
		current: "none",
		path,
		main,
	});
}

export function renderDegraded(degraded: ModelDegraded, path: string): string {
	const main = `
<h1>${trustedText("this portal cannot present the register right now")}</h1>
<p><span class="marker">${trustedText(degraded.marker)}</span> ${untrustedText(degraded.reason)}</p>
<p>${trustedText("this is not a statement about any record. the raw evidence remains at transparency.solstone.app.")}</p>`;
	return shell({
		title: "unavailable — trust.solstone.app",
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
<h1>${trustedText("this portal cannot present colliding records")}</h1>
<p>${trustedText("two records resolved to the same route")} ${untrustedText(left.product)} ${untrustedText(left.version)} ${trustedText("and")} ${untrustedText(right.product)} ${untrustedText(right.version)}${trustedText(". neither is shown.")}</p>`;
	return shell({
		title: "this portal cannot present colliding records — trust.solstone.app",
		current: "none",
		path,
		main,
	});
}
