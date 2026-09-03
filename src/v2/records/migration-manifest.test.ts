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

function manifestFetcher(responses: ReadonlyMap<string, Uint8Array>) {
	return {
		async fetch(url: string) {
			const bytes = responses.get(url);
			return bytes === undefined
				? { kind: "not-found" as const }
				: { kind: "ok" as const, bytes };
		},
	};
}

function descriptorBytes(objects: readonly MigrationObject[]): Uint8Array {
	const text = objects
		.slice()
		.sort((left, right) => left.url.localeCompare(right.url))
		.map((object) => `${object.url}\n${object.length}\n${object.sha256}\n`)
		.join("");
	return new TextEncoder().encode(text);
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
				migrationFetcher: manifestFetcher(
					new Map([
						[
							record.predicate.verification_contract.v1_public_key,
							new TextEncoder().encode("unused key"),
						],
						[object.url, record.objectBytes],
					]),
				),
			}),
		).toMatchObject({ state: "accepted" });
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

	test("AC 20: the full record pipeline rejects bytes that mismatch a manifest object", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const policy = await loadedPolicy(release, audit);
		const record = await signedMigrationRecord(policy, release);
		const object = firstObject(record.predicate);
		const result = await verifyEvidenceRecord({
			record: record.record,
			policy,
			subjectBytes: new Map([
				["software/legacy-corpus/v1", record.subjectBytes],
			]),
			migrationFetcher: manifestFetcher(
				new Map([
					[
						record.predicate.verification_contract.v1_public_key,
						new TextEncoder().encode("unused key"),
					],
					[object.url, new TextEncoder().encode("different bytes")],
				]),
			),
		});
		expect(result).toMatchObject({
			state: "rejected",
			reason: "migration-target-mismatch",
		});
	});

	test("AC 20: the full record pipeline rejects a bad minisig after matching byte checks", async () => {
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
		const objects = [object, sibling];
		const corpusBytes = descriptorBytes(objects);
		const corpusSha256 = await sha256(corpusBytes);
		const predicate: MigrationManifestPredicate = {
			...fixture.predicate,
			corpus_sha256: corpusSha256,
			object_count: 2,
			products: fixture.predicate.products.map((product) => ({
				...product,
				object_count: 2,
				corpus_sha256: corpusSha256,
			})),
			objects,
		};
		const release = await generatedKey();
		const audit = await generatedKey();
		const policy = await loadedPolicy(release, audit);
		const record = await signedMigrationRecord(policy, release, predicate);
		const responses = new Map<string, Uint8Array>([
			[
				predicate.verification_contract.v1_public_key,
				new TextEncoder().encode("untrusted public key"),
			],
			[object.url, fixture.objectBytes],
			[sibling.url, signatureBytes],
		]);
		const result = await verifyEvidenceRecord({
			record: record.record,
			policy,
			subjectBytes: new Map([["software/legacy-corpus/v1", corpusBytes]]),
			migrationFetcher: manifestFetcher(responses),
		});
		expect(result).toMatchObject({
			state: "rejected",
			reason: "signature-invalid",
		});
	});

	test("AC 21: validates every URL before fetching", async () => {
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
	});

	test("validates a cached public-key object against its descriptor", async () => {
		const fixture = await migrationPredicate();
		const object = firstObject(fixture.predicate);
		const predicate: MigrationManifestPredicate = {
			...fixture.predicate,
			verification_contract: {
				...fixture.predicate.verification_contract,
				v1_public_key: object.url,
			},
		};
		const result = await walkMigrationManifest(
			predicate,
			manifestFetcher(
				new Map([[object.url, new TextEncoder().encode("different bytes")]]),
			),
		);
		expect(result.verdict).toMatchObject({
			ok: false,
			reason: "migration-target-mismatch",
		});
	});
});
