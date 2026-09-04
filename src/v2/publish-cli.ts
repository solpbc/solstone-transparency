// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * v2 TUF repository publisher orchestration.
 * Assembles, signs, and writes TUF metadata and target EvidenceRecords for a product release.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CATALOG } from "../legacy/inventory";
import { signEvidenceRecord } from "./records/build-evidence-record";
import { descriptorDigest } from "./records/migration-manifest";
import {
	type LegacyCatalogProduct,
	buildMigrationManifestPredicate,
} from "./records/migration-manifest-constructor";
import {
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	RELEASE_RECORD_PREDICATE_TYPE,
} from "./records/predicates";
import { validateReleaseRecordPredicate } from "./records/release-record";
import { type TufTargetDescription, buildRepository } from "./tuf/builder";
import { canonicalizeTufJson } from "./tuf/canonical";
import { loadRepositorySigningKeys } from "./tuf/keyset";
import type { TufJsonValue } from "./tuf/outcome";
import { serializeRepository } from "./tuf/serializer";

export interface PublishOptions {
	artifactsPath: string;
	product: string;
	keysPath: string;
	policySha256: string;
	outDir: string;
	now?: Date;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * Builds and publishes a v2 TUF repository with signed metadata and EvidenceRecord targets.
 * Fails closed without writing on any input, key, or validation error.
 */
export async function publishRepository(
	options: PublishOptions,
): Promise<number> {
	// 1. Read and validate artifacts input file
	let artifactsJson: unknown;
	try {
		const raw = await readFile(options.artifactsPath, "utf-8");
		artifactsJson = JSON.parse(raw);
	} catch (error) {
		console.error(
			`could not read or parse artifacts file: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}

	const validatedRelease = await validateReleaseRecordPredicate(
		artifactsJson as TufJsonValue,
	);
	if (!validatedRelease.ok) {
		console.error(
			`invalid release record artifacts: ${validatedRelease.reason} (path: ${validatedRelease.detail?.path?.join(".") ?? "root"})`,
		);
		return 1;
	}
	const releasePredicate = validatedRelease.value;

	// 2. Validate product matches a known legacy catalog product
	const catalogProducts = Object.keys(CATALOG);
	if (!catalogProducts.includes(options.product)) {
		console.error(
			`unknown product '${options.product}'; expected one of: ${catalogProducts.join(", ")}`,
		);
		return 1;
	}

	// 3. Validate policy SHA-256
	// Note: this policySha256 is a placeholder pending the next lode's real authorization-policy publication.
	if (!/^[0-9a-f]{64}$/.test(options.policySha256)) {
		console.error(
			"policy-sha256 must be a 64-character lowercase hexadecimal SHA-256 digest",
		);
		return 1;
	}

	// 4. Read and validate keyset input file
	let keysJson: unknown;
	try {
		const raw = await readFile(options.keysPath, "utf-8");
		keysJson = JSON.parse(raw);
	} catch (error) {
		console.error(
			`could not read or parse keys file: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}

	const loadedKeys = await loadRepositorySigningKeys(keysJson);
	if (!loadedKeys.ok) {
		console.error(
			`invalid signing key set: ${loadedKeys.reason} (path: ${loadedKeys.detail?.path?.join(".") ?? "root"})`,
		);
		return 1;
	}
	const keySet = loadedKeys.value;

	// 5. Build migration manifest predicate
	const migrationPredicate = await buildMigrationManifestPredicate(
		options.product as LegacyCatalogProduct,
	);

	const issuedAt = (options.now ?? new Date()).toISOString();

	// 6. Sign release-record EvidenceRecord
	const releaseArtifactDigest = await descriptorDigest(
		releasePredicate.artifacts,
	);
	const signedReleaseRecord = await signEvidenceRecord({
		predicateType: RELEASE_RECORD_PREDICATE_TYPE,
		predicate: releasePredicate as unknown as TufJsonValue,
		subjectName: `software/${releasePredicate.product}/${releasePredicate.version}`,
		subjectSha256: releaseArtifactDigest,
		policySha256: options.policySha256,
		issuedAt,
		signingKeys: [keySet.dsseSigner],
	});
	if (!signedReleaseRecord.ok) {
		console.error(
			`could not sign release record: ${signedReleaseRecord.reason}`,
		);
		return 1;
	}

	// 7. Sign migration-manifest EvidenceRecord
	const signedMigrationRecord = await signEvidenceRecord({
		predicateType: MIGRATION_MANIFEST_PREDICATE_TYPE,
		predicate: migrationPredicate as unknown as TufJsonValue,
		subjectName: "software/legacy-corpus/v1",
		subjectSha256: migrationPredicate.corpus_sha256,
		policySha256: options.policySha256,
		issuedAt,
		signingKeys: [keySet.dsseSigner],
	});
	if (!signedMigrationRecord.ok) {
		console.error(
			`could not sign migration record: ${signedMigrationRecord.reason}`,
		);
		return 1;
	}

	// 8. Canonicalize and prepare target descriptions
	const releaseTargetPath = `software/${releasePredicate.product}/${releasePredicate.version}/release-record.json`;
	const migrationTargetPath = `legacy/${options.product}/migration-manifest.json`;

	const releaseCanonical = canonicalizeTufJson(signedReleaseRecord.value);
	if (!releaseCanonical.ok) {
		console.error(
			`could not canonicalize release record: ${releaseCanonical.reason}`,
		);
		return 1;
	}
	const releaseRecordBytes = releaseCanonical.value;

	const migrationCanonical = canonicalizeTufJson(signedMigrationRecord.value);
	if (!migrationCanonical.ok) {
		console.error(
			`could not canonicalize migration record: ${migrationCanonical.reason}`,
		);
		return 1;
	}
	const migrationRecordBytes = migrationCanonical.value;

	const releaseDigest = bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(releaseRecordBytes)),
		),
	);
	const migrationDigest = bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest(
				"SHA-256",
				new Uint8Array(migrationRecordBytes),
			),
		),
	);

	const targets: Record<string, TufTargetDescription> = {
		[releaseTargetPath]: {
			length: releaseRecordBytes.byteLength,
			hashes: { sha256: releaseDigest },
		},
		[migrationTargetPath]: {
			length: migrationRecordBytes.byteLength,
			hashes: { sha256: migrationDigest },
		},
	};

	// 9. Build TUF repository (hardcoding consistentSnapshot: true)
	const built = await buildRepository({
		signingKeys: keySet.signingKeys,
		targets,
		consistentSnapshot: true,
		now: options.now ?? new Date(),
	});
	if (!built.ok) {
		console.error(
			`could not build TUF repository: ${built.reason} (path: ${built.detail?.path?.join(".") ?? "root"})`,
		);
		return 1;
	}

	// 10. Write metadata to disk
	const metadataDir = join(options.outDir, "metadata");
	const serialized = await serializeRepository(built.value, metadataDir);
	if (!serialized.ok) {
		console.error(`could not serialize TUF metadata: ${serialized.reason}`);
		return 1;
	}

	// 11. Write targets to disk
	try {
		const targetsDir = join(options.outDir, "targets");
		const releaseFullPath = join(targetsDir, releaseTargetPath);
		const migrationFullPath = join(targetsDir, migrationTargetPath);

		await mkdir(dirname(releaseFullPath), { recursive: true });
		await writeFile(releaseFullPath, releaseRecordBytes);

		await mkdir(dirname(migrationFullPath), { recursive: true });
		await writeFile(migrationFullPath, migrationRecordBytes);
	} catch (error) {
		console.error(
			`could not write target files: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}

	console.log(`published v2 repository to ${options.outDir}`);
	console.log(`  metadata files: ${serialized.value.filenames.length}`);
	console.log(`  targets written: ${Object.keys(targets).length}`);
	return 0;
}
