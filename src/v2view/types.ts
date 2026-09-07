// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The typed portal model for the v2 register view. Built offline by
 * `src/v2view/build.ts` (`make build-model`), embedded at deploy time, and
 * rendered by `src/portal/`. Like the v1 model in `src/legacy/types.ts`, this
 * is a read-only, already-verified projection: the builder ran the v2 TUF
 * client from a pinned root and the DSSE record verifier against the
 * TUF-authenticated policy, and everything in here is what those checks
 * reported. The presentation layer re-derives nothing.
 *
 * ⛔ This file imports nothing from `src/v2/`. `worker.ts` embeds the model
 * JSON and the portal renders it; the verifier code stays out of the Worker
 * bundle by construction (`worker-import-boundary.test.ts`).
 *
 * The three top-level states exist so a page can never show a v2 claim the
 * build did not earn:
 *
 *   absent      no pinned root is configured, or the configured base holds no
 *               repository. The portal renders exactly what it renders today,
 *               with no mention of a v2 root anywhere.
 *   unverified  a pinned root exists and something is at the base, but the
 *               repository did not verify. The failure is rendered as the
 *               verifier's own report; no release is shown.
 *   verified    the repository verified. `releases` may be empty (the
 *               claim-ceiling spec's state (a)) or carry records (state (b)).
 */

import type {
	EvidenceLinkStatus,
	Iso8601,
	ProductSlug,
	Provenance,
} from "../legacy/types";

export type { Iso8601 };

/** The pinned root as the build saw it: everything `/keys/` shows about the v2 root. */
export interface V2RootView {
	version: number;
	/** Root role key IDs, in the order root metadata lists them. */
	keyids: readonly string[];
	threshold: number;
	/** sha256 over the exact bytes of `<version>.root.json` as pinned. */
	rootSha256: string;
	/** The two witness lines exactly as `cso/playbooks/tuf-root-key-ceremony.md` § witnesses defines them. */
	witnessLines: readonly [string, string];
	/** Where the witness lines are published. Organizational declaration: the builder is told these, it does not verify them. */
	witnesses: readonly { label: string; url: string }[];
	/** Raw link to the pinned root object on the evidence host, when the base is the evidence host. */
	rootLink: EvidenceLinkStatus;
}

/**
 * Freshness for the v2 register is the repository's own `timestamp` role
 * expiry: the shortest-lived signed assertion a verifier checks. It is a
 * statement about the repository, never about any artifact.
 */
export type V2FreshnessAxis =
	| {
			state: "asserted";
			assertedUntil: Iso8601;
			signedVersion: number;
			provenance: Extract<Provenance, { kind: "signed" }>;
	  }
	| {
			state: "expired";
			expiredAt: Iso8601;
			roleName: string;
			provenance: Extract<Provenance, { kind: "verifier" }>;
	  };

export type V2VerificationAxis =
	| {
			state: "valid";
			checkedAt: Iso8601;
			provenance: Extract<Provenance, { kind: "verifier" }>;
	  }
	| {
			state: "invalid";
			reason: string;
			checkedAt: Iso8601;
			provenance: Extract<Provenance, { kind: "verifier" }>;
	  }
	| {
			state: "unavailable";
			reason: string;
			checkedAt: Iso8601;
			provenance: Extract<Provenance, { kind: "verifier" }>;
	  };

export interface V2Artifact {
	url: string;
	length: number;
	sha256: string;
	link: EvidenceLinkStatus;
}

/**
 * One release record the repository carries. `verification` is the DSSE
 * record check against the TUF-authenticated policy; the TUF layer already
 * proved the bytes match the signed target descriptor before this record
 * existed in the model at all.
 */
export interface V2ReleaseRecord {
	kind: "release";
	/** The record's own `product` string, e.g. `solstone-journal`. */
	product: string;
	/** The portal slug it maps to, or undefined for a product the portal has no page for. */
	slug: ProductSlug | undefined;
	version: string;
	issuedAt: Iso8601;
	/** Logical TUF target path, e.g. `software/solstone-journal/2.0.0/release-record.json`. */
	targetPath: string;
	/** sha256 of the record bytes as the TUF target descriptor records it. */
	targetSha256: string;
	/** Raw link to the record object as served (hash-prefixed under consistent snapshots). */
	recordLink: EvidenceLinkStatus;
	signerKeyids: readonly string[];
	artifacts: readonly V2Artifact[];
	/** Rendered verbatim: the record's own claim boundary, as signed. */
	doesProve: readonly string[];
	doesNotProve: readonly string[];
	verification: V2VerificationAxis;
}

/** An expected record that is not in the repository. Never green, never silent. */
export interface V2GapRecord {
	kind: "gap";
	product: string;
	slug: ProductSlug | undefined;
	version: string;
	/** Where the expectation came from, named so a reader can judge it. */
	basis: string;
	provenance: Extract<Provenance, { kind: "declaration" }>;
}

export type V2SoftwareEntry = V2ReleaseRecord | V2GapRecord;

/** The legacy v1 register bound into the v2 repository by the migration manifest record. */
export type V2LegacyBinding =
	| {
			state: "bound";
			/** Products the manifest covers, with their chain tips as the manifest states them. */
			products: readonly {
				product: string;
				chainLength: number;
				chainTipVersion: string | null;
			}[];
			objectCount: number;
			manifestLink: EvidenceLinkStatus;
			checkedAt: Iso8601;
			provenance: Extract<Provenance, { kind: "verifier" }>;
	  }
	| {
			state: "not-verified";
			reason: string;
			checkedAt: Iso8601;
			provenance: Extract<Provenance, { kind: "verifier" }>;
	  }
	| { state: "absent" };

export interface V2PolicyView {
	state: "loaded";
	targetPath: string;
	version: number;
	sha256: string;
	link: EvidenceLinkStatus;
}

export interface V2VerifiedModel {
	state: "verified";
	generatedAt: Iso8601;
	/** The base the build verified against. Rendered on `/verify/` so the command a reader runs matches. */
	metadataBase: string;
	targetsBase: string;
	root: V2RootView;
	freshness: Extract<V2FreshnessAxis, { state: "asserted" }>;
	repositoryFingerprint: string;
	/** The authorization policy the records were checked against. A policy that failed to load is named, so a record's `unavailable` has a visible cause. */
	policy:
		| V2PolicyView
		| { state: "absent" }
		| { state: "failed"; targetPath: string; reason: string };
	/** The DSSE key-set target the policy's key IDs were resolved against, when the repository carries one. */
	dsseKeys: { targetPath: string; link: EvidenceLinkStatus } | undefined;
	legacy: V2LegacyBinding;
	/** Every release record and every gap, in the order the builder found them. */
	software: readonly V2SoftwareEntry[];
	/** Products the repository names that the portal has no page for. Surfaced, not hidden. */
	unmappedProducts: readonly string[];
}

export interface V2UnverifiedModel {
	state: "unverified";
	generatedAt: Iso8601;
	metadataBase: string;
	targetsBase: string;
	/** The pinned root is trusted out of band, so it is shown even when the repository is not. */
	root: V2RootView;
	/** An expired role is its own state, never a generic failure and never green. */
	freshness: Extract<V2FreshnessAxis, { state: "expired" }> | undefined;
	failure: {
		roleName: string | undefined;
		reason: string;
		detail: string;
		checkedAt: Iso8601;
		provenance: Extract<Provenance, { kind: "verifier" }>;
	};
}

export interface V2AbsentModel {
	state: "absent";
	generatedAt: Iso8601;
	/** Why no v2 register is rendered. Never shown to a visitor; kept so the build log and the packet can say so. */
	reason: string;
}

export type V2Model = V2VerifiedModel | V2UnverifiedModel | V2AbsentModel;

/**
 * The build never fails on an absent or unverifiable repository (contract
 * item 1: never a build failure that hides the v1 register). It is a plain
 * value, not a result union, so the Worker cannot receive a stale one: the
 * generated file is rewritten on every build.
 */
export type V2ModelResult = V2Model;

/** Map a record's product string onto the portal's fixed slugs. Anything else is unmapped, never guessed. */
export function slugForProduct(product: string): ProductSlug | undefined {
	if (product === "solstone-journal") return "journal";
	if (product === "solstone-linux") return "linux";
	if (product === "solstone-windows") return "windows";
	return undefined;
}

export function isVerified(model: V2Model): model is V2VerifiedModel {
	return model.state === "verified";
}

/** True when a page may say a v2 root exists: verified or unverified, never absent. */
export function rootIsKnown(
	model: V2Model,
): model is V2VerifiedModel | V2UnverifiedModel {
	return model.state !== "absent";
}

export const ABSENT_NO_PIN: V2AbsentModel = {
	state: "absent",
	generatedAt: "1970-01-01T00:00:00Z",
	reason: "no pinned root configured",
};
