// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { canonicalizeTufJson } from "./canonical";
import { generateEd25519SigningKey, signEd25519 } from "./ed25519";
import type { TufRejectionReason } from "./outcome";
import { DELEGATED_ROLES, TOP_LEVEL_ONLY_PREFIXES } from "./role-config";
import {
	MAX_DELEGATION_DEPTH,
	TOP_LEVEL_TARGETS_PREFIXES,
	UNCLAIMABLE_PREFIXES,
	authorizeTargetPath,
	checkMetadataType,
	evaluateRoleAuthorization,
	resolveDelegation,
	topLevelOnlyPrefixPartition,
	validateDelegatedRoleName,
	validateDelegationChain,
	validateDelegationConfiguration,
	validateRoleConfiguration,
	validateTargetPath,
	validateTargetPathPolicy,
	validateTopLevelOnlyPrefixPartition,
} from "./role-graph";

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function expectFailure(
	result: { ok: boolean; reason?: TufRejectionReason },
	reason: TufRejectionReason,
): void {
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.reason).toBe(reason);
}

function roleAt(index: number) {
	const role = DELEGATED_ROLES[index];
	if (role === undefined) throw new Error(`missing test role at ${index}`);
	return role;
}

describe("target path and prefix resolution", () => {
	test("the local three-way lists partition the landed top-level-only prefixes", () => {
		expect(topLevelOnlyPrefixPartition()).toEqual(
			[...TOP_LEVEL_ONLY_PREFIXES].sort(),
		);
		expect(validateTopLevelOnlyPrefixPartition()).toEqual({
			ok: true,
			value: undefined,
		});
		expect(
			[...TOP_LEVEL_TARGETS_PREFIXES, ...UNCLAIMABLE_PREFIXES].sort(),
		).toEqual([...TOP_LEVEL_ONLY_PREFIXES].sort());
	});

	test("checks raw unsafe syntax before matching a delegation", () => {
		for (const targetPath of [
			"",
			"/software/item",
			"software//item",
			"software/../item",
			"software\\item",
			"https://example.invalid/item",
			"software/%2Fitem",
			"software/%2e%2e/item",
		]) {
			expectFailure(validateTargetPath(targetPath), "unsafe-target-path");
		}
		expectFailure(validateTargetPathPolicy(undefined), "unsafe-target-path");
		expect(resolveDelegation("software/release-1")).toMatchObject({
			ok: true,
			value: { kind: "consulted", outcome: "accepted" },
		});
	});

	test("keeps top-level-only, forbidden, and unmatched paths distinct", () => {
		expect(authorizeTargetPath("targets", "policy/authorization.json").ok).toBe(
			true,
		);
		expectFailure(
			authorizeTargetPath("targets-software", "policy/authorization.json"),
			"role-not-authorized",
		);
		expectFailure(
			authorizeTargetPath("targets-software", "commitments/statement.json"),
			"role-not-authorized",
		);
		expectFailure(
			authorizeTargetPath("targets", "commitments/statement.json"),
			"role-not-authorized",
		);
		expectFailure(
			authorizeTargetPath("targets-services", "software/release.json"),
			"role-not-authorized",
		);
		expectFailure(
			authorizeTargetPath("targets", "unmatched/item.json"),
			"role-not-authorized",
		);
	});

	test("uses list order and terminating decisions when overlapping roles are configured", () => {
		const first = {
			...roleAt(0),
			name: "targets/first",
			pathPrefix: "overlap/",
			terminating: true,
		};
		const second = {
			...roleAt(1),
			name: "targets/second",
			pathPrefix: "overlap/",
			terminating: true,
		};
		const stopped = resolveDelegation(
			"overlap/target",
			[first, second],
			new Set([second.name]),
		);
		expect(stopped).toMatchObject({
			ok: true,
			value: {
				kind: "consulted",
				role: { name: first.name },
				outcome: "declined",
			},
		});
		const fallsThrough = resolveDelegation(
			"overlap/target",
			[{ ...first, terminating: false }, second],
			new Set([second.name]),
		);
		expect(fallsThrough).toMatchObject({
			ok: true,
			value: {
				kind: "consulted",
				role: { name: second.name },
				outcome: "accepted",
			},
		});
	});
});

