// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expiresAt, metaDescription, signMetadata } from "./builder";
import {
	parseDelegations,
	parseRootDeclarations,
	validateMetadataFreshnessAndSpec,
} from "./client-metadata";
import type { TufClientSuccess } from "./client-result";
import type { Ed25519SigningKey } from "./ed25519";
import { type TufResult, rejection } from "./outcome";
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
import { metadataFilename, metadataLogicalName } from "./serializer";

export interface RenewTufMetadataInput {
	priorState: TufClientSuccess;
	expectedPriorTimestampSha256: string;
	roleName: string;
	keys: Readonly<Record<string, Ed25519SigningKey>>;
	now: Date;
}

export interface MetadataRenewal {
	renewedRoles: readonly PreparedMetadata[];
	newTimestampSha256: string;
}

function renewalChain(roleName: string): TufResult<readonly string[]> {
	if (roleName === "root") {
		return rejection("malformed", {
			path: ["roleName"],
			expected: "a renewable non-root role name",
			observed: roleName,
		});
	}
	if (roleName === "timestamp") return { ok: true, value: ["timestamp"] };
	if (roleName === "snapshot")
		return { ok: true, value: ["snapshot", "timestamp"] };
	if (
		roleName === "targets" ||
		DELEGATED_ROLES.some((role) => role.name === roleName)
	) {
		return { ok: true, value: [roleName, "snapshot", "timestamp"] };
	}
	return rejection("malformed", {
		path: ["roleName"],
		expected:
			"timestamp, snapshot, targets, or a configured delegated role name",
		observed: roleName,
	});
}

function exactKeySet(
	keys: Readonly<Record<string, Ed25519SigningKey>>,
	chain: readonly string[],
): TufResult<undefined> {
	const actual = Object.keys(keys);
	const unexpected = actual.filter((name) => !chain.includes(name));
	const missing = chain.filter((name) => !actual.includes(name));
	if (
		actual.length !== chain.length ||
		unexpected.length > 0 ||
		missing.length > 0
	) {
		return rejection("malformed", {
			path: ["keys"],
			expected: chain,
			observed: { fields: actual, unexpected, missing },
		});
	}
	return { ok: true, value: undefined };
}

function validityDays(roleName: string): TufResult<number> {
	if (
		roleName === "targets" ||
		roleName === "snapshot" ||
		roleName === "timestamp"
	) {
		return { ok: true, value: TOP_LEVEL_ROLES[roleName].validityDays };
	}
	const delegated = DELEGATED_ROLES.find((role) => role.name === roleName);
	if (delegated !== undefined)
		return { ok: true, value: delegated.validityDays };
	return rejection("degenerate-role-configuration", {
		path: ["roleName"],
		expected: "a configured renewable role",
		observed: roleName,
	});
}

