// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { buildDsseAuthorizationPolicyTargets } from "../records/dsse-policy-builder";
import type { MigrationObject } from "../records/migration-manifest";
import {
	RELEASE_RECORD_SCHEMA,
	type ReleaseRecordPredicate,
} from "../records/release-record";
import {
	type RepositorySigningKeys,
	type TufTargetDescription,
	buildRepository,
	signMetadata,
} from "./builder";
import { canonicalizeTufJson } from "./canonical";
import { updateTufRepository } from "./client";
import { parseClientMetadata } from "./client-metadata";
import type { TufClientSuccess } from "./client-result";
import { type Ed25519SigningKey, generateEd25519SigningKey } from "./ed25519";
import type { TufFetchResponse, TufFetcher } from "./fetch";
import type { IncrementalSigningKeys } from "./incremental-keyset";
import { type TufJsonValue, type TufResult, rejection } from "./outcome";
import {
	type PrepareIncrementalReleaseInput,
	prepareIncrementalRelease,
} from "./release-preparation";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import { metadataFilename } from "./serializer";
import { targetStoragePath } from "./target-storage";
import type { TrustStoreState, TufTrustStore } from "./trust-store";

const now = new Date("2030-01-02T03:04:05.000Z");

interface Fixture {
	tufKeys: RepositorySigningKeys;
	input: PrepareIncrementalReleaseInput;
	state: TufClientSuccess;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function sha256(bytes: Uint8Array): Promise<string> {
	return bytesToHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
		),
	);
}

async function generatedKey(): Promise<Ed25519SigningKey> {
	const key = await generateEd25519SigningKey();
	if (!key.ok)
		throw new Error(`synthetic key generation failed: ${key.reason}`);
	return key.value;
}

async function signingKeys(): Promise<RepositorySigningKeys> {
	const generate = (count: number) =>
		Promise.all(Array.from({ length: count }, () => generatedKey()));
	const delegated: Record<string, readonly Ed25519SigningKey[]> = {};
	for (const role of DELEGATED_ROLES)
		delegated[role.name] = await generate(role.keyCount);
	return {
		root: await generate(TOP_LEVEL_ROLES.root.keyCount),
		targets: await generate(TOP_LEVEL_ROLES.targets.keyCount),
		snapshot: await generate(TOP_LEVEL_ROLES.snapshot.keyCount),
		timestamp: await generate(TOP_LEVEL_ROLES.timestamp.keyCount),
		delegated,
	};
}

function memoryTrustStore(): TufTrustStore {
	let current: { state: TrustStoreState; revision: string } | undefined;
	return {
		async read(): Promise<
			TufResult<{ state: TrustStoreState; revision: string } | undefined>
		> {
			return { ok: true, value: current };
		},
		async replace(
			expectedRevision: string | undefined,
			next: TrustStoreState,
		): Promise<TufResult<undefined>> {
			if (expectedRevision !== current?.revision) {
				return rejection("malformed", {
					path: ["revision"],
					expected: current?.revision ?? "missing",
					observed: expectedRevision ?? "missing",
				});
			}
			current = { state: next, revision: "in-memory-revision" };
			return { ok: true, value: undefined };
		},
	};
}

function releasePredicate(
	product: string,
	version: string,
	artifacts: readonly MigrationObject[],
): ReleaseRecordPredicate {
	return {
		_comment: ["synthetic incremental release"],
		schema: RELEASE_RECORD_SCHEMA,
		product,
		version,
		artifacts,
		does_prove: ["sol pbc built and published these exact final bytes"],
		does_not_prove: ["defect-free"],
	};
}

