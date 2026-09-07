// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { loadDsseAuthorizationPolicy } from "../records/authorization-policy";
import { signEvidenceRecord } from "../records/build-evidence-record";
import {
	type MigrationObject,
	descriptorCanonicalBytes,
	descriptorDigest,
} from "../records/migration-manifest";
import { RELEASE_RECORD_PREDICATE_TYPE } from "../records/predicates";
import { verifyEvidenceRecord } from "../records/record";
import type { ReleaseRecordPredicate } from "../records/release-record";
import { admitTufJson } from "./admission";
import { expiresAt, metaDescription, signMetadata } from "./builder";
import { canonicalizeTufJson } from "./canonical";
import {
	parseDelegations,
	parseRootDeclarations,
	validateMetadataFreshnessAndSpec,
} from "./client-metadata";
import type { TufClientSuccess } from "./client-result";
import { computeKeyId } from "./ed25519";
import type { IncrementalSigningKeys } from "./incremental-keyset";
import { type TufJsonValue, type TufResult, rejection } from "./outcome";
import {
	type PreparedMetadata,
	authorizeMetadata,
	isRecord,
	metadataOutput,
	nextVersion,
	requiredMetadata,
	sha256,
} from "./prepared-metadata";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import { validateTargetPath } from "./role-graph";
import { metadataFilename } from "./serializer";

export interface PrepareIncrementalReleaseInput {
	priorState: TufClientSuccess;
	expectedPriorTimestampSha256: string;
	product: string;
	version: string;
	artifactDescriptors: readonly MigrationObject[];
	releasePredicate: ReleaseRecordPredicate;
	keys: IncrementalSigningKeys;
	now: Date;
}

export type { PreparedMetadata } from "./prepared-metadata";

export interface PreparedRelease {
	releaseRecordLogicalPath: string;
	releaseRecordBytes: Uint8Array;
	releaseRecordSha256: string;
	targetsSoftware: PreparedMetadata;
	snapshot: PreparedMetadata;
	timestamp: PreparedMetadata;
	newTimestampSha256: string;
}

interface SelectedPolicyTargets {
	version: number;
	policyBytes: Uint8Array;
	keysBytes: Uint8Array;
}

const INCREMENTAL_SIGNING_KEY_FIELDS = [
	"targetsSoftware",
	"snapshot",
	"timestamp",
	"producerRelease",
] as const;
const INCREMENTAL_SIGNING_KEY_FIELD_SET = new Set<string>(
	INCREMENTAL_SIGNING_KEY_FIELDS,
);

function selectedPolicyTargets(
	priorState: TufClientSuccess,
	now: Date,
): TufResult<SelectedPolicyTargets> {
	const targets = priorState.authenticatedTargets.targets;
	if (targets === undefined) {
		return rejection("unavailable", {
			path: ["authenticatedTargets", "targets"],
			expected: "authenticated top-level policy and keys targets",
			observed: "missing",
		});
	}
	const policies = new Map<number, Uint8Array>();
	const keys = new Map<number, Uint8Array>();
	for (const [path, target] of Object.entries(targets)) {
		const policyMatch =
			/^policy\/dsse-authorization\/([1-9][0-9]*)\.json$/.exec(path);
		const keysMatch = /^keys\/dsse\/([1-9][0-9]*)\.json$/.exec(path);
		const matched = policyMatch ?? keysMatch;
		if (matched === null) continue;
		const version = Number(matched[1]);
		if (!Number.isSafeInteger(version)) {
			return rejection("malformed", {
				path: ["authenticatedTargets", "targets", path],
				expected: "a safe positive policy target version",
				observed: matched[1],
			});
		}
		if (policyMatch !== null) policies.set(version, target.bytes);
		else keys.set(version, target.bytes);
	}
	const versions = [...policies.keys()].sort((left, right) => right - left);
	if (versions.length === 0) {
		return rejection("unavailable", {
			path: ["authenticatedTargets", "targets"],
			expected: "at least one policy/dsse-authorization target",
			observed: Object.keys(targets),
		});
	}
	for (const version of versions) {
		const policyBytes = policies.get(version);
		if (policyBytes === undefined) {
			return rejection("unavailable", {
				path: ["authenticatedTargets", "targets"],
				expected: `policy/dsse-authorization/${version}.json bytes`,
				observed: "missing",
			});
		}
		const policy = admitTufJson(policyBytes);
		if (!policy.ok) return policy;
		if (!isRecord(policy.value)) {
			return rejection("malformed", {
				path: ["policy"],
				expected: "an authorization policy object",
				observed: policy.value,
			});
		}
		const notYetEffective =
			typeof policy.value.effective_from === "string" &&
			Date.parse(policy.value.effective_from) > now.getTime();
		if (notYetEffective) continue;
		if (policy.value.version !== version) {
			return rejection("filename-version-mismatch", {
				path: ["policy", "version"],
				expected: version,
				observed: policy.value.version,
			});
		}
		const keysBytes = keys.get(version);
		if (keysBytes === undefined) {
			return rejection("unavailable", {
				path: ["authenticatedTargets", "targets", `keys/dsse/${version}.json`],
				expected: `keys/dsse/${version}.json bytes for the selected policy`,
				observed: "missing",
			});
		}
		return { ok: true, value: { version, policyBytes, keysBytes } };
	}
	return rejection("unavailable", {
		path: ["authenticatedTargets", "targets"],
		expected: "a policy target currently effective at the injected time",
		observed: versions,
	});
}

