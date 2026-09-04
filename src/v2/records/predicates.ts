// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/** Exact predicate URI vocabulary and the deliberately small Wave 2 registry. */

import { type TufJsonValue, type TufResult, rejection } from "../tuf/outcome";
import {
	MIGRATION_MANIFEST_SCHEMA,
	type MigrationManifestPredicate,
	validateMigrationManifestPredicate,
} from "./migration-manifest";
import {
	RELEASE_RECORD_SCHEMA,
	type ReleaseRecordPredicate,
	validateReleaseRecordPredicate,
} from "./release-record";

export const PREDICATE_URI_BASE =
	"https://transparency.solstone.app/predicates/v1/";
export const RELEASE_RECORD_PREDICATE_TYPE = `${PREDICATE_URI_BASE}release-record`;
export const SLSA_BUILD_PROVENANCE_V1_PREDICATE_TYPE = `${PREDICATE_URI_BASE}slsa-build-provenance-v1`;
export const SPDX_SBOM_PREDICATE_TYPE = `${PREDICATE_URI_BASE}spdx-sbom`;
export const NATIVE_PLATFORM_RECEIPT_PREDICATE_TYPE = `${PREDICATE_URI_BASE}native-platform-receipt`;
export const IMAGE_BUILD_PREDICATE_TYPE = `${PREDICATE_URI_BASE}image-build`;
export const DEPLOYMENT_PREDICATE_TYPE = `${PREDICATE_URI_BASE}deployment`;
export const REPRODUCIBILITY_RESULT_PREDICATE_TYPE = `${PREDICATE_URI_BASE}reproducibility-result`;
export const AUDIT_RESULT_PREDICATE_TYPE = `${PREDICATE_URI_BASE}audit-result`;
export const RUNTIME_ATTESTATION_PREDICATE_TYPE = `${PREDICATE_URI_BASE}runtime-attestation`;
export const KEY_EVENT_PREDICATE_TYPE = `${PREDICATE_URI_BASE}key-event`;
export const MIGRATION_MANIFEST_PREDICATE_TYPE = `${PREDICATE_URI_BASE}migration-manifest-v1-to-v2`;

export const ALL_CSO_PREDICATE_TYPES = [
	RELEASE_RECORD_PREDICATE_TYPE,
	SLSA_BUILD_PROVENANCE_V1_PREDICATE_TYPE,
	SPDX_SBOM_PREDICATE_TYPE,
	NATIVE_PLATFORM_RECEIPT_PREDICATE_TYPE,
	IMAGE_BUILD_PREDICATE_TYPE,
	DEPLOYMENT_PREDICATE_TYPE,
	REPRODUCIBILITY_RESULT_PREDICATE_TYPE,
	AUDIT_RESULT_PREDICATE_TYPE,
	RUNTIME_ATTESTATION_PREDICATE_TYPE,
	KEY_EVENT_PREDICATE_TYPE,
	MIGRATION_MANIFEST_PREDICATE_TYPE,
] as const;

export type KnownPredicate =
	| {
			type: typeof MIGRATION_MANIFEST_PREDICATE_TYPE;
			body: MigrationManifestPredicate;
	  }
	| {
			type: typeof RELEASE_RECORD_PREDICATE_TYPE;
			body: ReleaseRecordPredicate;
	  };

/** Validates known predicate URIs; every other pinned URI fails closed. */
export async function validateKnownPredicate(
	predicateType: string,
	predicate: TufJsonValue,
): Promise<TufResult<KnownPredicate>> {
	if (predicateType === MIGRATION_MANIFEST_PREDICATE_TYPE) {
		const validated = await validateMigrationManifestPredicate(predicate);
		if (!validated.ok) return validated;
		return {
			ok: true,
			value: { type: MIGRATION_MANIFEST_PREDICATE_TYPE, body: validated.value },
		};
	}
	if (predicateType === RELEASE_RECORD_PREDICATE_TYPE) {
		const validated = await validateReleaseRecordPredicate(predicate);
		if (!validated.ok) return validated;
		return {
			ok: true,
			value: { type: RELEASE_RECORD_PREDICATE_TYPE, body: validated.value },
		};
	}
	return rejection("unrecognized-predicate", {
		path: ["predicateType"],
		expected: [
			MIGRATION_MANIFEST_PREDICATE_TYPE,
			RELEASE_RECORD_PREDICATE_TYPE,
		],
		observed: predicateType,
	});
}

export { MIGRATION_MANIFEST_SCHEMA, RELEASE_RECORD_SCHEMA };
