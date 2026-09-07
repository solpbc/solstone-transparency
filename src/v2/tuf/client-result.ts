// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import type {
	TufFailure,
	TufJsonValue,
	TufRejectionReason,
	TufSuccess,
} from "./outcome";

export type RoleStatus =
	| { roleName: string; state: "verified"; version: number }
	| { roleName: string; state: "failed"; reason: TufRejectionReason }
	| { roleName: string; state: "never-checked" };

export interface RenewalAdvisory {
	roleName: string;
	overdueByMilliseconds: number;
}

export interface AuthorizationChainEntry {
	subjectRole: string;
	subjectVersion: number;
	delegationPath: readonly string[];
	authorizingRole: string;
	authorizingVersion: number;
	satisfyingKeyids: readonly string[];
}

export interface ConsumedVersions {
	root: number;
	timestamp: number;
	snapshot: number;
	targets: number;
	delegatedTargets: Readonly<Record<string, number>>;
}

export interface PartialConsumedVersions {
	root?: number;
	timestamp?: number;
	snapshot?: number;
	targets?: number;
	delegatedTargets: Readonly<Record<string, number>>;
}

/** Metadata bytes and envelope accepted while constructing a successful TUF view. */
export interface AuthenticatedRoleMetadata {
	roleName: string;
	filename: string;
	version: number;
	envelope: {
		signed: Readonly<Record<string, TufJsonValue>>;
		signatures: readonly { keyid: string; sig: string }[];
	};
	bytes: Uint8Array;
}

/** Target bytes accepted against the descriptor of the role that authorized them. */
export interface AuthenticatedTarget {
	roleName: string;
	logicalPath: string;
	descriptor: {
		length: number;
		hashes: Readonly<Record<string, string>>;
	};
	bytes: Uint8Array;
}

export interface TufClientSuccess {
	evaluatedAt: string;
	advisories: readonly RenewalAdvisory[];
	authorizationChain: readonly AuthorizationChainEntry[];
	versions: ConsumedVersions;
	roleStatuses: readonly RoleStatus[];
	fingerprint: string;
	authenticatedMetadata: Readonly<Record<string, AuthenticatedRoleMetadata>>;
	authenticatedTargets: Readonly<
		Record<string, Readonly<Record<string, AuthenticatedTarget>>>
	>;
}

export interface TufClientPartialView {
	evaluatedAt: string;
	authorizationChain: readonly AuthorizationChainEntry[];
	versions: PartialConsumedVersions;
	roleStatuses: readonly RoleStatus[];
	fingerprint: string;
}

export type TufClientFailureClassification =
	| { kind: "role"; roleName: string }
	| { kind: "trust-store" };

export interface TufClientFailure<
	R extends TufRejectionReason = TufRejectionReason,
> extends TufFailure<R> {
	partial: TufClientPartialView;
	classification: TufClientFailureClassification;
}

export type TufClientResult = TufSuccess<TufClientSuccess> | TufClientFailure;
