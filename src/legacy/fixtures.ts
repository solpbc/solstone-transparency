// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Wholly synthetic fixture builders for the legacy (v1) verifier/model
 * tests. Nothing here is a copy, sample, or derivative of real evidence
 * that was actually published — every product name, version, digest, and
 * date below is invented for the test. Real signing happens per-test via a
 * freshly generated throwaway keypair (`test-helpers.ts`); no key material
 * is stored in this file.
 */

import { GENESIS_SHA256 } from "./canonical";
import type { LatestPointerV1Raw, LedgerEntryV1Raw } from "./verify";

/** A structurally valid, wholly synthetic genesis entry. Used as the "valid + fresh" and "valid + expired" base, and as the base every negative-control fixture below tampers from. */
export function syntheticGenesisEntry(
	overrides: Partial<LedgerEntryV1Raw> = {},
): LedgerEntryV1Raw {
	return {
		artifacts: [
			{
				name: "example-0.0.1.tar.gz",
				sha256: "ab".repeat(32),
				bytes: 100_000_000,
			},
		],
		manifests: [
			{
				name: "example-0.0.1.rust-release-manifest.json",
				sha256: "cd".repeat(32),
				bytes: 512,
			},
		],
		proofs: [],
		prev_sha256: GENESIS_SHA256,
		prev_version: "",
		product: "example-product",
		published_utc: "2026-01-01T00:00:00Z",
		schema: "https://solpbc.org/schemas/transparency-ledger-entry/v1.json",
		seq: 1,
		source_commit: "0123456789abcdef0123456789abcdef01234567",
		version: "0.0.1",
		...overrides,
	};
}

/** A second entry chained onto the genesis entry above, for chain-linkage tests. Caller supplies the genesis entry's actual computed sha256 as `prevSha256`. */
export function syntheticSecondEntry(
	prevSha256: string,
	overrides: Partial<LedgerEntryV1Raw> = {},
): LedgerEntryV1Raw {
	return {
		artifacts: [
			{
				name: "example-0.0.2.tar.gz",
				sha256: "ef".repeat(32),
				bytes: 100_000_001,
			},
		],
		manifests: [
			{
				name: "example-0.0.2.rust-release-manifest.json",
				sha256: "01".repeat(32),
				bytes: 513,
			},
		],
		proofs: [],
		prev_sha256: prevSha256,
		prev_version: "0.0.1",
		product: "example-product",
		published_utc: "2026-01-02T00:00:00Z",
		schema: "https://solpbc.org/schemas/transparency-ledger-entry/v1.json",
		seq: 2,
		source_commit: "abcdef0123456789abcdef0123456789abcdef01",
		version: "0.0.2",
		...overrides,
	};
}

/** Negative control 2 (broken chain link): declares a `prev_sha256` that does not match the real previous entry's hash. */
export function fixtureBrokenChainLink(): LedgerEntryV1Raw {
	return syntheticSecondEntry("ff".repeat(32));
}

/** Negative control 5 (missing subject): the entry's own identity field (`version`) is absent. */
export function fixtureMissingSubject(): Omit<LedgerEntryV1Raw, "version"> {
	const { version: _version, ...rest } = syntheticGenesisEntry();
	return rest;
}

/** A record that fails schema validation: a float where an integer is required (bools are `number`-typed nowhere in this schema, so the float case alone exercises the "no floats" rule). */
export function fixtureMalformedRecord(): LedgerEntryV1Raw {
	return syntheticGenesisEntry({ seq: 1.5 as unknown as number });
}

/** Negative control 6 (expired pointer): a structurally valid, signed pointer whose `valid_until` is in the past relative to the fixture's own fixed "now". */
export function fixtureExpiredPointer(tipSha256: string): LatestPointerV1Raw {
	return {
		chain_length: 1,
		product: "example-product",
		schema: "https://solpbc.org/schemas/transparency-latest/v1.json",
		signed_at: "2026-01-01T00:00:00Z",
		tip_sha256: tipSha256,
		valid_until: "2026-01-15T00:00:00Z",
		version: "0.0.1",
	};
}

export function fixtureFreshPointer(tipSha256: string): LatestPointerV1Raw {
	return {
		chain_length: 1,
		product: "example-product",
		schema: "https://solpbc.org/schemas/transparency-latest/v1.json",
		signed_at: "2026-01-01T00:00:00Z",
		tip_sha256: tipSha256,
		valid_until: "2099-01-01T00:00:00Z",
		version: "0.0.1",
	};
}

/**
 * Negative control 3 (hostile display string): a field value containing a
 * script tag, a path-traversal-shaped segment, and a raw control character —
 * everything a hostile source could put in a display name that is still
 * valid ASCII. This is deliberately ASCII-only: the v1 wire format's own
 * canonicalization rule requires every string value to be ASCII before
 * serialization, so a real signed record can never carry a non-ASCII
 * bidi-override character in the first place — that class of attack is
 * already excluded at the wire layer, proven separately below
 * (`HOSTILE_BIDI_DISPLAY_STRING`), not smuggled through this control. This
 * control instead proves the verifier does not choke on,
 * strip, or misinterpret an ASCII-hostile value — it passes it through
 * verbatim as opaque data, leaving escaping to the presentation layer.
 */
export const HOSTILE_DISPLAY_STRING =
	"<script>alert(1)</script>\x00\x1b[31m../../../etc/passwd-a-perfectly-normal-looking-filename";

export function fixtureHostileDisplayName(): LedgerEntryV1Raw {
	return syntheticGenesisEntry({
		artifacts: [
			{ name: HOSTILE_DISPLAY_STRING, sha256: "ab".repeat(32), bytes: 1 },
		],
	});
}

/**
 * A right-to-left-override/pop-directional-formatting bidi attack, the same
 * shape a portal presentation layer's own hostile-string fixtures exercise.
 * At THIS layer it is not a valid input to pass through — it is proof that
 * the wire format's ASCII-only rule rejects it before it can ever reach a
 * display, which is a stronger defense than presentation-layer escaping
 * alone. See the dedicated test asserting this fails closed as `malformed`.
 */
const RLO = "‮"; // RIGHT-TO-LEFT OVERRIDE
const PDF = "‬"; // POP DIRECTIONAL FORMATTING
export const HOSTILE_BIDI_DISPLAY_STRING = `${RLO}gpj.exe${PDF}<script>alert(1)</script>-a-perfectly-normal-looking-filename`;

export function fixtureHostileBidiDisplayName(): LedgerEntryV1Raw {
	return syntheticGenesisEntry({
		artifacts: [
			{ name: HOSTILE_BIDI_DISPLAY_STRING, sha256: "ab".repeat(32), bytes: 1 },
		],
	});
}

/** Negative control 4 (invalid URL scheme): candidate raw-link strings a hostile or buggy source might supply, none of which may ever become clickable. */
export const INVALID_SCHEME_CANDIDATES = [
	"javascript:alert(1)",
	"http://transparency.solstone.app/releases/example-product/v/0.0.1/ledger-entry.json",
	"https://evil.example/releases/example-product/v/0.0.1/ledger-entry.json",
	"https://transparency.solstone.app:8443/releases/example-product/v/0.0.1/ledger-entry.json",
	"https://user:pass@transparency.solstone.app/releases/example-product/v/0.0.1/ledger-entry.json",
	"https://transparency.solstone.app/releases/example-product/v/0.0.1/ledger-entry.json?x=1",
	"https://transparency.solstone.app/releases/example-product/v/0.0.1/ledger-entry.json#frag",
	"https://transparency.solstone.app/releases/example-product/v/../../../etc/passwd",
];
