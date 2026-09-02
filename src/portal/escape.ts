// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * HTML escaping for the Wave 1 portal. Every interpolation goes through
 * `escapeHtml`. Model-derived untrusted display strings also replace C0
 * controls and wrap in `<bdi>`.
 */

/** Replace C0 controls other than tab/newline with U+FFFD. */
export function replaceC0(s: string): string {
	let out = "";
	for (let i = 0; i < s.length; i++) {
		const code = s.charCodeAt(i);
		if (code === 9 || code === 10) {
			out += s[i];
			continue;
		}
		if (code <= 0x1f || code === 0x7f) {
			out += "\uFFFD";
			continue;
		}
		out += s[i];
	}
	return out;
}

/** Escape `& < > " '` for text nodes and attribute values. */
export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** CMO copy and structural vocabulary: escaped, not bidi-wrapped. */
export function trustedText(s: string): string {
	return escapeHtml(s);
}

/** Model-derived display: C0-replaced, escaped, wrapped in `<bdi>`. */
export function untrustedText(s: string): string {
	return `<bdi>${escapeHtml(replaceC0(s))}</bdi>`;
}
