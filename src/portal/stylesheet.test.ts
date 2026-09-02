// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { PORTAL_CSS } from "./stylesheet";

describe("PORTAL_CSS", () => {
	test("contains the three overflow mechanisms as literals", () => {
		expect(PORTAL_CSS).toContain("white-space: pre-wrap");
		expect(PORTAL_CSS).toContain("table-layout: fixed");
		expect(PORTAL_CSS).toContain("overflow-wrap: anywhere");
	});

	test("print guard keeps open tech details visible", () => {
		expect(PORTAL_CSS).toMatch(/@media\s+print/);
		expect(PORTAL_CSS).toContain("details.tech[open]");
		expect(PORTAL_CSS).toContain("display: block");
		expect(PORTAL_CSS).not.toMatch(
			/details(?:\.tech)?\s*\{[^}]*display:\s*none/,
		);
	});

	test("declares Comfortaa @font-face with the relative vendored url", () => {
		expect(PORTAL_CSS).toContain("font-family: 'Comfortaa'");
		expect(PORTAL_CSS).toContain(
			"src: url('Comfortaa-Variable.woff2') format('woff2')",
		);
		expect(PORTAL_CSS).toContain("font-weight: 400 700");
		expect(PORTAL_CSS).toContain("font-display: swap");
		expect(PORTAL_CSS).not.toContain("url(https://");
		expect(PORTAL_CSS).not.toContain("url('https://");
	});

	test("does not @import anything", () => {
		expect(PORTAL_CSS).not.toMatch(/@import\b/);
	});

	test("copies every tokens.css custom property with the same value", async () => {
		const tokens = await Bun.file(
			`${import.meta.dir}/../../public/static/tokens.css`,
		).text();
		const uncommented = tokens.replace(/\/\*[\s\S]*?\*\//g, "");
		const root = uncommented.match(/:root\s*\{([\s\S]*?)\}/);
		expect(root).not.toBeNull();
		const body = root?.[1] ?? "";
		const re = /(--[a-z0-9-]+):\s*([^;]+?)\s*;/gi;
		const found: { name: string; value: string }[] = [];
		let match = re.exec(body);
		while (match !== null) {
			const name = match[1];
			const value = match[2]?.trim();
			if (name !== undefined && value !== undefined && value.length > 0) {
				found.push({ name, value });
			}
			match = re.exec(body);
		}
		expect(found.length).toBeGreaterThan(0);
		for (const { name, value } of found) {
			const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			expect(PORTAL_CSS).toMatch(
				new RegExp(`${escapedName}:\\s*${escapedValue}`),
			);
		}
	});

	test("state modifiers use accessible token text colors, not decoration hues", () => {
		expect(PORTAL_CSS).toContain(".state-success");
		expect(PORTAL_CSS).toContain("var(--success-ink)");
		expect(PORTAL_CSS).toContain(".state-warn");
		expect(PORTAL_CSS).toContain("var(--warn-ink)");
		expect(PORTAL_CSS).toContain(".state-danger");
		expect(PORTAL_CSS).toContain("var(--danger)");
		expect(PORTAL_CSS).toContain(".state-neutral");
		expect(PORTAL_CSS).toContain("var(--ink-soft)");
		expect(PORTAL_CSS).not.toMatch(/\.state-\w+\s*\{[^}]*var\(--orange\)/);
		expect(PORTAL_CSS).not.toMatch(/\.state-\w+\s*\{[^}]*var\(--success\)/);
		expect(PORTAL_CSS).not.toMatch(/\.state-\w+\s*\{[^}]*var\(--warn\)/);
	});

	test("headings and lockup use --font-display", () => {
		expect(PORTAL_CSS).toContain("font-family: var(--font-display)");
		expect(PORTAL_CSS).toContain("font-family: var(--font-body)");
	});
});
