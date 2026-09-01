// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { type Fetcher, buildPortalModel } from "./adapter";
import { GENESIS_SHA256, canonicalize, sha256Hex } from "./canonical";
import { CATALOG, JOURNAL_GAP } from "./inventory";
import {
	type ThrowawayKeypair,
	generateThrowawayKeypair,
} from "./test-helpers";
import type { LedgerEntryV1Raw } from "./verify";

const KEY_FILENAME = "solpbc-transparency-1.pub";

/** An in-memory Fetcher backed by a plain object store, used so adapter tests never touch the network. */
class FakeFetcher implements Fetcher {
	private bytes = new Map<string, Uint8Array>();
	private text = new Map<string, string>();
	private status = new Map<string, number>();

	setBytes(path: string, body: Uint8Array, status = 200) {
		this.bytes.set(path, body);
		this.status.set(path, status);
	}
	setText(path: string, body: string, status = 200) {
		this.text.set(path, body);
		this.status.set(path, status);
	}

	async getBytes(path: string) {
		const status = this.status.get(path) ?? 404;
		return { status, body: this.bytes.get(path) ?? new Uint8Array() };
	}
	async getText(path: string) {
		const status = this.status.get(path) ?? 404;
		return { status, body: this.text.get(path) ?? "" };
	}
}

/** Populates a FakeFetcher with a genuinely signed, correctly chained set of entries for one product, matching CATALOG's real version list so the adapter's hardcoded catalog walk resolves every path it looks for. */
async function seedProductChain(
	fetcher: FakeFetcher,
	kp: ThrowawayKeypair,
	product: "journal" | "linux",
	fullProduct: string,
) {
	const versions = CATALOG[product];
	let prevSha256 = GENESIS_SHA256;
	let prevVersion = "";
	let lastEntryBytes: Uint8Array | undefined;
	for (let i = 0; i < versions.length; i++) {
		const version = versions[i];
		if (version === undefined) continue;
		const seq = i + 1;
		const entry: LedgerEntryV1Raw = {
			artifacts: [
				{
					name: `${fullProduct}-${version}.tar.gz`,
					sha256: "ab".repeat(32),
					bytes: 1000,
				},
			],
			manifests: [
				{
					name: `${fullProduct}-${version}.rust-release-manifest.json`,
					sha256: "cd".repeat(32),
					bytes: 200,
				},
			],
			proofs: [
				{
					name: `${fullProduct}-${version}.proof.json`,
					sha256: "ef".repeat(32),
					bytes: 50,
				},
			],
			prev_sha256: prevSha256,
			prev_version: prevVersion,
			product: fullProduct,
			published_utc: `2026-01-${String(seq).padStart(2, "0")}T00:00:00Z`,
			schema: "https://solpbc.org/schemas/transparency-ledger-entry/v1.json",
			seq,
			source_commit: "0123456789abcdef0123456789abcdef01234567",
			version,
		};
		const bytes = canonicalize(entry);
		const entrySha256 = await sha256Hex(bytes);
		const sig = await kp.sign(
			bytes,
			`solpbc-transparency-v1 entry product=${fullProduct} seq=${seq} version=${version} sha256=${entrySha256} prev=${prevSha256}`,
		);
		const entryPath = `releases/${fullProduct}/v/${version}/ledger-entry.json`;
		fetcher.setBytes(entryPath, bytes);
		fetcher.setText(`${entryPath}.minisig`, sig);
		for (const m of entry.manifests ?? []) {
			fetcher.setBytes(
				`releases/${fullProduct}/v/${version}/${m.name}`,
				new Uint8Array([1]),
			);
		}
		for (const p of entry.proofs ?? []) {
			fetcher.setBytes(
				`releases/${fullProduct}/v/${version}/${p.name}`,
				new Uint8Array([1]),
			);
		}
		prevSha256 = entrySha256;
		prevVersion = version;
		lastEntryBytes = bytes;
	}
	if (lastEntryBytes) {
		const tipSha256 = await sha256Hex(lastEntryBytes);
		const pointer = {
			chain_length: versions.length,
			product: fullProduct,
			schema: "https://solpbc.org/schemas/transparency-latest/v1.json",
			signed_at: "2026-01-01T00:00:00Z",
			tip_sha256: tipSha256,
			valid_until: "2026-01-15T00:00:00Z", // always in the past relative to any realistic test "now" — freshness is not this test's concern
			version: versions[versions.length - 1],
		};
		const pointerBytes = canonicalize(pointer);
		const pointerSig = await kp.sign(
			pointerBytes,
			`solpbc-transparency-v1 latest product=${fullProduct} chain_length=${pointer.chain_length} tip=${tipSha256} valid_until=${pointer.valid_until}`,
		);
		fetcher.setBytes(`releases/${fullProduct}/latest.json`, pointerBytes);
		fetcher.setText(`releases/${fullProduct}/latest.json.minisig`, pointerSig);
	}
}

describe("buildPortalModel — full pipeline over a fake, in-memory evidence host", () => {
	test("builds a valid model with journal's gap, linux's single entry, and windows absence", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${KEY_FILENAME}`, kp.pubKeyText);
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
			expect(e.axes.freshness.state).toBe("expired"); // fixed 2026-01-15 valid_until vs. fixed 2026-06-01 "now"
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

	test("a missing tip entry degrades that record to missing-object, never a silent gap in the timeline", async () => {
		const kp = await generateThrowawayKeypair();
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${KEY_FILENAME}`, kp.pubKeyText);
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
