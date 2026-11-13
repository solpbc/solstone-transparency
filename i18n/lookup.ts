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

export const SOURCE_LOCALE = "en-US";
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
	const text = render(SOURCE_LOCALE, id, pairs, {
		useIsolating: SOURCE_LOCALE !== "en-US",
	});
	if (typeof text !== "string" || text.length === 0) {
		throw new Error(`message ${id} rendered empty`);
	}
	return text;
}