async function fixture(
	options: {
		duplicateRelease?: boolean;
		replacedPolicy?: boolean;
		futureReplacementPolicy?: boolean;
		missingReplacementKeys?: boolean;
		invalidReplacementPolicy?: boolean;
		privilegedAlias?: "root" | "targets";
	} = {},
): Promise<Fixture> {
	const tufKeys = await signingKeys();
	const producer = await generatedKey();
	const tufRoleKeyids = [
		...tufKeys.root,
		...tufKeys.targets,
		...tufKeys.snapshot,
		...tufKeys.timestamp,
		...Object.values(tufKeys.delegated).flat(),
	].map((key) => key.keyId);
	const firstPolicy = await buildDsseAuthorizationPolicyTargets({
		version: 1,
		effectiveFrom: "2030-01-01T00:00:00.000Z",
		now,
		producerReleaseKeys: [{ keyObject: producer.keyObject }],
		tufRoleKeyids,
	});
	if (!firstPolicy.ok)
		throw new Error(`policy build failed: ${firstPolicy.reason}`);
	const targetBytes = new Map<string, Uint8Array>([
		[firstPolicy.value.policyLogicalPath, firstPolicy.value.policyBytes],
		[firstPolicy.value.keysLogicalPath, firstPolicy.value.keysTargetBytes],
	]);
	if (
		options.replacedPolicy ||
		options.futureReplacementPolicy ||
		options.missingReplacementKeys ||
		options.invalidReplacementPolicy
	) {
		const replacementProducer = await generatedKey();
		const replacementEffectiveFrom = options.futureReplacementPolicy
			? "2031-01-01T00:00:00.000Z"
			: "2030-01-01T00:00:00.000Z";
		const replacement = await buildDsseAuthorizationPolicyTargets({
			version: 2,
			effectiveFrom: replacementEffectiveFrom,
			now: new Date(replacementEffectiveFrom),
			producerReleaseKeys: [{ keyObject: replacementProducer.keyObject }],
			tufRoleKeyids,
		});
		if (!replacement.ok)
			throw new Error(`replacement policy build failed: ${replacement.reason}`);
		let replacementPolicyBytes = replacement.value.policyBytes;
		if (options.invalidReplacementPolicy) {
			const policy = JSON.parse(
				new TextDecoder().decode(replacementPolicyBytes),
			) as {
				roles: { id: string; keyids: string[] }[];
			};
			const producerRole = policy.roles.find(
				(role) => role.id === "producer.release",
			);
			const overlappingTufKey = tufKeys.root[0];
			if (producerRole === undefined || overlappingTufKey === undefined) {
				throw new Error("fixture replacement policy mutation failed");
			}
			producerRole.keyids = [overlappingTufKey.keyId];
			const canonical = canonicalizeTufJson(policy as unknown as TufJsonValue);
			if (!canonical.ok)
				throw new Error("fixture replacement policy canonicalization failed");
			replacementPolicyBytes = canonical.value;
		}
		targetBytes.set(
			replacement.value.policyLogicalPath,
			replacementPolicyBytes,
		);
		if (!options.missingReplacementKeys) {
			targetBytes.set(
				replacement.value.keysLogicalPath,
				replacement.value.keysTargetBytes,
			);
		}
	}
	const artifacts: readonly MigrationObject[] = [
		{
			url: "https://example.test/software/journal/2.0.0/journal.tar.gz",
			length: 123,
			sha256: "a".repeat(64),
		},
	];
	const predicate = releasePredicate("journal", "2.0.0", artifacts);
	const releasePath = "software/journal/2.0.0/release-record.json";
	if (options.duplicateRelease) {
		targetBytes.set(releasePath, new TextEncoder().encode("existing release"));
	}
	const targets: Record<string, TufTargetDescription> = {};
	for (const [path, bytes] of targetBytes) {
		targets[path] = {
			length: bytes.byteLength,
			hashes: { sha256: await sha256(bytes) },
		};
	}
	const built = await buildRepository({
		signingKeys: tufKeys,
		targets,
		consistentSnapshot: true,
		now,
	});
	if (!built.ok)
		throw new Error(`genesis repository build failed: ${built.reason}`);
	if (options.privilegedAlias !== undefined) {
		const signed = built.value.root.envelope.signed;
		const roles = signed.roles as Record<
			string,
			{ keyids: string[]; threshold: number }
		>;
		const privileged = roles[options.privilegedAlias];
		const snapshot = tufKeys.snapshot[0];
		if (privileged === undefined || snapshot === undefined)
			throw new Error("fixture alias keys missing");
		const replacement = await signMetadata(
			"root",
			1,
			{
				...signed,
				roles: {
					...roles,
					[options.privilegedAlias]: {
						...privileged,
						keyids: [...privileged.keyids, snapshot.keyId],
					},
				},
			},
			tufKeys.root,
		);
		if (!replacement.ok) throw new Error("fixture root signing failed");
		built.value.root = replacement.value;
	}
	const objects = new Map<string, TufFetchResponse>();
	for (const metadata of [
		built.value.root,
		built.value.timestamp,
		built.value.snapshot,
		built.value.targets,
		...built.value.delegatedTargets,
	]) {
		const filename = metadataFilename(
			metadata.roleName,
			metadata.version,
			true,
		);
		if (!filename.ok) throw new Error("fixture metadata filename failed");
		objects.set(filename.value, { kind: "ok", bytes: metadata.bytes });
	}
	for (const [path, bytes] of targetBytes) {
		const descriptor = targets[path];
		if (descriptor === undefined)
			throw new Error("fixture target descriptor missing");
		const storagePath = targetStoragePath(path, {
			sha256: descriptor.hashes.sha256 ?? "",
			consistentSnapshot: true,
		});
		if (!storagePath.ok) throw new Error("fixture target storage path failed");
		objects.set(storagePath.value, { kind: "ok", bytes });
	}
	const fetcher: TufFetcher = {
		async fetch(path) {
			return objects.get(path) ?? { kind: "not-found" };
		},
	};
	const authenticated = await updateTufRepository({
		fetcher,
		bootstrapRoot: built.value.root.bytes,
		trustStore: memoryTrustStore(),
		now,
	});
	if (!authenticated.ok)
		throw new Error(`fixture authentication failed: ${authenticated.reason}`);
	const targetsSoftware = tufKeys.delegated["targets-software"]?.[0];
	const snapshot = tufKeys.snapshot[0];
	const timestamp = tufKeys.timestamp[0];
	if (
		targetsSoftware === undefined ||
		snapshot === undefined ||
		timestamp === undefined
	) {
		throw new Error("fixture signing keys missing");
	}
	const priorTimestamp = authenticated.value.authenticatedMetadata.timestamp;
	if (priorTimestamp === undefined)
		throw new Error("fixture timestamp missing");
	return {
		tufKeys,
		state: authenticated.value,
		input: {
			priorState: authenticated.value,
			expectedPriorTimestampSha256: await sha256(priorTimestamp.bytes),
			product: "journal",
			version: "2.0.0",
			artifactDescriptors: artifacts,
			releasePredicate: predicate,
			keys: {
				targetsSoftware,
				snapshot,
				timestamp,
				producerRelease: producer,
			} satisfies IncrementalSigningKeys,
			now,
		},
	};
}

