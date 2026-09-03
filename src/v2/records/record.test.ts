// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import type { TufJsonValue } from "../tuf/outcome";
import type { MigrationManifestPredicate } from "./migration-manifest";
import { MIGRATION_MANIFEST_PREDICATE_TYPE } from "./predicates";
import {
	EVIDENCE_RECORD_SCHEMA,
	type EvidenceRecord,
	verifyEvidenceRecord,
} from "./record";
import {
	basePolicy,
	generatedKey,
	loadedPolicy,
	migrationPredicate,
	signedEnvelope,
	signedMigrationRecord,
} from "./records.test-support";
import { IN_TOTO_STATEMENT_V1 } from "./statement";

function migrationFetcher(
	predicate: MigrationManifestPredicate,
	objectBytes: Uint8Array,
) {
	const object = predicate.objects[0];
	if (object === undefined)
		throw new Error("migration fixture must include one object");
	return {
		async fetch(url: string) {
			if (url === predicate.verification_contract.v1_public_key)
				return {
					kind: "ok" as const,
					bytes: new TextEncoder().encode("unused key"),
				};
			if (url === object.url)
				return { kind: "ok" as const, bytes: objectBytes };
			return { kind: "not-found" as const };
		},
	};
}

async function customRecord(
	policy: Awaited<ReturnType<typeof loadedPolicy>>,
	key: Awaited<ReturnType<typeof generatedKey>>,
	predicateType: string,
	predicate: TufJsonValue,
	issuedAt = "2027-05-01T00:00:00.000Z",
	role?: string,
): Promise<{ record: EvidenceRecord; subjectBytes: Uint8Array }> {
	const fixture = await migrationPredicate();
	return {
		record: {
			schema: EVIDENCE_RECORD_SCHEMA,
			policy_sha256: policy.sha256,
			issued_at: issuedAt,
			envelope: await signedEnvelope(
				{
					_type: IN_TOTO_STATEMENT_V1,
					subject: [
						{
							name: "software/legacy-corpus/v1",
							digest: { sha256: fixture.predicate.corpus_sha256 },
						},
					],
					predicateType,
					predicate,
					...(role === undefined ? {} : { role }),
				},
				[key],
			),
		},
		subjectBytes: fixture.subjectBytes,
	};
}

