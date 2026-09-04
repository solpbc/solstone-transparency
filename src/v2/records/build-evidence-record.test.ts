// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { authorizeTargetPath } from "../tuf/role-graph";
import { signEvidenceRecord } from "./build-evidence-record";
import { descriptorDigest } from "./migration-manifest";
import { RELEASE_RECORD_PREDICATE_TYPE } from "./predicates";
import { verifyEvidenceRecord } from "./record";
import { generatedKey, loadedPolicy } from "./records.test-support";
import {
	RELEASE_RECORD_SCHEMA,
	type ReleaseRecordPredicate,
} from "./release-record";

describe("build-evidence-record and DSSE verification", () => {
	test("AC 5: signs release-record and verifies end-to-end under policy", async () => {
		const releaseSigner = await generatedKey();
		const auditSigner = await generatedKey();
		const policy = await loadedPolicy(releaseSigner, auditSigner);

		const predicate: ReleaseRecordPredicate = {
			_comment: ["AC 5 test"],
			schema: RELEASE_RECORD_SCHEMA,
			product: "journal",
			version: "1.0.23",
			artifacts: [
				{
					url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.23/journal-1.0.23.tar.gz",
					length: 2048,
					sha256:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				},
			],
			does_prove: ["built and recorded by sol pbc"],
			does_not_prove: ["defect-free"],
		};

		const subjectName = `software/${predicate.product}/${predicate.version}`;
		const subjectSha256 = await descriptorDigest(predicate.artifacts);

		// Subject bytes preimage for verifyEvidenceRecord:
		const text = predicate.artifacts
			.map((a) => `${a.url}\n${a.length}\n${a.sha256}\n`)
			.join("");
		const subjectBytes = new TextEncoder().encode(text);

		const signed = await signEvidenceRecord({
			predicateType: RELEASE_RECORD_PREDICATE_TYPE,
			predicate: predicate as never,
			subjectName,
			subjectSha256,
			policySha256: policy.sha256,
			issuedAt: new Date().toISOString(),
			signingKeys: [releaseSigner],
		});

		expect(signed.ok).toBe(true);
		if (!signed.ok) return;

		const verification = await verifyEvidenceRecord({
			record: signed.value,
			policy,
			subjectBytes: new Map([[subjectName, subjectBytes]]),
		});

		expect(verification).toMatchObject({ state: "accepted" });
	});

	test("AC 6: rejects evidence record signed by unknown key not declared in policy", async () => {
		const releaseSigner = await generatedKey();
		const auditSigner = await generatedKey();
		const rogueSigner = await generatedKey();
		const policy = await loadedPolicy(releaseSigner, auditSigner);

		const predicate: ReleaseRecordPredicate = {
			_comment: ["AC 6 rogue signer test"],
			schema: RELEASE_RECORD_SCHEMA,
			product: "journal",
			version: "1.0.23",
			artifacts: [
				{
					url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.23/journal-1.0.23.tar.gz",
					length: 2048,
					sha256:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				},
			],
			does_prove: ["provenance claim"],
			does_not_prove: ["non-claim"],
		};

		const subjectName = `software/${predicate.product}/${predicate.version}`;
		const subjectSha256 = await descriptorDigest(predicate.artifacts);

		const signed = await signEvidenceRecord({
			predicateType: RELEASE_RECORD_PREDICATE_TYPE,
			predicate: predicate as never,
			subjectName,
			subjectSha256,
			policySha256: policy.sha256,
			issuedAt: new Date().toISOString(),
			signingKeys: [rogueSigner],
		});

		expect(signed.ok).toBe(true);
		if (!signed.ok) return;

		const firstArtifact = predicate.artifacts[0];
		if (!firstArtifact) throw new Error("expected artifact");

		const verification = await verifyEvidenceRecord({
			record: signed.value,
			policy,
			subjectBytes: new Map([
				[
					subjectName,
					new TextEncoder().encode(
						`${firstArtifact.url}\n2048\n${firstArtifact.sha256}\n`,
					),
				],
			]),
		});

		expect(verification).toMatchObject({
			state: "rejected",
			reason: "unknown-key",
		});
	});

	test("AC 9: authorizes target paths into correct delegated roles", () => {
		const releaseTargetPath = "software/journal/1.0.23/release-record.json";
		const migrationTargetPath = "legacy/journal/migration-manifest.json";

		const releaseAuth = authorizeTargetPath(
			"targets-software",
			releaseTargetPath,
		);
		expect(releaseAuth).toMatchObject({
			ok: true,
			value: {
				kind: "consulted",
				outcome: "accepted",
				role: { name: "targets-software" },
			},
		});

		const migrationAuth = authorizeTargetPath(
			"targets-legacy",
			migrationTargetPath,
		);
		expect(migrationAuth).toMatchObject({
			ok: true,
			value: {
				kind: "consulted",
				outcome: "accepted",
				role: { name: "targets-legacy" },
			},
		});
	});
});
