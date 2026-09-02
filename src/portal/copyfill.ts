// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Substitutes `{placeholder}` tokens in approved copy.ts templates. Only
 * the named tokens are replaced; the surrounding sentence is not reworded.
 * The filled string is HTML-escaped.
 */

import { escapeHtml } from "./escape";

const TOKENS = [
	"version",
	"date",
	"count",
	"product",
	"prev",
	"next",
	"published_utc",
	"valid_until",
] as const;

export type CopyToken = (typeof TOKENS)[number];

export function substituteCopy(
	template: string,
	values: Partial<Record<CopyToken, string>>,
): string {
	let out = template;
	for (const key of TOKENS) {
		const value = values[key];
		if (value === undefined) continue;
		out = out.split(`{${key}}`).join(value);
	}
	return escapeHtml(out);
}
