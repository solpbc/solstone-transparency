// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The four Wave 1 semantic primitives: provenance kind tag, four-axis
 * block, declaration/absence callout, and raw-evidence table.
 */

import { VERSION_ARTIFACT_NOTE } from "../legacy/copy";
import type { AxisBlock, Provenance, UnhostedArtifact } from "../legacy/types";
import { escapeHtml, trustedText, untrustedText } from "./escape";
import {
	AXIS_FRESHNESS,
	AXIS_PUBLICATION,
	AXIS_REBUILD,
	AXIS_VERIFICATION,
	KIND_DECLARATION,
	KIND_REGISTER,
	KIND_SIGNED,
	KIND_VERIFIER,
	STATE_COULD_NOT_BE_CHECKED,
	STATE_NOT_ATTEMPTED,
	STATE_NOT_TIME_BOUND,
	STATE_PAUSED,
	STATE_SIGNATURE_DID_NOT_VERIFY,
} from "./vocab";

export function kindTag(
	kind: "signed" | "register" | "declaration" | "verifier",
): string {
	const label =
		kind === "signed"
			? KIND_SIGNED
			: kind === "register"
				? KIND_REGISTER
				: kind === "declaration"
					? KIND_DECLARATION
					: KIND_VERIFIER;
	return `<span class="kind kind-${kind}">${trustedText(label)}</span>`;
}

function kindFromProvenance(p: Provenance): Parameters<typeof kindTag>[0] {
	return p.kind;
}

function axisRow(
	name: string,
	kind: Parameters<typeof kindTag>[0],
	state: string,
	extra: string,
): string {
	return `<div class="axis-row"><div class="axis-name">${trustedText(name)}</div><div class="axis-value">${kindTag(kind)} ${state}${extra}</div></div>`;
}

export function axisBlock(
	axes: AxisBlock,
	links?: { verifyHref?: string; keysHref?: string },
): string {
	const pub = axisRow(
		AXIS_PUBLICATION,
		kindFromProvenance(axes.publication.provenance),
		`<span class="state">${trustedText(STATE_PAUSED)}</span>`,
		`<span class="basis">${trustedText(axes.publication.basis)}</span>`,
	);

	let freshnessState: string;
	let freshnessExtra = "";
	if (axes.freshness.state === "expired") {
		freshnessState = `<span class="state">${trustedText("expired")} ${untrustedText(axes.freshness.validUntil)}</span>`;
		freshnessExtra = `<span class="as-of">${trustedText("signed")} ${untrustedText(axes.freshness.signedAt)}</span>`;
	} else if (axes.freshness.state === "fresh") {
		freshnessState = `<span class="state">${trustedText("fresh until")} ${untrustedText(axes.freshness.validUntil)}</span>`;
		freshnessExtra = `<span class="as-of">${trustedText("signed")} ${untrustedText(axes.freshness.signedAt)}</span>`;
	} else if (axes.freshness.state === "not-time-bound") {
		freshnessState = `<span class="state">${trustedText(STATE_NOT_TIME_BOUND)}</span>`;
	} else {
		freshnessState = `<span class="state">${trustedText(STATE_COULD_NOT_BE_CHECKED)}</span>`;
		freshnessExtra = `<span class="basis">${untrustedText(axes.freshness.reason)}</span>`;
	}
	const freshness = axisRow(
		AXIS_FRESHNESS,
		kindFromProvenance(axes.freshness.provenance),
		freshnessState,
		freshnessExtra,
	);

	let verifyState: string;
	let verifyExtra = "";
	if (axes.verification.state === "valid") {
		verifyState = `<span class="state">${trustedText("verified")} ${untrustedText(axes.verification.checkedAt)}</span>`;
	} else if (axes.verification.state === "invalid") {
		verifyState = `<span class="state">${trustedText(STATE_SIGNATURE_DID_NOT_VERIFY)}</span>`;
		verifyExtra = `<span class="basis">${untrustedText(axes.verification.reason)}</span>`;
	} else {
		verifyState = `<span class="state">${trustedText(STATE_COULD_NOT_BE_CHECKED)}</span>`;
		verifyExtra = `<span class="basis">${untrustedText(axes.verification.reason)}</span>`;
	}
	if (links?.verifyHref) {
		verifyExtra += ` <a href="${escapeHtml(links.verifyHref)}">${trustedText("how this was checked")}</a>`;
	}
	if (links?.keysHref) {
		verifyExtra += ` <a href="${escapeHtml(links.keysHref)}">${trustedText("key")}</a>`;
	}
	const verification = axisRow(
		AXIS_VERIFICATION,
		kindFromProvenance(axes.verification.provenance),
		verifyState,
		verifyExtra,
	);

	const rebuild = axisRow(
		AXIS_REBUILD,
		kindFromProvenance(axes.rebuild.provenance),
		`<span class="state">${trustedText(STATE_NOT_ATTEMPTED)}</span>`,
		"",
	);

	return `<div class="axis-block">${pub}${freshness}${verification}${rebuild}</div>`;
}

export function declaration(args: {
	kind: "declaration" | "register";
	text: string;
}): string {
	return `<div class="declaration">${kindTag(args.kind)}<p>${trustedText(args.text)}</p></div>`;
}

export type EvidenceRow =
	| { type: "linked"; item: string; detail: string; url: string }
	| { type: "unhosted"; artifact: UnhostedArtifact }
	| { type: "rejected"; item: string; reason: string }
	| {
			type: "group";
			item: string;
			detail: string;
			members: { name: string; url: string }[];
	  };

function linkedCell(url: string): string {
	return `<a class="raw-link" href="${escapeHtml(url)}">${untrustedText(url)}</a>`;
}

export function evidenceTable(rows: EvidenceRow[]): string {
	const body = rows
		.map((row) => {
			if (row.type === "linked") {
				return `<tr><td>${trustedText(row.item)}</td><td>${trustedText(row.detail)}</td><td>${linkedCell(row.url)}</td></tr>`;
			}
			if (row.type === "unhosted") {
				return `<tr><td>${untrustedText(row.artifact.name)}</td><td>${trustedText(VERSION_ARTIFACT_NOTE)} ${trustedText("sha256")} ${untrustedText(row.artifact.sha256)} ${trustedText("bytes")} ${trustedText(String(row.artifact.bytes))}</td><td>${trustedText("not a raw link")}</td></tr>`;
			}
			if (row.type === "rejected") {
				return `<tr><td>${untrustedText(row.item)}</td><td>${trustedText("unavailable")} ${untrustedText(row.reason)}</td><td>${trustedText("not a raw link")}</td></tr>`;
			}
			const items = row.members
				.map((m) => `<li>${untrustedText(m.name)} ${linkedCell(m.url)}</li>`)
				.join("");
			return `<tr><td>${trustedText(row.item)}</td><td>${trustedText(row.detail)}</td><td>${trustedText(`${row.members.length} exact links below`)}</td></tr><tr><td colspan="3"><details class="tech" open><summary>${trustedText(row.item)}</summary><div class="body"><ul>${items}</ul></div></details></td></tr>`;
		})
		.join("");
	return `<div class="table-scroll"><table class="evidence-table"><thead><tr><th scope="col">${trustedText("item")}</th><th scope="col">${trustedText("detail")}</th><th scope="col">${trustedText("raw")}</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
