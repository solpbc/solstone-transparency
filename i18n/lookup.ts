// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * English lookup for trust.solstone.app. The catalog is compiled to
 * `i18n/generated/` and read here; call sites pass an id, never a sentence.
 *
 * Isolation stays off for en-US so today's English bytes match the literals
 * this catalog replaced. A later locale turns isolation on without a second
 * call shape. Numeric arguments accept the finite integers the catalog
 * declares, and a plain decimal digit string, because the pages used to
 * pass counts as text.
 */

import { ARG_TYPES, MESSAGE_IDS, type MessageId } from "./catalog-table";
import { render } from "./generated/esm/transparency/api.mjs";
import { CATALOGS } from "./generated/esm/transparency/catalogs.mjs";

export const SOURCE_LOCALE = "en-US";
export const PACKAGED_LOCALES: readonly string[] = Object.keys(CATALOGS);

function resolveActiveLocale(): string {
	const requested =
		typeof process !== "undefined" ? process.env?.SOLSTONE_LOCALE : undefined;
	if (requested) {
		const trimmed = requested.trim().toLowerCase();
		const exact = PACKAGED_LOCALES.find((l) => l.toLowerCase() === trimmed);
		if (exact !== undefined) return exact;
		const primary = trimmed.split("-")[0];
		const byPrimary = PACKAGED_LOCALES.find(
			(l) => l.toLowerCase().split("-")[0] === primary,
		);
		if (byPrimary !== undefined) return byPrimary;
	}
	const nonSource = PACKAGED_LOCALES.filter((l) => l !== SOURCE_LOCALE);
	if (nonSource.length === 1 && nonSource[0] !== undefined) {
		return nonSource[0];
	}
	return SOURCE_LOCALE;
}

export const ACTIVE_LOCALE = resolveActiveLocale();
export const HTML_LANG = ACTIVE_LOCALE === SOURCE_LOCALE ? "en" : ACTIVE_LOCALE;
export { MESSAGE_IDS, type MessageId };

const DECIMAL = /^(0|[1-9][0-9]*)$/;

export type CatalogArg = string | number | boolean;

export type CatalogRef = {
	readonly id: MessageId;
	readonly args: Readonly<Record<string, string | number>>;
};

export function msg(
	id: MessageId,
	args: Readonly<Record<string, string | number>> = {},
): CatalogRef {
	return { id, args };
}

export function t(
	id: MessageId,
	args: Readonly<Record<string, CatalogArg>> = {},
): string {
	const spec = ARG_TYPES[id];
	const pairs: [string, string | number | boolean][] = [];
	for (const name of Object.keys(spec)) {
		const raw = args[name];
		if (raw === undefined) throw new Error(`message ${id} missing ${name}`);
		const kind = spec[name];
		if (
			(kind === "cardinal" || kind === "integer") &&
			typeof raw === "string" &&
			DECIMAL.test(raw)
		) {
			pairs.push([name, Number(raw)]);
			continue;
		}
		pairs.push([name, raw]);
	}
	for (const name of Object.keys(args)) {
		if (spec[name] === undefined) {
			throw new Error(`message ${id} unknown ${name}`);
		}
	}
	const text = render(ACTIVE_LOCALE, id, pairs, {
		useIsolating: ACTIVE_LOCALE !== SOURCE_LOCALE,
	});
	if (typeof text !== "string" || text.length === 0) {
		throw new Error(`message ${id} rendered empty`);
	}
	return text;
}
