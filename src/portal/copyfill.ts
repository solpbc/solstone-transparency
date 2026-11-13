// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Substitutes `{placeholder}` tokens in approved copy.ts templates. Only
 * the named tokens are replaced; the surrounding sentence is not reworded.
 * The filled string is HTML-escaped.
 */

import { type CatalogRef, t } from "../../i18n/lookup";
import { escapeHtml, untrustedText } from "./escape";

const TOKENS = [
	"version",
	"date",
	"count",
	"product",
	"prev",
	"next",
	"published_utc",
	"valid_until",
	"asserted_until",
	"issued_at",
	"basis",
	"products",
	"reason",
	"root_version",
	"key_count",
	"threshold",
	"platforms",
] as const;

export type CopyToken = (typeof TOKENS)[number];

export function substituteCopy(
	template: string | CatalogRef,
	values: Partial<Record<CopyToken, string>> = {},
): string {
	if (typeof template !== "string") {
		const args: Record<string, string | number> = { ...template.args };
		for (const key of TOKENS) {
			const value = values[key];
			if (value !== undefined) args[key] = value;
		}
		return escapeHtml(t(template.id, args));
	}
	let out = template;
	for (const key of TOKENS) {
		const value = values[key];
		if (value === undefined) continue;
		out = out.split(`{${key}}`).join(value);
	}
	return escapeHtml(out);
}

/**
 * A catalog sentence with model values wrapped in `<bdi>`. The lookup sees a
 * private-use placeholder, the placeholder is escaped as text, then the real
 * value replaces it already wrapped. The static words come from the catalog.
 */
export function htmlCatalog(
	id: CatalogRef["id"],
	args: Readonly<Record<string, string | number>>,
	untrustedKeys: readonly string[],
): string {
	const call: Record<string, string | number> = { ...args };
	const slots: { token: string; value: string }[] = [];
	for (let i = 0; i < untrustedKeys.length; i++) {
		const key = untrustedKeys[i];
		if (key === undefined) continue;
		const token = `\uE000${i}\uE001`;
		slots.push({ token, value: String(args[key] ?? "") });
		call[key] = token;
	}
	let html = escapeHtml(t(id, call));
	for (const slot of slots) {
		if (!html.includes(slot.token)) {
			throw new Error(`message ${id} dropped an untrusted slot`);
		}
		html = html.split(slot.token).join(untrustedText(slot.value));
	}
	return html;
}