describe("role authorization", () => {
	test("distinguishes configuration defects and depth failures", () => {
		const key = "a".repeat(64);
		const keys = {
			[key]: {
				keytype: "ed25519",
				scheme: "ed25519",
				keyval: { public: "00".repeat(32) },
			},
		};
		for (const role of [
			{ keyids: [key], threshold: 0 },
			{ keyids: [key], threshold: 2 },
			{ keyids: [], threshold: 1 },
			{ keyids: [key, key], threshold: 1 },
		]) {
			expectFailure(
				validateRoleConfiguration(role, keys),
				"degenerate-role-configuration",
			);
		}
		expectFailure(
			validateRoleConfiguration({ keyids: [key], threshold: 1 }, {}),
			"dangling-keyid",
		);
		const delegated = [
			{
				name: "targets/one",
				keyids: [key],
				threshold: 1,
				paths: ["one/*"],
				terminating: true,
			},
			{
				name: "targets/one",
				keyids: [key],
				threshold: 1,
				paths: ["two/*"],
				terminating: true,
			},
		];
		expectFailure(
			validateDelegationConfiguration(delegated, keys),
			"degenerate-role-configuration",
		);
		expectFailure(
			validateDelegatedRoleName("targets"),
			"degenerate-role-configuration",
		);
		for (const depth of [MAX_DELEGATION_DEPTH - 1, MAX_DELEGATION_DEPTH]) {
			expect(
				validateDelegationChain(
					Array.from({ length: depth + 1 }, (_, index) => `role-${index}`),
				),
			).toEqual({
				ok: true,
				value: undefined,
			});
		}
		expectFailure(
			validateDelegationChain(
				Array.from(
					{ length: MAX_DELEGATION_DEPTH + 2 },
					(_, index) => `role-${index}`,
				),
			),
			"delegation-too-deep",
		);
		expectFailure(
			validateDelegationChain(["targets", "targets-software", "targets"]),
			"delegation-too-deep",
		);
	});

	test("counts only distinct authorized valid signatures", async () => {
		const first = await generateEd25519SigningKey();
		const second = await generateEd25519SigningKey();
		if (!first.ok || !second.ok)
			throw new Error("synthetic key generation failed");
		const messageResult = canonicalizeTufJson({ signed: "role graph fixture" });
		if (!messageResult.ok) throw new Error("canonicalization failed");
		const firstSignature = await signEd25519(
			first.value.privateKey,
			messageResult.value,
		);
		const secondSignature = await signEd25519(
			second.value.privateKey,
			messageResult.value,
		);
		if (!firstSignature.ok || !secondSignature.ok)
			throw new Error("synthetic signing failed");
		const keys = {
			[first.value.keyId]: first.value.keyObject,
			[second.value.keyId]: second.value.keyObject,
		};
		expectFailure(
			await evaluateRoleAuthorization({
				role: { keyids: [first.value.keyId, second.value.keyId], threshold: 2 },
				keys,
				signatures: [
					{ keyid: first.value.keyId, sig: bytesToHex(firstSignature.value) },
					{ keyid: first.value.keyId, sig: bytesToHex(firstSignature.value) },
				],
				message: messageResult.value,
			}),
			"threshold-unmet",
		);
		expectFailure(
			await evaluateRoleAuthorization({
				role: { keyids: [first.value.keyId], threshold: 1 },
				keys,
				signatures: [
					{ keyid: second.value.keyId, sig: bytesToHex(secondSignature.value) },
				],
				message: messageResult.value,
			}),
			"key-not-in-role",
		);
		expect(
			await evaluateRoleAuthorization({
				role: { keyids: [first.value.keyId, second.value.keyId], threshold: 2 },
				keys,
				signatures: [
					{ keyid: first.value.keyId, sig: bytesToHex(firstSignature.value) },
					{ keyid: second.value.keyId, sig: bytesToHex(secondSignature.value) },
				],
				message: messageResult.value,
			}),
		).toEqual({ ok: true, value: undefined });
	});

	test("checks metadata identity before its signature branch", () => {
		expectFailure(
			checkMetadataType({ _type: "snapshot" }, "timestamp"),
			"metadata-type-mismatch",
		);
		expect(checkMetadataType({ _type: "timestamp" }, "timestamp")).toEqual({
			ok: true,
			value: { _type: "timestamp" },
		});
	});
});
