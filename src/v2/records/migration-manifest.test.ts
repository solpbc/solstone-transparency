// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import type { TufJsonValue } from "../tuf/outcome";
import type {
	MigrationManifestPredicate,
	MigrationObject,
} from "./migration-manifest";
import {
	validateMigrationManifestPredicate,
	walkMigrationManifest,
} from "./migration-manifest";
import { verifyEvidenceRecord } from "./record";
import {
	generatedKey,
	loadedPolicy,
	migrationPredicate,
	sha256,
	signedMigrationRecord,
} from "./records.test-support";

function firstObject(predicate: MigrationManifestPredicate): MigrationObject {
	const object = predicate.objects[0];
	if (object === undefined)
		throw new Error("migration fixture must include one object");
	return object;
}

describe("migration-manifest predicate and walk", () => {
	test("AC 19: a signed migration record verifies and walks its original object", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const policy = await loadedPolicy(release, audit);
		const record = await signedMigrationRecord(policy, release);
		const object = firstObject(record.predicate);
		expect(
			await verifyEvidenceRecord({
				record: record.record,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", record.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "accepted" });
		const walked = await walkMigrationManifest(record.predicate, {
			async fetch(url) {
				if (url === record.predicate.verification_contract.v1_public_key)
					return { kind: "ok", bytes: new TextEncoder().encode("unused key") };
				return { kind: "ok", bytes: record.objectBytes };
			},
		});
		expect(walked).toEqual({
			verdict: { ok: true, value: undefined },
			objects: [{ url: object.url, state: "verified" }],
		});
	});

	test("AC 19: validates the real predicate body shape and rejects body inconsistencies", async () => {
		const fixture = await migrationPredicate();
		expect(
			await validateMigrationManifestPredicate(
				fixture.predicate as unknown as TufJsonValue,
			),
		).toMatchObject({
			ok: true,
			value: { schema: "solstone-transparency/migration-manifest/v1-to-v2" },
		});
		expect(
			await validateMigrationManifestPredicate({
				...fixture.predicate,
				object_count: 2,
			} as unknown as TufJsonValue),
		).toMatchObject({ ok: false, reason: "predicate-malformed" });
	});

	test("AC 20: a listed minisig sibling is verified after byte checks and can fail the record", async () => {
		const fixture = await migrationPredicate();
		const object = firstObject(fixture.predicate);
		const signatureBytes = new TextEncoder().encode(
			"not a valid minisign signature",
		);
		const sibling = {
			url: `${object.url}.minisig`,
			length: signatureBytes.byteLength,
			sha256: await sha256(signatureBytes),
		};
		const predicate: MigrationManifestPredicate = {
			...fixture.predicate,
			object_count: 2,
			objects: [object, sibling],
		};
		const responses = new Map<string, Uint8Array>([
			[
				predicate.verification_contract.v1_public_key,
				new TextEncoder().encode("untrusted public key"),
			],
			[object.url, fixture.objectBytes],
			[sibling.url, signatureBytes],
		]);
		const result = await walkMigrationManifest(predicate, {
			async fetch(url) {
				const bytes = responses.get(url);
				return bytes === undefined
					? { kind: "not-found" }
					: { kind: "ok", bytes };
			},
		});
		expect(result.verdict).toMatchObject({
			ok: false,
			reason: "signature-invalid",
		});
		expect(result.objects).toEqual([
			{
				url: object.url,
				state: "rejected",
				reason: "signature-invalid",
			},
		]);
	});

	test("AC 20 and 21: validates every URL before fetching and reports byte mismatch", async () => {
		const fixture = await migrationPredicate();
		const object = firstObject(fixture.predicate);
		const unsafe: MigrationManifestPredicate = {
			...fixture.predicate,
			objects: [
				{
					...object,
					url: "https://transparency.solstone.app/releases/example-product/v/../../../etc/passwd",
				},
			],
		};
		let fetches = 0;
		const unsafeResult = await walkMigrationManifest(unsafe, {
			async fetch() {
				fetches++;
				return { kind: "not-found" };
			},
		});
		expect(unsafeResult.verdict).toMatchObject({
			ok: false,
			reason: "unsafe-target-path",
		});
		expect(fetches).toBe(0);
		const mismatch = await walkMigrationManifest(fixture.predicate, {
			async fetch(url) {
				if (url === fixture.predicate.verification_contract.v1_public_key)
					return { kind: "ok", bytes: new TextEncoder().encode("unused key") };
				return {
					kind: "ok",
					bytes: new TextEncoder().encode("different bytes"),
				};
			},
		});
		expect(mismatch.verdict).toMatchObject({
			ok: false,
			reason: "migration-target-mismatch",
		});
	});
});