/** Renews one role and its metadata dependency chain from an authenticated view. */
export async function renewTufMetadata(
	input: RenewTufMetadataInput,
): Promise<TufResult<MetadataRenewal>> {
	const chain = renewalChain(input.roleName);
	if (!chain.ok) return chain;
	const keySet = exactKeySet(input.keys, chain.value);
	if (!keySet.ok) return keySet;

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
		const fresh = validateMetadataFreshnessAndSpec(
			{ ...metadata.envelope.signed },
			input.now,
		);
		if (!fresh.ok) return fresh;
	}

	const rootMetadata = requiredMetadata(input.priorState, "root");
	if (!rootMetadata.ok) return rootMetadata;
	const root = parseRootDeclarations({ ...rootMetadata.value.envelope.signed });
	if (!root.ok) return root;
	const targetsMetadata = requiredMetadata(input.priorState, "targets");
	if (!targetsMetadata.ok) return targetsMetadata;
	const delegations = parseDelegations(
		targetsMetadata.value.envelope.signed.delegations,
	);
	if (!delegations.ok) return delegations;

	const signedByRole = new Map<
		string,
		Awaited<ReturnType<typeof signMetadata>>
	>();
	const outputs: PreparedMetadata[] = [];
	const leafRoleName = chain.value[0];
	if (leafRoleName === undefined) {
		return rejection("malformed", {
			path: ["roleName"],
			expected: "a non-empty renewal chain",
			observed: input.roleName,
		});
	}
	for (const roleName of chain.value) {
		const current = requiredMetadata(input.priorState, roleName);
		if (!current.ok) return current;
		const version = nextVersion(current.value);
		if (!version.ok) return version;
		const days = validityDays(roleName);
		if (!days.ok) return days;
		const expires = expiresAt(input.now, days.value);
		if (!expires.ok) return expires;

		let updatedMeta: Record<string, unknown> | undefined;
		if (roleName === "snapshot" && input.roleName !== "snapshot") {
			const currentMeta = current.value.envelope.signed.meta;
			if (!isRecord(currentMeta)) {
				return rejection("malformed", {
					path: ["authenticatedMetadata", roleName, "signed", "meta"],
					expected: "a metadata description map",
					observed: currentMeta,
				});
			}
			const leaf = signedByRole.get(leafRoleName);
			if (leaf === undefined || !leaf.ok) {
				throw new Error("renewal chain lost its signed leaf metadata");
			}
			const logicalName = metadataLogicalName(leafRoleName);
			if (!logicalName.ok) return logicalName;
			const description = await metaDescription(leaf.value);
			if (!description.ok) return description;
			updatedMeta = { ...currentMeta, [logicalName.value]: description.value };
		}
		if (roleName === "timestamp" && chain.value.length > 1) {
			const currentMeta = current.value.envelope.signed.meta;
			if (!isRecord(currentMeta)) {
				return rejection("malformed", {
					path: ["authenticatedMetadata", roleName, "signed", "meta"],
					expected: "a metadata description map",
					observed: currentMeta,
				});
			}
			const snapshot = signedByRole.get("snapshot");
			if (snapshot === undefined || !snapshot.ok) {
				throw new Error("renewal chain lost its signed snapshot metadata");
			}
			const description = await metaDescription(snapshot.value);
			if (!description.ok) return description;
			updatedMeta = { ...currentMeta, "snapshot.json": description.value };
		}

		const key = input.keys[roleName];
		if (key === undefined) {
			throw new Error(
				"exact renewal key-set unexpectedly omitted a chain role",
			);
		}
		const signed = await signMetadata(
			roleName,
			version.value,
			{
				...current.value.envelope.signed,
				version: version.value,
				expires: expires.value,
				...(updatedMeta === undefined ? {} : { meta: updatedMeta }),
			},
			[key],
		);
		if (!signed.ok) return signed;
		let authorization: TufResult<undefined>;
		if (
			roleName === "targets" ||
			roleName === "snapshot" ||
			roleName === "timestamp"
		) {
			authorization = await authorizeMetadata(
				signed.value,
				root.value.roles[roleName],
				root.value.keys,
			);
		} else {
			const role = delegations.value.verificationRoles.find(
				(item) => item.name === roleName,
			);
			if (role === undefined) {
				return rejection("role-not-authorized", {
					path: ["delegations", "roles"],
					expected: `a ${roleName} delegation`,
					observed: "missing",
				});
			}
			authorization = await authorizeMetadata(
				signed.value,
				role,
				delegations.value.keys,
			);
		}
		if (!authorization.ok) return authorization;
		const filename = metadataFilename(
			roleName,
			version.value,
			root.value.consistentSnapshot,
		);
		if (!filename.ok) return filename;
		signedByRole.set(roleName, signed);
		outputs.push(metadataOutput(signed.value, filename.value));
	}
	const newTimestamp = signedByRole.get("timestamp");
	if (newTimestamp === undefined || !newTimestamp.ok) {
		throw new Error("renewal chain did not produce timestamp metadata");
	}
	const newTimestampSha256 = await sha256(newTimestamp.value.bytes);
	if (!newTimestampSha256.ok) return newTimestampSha256;
	return {
		ok: true,
		value: {
			renewedRoles: outputs,
			newTimestampSha256: newTimestampSha256.value,
		},
	};
}

/** Refreshes only timestamp metadata through the generic renewal constructor. */
export async function refreshTimestamp(
	input: Omit<RenewTufMetadataInput, "roleName" | "keys"> & {
		timestampKey: Ed25519SigningKey;
	},
): Promise<TufResult<MetadataRenewal>> {
	return renewTufMetadata({
		...input,
		roleName: "timestamp",
		keys: { timestamp: input.timestampKey },
	});
}
