// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { generateEd25519SigningKey } from "../tuf/ed25519";
import { loadDsseAuthorizationPolicy } from "./authorization-policy";
import { buildDsseAuthorizationPolicyTargets } from "./dsse-policy-builder";
import {
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	NATIVE_PLATFORM_RECEIPT_PREDICATE_TYPE,
	RELEASE_RECORD_PREDICATE_TYPE,
	SLSA_BUILD_PROVENANCE_V1_PREDICATE_TYPE,
	SPDX_SBOM_PREDICATE_TYPE,
} from "./predicates";

const now = new Date("2030-01-02T03:04:05.000Z");

async function generatedKey() {
	const key = await generateEd25519SigningKey();
	if (!key.ok)
		throw new Error(`synthetic key generation failed: ${key.reason}`);
	return key.value;
}

test("builds a self-validating fixed DSSE policy and public-key targets", async () => {
	const producer = await generatedKey();
	const built = await buildDsseAuthorizationPolicyTargets({
		version: 4,
		effectiveFrom: "2030-01-01T00:00:00.000Z",
		now,
		producerReleaseKeys: [{ keyObject: producer.keyObject }],
		tufRoleKeyids: [],
	});
	expect(built.ok).toBe(true);
	if (!built.ok) return;
	expect(built.value.policyLogicalPath).toBe(
		"policy/dsse-authorization/4.json",
	);
	expect(built.value.keysLogicalPath).toBe("keys/dsse/4.json");
	const loaded = await loadDsseAuthorizationPolicy({
		bytes: built.value.policyBytes,
		now,
		evidenceKeys: { [producer.keyId]: producer.keyObject },
		tufRoleKeyids: new Set(),
	});
	expect(loaded).toMatchObject({
		ok: true,
		value: { sha256: built.value.policySha256 },
	});
	const release = built.value.policy.roles.find(
		(role) => role.id === "producer.release",
	);
	expect(release?.predicate_types).toEqual([
		RELEASE_RECORD_PREDICATE_TYPE,
		SLSA_BUILD_PROVENANCE_V1_PREDICATE_TYPE,
		SPDX_SBOM_PREDICATE_TYPE,
		NATIVE_PLATFORM_RECEIPT_PREDICATE_TYPE,
		MIGRATION_MANIFEST_PREDICATE_TYPE,
	]);
	expect(release?.keyids).toEqual([producer.keyId]);
	for (const roleId of [
		"producer.image",
		"verifier.repro",
		"verifier.audit",
		"appraiser.runtime",
		"key-events",
	]) {
		expect(
			built.value.policy.roles.find((role) => role.id === roleId)?.keyids,
		).toEqual([]);
	}
});

test("rejects DSSE and TUF key-ID overlap", async () => {
	const producer = await generatedKey();
	const built = await buildDsseAuthorizationPolicyTargets({
		version: 1,
		effectiveFrom: "2030-01-01T00:00:00.000Z",
		now,
		producerReleaseKeys: [{ keyObject: producer.keyObject }],
		tufRoleKeyids: [producer.keyId],
	});
	expect(built).toMatchObject({
		ok: false,
		reason: "degenerate-role-configuration",
	});
});

test("rejects malformed policy versions", async () => {
	const producer = await generatedKey();
	const built = await buildDsseAuthorizationPolicyTargets({
		version: 0,
		effectiveFrom: "2030-01-01T00:00:00.000Z",
		now,
		producerReleaseKeys: [{ keyObject: producer.keyObject }],
		tufRoleKeyids: [],
	});
	expect(built).toMatchObject({ ok: false, reason: "malformed" });
});

test("rejects an empty producer.release key set", async () => {
	const built = await buildDsseAuthorizationPolicyTargets({
		version: 1,
		effectiveFrom: "2030-01-01T00:00:00.000Z",
		now,
		producerReleaseKeys: [],
		tufRoleKeyids: [],
	});
	expect(built).toMatchObject({
		ok: false,
		reason: "degenerate-role-configuration",
	});
});
