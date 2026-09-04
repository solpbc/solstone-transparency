// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Migration manifest constructor.
 * Reconstructs a compliant v1-to-v2 migration-manifest predicate from the frozen legacy inventory and catalog.
 */

import { KEY_FILENAME } from "../../legacy/adapter";
import { CATALOG, INVENTORY, JOURNAL_GAP } from "../../legacy/inventory";
import { EVIDENCE_HOST } from "./evidence-host-link";
import {
	MIGRATION_MANIFEST_SCHEMA,
	type MigrationManifestPredicate,
	type MigrationObject,
	type MigrationProduct,
	descriptorDigest,
} from "./migration-manifest";

export type LegacyCatalogProduct = keyof typeof CATALOG;

/**
 * Builds the v1-to-v2 migration manifest predicate for a legacy catalog product.
 * Produces a validated predicate adhering to MIGRATION_MANIFEST_SCHEMA.
 */
export async function buildMigrationManifestPredicate(
	product: LegacyCatalogProduct,
): Promise<MigrationManifestPredicate> {
	const prefix = `releases/solstone-${product}/`;
	const objects: MigrationObject[] = INVENTORY.filter((entry) =>
		entry.key.startsWith(prefix),
	)
		.map((entry) => ({
			url: `https://${EVIDENCE_HOST}/${entry.key}`,
			length: entry.bytes,
			sha256: entry.sha256,
		}))
		.sort((left, right) => left.url.localeCompare(right.url));

	const corpusSha256 = await descriptorDigest(objects);
	const versions = CATALOG[product];
	const chainTipVersion =
		versions.length > 0 ? (versions[versions.length - 1] ?? null) : null;
	const declaredGapVersions: readonly string[] =
		product === "journal" ? [JOURNAL_GAP.absentVersion] : [];

	const productEntry: MigrationProduct = {
		product,
		chain_length: versions.length,
		chain_tip_version: chainTipVersion,
		declared_gap_versions: declaredGapVersions,
		object_count: objects.length,
		corpus_sha256: corpusSha256,
	};

	return {
		_comment: [
			"Constructed from the committed v1 release inventory and catalog.",
		],
		schema: MIGRATION_MANIFEST_SCHEMA,
		verification_contract: {
			v1_algorithm: "minisign",
			v1_public_key: `https://${EVIDENCE_HOST}/releases/keys/${KEY_FILENAME}`,
			note: "Frozen historical v1 release-evidence register verified under sol pbc minisign public key.",
		},
		corpus_sha256: corpusSha256,
		object_count: objects.length,
		products: [productEntry],
		objects,
	};
}
