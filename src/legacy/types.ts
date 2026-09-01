// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The typed portal model for the legacy (v1) trust portal. This is a
 * read-only, already-verified projection: everything in here has already
 * been fetched and checked by the adapter/verifier in this directory. A
 * separate, later portal-presentation change consumes this model; it does
 * not re-derive, re-fetch, or infer beyond what is here.
 *
 * This stage's entire public claim is: "These are historical records of what
 * sol pbc published." Nothing in this model may be read to assert more —
 * not currency, not reproducibility, not complete coverage, not delivery.
 */

export type Iso8601 = string;
export type ProductSlug = "journal" | "linux" | "windows";

/**
 * Four provenance kinds, one attached to every displayed fact. A `signed`
 * fact is derived from a record that actually verified. `register` is read
 * only from the frozen legacy inventory (absence, coverage, an unattempted
 * rebuild) — never a verifier's own report. `declaration` is an
 * organizational statement with a named basis. `verifier` carries every
 * verification-axis outcome AND every model-construction outcome the
 * verifier itself reports about a record it tried and failed to build
 * (missing subject, missing object, malformed) — those three are the
 * verifier's own report, the same class as a failed/unavailable check, and
 * must never be tagged `register`.
 */
export type Provenance =
	| { kind: "signed"; sourceUrl: string }
	| { kind: "register" }
	| { kind: "declaration"; basis: string }
	| { kind: "verifier"; checkedAt: Iso8601 };

export interface RawLink {
	url: string;
}

/** A raw-evidence reference that failed the raw-link safety contract. Never rendered as clickable. */
export interface RejectedLink {
	reason: string;
}

/** An artifact that is declared inside a ledger entry but is not independently hosted on the evidence surface — named and digested, never given a fabricated raw link. */
export interface UnhostedArtifact {
	name: string;
	sha256: string;
	bytes: number;
	note: "not independently hosted; verify by hash comparison";
}

export type EvidenceLinkStatus =
	| { status: "linked"; link: RawLink }
	| { status: "unhosted"; artifact: UnhostedArtifact }
	| { status: "rejected"; rejected: RejectedLink };

export interface ArtifactRef {
	name: string;
	sha256: string;
	bytes: number;
}

// ---- axes -------------------------------------------------------------

/** This stage has exactly one publication value: paused. The type still names it explicitly rather than a bare boolean, so a future wave's new state is a real union member, not a silent reinterpretation of this one. */
export interface PublicationAxis {
	state: "paused";
	basis: string;
	provenance: Extract<Provenance, { kind: "declaration" }>;
}

/**
 * Freshness is read from the record's own signed pointer and is completely
 * independent of validity — an expired pointer is a valid signature over a
 * stale head, never a claim of invalidity, tampering, or insecurity.
 */
export type FreshnessAxis =
	| {
			state: "fresh";
			validUntil: Iso8601;
			signedAt: Iso8601;
			provenance: Extract<Provenance, { kind: "signed" }>;
	  }
	| {
			state: "expired";
			validUntil: Iso8601;
			signedAt: Iso8601;
			provenance: Extract<Provenance, { kind: "signed" }>;
	  }
	/**
	 * Only the current tip carries a signed freshness assertion (the mutable
	 * `latest.json` pointer). A superseded, non-tip entry was never itself
	 * signed as "valid until <date>" — using its own `published_utc` as a
	 * stand-in for that would be a fabricated freshness claim. This state is
	 * a structural fact about chain position, read from the frozen legacy
	 * inventory, never the verifier's own report.
	 */
	| {
			state: "not-time-bound";
			provenance: Extract<Provenance, { kind: "register" }>;
	  }
	/**
	 * The tip entry's pointer could not be fetched or did not verify. Freshness
	 * is a property of that separately-signed pointer, never of the entry
	 * itself — so an entry-verification failure never reaches this state, and
	 * this state never falls back to deriving freshness from the entry.
	 */
	| {
			state: "unavailable";
			reason: string;
			checkedAt: Iso8601;
			provenance: Extract<Provenance, { kind: "verifier" }>;
	  };

/**
 * Verification is a distinct axis from freshness. `valid` requires an
 * actually-passed signature+chain check. `invalid` and `unavailable` are
 * both `verifier`-tagged and both distinct from `expired` — a portal that
 * cannot reach a record has learned nothing about that record, and neither
 * failure mode may cause any other field of the same record to render as
 * confirmed or signed.
 */