function parseEvidenceKeys(
	bytes: Uint8Array,
): TufResult<Readonly<Record<string, unknown>>> {
	const admitted = admitTufJson(bytes);
	if (!admitted.ok) return admitted;
	if (
		!isRecord(admitted.value) ||
		admitted.value.schema !== "solstone-transparency/dsse-keys/v1" ||
		!isRecord(admitted.value.keys)
	) {
		return rejection("malformed", {
			path: [],
			expected: "a DSSE keys target with schema and keys object",
			observed: admitted.value,
		});
	}
	return { ok: true, value: admitted.value.keys };
}

/** Prepares one authenticated incremental release without reading or writing files. */
export async function prepareIncrementalRelease(
	input: PrepareIncrementalReleaseInput,
): Promise<TufResult<PreparedRelease>> {
	const keyFields = Object.keys(input.keys);
	const unexpectedKeyFields = keyFields.filter(
		(field) => !INCREMENTAL_SIGNING_KEY_FIELD_SET.has(field),
	);
	const missingKeyFields = INCREMENTAL_SIGNING_KEY_FIELDS.filter(
		(field) => !keyFields.includes(field),
	);
	if (
		keyFields.length !== INCREMENTAL_SIGNING_KEY_FIELDS.length ||
		unexpectedKeyFields.length > 0 ||
		missingKeyFields.length > 0
	) {
		return rejection("malformed", {
			path: ["keys"],
			expected: INCREMENTAL_SIGNING_KEY_FIELDS,
			observed: {
				unexpected: unexpectedKeyFields,
				missing: missingKeyFields,
				fields: keyFields,
			},
		});
	}
	const timestamp = requiredMetadata(input.priorState, "timestamp");
	if (!timestamp.ok) return timestamp;
	const priorTimestampSha256 = await sha256(timestamp.value.bytes);
	if (!priorTimestampSha256.ok) return priorTimestampSha256;
	if (priorTimestampSha256.value !== input.expectedPriorTimestampSha256) {
		return rejection("hash-mismatch", {
			path: ["expectedPriorTimestampSha256"],
			expected: priorTimestampSha256.value,
			observed: input.expectedPriorTimestampSha256,
		});
	}
	for (const metadata of Object.values(
		input.priorState.authenticatedMetadata,
	)) {
		const freshness = validateMetadataFreshnessAndSpec(
			{ ...metadata.envelope.signed },
			input.now,
		);
		if (!freshness.ok) return freshness;
	}
	if (
		input.releasePredicate.product !== input.product ||
		input.releasePredicate.version !== input.version
	) {
		return rejection("subject-mismatch", {
			path: ["releasePredicate"],
			expected: { product: input.product, version: input.version },
			observed: {
				product: input.releasePredicate.product,
				version: input.releasePredicate.version,
			},
		});
	}
	const subjectSha256 = await descriptorDigest(input.artifactDescriptors);
	const predicateDigest = await descriptorDigest(
		input.releasePredicate.artifacts,
	);
	if (subjectSha256 !== predicateDigest) {
		return rejection("subject-mismatch", {
			path: ["releasePredicate", "artifacts"],
			expected: subjectSha256,
			observed: predicateDigest,
		});
	}
	const releaseRecordLogicalPath = `software/${input.product}/${input.version}/release-record.json`;
	const safePath = validateTargetPath(releaseRecordLogicalPath);
	if (!safePath.ok) return safePath;
	const existingSoftwareTargets =
		input.priorState.authenticatedTargets["targets-software"];
	if (existingSoftwareTargets?.[releaseRecordLogicalPath] !== undefined) {
		return rejection("malformed", {
			path: [
				"authenticatedTargets",
				"targets-software",
				releaseRecordLogicalPath,
			],
			expected:
				"a release target path not already present in authenticated metadata",
			observed: "duplicate",
		});
	}

	const selected = selectedPolicyTargets(input.priorState, input.now);
	if (!selected.ok) return selected;
	const evidenceKeys = parseEvidenceKeys(selected.value.keysBytes);
	if (!evidenceKeys.ok) return evidenceKeys;
	const rootMetadata = requiredMetadata(input.priorState, "root");
	if (!rootMetadata.ok) return rootMetadata;
	const root = parseRootDeclarations({ ...rootMetadata.value.envelope.signed });
	if (!root.ok) return root;
	const topTargetsMetadata = requiredMetadata(input.priorState, "targets");
	if (!topTargetsMetadata.ok) return topTargetsMetadata;
	const delegations = parseDelegations(
		topTargetsMetadata.value.envelope.signed.delegations,
	);
	if (!delegations.ok) return delegations;
	const tufRoleKeyids = new Set([
		...Object.keys(root.value.keys),
		...Object.keys(delegations.value.keys),
	]);
	const policy = await loadDsseAuthorizationPolicy({
		bytes: selected.value.policyBytes,
		now: input.now,
		evidenceKeys: evidenceKeys.value,
		tufRoleKeyids,
	});
	if (!policy.ok) return policy;
	const producerKeyid = await computeKeyId(
		input.keys.producerRelease.keyObject,
	);
	if (!producerKeyid.ok) return producerKeyid;
	const producerRole = policy.value.policy.roles.find(
		(role) => role.id === "producer.release",
	);
	if (
		producerRole === undefined ||
		!producerRole.keyids.includes(producerKeyid.value)
	) {
		return rejection("unknown-key", {
			path: ["keys", "producer.release"],
			expected: producerRole?.keyids ?? [],
			observed: producerKeyid.value,
		});
	}

	const record = await signEvidenceRecord({
		predicateType: RELEASE_RECORD_PREDICATE_TYPE,
		predicate: input.releasePredicate as unknown as TufJsonValue,
		subjectName: `software/${input.product}/${input.version}`,
		subjectSha256,
		policySha256: policy.value.sha256,
		issuedAt: input.now.toISOString(),
		signingKeys: [input.keys.producerRelease],
	});
	if (!record.ok) return record;
	const verifiedRecord = await verifyEvidenceRecord({
		record: record.value,
		policy: policy.value,
		subjectBytes: new Map([
			[
				`software/${input.product}/${input.version}`,
				descriptorCanonicalBytes(input.artifactDescriptors),
			],
		]),
		migrationFetcher: undefined,
	});
	if (verifiedRecord.state === "rejected") {
		return rejection(verifiedRecord.reason, verifiedRecord.detail);
	}
	if (verifiedRecord.state === "suspect") {
		return rejection("role-not-authorized", {
			path: ["policy", "roles", verifiedRecord.role.id],
			expected: "an uncompromised policy role",
			observed: "compromised",
		});
	}
	const releaseRecordBytes = canonicalizeTufJson(
		record.value as unknown as TufJsonValue,
	);
	if (!releaseRecordBytes.ok) return releaseRecordBytes;
	const releaseRecordSha256 = await sha256(releaseRecordBytes.value);
	if (!releaseRecordSha256.ok) return releaseRecordSha256;

	const softwareMetadata = requiredMetadata(
		input.priorState,
		"targets-software",
	);
	if (!softwareMetadata.ok) return softwareMetadata;
	const softwareVersion = nextVersion(softwareMetadata.value);
	if (!softwareVersion.ok) return softwareVersion;
	const softwareWindow = DELEGATED_ROLES.find(
		(role) => role.name === "targets-software",
	);
	if (softwareWindow === undefined) {
		return rejection("degenerate-role-configuration", {
			path: ["delegatedRoles", "targets-software"],
			expected: "the configured targets-software role",
			observed: "missing",
		});
	}
	const softwareExpires = expiresAt(input.now, softwareWindow.validityDays);
	if (!softwareExpires.ok) return softwareExpires;
	const oldSoftwareTargets = softwareMetadata.value.envelope.signed.targets;
	if (!isRecord(oldSoftwareTargets)) {
		return rejection("malformed", {
			path: ["authenticatedMetadata", "targets-software", "signed", "targets"],
			expected: "a targets object",
			observed: oldSoftwareTargets,
		});
	}
	const newSoftware = await signMetadata(
		"targets-software",
		softwareVersion.value,
		{
			...softwareMetadata.value.envelope.signed,
			version: softwareVersion.value,
			expires: softwareExpires.value,
			targets: {
				...oldSoftwareTargets,
				[releaseRecordLogicalPath]: {
					length: releaseRecordBytes.value.byteLength,
					hashes: { sha256: releaseRecordSha256.value },
				},
			},
		},
		[input.keys.targetsSoftware],
	);
	if (!newSoftware.ok) return newSoftware;
	const delegatedRole = delegations.value.verificationRoles.find(
		(role) => role.name === "targets-software",
	);
	if (delegatedRole === undefined) {
		return rejection("role-not-authorized", {
			path: ["delegations", "roles"],
			expected: "a targets-software delegation",
			observed: "missing",
		});
	}
	const softwareAuthorized = await authorizeMetadata(
		newSoftware.value,
		delegatedRole,
		delegations.value.keys,
	);
	if (!softwareAuthorized.ok) return softwareAuthorized;
	const softwareFilename = metadataFilename(
		"targets-software",
		softwareVersion.value,
		root.value.consistentSnapshot,
	);
	if (!softwareFilename.ok) return softwareFilename;

	const snapshotMetadata = requiredMetadata(input.priorState, "snapshot");
	if (!snapshotMetadata.ok) return snapshotMetadata;
	const snapshotVersion = nextVersion(snapshotMetadata.value);
	if (!snapshotVersion.ok) return snapshotVersion;
	const snapshotExpires = expiresAt(
		input.now,
		TOP_LEVEL_ROLES.snapshot.validityDays,
	);
	if (!snapshotExpires.ok) return snapshotExpires;
	const oldSnapshotMeta = snapshotMetadata.value.envelope.signed.meta;
	if (!isRecord(oldSnapshotMeta)) {
		return rejection("malformed", {
			path: ["authenticatedMetadata", "snapshot", "signed", "meta"],
			expected: "a metadata description map",
			observed: oldSnapshotMeta,
		});
	}
	const softwareDescription = await metaDescription(newSoftware.value);
	if (!softwareDescription.ok) return softwareDescription;
	const newSnapshot = await signMetadata(
		"snapshot",
		snapshotVersion.value,
		{
			...snapshotMetadata.value.envelope.signed,
			version: snapshotVersion.value,
			expires: snapshotExpires.value,
			meta: {
				...oldSnapshotMeta,
				"targets-software.json": softwareDescription.value,
			},
		},
		[input.keys.snapshot],
	);
	if (!newSnapshot.ok) return newSnapshot;
	const snapshotAuthorized = await authorizeMetadata(
		newSnapshot.value,
		root.value.roles.snapshot,
		root.value.keys,
	);
	if (!snapshotAuthorized.ok) return snapshotAuthorized;
	const snapshotFilename = metadataFilename(
		"snapshot",
		snapshotVersion.value,
		root.value.consistentSnapshot,
	);
	if (!snapshotFilename.ok) return snapshotFilename;

	const timestampVersion = nextVersion(timestamp.value);
	if (!timestampVersion.ok) return timestampVersion;
	const timestampExpires = expiresAt(
		input.now,
		TOP_LEVEL_ROLES.timestamp.validityDays,
	);
	if (!timestampExpires.ok) return timestampExpires;
	const oldTimestampMeta = timestamp.value.envelope.signed.meta;
	if (!isRecord(oldTimestampMeta)) {
		return rejection("malformed", {
			path: ["authenticatedMetadata", "timestamp", "signed", "meta"],
			expected: "a metadata description map",
			observed: oldTimestampMeta,
		});
	}
	const snapshotDescription = await metaDescription(newSnapshot.value);
	if (!snapshotDescription.ok) return snapshotDescription;
	const newTimestamp = await signMetadata(
		"timestamp",
		timestampVersion.value,
		{
			...timestamp.value.envelope.signed,
			version: timestampVersion.value,
			expires: timestampExpires.value,
			meta: { ...oldTimestampMeta, "snapshot.json": snapshotDescription.value },
		},
		[input.keys.timestamp],
	);
	if (!newTimestamp.ok) return newTimestamp;
	const timestampAuthorized = await authorizeMetadata(
		newTimestamp.value,
		root.value.roles.timestamp,
		root.value.keys,
	);
	if (!timestampAuthorized.ok) return timestampAuthorized;
	const timestampFilename = metadataFilename(
		"timestamp",
		timestampVersion.value,
		root.value.consistentSnapshot,
	);
	if (!timestampFilename.ok) return timestampFilename;
	const newTimestampSha256 = await sha256(newTimestamp.value.bytes);
	if (!newTimestampSha256.ok) return newTimestampSha256;

	return {
		ok: true,
		value: {
			releaseRecordLogicalPath,
			releaseRecordBytes: releaseRecordBytes.value,
			releaseRecordSha256: releaseRecordSha256.value,
			targetsSoftware: metadataOutput(
				newSoftware.value,
				softwareFilename.value,
			),
			snapshot: metadataOutput(newSnapshot.value, snapshotFilename.value),
			timestamp: metadataOutput(newTimestamp.value, timestampFilename.value),
			newTimestampSha256: newTimestampSha256.value,
		},
	};
}