test("prepares an authenticated release and re-signs exactly three metadata roles", async () => {
	const built = await fixture();
	const prepared = await prepareIncrementalRelease(built.input);
	expect(prepared.ok).toBe(true);
	if (!prepared.ok) return;
	expect(prepared.value.releaseRecordLogicalPath).toBe(
		"software/journal/2.0.0/release-record.json",
	);
	expect(prepared.value.targetsSoftware).toMatchObject({
		filename: "2.targets-software.json",
		version: 2,
	});
	expect(prepared.value.snapshot).toMatchObject({
		filename: "2.snapshot.json",
		version: 2,
	});
	expect(prepared.value.timestamp).toMatchObject({
		filename: "timestamp.json",
		version: 2,
	});
	expect(prepared.value.releaseRecordSha256).toHaveLength(64);
	expect(prepared.value.newTimestampSha256).toHaveLength(64);
	const targetsMetadata = parseClientMetadata(
		"targets-software",
		prepared.value.targetsSoftware.filename,
		prepared.value.targetsSoftware.bytes,
	);
	expect(targetsMetadata.ok).toBe(true);
	if (!targetsMetadata.ok) return;
	expect(Object.keys(targetsMetadata.value.signed.targets ?? {})).toEqual([
		prepared.value.releaseRecordLogicalPath,
	]);
});

