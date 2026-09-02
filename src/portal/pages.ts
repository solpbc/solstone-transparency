// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Per-route HTML renderers for the Wave 1 portal. No JavaScript ships; CSS
 * is served from the model-independent /static/portal.css route. No
 * third-party URLs except already-allowlisted evidence links.
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
import { aboutUrl } from "../legacy/rawlink";
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
import { substituteCopy } from "./copyfill";
import { escapeHtml, trustedText, untrustedText } from "./escape";
import {
	type EvidenceRow,
	type StateTone,
	axisBlock,
	declaration,
	evidenceTable,
	kindTag,
	stateSpan,
} from "./primitives";
import { STYLESHEET_PATH, versionPath } from "./routes";
import {
	PRODUCT_DISPLAY,
	VERIFY_LEAD_IN,
	VERSION_SUMMARY_NOT_TIME_BOUND,
	VERSION_SUMMARY_UNAVAILABLE,
	WINDOWS_ONE_FACT,
	verifyCommand,
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

function proveColumns(does: string, doesNot: string): string {
	return `<div class="prove-columns"><div class="does"><h3>${trustedText("what this proves")}</h3><p>${does}</p></div><div class="does-not"><h3>${trustedText("what this does not prove")}</h3><p>${doesNot}</p></div></div>`;
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
): string {
	const tip = tipEntry(timeline);
	const count = String(entryCount(timeline));
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

export function renderHome(model: PortalModel, path: string): string {
	const journal = historySubject(model, "journal");
	const linux = historySubject(model, "linux");
	const jTip = tipEntry(journal.timeline);
	const lTip = tipEntry(linux.timeline);
	const jRow = jTip
		? substituteCopy(homeRegisterSummaryRow(true), {
				version: jTip.version,
				date: jTip.publishedUtc,
			})
		: trustedText(homeRegisterSummaryRow(false));
	const lRow = lTip
		? substituteCopy(homeRegisterSummaryRow(true), {
				version: lTip.version,
				date: lTip.publishedUtc,
			})
		: trustedText(homeRegisterSummaryRow(false));
	const wRow = trustedText(homeRegisterSummaryRow(false));
	const main = `
<h1>${trustedText("trust.solstone.app")}</h1>
<p>${trustedText(HOME_HERO_EXPLAINER)}</p>
${declaration({ kind: "declaration", text: HOME_PUBLICATION_DECLARATION })}
<h2>${trustedText("the register, at a glance")}</h2>
<p>${trustedText(HOME_REGISTER_SUMMARY_LEAD)}</p>
<table class="register-table">
<caption class="sr-only">${trustedText("software publication register summary")}</caption>
<thead><tr><th scope="col">${trustedText("product")}</th><th scope="col">${trustedText("publication")}</th><th scope="col">${trustedText("latest recorded release")}</th></tr></thead>
<tbody>
<tr><td><a href="/software/journal/">${trustedText(PRODUCT_DISPLAY.journal)}</a></td><td>${kindTag("declaration")} ${stateSpan("neutral", trustedText("paused"))}</td><td>${jRow}</td></tr>
<tr><td><a href="/software/linux/">${trustedText(PRODUCT_DISPLAY.linux)}</a></td><td>${kindTag("declaration")} ${stateSpan("neutral", trustedText("paused"))}</td><td>${lRow}</td></tr>
<tr><td><a href="/software/windows/">${trustedText(PRODUCT_DISPLAY.windows)}</a></td><td>${kindTag("register")} ${stateSpan("neutral", trustedText("no records in this register"))}</td><td>${wRow}</td></tr>
</tbody>
</table>
<h2>${trustedText("go deeper")}</h2>
<ul>
<li><a href="/software/">${trustedText("software register")}</a></li>
<li><a href="/verify/">${trustedText("how to verify a record yourself")}</a></li>
<li><a href="/keys/">${trustedText("the public key")}</a></li>
<li><a href="/about/">${trustedText("about this register")}</a></li>
</ul>`;
	return shell({
		title: "trust.solstone.app",
		current: "home",
		path,
		main,
	});
}

export function renderSoftwareIndex(model: PortalModel, path: string): string {
	const journal = historySubject(model, "journal");
	const linux = historySubject(model, "linux");
	const jTip = tipEntry(journal.timeline);
	const lTip = tipEntry(linux.timeline);
	const main = `
<h1>${trustedText("the software register")}</h1>
<p>${trustedText(SOFTWARE_INDEX_LEAD)}</p>
${declaration({ kind: "declaration", text: SOFTWARE_COVERAGE_CAVEAT }).replace('<div class="declaration">', '<div class="declaration" id="coverage">')}
<h2>${trustedText("products")}</h2>
<div class="card-grid">
<div class="card"><a class="card-link" href="/software/journal/"><h3>${trustedText(PRODUCT_DISPLAY.journal)}</h3><p>${jTip ? `${kindTag("signed")} <span class="mono">${untrustedText(jTip.version)}</span> ${trustedText("latest recorded")}` : kindTag("register")}</p></a></div>
<div class="card"><a class="card-link" href="/software/linux/"><h3>${trustedText(PRODUCT_DISPLAY.linux)}</h3><p>${lTip ? `${kindTag("signed")} <span class="mono">${untrustedText(lTip.version)}</span> ${trustedText("latest recorded")}` : kindTag("register")}</p></a></div>
<div class="card"><a class="card-link" href="/software/windows/"><h3>${trustedText(PRODUCT_DISPLAY.windows)}</h3><p>${kindTag("register")} ${stateSpan("neutral", trustedText("no records in this register"))}</p></a></div>
</div>`;
	return shell({
		title: "software — trust.solstone.app",
		current: "software",
		path,
		breadcrumbs: [{ href: "/", label: "home" }, { label: "software" }],
		main,
	});
}

export function renderProduct(
	model: PortalModel,
	product: ProductSlug,
	path: string,
): string {
	if (product === "windows") {
		const main = `
<h1>${trustedText(PRODUCT_DISPLAY.windows)}</h1>
${declaration({ kind: "register", text: WINDOWS_ABSENCE_EXPLAINER, tone: "neutral" })}
<p>${trustedText(WINDOWS_ONE_FACT)}</p>
<p><a href="/software/">${trustedText("back to the software register")}</a></p>`;
		return shell({
			title: `${PRODUCT_DISPLAY.windows} — trust.solstone.app`,
			current: "software",
			path,
			breadcrumbs: [
				{ href: "/", label: "home" },
				{ href: "/software/", label: "software" },
				{ label: PRODUCT_DISPLAY.windows },
			],
			main,
		});
	}
	const subject = historySubject(model, product);
	const axes = axesForProduct(model, subject);
	const ledgerCell =
		subject.ledger.link.status === "linked"
			? `<a class="raw-link" href="${escapeHtml(subject.ledger.link.link.url)}">${untrustedText(subject.ledger.link.link.url)}</a>`
			: trustedText("unavailable");
	const main = `
<h1>${trustedText(PRODUCT_DISPLAY[product])}</h1>
<p>${summaryForProduct(product, subject.timeline)}</p>
${axisBlock(axes, { verifyHref: "/verify/" })}
${proveColumns(trustedText(productDoesProve(product)), trustedText(productDoesNotProve(product)))}
<h2>${trustedText("release timeline")}</h2>
${timelineHtml(product, subject.timeline)}
<h2>${trustedText("the derived chain ledger")}</h2>
${kindTag("signed")}
<div class="table-scroll"><table class="evidence-table"><tbody><tr><td>${trustedText("chain ledger (derived)")}</td><td>${ledgerCell}</td></tr></tbody></table></div>`;
	return shell({
		title: `${PRODUCT_DISPLAY[product]} — trust.solstone.app`,
		current: "software",
		path,
		breadcrumbs: [
			{ href: "/", label: "home" },
			{ href: "/software/", label: "software" },
			{ label: PRODUCT_DISPLAY[product] },
		],
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

function versionSummary(entry: EntryRecord, display: string): string {
	const product = untrustedText(display);
	const version = untrustedText(entry.version);
	const published = untrustedText(entry.publishedUtc);
	if (
		entry.axes.freshness.state === "fresh" ||
		entry.axes.freshness.state === "expired"
	) {
		return substituteCopy(VERSION_PLAIN_SUMMARY, {
			product: display,
			version: entry.version,
			published_utc: entry.publishedUtc,
			valid_until: entry.axes.freshness.validUntil,
		});
	}
	if (entry.axes.freshness.state === "not-time-bound") {
		return fillStructural(VERSION_SUMMARY_NOT_TIME_BOUND, {
			product,
			version,
			published_utc: published,
		});
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
	entry: EntryRecord,
	path: string,
): string {
	const display = PRODUCT_DISPLAY[entry.product];
	const summary = versionSummary(entry, display);
	const tech = `<details class="tech" open><summary>${trustedText("technical fields")}</summary><div class="body"><div class="table-scroll"><table class="evidence-table"><tbody>
<tr><td>${trustedText("subject")}</td><td>${untrustedText(display)} ${untrustedText(entry.version)}</td></tr>
<tr><td>${trustedText("entry sha256")}</td><td class="mono">${untrustedText(entry.entrySha256)}</td></tr>
<tr><td>${trustedText("issue time")}</td><td>${untrustedText(entry.publishedUtc)}</td></tr>
<tr><td>${trustedText("chain position")}</td><td>${trustedText("seq")} ${trustedText(String(entry.seq))}${entry.prevVersion ? ` ${trustedText("previous")} ${untrustedText(entry.prevVersion)}` : ` ${trustedText("genesis")}`}</td></tr>
</tbody></table></div></div></details>`;
	const main = `
<h1>${trustedText(display)} <span class="mono">${untrustedText(entry.version)}</span></h1>
<p>${summary}</p>
${axisBlock(entry.axes, { keysHref: "/keys/" })}
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

export function renderVerify(model: PortalModel, path: string): string {
	const filename = model.keys[0]?.filename ?? "solpbc-transparency-1.pub";
	const cmd = verifyCommand(filename);
	const main = `
<h1>${trustedText("verify a record yourself")}</h1>
<p>${trustedText(VERIFY_METHOD_INTRO)}</p>
<h2>${trustedText("the command")}</h2>
<p>${trustedText(VERIFY_LEAD_IN)}</p>
<pre class="mono">${trustedText(cmd)}</pre>
<h2>${trustedText("reading the result")}</h2>
<table class="evidence-table">
<thead><tr><th>${trustedText("outcome")}</th><th>${trustedText("what it means")}</th></tr></thead>
<tbody>
<tr><td>${trustedText("signature verifies")}</td><td>${trustedText(VERIFY_OUTCOME_PASS)}</td></tr>
<tr><td>${trustedText("signature fails to verify")}</td><td>${trustedText(VERIFY_OUTCOME_FAIL)}</td></tr>
<tr><td>${trustedText("curl or fetch fails")}</td><td>${trustedText(VERIFY_OUTCOME_UNREACHABLE)}</td></tr>
</tbody>
</table>
<p><a href="/keys/">${trustedText("the public key")}</a></p>`;
	return shell({
		title: "verify — trust.solstone.app",
		current: "verify",
		path,
		breadcrumbs: [{ href: "/", label: "home" }, { label: "verify" }],
		main,
	});
}

export function renderKeys(model: PortalModel, path: string): string {
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
		breadcrumbs: [{ href: "/", label: "home" }, { label: "keys" }],
		main,
	});
}

export function renderAbout(path: string): string {
	const link = aboutUrl();
	const raw =
		link.status === "linked"
			? `<a class="raw-link" href="${escapeHtml(link.url)}">${untrustedText(link.url)}</a>`
			: trustedText("unavailable");
	const main = `
<h1>${trustedText("about this register")}</h1>
<pre class="mono">${trustedText(ABOUT_READABLE_BODY)}</pre>
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