describe("evidence-record verification", () => {
	test("AC 5v, 6, and 9: exact bound policy accepts a valid record and ignores self-declared role", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const policy = await loadedPolicy(release, audit);
		const fixture = await signedMigrationRecord(policy, release);
		expect(
			await verifyEvidenceRecord({
				record: fixture.record,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", fixture.subjectBytes],
				]),
				migrationFetcher: migrationFetcher(
					fixture.predicate,
					fixture.objectBytes,
				),
			}),
		).toMatchObject({ state: "accepted" });
		const declared = await customRecord(
			policy,
			release,
			MIGRATION_MANIFEST_PREDICATE_TYPE,
			fixture.predicate as unknown as TufJsonValue,
			undefined,
			"verifier.audit",
		);
		expect(
			await verifyEvidenceRecord({
				record: declared.record,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", declared.subjectBytes],
				]),
				migrationFetcher: migrationFetcher(
					fixture.predicate,
					fixture.objectBytes,
				),
			}),
		).toMatchObject({ state: "accepted" });
		expect(
			await verifyEvidenceRecord({
				record: fixture.record,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", fixture.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "unavailable" });
		const mismatched = await verifyEvidenceRecord({
			record: fixture.record,
			policy: { ...policy, sha256: "0".repeat(64) },
			subjectBytes: new Map([
				["software/legacy-corpus/v1", fixture.subjectBytes],
			]),
		});
		expect(mismatched).toMatchObject({
			state: "rejected",
			reason: "hash-mismatch",
		});
	});

	test("AC 3, 5c, 5s, 6z, 7, and 8: key, role, and threshold failures remain distinct", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const unknown = await generatedKey();
		const secondRelease = await generatedKey();
		const policy = await loadedPolicy(release, audit);
		const fixture = await signedMigrationRecord(policy, unknown);
		expect(
			await verifyEvidenceRecord({
				record: fixture.record,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", fixture.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "unknown-key" });
		const auditRecord = await signedMigrationRecord(policy, audit);
		expect(
			await verifyEvidenceRecord({
				record: auditRecord.record,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", auditRecord.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "role-not-authorized" });
		const empty = basePolicy(release, audit);
		empty.roles = empty.roles.map((role, index) =>
			index === 0 ? { ...role, keyids: [] } : role,
		);
		const emptyPolicy = await loadedPolicy(release, audit, empty);
		const emptyRecord = await signedMigrationRecord(emptyPolicy, release);
		emptyRecord.record = {
			...emptyRecord.record,
			envelope: { ...emptyRecord.record.envelope, signatures: [] },
		};
		expect(
			await verifyEvidenceRecord({
				record: emptyRecord.record,
				policy: emptyPolicy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", emptyRecord.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "threshold-unmet" });
		const twoKey = basePolicy(release, audit);
		twoKey.roles = twoKey.roles.map((role, index) =>
			index === 0
				? { ...role, keyids: [release.keyId, audit.keyId], threshold: 2 }
				: index === 3
					? { ...role, keyids: [] }
					: role,
		);
		const twoKeyPolicy = await loadedPolicy(release, audit, twoKey);
		const twoKeyFixture = await migrationPredicate();
		const twoKeyStatement: TufJsonValue = {
			_type: IN_TOTO_STATEMENT_V1,
			subject: [
				{
					name: "software/legacy-corpus/v1",
					digest: { sha256: twoKeyFixture.predicate.corpus_sha256 },
				},
			],
			predicateType: MIGRATION_MANIFEST_PREDICATE_TYPE,
			predicate: twoKeyFixture.predicate as unknown as TufJsonValue,
		};
		const duplicateRecord: EvidenceRecord = {
			schema: EVIDENCE_RECORD_SCHEMA,
			policy_sha256: twoKeyPolicy.sha256,
			issued_at: "2027-05-01T00:00:00.000Z",
			envelope: await signedEnvelope(twoKeyStatement, [release, release]),
		};
		expect(
			await verifyEvidenceRecord({
				record: duplicateRecord,
				policy: twoKeyPolicy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", twoKeyFixture.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "threshold-unmet" });
		const distinctRecord: EvidenceRecord = {
			...duplicateRecord,
			envelope: await signedEnvelope(twoKeyStatement, [release, audit]),
		};
		expect(
			await verifyEvidenceRecord({
				record: distinctRecord,
				policy: twoKeyPolicy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", twoKeyFixture.subjectBytes],
				]),
				migrationFetcher: migrationFetcher(
					twoKeyFixture.predicate,
					twoKeyFixture.objectBytes,
				),
			}),
		).toMatchObject({ state: "accepted" });
		const thresholdWithUnauthorized = basePolicy(release, audit);
		thresholdWithUnauthorized.roles = thresholdWithUnauthorized.roles.map(
			(role, index) =>
				index === 0
					? {
							...role,
							keyids: [release.keyId, secondRelease.keyId],
							threshold: 2,
						}
					: role,
		);
		const thresholdWithUnauthorizedPolicy = await loadedPolicy(
			release,
			audit,
			thresholdWithUnauthorized,
			{ [secondRelease.keyId]: secondRelease.keyObject },
		);
		const oneAuthorizedAndOneUnauthorized: EvidenceRecord = {
			...duplicateRecord,
			policy_sha256: thresholdWithUnauthorizedPolicy.sha256,
			envelope: await signedEnvelope(twoKeyStatement, [release, audit]),
		};
		const insufficient = await verifyEvidenceRecord({
			record: oneAuthorizedAndOneUnauthorized,
			policy: thresholdWithUnauthorizedPolicy,
			subjectBytes: new Map([
				["software/legacy-corpus/v1", twoKeyFixture.subjectBytes],
			]),
		});
		expect(insufficient).toMatchObject({
			state: "rejected",
			reason: "threshold-unmet",
			detail: {
				observed: [
					{
						role: "producer.release",
						satisfyingKeyids: [release.keyId],
					},
				],
			},
		});
		const wrongCollection = basePolicy(release, audit);
		wrongCollection.roles = wrongCollection.roles.map((role, index) =>
			index === 0 ? { ...role, subject_patterns: ["software/other/**"] } : role,
		);
		const wrongCollectionPolicy = await loadedPolicy(
			release,
			audit,
			wrongCollection,
		);
		const wrongCollectionRecord = await signedMigrationRecord(
			wrongCollectionPolicy,
			release,
		);
		expect(
			await verifyEvidenceRecord({
				record: wrongCollectionRecord.record,
				policy: wrongCollectionPolicy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", wrongCollectionRecord.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "role-not-authorized" });
	});

	test("AC 5w, 5x, 10, and 11: time states and missing policy fail closed", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const expiredWindow = await loadedPolicy(release, audit);
		const late = await signedMigrationRecord(
			expiredWindow,
			release,
			undefined,
			"2031-01-01T00:00:00.000Z",
		);
		expect(
			await verifyEvidenceRecord({
				record: late.record,
				policy: expiredWindow,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", late.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "outside-issuance-window" });
		const compromised = basePolicy(release, audit);
		compromised.roles = compromised.roles.map((role, index) =>
			index === 0 ? { ...role, compromised: true } : role,
		);
		const compromisedPolicy = await loadedPolicy(release, audit, compromised);
		const suspect = await signedMigrationRecord(compromisedPolicy, release);
		expect(
			await verifyEvidenceRecord({
				record: suspect.record,
				policy: compromisedPolicy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", suspect.subjectBytes],
				]),
				migrationFetcher: migrationFetcher(
					suspect.predicate,
					suspect.objectBytes,
				),
			}),
		).toMatchObject({ state: "suspect", requiresReattestation: true });
		const revoked = basePolicy(release, audit);
		revoked.roles = revoked.roles.map((role, index) =>
			index === 0 ? { ...role, revoked_at: "2027-05-15T00:00:00.000Z" } : role,
		);
		const revokedPolicy = await loadedPolicy(release, audit, revoked);
		const beforeRevocation = await signedMigrationRecord(
			revokedPolicy,
			release,
			undefined,
			"2027-05-01T00:00:00.000Z",
		);
		expect(
			await verifyEvidenceRecord({
				record: beforeRevocation.record,
				policy: revokedPolicy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", beforeRevocation.subjectBytes],
				]),
				migrationFetcher: migrationFetcher(
					beforeRevocation.predicate,
					beforeRevocation.objectBytes,
				),
			}),
		).toMatchObject({ state: "accepted" });
		const afterRevocation = await signedMigrationRecord(
			revokedPolicy,
			release,
			undefined,
			"2027-06-01T00:00:00.000Z",
		);
		expect(
			await verifyEvidenceRecord({
				record: afterRevocation.record,
				policy: revokedPolicy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", afterRevocation.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "role-not-authorized" });
		expect(
			await verifyEvidenceRecord({
				record: suspect.record,
				subjectBytes: new Map(),
			}),
		).toMatchObject({ state: "rejected", reason: "unavailable" });
	});

	test("AC 12 and 13: crypto failure wins over unrecognized predicate", async () => {
		const release = await generatedKey();
		const audit = await generatedKey();
		const policy = await loadedPolicy(release, audit);
		const unknown = await customRecord(
			policy,
			release,
			"https://transparency.solstone.app/predicates/v1/future",
			{},
		);
		expect(
			await verifyEvidenceRecord({
				record: unknown.record,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", unknown.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "unrecognized-predicate" });
		const signature = unknown.record.envelope.signatures[0];
		if (signature === undefined)
			throw new Error("fixture must have one signature");
		const altered: EvidenceRecord = {
			...unknown.record,
			envelope: {
				...unknown.record.envelope,
				signatures: [
					{
						...signature,
						sig: `${signature.sig[0] === "A" ? "B" : "A"}${signature.sig.slice(1)}`,
					},
				],
			},
		};
		expect(
			await verifyEvidenceRecord({
				record: altered,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", unknown.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "signature-invalid" });
		const malformed = await customRecord(
			policy,
			release,
			MIGRATION_MANIFEST_PREDICATE_TYPE,
			{ bad: true },
		);
		expect(
			await verifyEvidenceRecord({
				record: malformed.record,
				policy,
				subjectBytes: new Map([
					["software/legacy-corpus/v1", malformed.subjectBytes],
				]),
			}),
		).toMatchObject({ state: "rejected", reason: "predicate-malformed" });
	});
});