test("refuses a valid snapshot signer also authorized for root or top-level targets", async () => {
	for (const privilegedAlias of ["root", "targets"] as const) {
		// The fixture authenticates this root and the existing repository first.
		const built = await fixture({ privilegedAlias });
		const prepared = await prepareIncrementalRelease(built.input);
		expect(prepared).toMatchObject({
			ok: false,
			reason: "role-not-authorized",
			detail: { path: ["keys", "snapshot"] },
		});
	}
});

test("rejects wrong producer keys, stale prior timestamps, duplicates, product mismatches, and expiry", async () => {
	const built = await fixture();
	const wrongProducer = await generatedKey();
	expect(
		await prepareIncrementalRelease({
			...built.input,
			keys: { ...built.input.keys, producerRelease: wrongProducer },
		}),
	).toMatchObject({ ok: false, reason: "unknown-key" });
	expect(
		await prepareIncrementalRelease({
			...built.input,
			expectedPriorTimestampSha256: "0".repeat(64),
		}),
	).toMatchObject({ ok: false, reason: "hash-mismatch" });
	const duplicate = await fixture({ duplicateRelease: true });
	expect(await prepareIncrementalRelease(duplicate.input)).toMatchObject({
		ok: false,
		reason: "malformed",
	});
	expect(
		await prepareIncrementalRelease({
			...built.input,
			releasePredicate: { ...built.input.releasePredicate, product: "linux" },
		}),
	).toMatchObject({ ok: false, reason: "subject-mismatch" });
	expect(
		await prepareIncrementalRelease({
			...built.input,
			now: new Date("2034-01-02T03:04:05.000Z"),
		}),
	).toMatchObject({ ok: false, reason: "expired" });
});

test("a higher replacement policy no longer authorizes the old producer", async () => {
	const replaced = await fixture({ replacedPolicy: true });
	expect(await prepareIncrementalRelease(replaced.input)).toMatchObject({
		ok: false,
		reason: "unknown-key",
	});
});

test("a future policy does not block the still-effective prior policy", async () => {
	const futureReplacement = await fixture({ futureReplacementPolicy: true });
	expect(
		await prepareIncrementalRelease(futureReplacement.input),
	).toMatchObject({
		ok: true,
	});
});

test("an effective newer policy missing keys rejects without falling back", async () => {
	const missingKeys = await fixture({ missingReplacementKeys: true });
	expect(await prepareIncrementalRelease(missingKeys.input)).toMatchObject({
		ok: false,
		reason: "unavailable",
	});
});

test("an effective newer invalid policy rejects without falling back", async () => {
	const invalidPolicy = await fixture({ invalidReplacementPolicy: true });
	expect(await prepareIncrementalRelease(invalidPolicy.input)).toMatchObject({
		ok: false,
		reason: "degenerate-role-configuration",
	});
});

test("rejects extra release signing-key fields before preparing a release", async () => {
	const built = await fixture();
	const keysWithExtraField = {
		...built.input.keys,
		root: built.input.keys.snapshot,
	};
	expect(
		await prepareIncrementalRelease({
			...built.input,
			keys: keysWithExtraField,
		}),
	).toMatchObject({ ok: false, reason: "malformed" });
});

test("refuses root and top-level targets by key identity in every release signing slot", async () => {
	const built = await fixture();
	for (const forbidden of [...built.tufKeys.root, ...built.tufKeys.targets]) {
		for (const field of [
			"targetsSoftware",
			"snapshot",
			"timestamp",
			"producerRelease",
		] as const) {
			const result = await prepareIncrementalRelease({
				...built.input,
				keys: { ...built.input.keys, [field]: forbidden },
			});
			expect(result).toMatchObject({
				ok: false,
				reason: "role-not-authorized",
				detail: { path: ["keys", field] },
			});
		}
	}
	expect((await prepareIncrementalRelease(built.input)).ok).toBe(true);
});
