// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * The v2 TUF role graph, thresholds, validity windows and renewal cadences.
 *
 * Genesis policy approved on 2026-09-07: one root key with threshold one.
 * Root renewal remains able to honor a trusted root's multi-key threshold.
 * These values define signed metadata; changing them requires operator approval,
 * never a test convenience. Tests inject time instead of shortening validity.
 *
 * ⚠ The staging and production graphs are IDENTICAL. Only the keys and the object
 * prefix differ. The discriminator between the two repositories is the pinned root
 * key set, not a label -- distinct root keys make cross-verification structurally
 * impossible, which is the property worth having. Do not add an environment or
 * network field to root, and do not rely on one.
 */

/** Days. Named so a reader is never guessing at the unit of a bare number. */
export type Days = number;

export interface RoleWindow {
	/** Signatures required. */
	threshold: number;
	/** How many keys the role holds. */
	keyCount: number;
	/** Validity window `V_r`. */
	validityDays: Days;
	/**
	 * Renewal cadence `C_r`, always `<= V_r / 3`.
	 *
	 * Where the calendar allows, `C_r` is exactly `V_r / 3`, which makes the
	 * renewal deadline and the alert threshold the SAME instant: a file signed at
	 * `T` is due at `T + C_r`, at which moment exactly `2 * C_r` validity remains.
	 * One number to get wrong instead of two.
	 */
	renewalDays: Days;
	/** Alert when remaining validity drops to this, per architecture 5.8's `2 * C_r`. */
	alertAtRemainingDays: Days;
	/** The office or person who owns the renewal firing. Never authority; an owner. */
	owner: string;
	/** Vault/key-event label. ⛔ A label is an identifier, never authority. */
	keyLabel: string;
}

export interface DelegatedRoleConfig extends RoleWindow {
	name: string;
	/** Target path prefix this role is authorized over. */
	pathPrefix: string;
	/** Always true at Wave 2: a role that declines must fail, not fall through. */
	terminating: boolean;
}

/**
 * Top-level roles. `timestamp` is the only routinely online signing role, and its
 * blast radius is bounded to freeze/replay inside its own seven-day window: it
 * cannot sign targets, snapshot, delegated metadata, DSSE evidence, or portal code.
 */
export const TOP_LEVEL_ROLES = {
	root: {
		threshold: 1,
		keyCount: 1,
		validityDays: 1095,
		renewalDays: 365,
		alertAtRemainingDays: 730,
		owner: "cso",
		keyLabel: "solpbc-tuf-root-1",
	},
	targets: {
		threshold: 1,
		keyCount: 1,
		validityDays: 365,
		renewalDays: 120,
		alertAtRemainingDays: 240,
		owner: "cso",
		keyLabel: "solpbc-tuf-targets-1",
	},
	snapshot: {
		threshold: 1,
		keyCount: 1,
		validityDays: 90,
		renewalDays: 30,
		alertAtRemainingDays: 60,
		owner: "cso",
		keyLabel: "solpbc-tuf-snapshot-1",
	},
	timestamp: {
		threshold: 1,
		keyCount: 1,
		validityDays: 7,
		renewalDays: 1,
		alertAtRemainingDays: 2,
		owner: "cso",
		keyLabel: "solpbc-tuf-timestamp-1",
	},
} as const satisfies Record<string, RoleWindow>;

/**
 * Delegated targets roles, IN DELEGATION LIST ORDER. The order is part of the
 * contract: TUF consults delegations in listed order, so reordering this array
 * changes which role wins a path both could match.
 */
export const DELEGATED_ROLES: readonly DelegatedRoleConfig[] = [
	{
		name: "targets-software",
		pathPrefix: "software/",
		terminating: true,
		threshold: 1,
		keyCount: 1,
		validityDays: 180,
		renewalDays: 60,
		alertAtRemainingDays: 120,
		owner: "cso",
		keyLabel: "solpbc-tuf-software-1",
	},
	{
		name: "targets-services",
		pathPrefix: "services/",
		terminating: true,
		threshold: 1,
		keyCount: 1,
		validityDays: 180,
		renewalDays: 60,
		alertAtRemainingDays: 120,
		owner: "cso",
		keyLabel: "solpbc-tuf-services-1",
	},
	{
		name: "targets-verification",
		pathPrefix: "verification/",
		terminating: true,
		threshold: 1,
		keyCount: 1,
		validityDays: 180,
		renewalDays: 60,
		alertAtRemainingDays: 120,
		owner: "cso",
		keyLabel: "solpbc-tuf-verification-1",
	},
	{
		name: "targets-legacy",
		pathPrefix: "legacy/",
		terminating: true,
		threshold: 1,
		keyCount: 1,
		validityDays: 270,
		renewalDays: 90,
		alertAtRemainingDays: 180,
		owner: "cso",
		keyLabel: "solpbc-tuf-legacy-1",
	},
];

/**
 * Path prefixes NO delegated role may carry. This half is load-bearing.
 *
 * 🔴 `policy/` holds the DSSE authorization policy. If any delegated role could
 * sign it, the release producer could GRANT ITSELF AUDIT AUTHORITY. A delegated
 * role must never be able to widen its own authority.
 *
 * `keys/` holds key-event records, which narrate the trust substrate; a collection
 * role must not narrate it. `commitments/` binds legal and policy documents, whose
 * admission is a founder and legal question rather than an engineering default.
 *
 * Anything matching one of these resolves to top-level `targets` only. Anything
 * matching no role at all is `role-not-authorized` -- never a fallback.
 */
export const TOP_LEVEL_ONLY_PREFIXES: readonly string[] = [
	"policy/",
	"keys/",
	"commitments/",
];

/**
 * Validity must strictly increase in this order.
 *
 * Not a coincidence and not cosmetic: it is what makes a repository-level role take
 * everything down while a dormant collection fails alone. A builder that violates
 * it produces a repository whose freshness semantics are inverted.
 */
export const VALIDITY_ORDER: readonly string[] = [
	"timestamp",
	"snapshot",
	"targets-software",
	"targets-legacy",
	"targets",
	"root",
];