export type VerificationAxis =
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

/** This stage never attempts a rebuild. The type still names the axis explicitly rather than omitting it. */
export interface RebuildAxis {
	state: "not-attempted";
	provenance: Extract<Provenance, { kind: "register" }>;
}

export interface AxisBlock {
	publication: PublicationAxis;
	freshness: FreshnessAxis;
	verification: VerificationAxis;
	rebuild: RebuildAxis;
}

// ---- records ------------------------------------------------------------

export interface EntryRecord {
	kind: "entry";
	product: Extract<ProductSlug, "journal" | "linux">;
	version: string;
	seq: number;
	entrySha256: string;
	publishedUtc: Iso8601;
	prevSha256: string;
	prevVersion: string;
	entryLink: EvidenceLinkStatus;
	entrySigLink: EvidenceLinkStatus;
	manifests: { ref: ArtifactRef; link: EvidenceLinkStatus }[];
	proofs: { ref: ArtifactRef; link: EvidenceLinkStatus }[];
	artifacts: { ref: ArtifactRef; link: EvidenceLinkStatus }[];
	axes: AxisBlock;
	isTip: boolean;
	latestLink?: EvidenceLinkStatus;
	latestSigLink?: EvidenceLinkStatus;
}

/** A version explicitly absent between two recorded neighbours (e.g. journal's real 1.0.14 gap). Register-tagged; worded so it can never imply the version was never released. */
export interface GapRecord {
	kind: "gap";
	product: Extract<ProductSlug, "journal" | "linux">;
	afterSeq: number;
	beforeSeq: number;
	provenance: Extract<Provenance, { kind: "register" }>;
}

/**
 * A record the verifier itself could not construct: missing subject,
 * missing evidence object, or failed schema validation. These are the
 * verifier's own report — same class as a failed/unavailable verification
 * outcome — and must be tagged `verifier`, never `register`. The record is
 * withheld from confirmed display entirely; sibling records for the same
 * product stay visible and correctly stated.
 */
export type ModelConstructionFailure =
	| {
			kind: "missing-subject";
			product: Extract<ProductSlug, "journal" | "linux">;
			provenance: Extract<Provenance, { kind: "verifier" }>;
			checkedAt: Iso8601;
	  }
	| {
			kind: "missing-object";
			product: Extract<ProductSlug, "journal" | "linux">;
			declaredName: string;
			provenance: Extract<Provenance, { kind: "verifier" }>;
			checkedAt: Iso8601;
	  }
	| {
			kind: "malformed";
			product: Extract<ProductSlug, "journal" | "linux">;
			reason: string;
			provenance: Extract<Provenance, { kind: "verifier" }>;
			checkedAt: Iso8601;
	  };

export type TimelineEntry = EntryRecord | GapRecord | ModelConstructionFailure;

export interface DerivedLedger {
	link: EvidenceLinkStatus;
}

/** Windows renders one fact — coverage/publication only — never four axis rows padded with invented "not applicable" values. */
export interface WindowsAbsenceFact {
	kind: "windows-absence";
	provenance: Extract<Provenance, { kind: "register" }>;
	observedAt: Iso8601;
	observationMethod: string;
}

export type SubjectModel =
	| { product: "windows"; fact: WindowsAbsenceFact }
	| {
			product: "journal" | "linux";
			timeline: TimelineEntry[];
			ledger: DerivedLedger;
	  };

export interface KeyRecord {
	filename: string;
	role: string;
	status: "active" | "retired";
	link: EvidenceLinkStatus;
}

export interface RegisterDeclaration {
	basis: string;
	provenance: Extract<Provenance, { kind: "declaration" }>;
}

export interface PortalModel {
	generatedAt: Iso8601;
	registerDeclaration: RegisterDeclaration;
	subjects: SubjectModel[];
	keys: KeyRecord[];
}

/**
 * The explicit invalid-model / degradation state. A page or route that
 * cannot obtain a valid model must render this, never a stale prior
 * success and never a confident-looking empty model.
 */
export interface ModelDegraded {
	httpStatus: number;
	marker: "degraded";
	reason: string;
	neverStale: true;
}

export type PortalModelResult =
	| { ok: true; model: PortalModel }
	| { ok: false; degraded: ModelDegraded };
