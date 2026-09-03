// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The frozen legacy (v1) inventory: a source-controlled, discovery-only
 * record of which keys exist on the public evidence host, and their
 * observed metadata — key, byte size, sha256, content-type, ETag, and
 * cache-control. This is metadata only: no evidence bytes, signature
 * material, or key material are stored here, only what was observed about
 * each object. It is used for discovery and cross-checking, never as a
 * substitute for re-fetching and re-verifying the actual evidence.
 *
 * Measured live against https://transparency.solstone.app, 2026-09-01, by
 * walking each product's chain backward from its published `latest.json`
 * pointer via `prev_version`, HTTP GET on every entry/signature/manifest/
 * proof/pointer/ledger/key/ABOUT.txt object, and computing sha256 locally
 * over each response body. Independently cross-checked against a
 * separately-constructed bucket listing (108 journal + 9 linux + 2
 * general = 119) — this file's own count (below) matches that figure by
 * direct re-derivation, not by restating it.
 *
 * Re-derive, don't restate: a later session doubting any figure here should
 * re-run the same live walk (this module's own object shape is stable
 * enough to script it) rather than trust this file's age.
 *
 * Re-verified 2026-09-03 (Wave 3 readiness, `req_fzo23rym`): every one of
 * the 119 recorded objects re-fetched live and re-hashed, byte-for-byte
 * identical to what's recorded below; no new journal/linux version exists
 * (1.0.23 and 1.0.3 both 404); Windows still carries zero records (404).
 * A fresh R2 bucket listing (`list_objects_v2`, S3-compatible API) found
 * exactly one object beyond these 119: `robots.txt` (157 bytes) — Wave 1's
 * tier-4 crawler-policy file (`records/decisions/260901-cto-wave-1-trust-transparency-redirect-robots-d1.md`),
 * correctly out of scope for this release-evidence inventory. No drift.
 */

import rawInventory from "./inventory-data.json";

export interface InventoryObject {
	key: string;
	bytes: number;
	sha256: string;
	content_type: string | null;
	etag: string | null;
	cache_control: string | null;
	collection: string;
	status: number;
}

export const MEASURED_AT = "2026-09-01T23:10Z";
export const MEASURED_FROM =
	"operator host, direct curl + local sha256, no CDN/proxy in the measurement path";

export const INVENTORY: InventoryObject[] = rawInventory as InventoryObject[];

/** The complete, fixed v1 catalog of products and versions this v1 register carries. Windows carries zero versions by design — its absence is itself the observed fact, not a placeholder. */
export const CATALOG: Record<"journal" | "linux" | "windows", string[]> = {
	journal: [
		"1.0.12",
		"1.0.13",
		"1.0.15",
		"1.0.16",
		"1.0.17",
		"1.0.18",
		"1.0.19",
		"1.0.20",
		"1.0.21",
		"1.0.22",
	],
	linux: ["1.0.2"],
	windows: [],
};

/** The one deliberate gap in journal's register: recorded neighbours 1.0.13 and 1.0.15 skip the curated absent version. This is a gap in the record, never evidence the version was not released. */
export const JOURNAL_GAP = {
	product: "journal" as const,
	afterVersion: "1.0.13",
	beforeVersion: "1.0.15",
	// the known absent version between the two recorded neighbours — a curated fact from the register's own history, not inferred from the neighbouring version strings
	absentVersion: "1.0.14",
	afterSeq: 2,
	beforeSeq: 3,
};

export function objectsInCollection(collection: string): InventoryObject[] {
	return INVENTORY.filter((o) => o.collection === collection);
}

export function totalObjectCount(): number {
	return INVENTORY.length;
}
