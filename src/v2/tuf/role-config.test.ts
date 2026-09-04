// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import {
	DELEGATED_ROLES,
	TOP_LEVEL_ONLY_PREFIXES,
	TOP_LEVEL_ROLES,
	VALIDITY_ORDER,
} from "./role-config";

/**
 * The security office's table, transcribed a SECOND time and independently.
 *
 * Source: cso/architecture/transparency-v2-tuf-role-key-and-custody-design.md
 * sections 1 and 2. This is deliberately a duplicate literal rather than a derived
 * value: comparing the module to itself would prove nothing, and the failure this
 * guards is a transcription slip, which only a second reading catches.
 */
const CSO_TOP_LEVEL: Record<
	string,
	[
		threshold: number,
		keys: number,
		validity: number,
		renewal: number,
		alert: number,
	]
> = {
	root: [2, 3, 1095, 365, 730],
	targets: [1, 1, 365, 120, 240],
	snapshot: [1, 1, 90, 30, 60],
	timestamp: [1, 1, 7, 1, 2],
};

const CSO_DELEGATED: [
	name: string,
	prefix: string,
	validity: number,
	renewal: number,
	alert: number,
][] = [
	["targets-software", "software/", 180, 60, 120],
	["targets-services", "services/", 180, 60, 120],
	["targets-verification", "verification/", 180, 60, 120],
	["targets-legacy", "legacy/", 270, 90, 180],
];

test("top-level roles match the security office's table exactly", () => {
	expect(Object.keys(TOP_LEVEL_ROLES).sort()).toEqual(
		Object.keys(CSO_TOP_LEVEL).sort(),
	);
	for (const [
		name,
		[threshold, keys, validity, renewal, alert],
	] of Object.entries(CSO_TOP_LEVEL)) {
		const role = TOP_LEVEL_ROLES[name as keyof typeof TOP_LEVEL_ROLES];
		const actual: number[] = [
			role.threshold,
			role.keyCount,
			role.validityDays,
			role.renewalDays,
			role.alertAtRemainingDays,
		];
		expect(actual).toEqual([threshold, keys, validity, renewal, alert]);
	}
	// Root is the only quorum role, and it is the one whose loss nothing else can
	// recover from. If this ever reads 1-of-1, the custody design has been undone.
	const rootThreshold: number = TOP_LEVEL_ROLES.root.threshold;
	const rootKeys: number = TOP_LEVEL_ROLES.root.keyCount;
	expect(rootThreshold).toBe(2);
	expect(rootKeys).toBe(3);
});

test("delegated roles match the table, in delegation list order", () => {
	expect(DELEGATED_ROLES.map((r) => r.name)).toEqual(
		CSO_DELEGATED.map(([name]) => name),
	);
	for (const [
		index,
		[name, prefix, validity, renewal, alert],
	] of CSO_DELEGATED.entries()) {
		const role = DELEGATED_ROLES[index];
		expect(role).toBeDefined();
		if (role === undefined) continue;
		expect([
			role.name,
			role.pathPrefix,
			role.validityDays,
			role.renewalDays,
			role.alertAtRemainingDays,
		]).toEqual([name, prefix, validity, renewal, alert]);
		// A role that declines must fail rather than fall through to the next match.
		expect(role.terminating).toBe(true);
	}
});

test("policy/, keys/ and commitments/ are carried by NO delegated role", () => {
	expect([...TOP_LEVEL_ONLY_PREFIXES].sort()).toEqual([
		"commitments/",
		"keys/",
		"policy/",
	]);
	// The privilege-escalation case: a delegated role able to sign policy/ could
	// grant itself audit authority. Assert no delegation prefix reaches any of them.
	for (const reserved of TOP_LEVEL_ONLY_PREFIXES) {
		for (const role of DELEGATED_ROLES) {
			expect(reserved.startsWith(role.pathPrefix)).toBe(false);
			expect(role.pathPrefix.startsWith(reserved)).toBe(false);
		}
	}
});

test("renewal cadence never exceeds a third of the validity window", () => {
	const all = [
		...Object.entries(TOP_LEVEL_ROLES).map(([name, r]) => [name, r] as const),
		...DELEGATED_ROLES.map((r) => [r.name, r] as const),
	];
	for (const [name, role] of all) {
		expect({ name, ok: role.renewalDays <= role.validityDays / 3 }).toEqual({
			name,
			ok: true,
		});
		// Architecture 5.8: alert no later than 2 * C_r remaining.
		expect({ name, alert: role.alertAtRemainingDays }).toEqual({
			name,
			alert: role.renewalDays * 2,
		});
	}
});

test("validity strictly increases across the role ordering", () => {
	const windowFor = (name: string): number => {
		if (name in TOP_LEVEL_ROLES) {
			return TOP_LEVEL_ROLES[name as keyof typeof TOP_LEVEL_ROLES].validityDays;
		}
		const delegated = DELEGATED_ROLES.find((r) => r.name === name);
		if (delegated === undefined) throw new Error(`unknown role ${name}`);
		return delegated.validityDays;
	};
	const windows = VALIDITY_ORDER.map(windowFor);
	// Strictly increasing is the invariant that makes a repository-level role take
	// everything down while a dormant collection fails alone.
	for (let i = 1; i < windows.length; i++) {
		const previous = windows[i - 1];
		const current = windows[i];
		expect({
			pair: `${VALIDITY_ORDER[i - 1]} < ${VALIDITY_ORDER[i]}`,
			ok: previous !== undefined && current !== undefined && previous < current,
		}).toEqual({
			pair: `${VALIDITY_ORDER[i - 1]} < ${VALIDITY_ORDER[i]}`,
			ok: true,
		});
	}
	// timestamp is the shortest and the only routinely online role.
	const shortest: number = TOP_LEVEL_ROLES.timestamp.validityDays;
	expect(Math.min(...windows)).toBe(shortest);
});

test("every role carries a distinct key label", () => {
	const labels = [
		...Object.values(TOP_LEVEL_ROLES).map((r) => r.keyLabel),
		...DELEGATED_ROLES.map((r) => r.keyLabel),
	];
	expect(new Set(labels).size).toBe(labels.length);
});
