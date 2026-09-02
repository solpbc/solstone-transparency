// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import type { TufFailure, TufRejectionReason, TufSuccess } from "./outcome";

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

export interface TufClientSuccess {
	evaluatedAt: string;
	advisories: readonly RenewalAdvisory[];
	authorizationChain: readonly AuthorizationChainEntry[];
	versions: ConsumedVersions;
	roleStatuses: readonly RoleStatus[];
	fingerprint: string;
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
