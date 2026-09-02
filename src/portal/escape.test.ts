// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import {
	HOSTILE_BIDI_DISPLAY_STRING,
	HOSTILE_DISPLAY_STRING,
} from "../legacy/fixtures";
import { escapeHtml, replaceC0, trustedText, untrustedText } from "./escape";

describe("escape contract", () => {
	test("escapeHtml encodes the five HTML-significant characters", () => {
		expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
	});

	test("replaceC0 keeps tab and newline, replaces other C0 and DEL", () => {
		expect(replaceC0("a\tb\nc")).toBe("a\tb\nc");
		expect(replaceC0("a\x00b\x1bc\x7fd")).toBe("a\uFFFDb\uFFFDc\uFFFDd");
		expect(replaceC0("a\rb")).toBe("a\uFFFDb");
	});

	test("untrustedText wraps HOSTILE_DISPLAY_STRING as escaped <bdi> text", () => {
		const html = untrustedText(HOSTILE_DISPLAY_STRING);
		expect(html.startsWith("<bdi>")).toBe(true);
		expect(html.endsWith("</bdi>")).toBe(true);
		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain("<script>");
		expect(html).toContain("\uFFFD"); // null and ESC become U+FFFD
	});

	test("bidi override cannot escape the <bdi> wrapper (unit, not via adapter)", () => {
		const html = untrustedText(HOSTILE_BIDI_DISPLAY_STRING);
		expect(html.startsWith("<bdi>")).toBe(true);
		expect(html.endsWith("</bdi>")).toBe(true);
		expect(html).toContain("&lt;script&gt;");
	});

	test("trustedText does not wrap in bdi", () => {
		expect(trustedText("<x>")).toBe("&lt;x&gt;");
		expect(trustedText("<x>")).not.toContain("<bdi>");
	});
});
