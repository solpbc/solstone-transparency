// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { buildPortalModel } from "./adapter";
import { CATALOG, JOURNAL_GAP } from "./inventory";
import {
	FakeFetcher,
	TEST_KEY_FILENAME,
	generateThrowawayKeypair,
	seedProductChain,
} from "./test-helpers";

describe("buildPortalModel — full pipeline over a fake, in-memory evidence host", () => {
	test("builds a valid model with journal's gap, linux's single entry, and windows absence", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "journal", "solstone-journal");
		await seedProductChain(fetcher, kp, "linux", "solstone-linux");
		// windows: no entries seeded, so getBytes falls through to the default 404.

		const result = await buildPortalModel(
			fetcher,
			new Date("2026-06-01T00:00:00Z"),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const journal = result.model.subjects.find((s) => s.product === "journal");
		expect(journal && "timeline" in journal).toBe(true);
		if (!journal || !("timeline" in journal)) return;

		const entries = journal.timeline.filter((t) => t.kind === "entry");
		expect(entries.length).toBe(CATALOG.journal.length);
		// Every entry actually verified against the fake chain we built.
		for (const e of entries) {
			expect(e.axes.verification.state).toBe("valid");
			// Freshness is a property of the tip's separately-signed pointer, never
			// of the entry itself: only the tip gets a time-bound value (fixed
			// 2026-01-15 valid_until vs. fixed 2026-06-01 "now" → expired); every
			// superseded entry is honestly "not-time-bound", not a fabricated value
			// derived from its own published_utc.
			if (e.isTip) {
				expect(e.axes.freshness.state).toBe("expired");
				expect(e.axes.freshness.provenance.kind).toBe("signed");
			} else {
				expect(e.axes.freshness.state).toBe("not-time-bound");
				expect(e.axes.freshness.provenance.kind).toBe("register");
			}
			expect(e.axes.publication.state).toBe("paused");
			expect(e.axes.rebuild.state).toBe("not-attempted");
		}

		const gaps = journal.timeline.filter((t) => t.kind === "gap");
		expect(gaps.length).toBe(1);
		expect(gaps[0]).toMatchObject({
			afterSeq: JOURNAL_GAP.afterSeq,
			beforeSeq: JOURNAL_GAP.beforeSeq,
			provenance: { kind: "register" },
		});

		const linux = result.model.subjects.find((s) => s.product === "linux");
		expect(
			linux &&
				"timeline" in linux &&
				linux.timeline.filter((t) => t.kind === "entry").length,
		).toBe(1);

		const windows = result.model.subjects.find((s) => s.product === "windows");
		expect(windows && "fact" in windows).toBe(true);
		if (windows && "fact" in windows) {
			expect(windows.fact.kind).toBe("windows-absence");
			expect(windows.fact.provenance).toEqual({ kind: "register" });
		}
	});

	test("a tampered TIP ENTRY signature never taints freshness — the two axes are independently sourced", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux");
		const tipVersion = CATALOG.linux[CATALOG.linux.length - 1];
		if (tipVersion === undefined) throw new Error("fixture has no linux tip");
		// Corrupt only the tip entry's own signature; the separately-signed
		// pointer is untouched.
		fetcher.setText(
			`releases/solstone-linux/v/${tipVersion}/ledger-entry.json.minisig`,
			"untrusted comment: corrupted\nAAAAnotarealsignature",
		);

		const result = await buildPortalModel(
			fetcher,
			new Date("2026-06-01T00:00:00Z"),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const linux = result.model.subjects.find((s) => s.product === "linux");
		if (!linux || !("timeline" in linux))
			throw new Error("expected linux timeline");
		const tip = linux.timeline.find((t) => t.kind === "entry" && t.isTip);
		if (!tip || tip.kind !== "entry") throw new Error("expected a tip entry");

		expect(tip.axes.verification.state).toBe("invalid");
		// The bug this test guards: freshness must never inherit "signed"
		// provenance from an entry whose own signature failed. It is derived
		// solely from the separately-signed pointer, which is untouched here.
		expect(tip.axes.freshness.state).toBe("expired");
		expect(tip.axes.freshness.provenance.kind).toBe("signed");
		if (tip.axes.freshness.provenance.kind === "signed") {
			expect(tip.axes.freshness.provenance.sourceUrl).toContain("latest.json");
		}
	});

	test("an unavailable/tampered POINTER never falls back to a fabricated entry-derived freshness value", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux");
		// Corrupt only the pointer's signature; every entry (including the tip)
		// remains genuinely, verifiably signed.
		fetcher.setText(
			"releases/solstone-linux/latest.json.minisig",
			"untrusted comment: corrupted\nAAAAnotarealsignature",
		);

		const result = await buildPortalModel(
			fetcher,
			new Date("2026-06-01T00:00:00Z"),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const linux = result.model.subjects.find((s) => s.product === "linux");
		if (!linux || !("timeline" in linux))
			throw new Error("expected linux timeline");
		const tip = linux.timeline.find((t) => t.kind === "entry" && t.isTip);
		if (!tip || tip.kind !== "entry") throw new Error("expected a tip entry");

		expect(tip.axes.verification.state).toBe("valid");
		// The bug this test guards: a pointer that fails to verify must never
		// silently fall back to a "signed"-tagged value derived from the
		// entry's own published_utc.
		expect(tip.axes.freshness.state).toBe("unavailable");
		expect(tip.axes.freshness.provenance.kind).toBe("verifier");
	});

	test("a non-JSON entry body degrades that record to malformed instead of throwing and failing the whole build", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux");
		const tipVersion = CATALOG.linux[CATALOG.linux.length - 1];
		if (tipVersion === undefined) throw new Error("fixture has no linux tip");
		// A truncated fetch or an HTML error page served with a 200 both look
		// like this: a 200 status whose body is not parseable JSON at all.
		fetcher.setBytes(
			`releases/solstone-linux/v/${tipVersion}/ledger-entry.json`,
			new TextEncoder().encode("<html>not json</html>"),
		);

		const result = await buildPortalModel(
			fetcher,
			new Date("2026-06-01T00:00:00Z"),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const linux = result.model.subjects.find((s) => s.product === "linux");
		if (!linux || !("timeline" in linux))
			throw new Error("expected linux timeline");
		const tip = linux.timeline.find((t) => t.kind === "entry" && t.isTip);
		expect(tip).toBeUndefined();
		const malformed = linux.timeline.find((t) => t.kind === "malformed");
		expect(malformed).toBeDefined();
	});

	test("a missing tip entry degrades that record to missing-object, never a silent gap in the timeline", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux");
		// Deliberately do not seed journal at all — every journal path 404s via the fake's default.

		const result = await buildPortalModel(
			fetcher,
			new Date("2026-06-01T00:00:00Z"),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const journal = result.model.subjects.find((s) => s.product === "journal");
		if (!journal || !("timeline" in journal))
			throw new Error("expected journal subject");
		const failures = journal.timeline.filter(
			(t) => t.kind === "missing-object",
		);
		expect(failures.length).toBeGreaterThan(0);
	});

	test("a missing pinned key degrades the whole model, never a partial or stale success", async () => {
		const fetcher = new FakeFetcher(); // key never seeded -> 404
		const result = await buildPortalModel(
			fetcher,
			new Date("2026-06-01T00:00:00Z"),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.degraded.marker).toBe("degraded");
			expect(result.degraded.neverStale).toBe(true);
		}
	});
});
