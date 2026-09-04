// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type BuiltRepository,
	type RepositorySigningKeys,
	type RoleConfiguration,
	buildRepository,
} from "./builder";
import { canonicalizeTufJson } from "./canonical";
import { updateTufRepository } from "./client";
import { validateMetadataDescription } from "./client-metadata";
import type { TufClientPartialView } from "./client-result";
import {
	type Ed25519SigningKey,
	generateEd25519SigningKey,
	signEd25519,
} from "./ed25519";
import type { TufFetchResponse, TufFetcher } from "./fetch";
import { rejection } from "./outcome";
import { DELEGATED_ROLES, TOP_LEVEL_ROLES } from "./role-config";
import { metadataFilename } from "./serializer";
import { type TrustStoreState, openFileTrustStore } from "./trust-store";

const issuedAt = new Date("2030-01-02T03:04:05Z");

type ScriptedFetcher = {
	fetcher: TufFetcher;
	objects: Map<string, TufFetchResponse>;
	requests: { path: string; maxBytes: number }[];
};

async function signingKeys(
	configuration: RoleConfiguration = {
		topLevelRoles: TOP_LEVEL_ROLES,
		delegatedRoles: DELEGATED_ROLES,
	},
): Promise<RepositorySigningKeys> {
	const generate = async (count: number): Promise<Ed25519SigningKey[]> => {
		const results = await Promise.all(
			Array.from({ length: count }, () => generateEd25519SigningKey()),
		);
		return results.map((result) => {
			if (!result.ok)
				throw new Error(`synthetic key generation failed: ${result.reason}`);
			return result.value;
		});
	};
	const delegated: Record<string, Ed25519SigningKey[]> = {};
	for (const role of configuration.delegatedRoles) {
		delegated[role.name] = await generate(role.keyCount);
	}
	return {
		root: await generate(configuration.topLevelRoles.root?.keyCount ?? 0),
		targets: await generate(configuration.topLevelRoles.targets?.keyCount ?? 0),
		snapshot: await generate(
			configuration.topLevelRoles.snapshot?.keyCount ?? 0,
		),
		timestamp: await generate(
			configuration.topLevelRoles.timestamp?.keyCount ?? 0,
		),
		delegated,
	};
}

function createScriptedFetcher(
	objects: Map<string, TufFetchResponse>,
): ScriptedFetcher {
	const requests: { path: string; maxBytes: number }[] = [];
	return {
		objects,
		requests,
		fetcher: {
			async fetch(path, maxBytes) {
				requests.push({ path, maxBytes });
				return objects.get(path) ?? { kind: "not-found" };
			},
		},
	};
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

async function signMetadataFixture(
	signed: Record<string, unknown>,
	keys: readonly Ed25519SigningKey[],
): Promise<Uint8Array> {
	const canonicalSigned = canonicalizeTufJson(signed);
	if (!canonicalSigned.ok)
		throw new Error("fixture signed metadata canonicalization failed");
	const signatures = [] as { keyid: string; sig: string }[];
	for (const key of keys) {
		const signature = await signEd25519(key.privateKey, canonicalSigned.value);
		if (!signature.ok) throw new Error("fixture metadata signing failed");
		signatures.push({ keyid: key.keyId, sig: bytesToHex(signature.value) });
	}
	signatures.sort((left, right) => left.keyid.localeCompare(right.keyid));
	const envelope = canonicalizeTufJson({ signed, signatures });
	if (!envelope.ok) throw new Error("fixture envelope canonicalization failed");
	return envelope.value;
}

async function buildRotatingRootChain(
	repository: BuiltRepository,
	keys: RepositorySigningKeys,
	signers: "both" | "old" | "new" = "both",
): Promise<Uint8Array> {
	const nextRootKeys = await Promise.all(
		Array.from({ length: 3 }, () => generateEd25519SigningKey()),
	);
	if (nextRootKeys.some((key) => !key.ok))
		throw new Error("root rotation keys failed");
	const next = nextRootKeys.map((key) => {
		if (!key.ok) throw new Error("unreachable root key failure");
		return key.value;
	});
	const signed = repository.root.envelope.signed as Record<string, unknown>;
	const oldKeys = signed.keys as Record<string, unknown>;
	const oldRoles = signed.roles as Record<string, unknown>;
	const oldSigners = [keys.root[0], keys.root[1]].filter(
		(key): key is Ed25519SigningKey => key !== undefined,
	);
	const rotationSigners =
		signers === "old"
			? oldSigners
			: signers === "new"
				? next.slice(0, 2)
				: [...oldSigners, ...next.slice(0, 2)];
	return signMetadataFixture(
		{
			...signed,
			version: 2,
			keys: {
				...oldKeys,
				...Object.fromEntries(next.map((key) => [key.keyId, key.keyObject])),
			},
			roles: {
				...oldRoles,
				root: { keyids: next.map((key) => key.keyId), threshold: 2 },
			},
		},
		rotationSigners,
	);
}

async function fixtureWithKeys(
	configuration: RoleConfiguration = {
		topLevelRoles: TOP_LEVEL_ROLES,
		delegatedRoles: DELEGATED_ROLES,
	},
): Promise<{
	repository: BuiltRepository;
	keys: RepositorySigningKeys;
	fetch: ScriptedFetcher;
	targetBytes: Uint8Array;
}> {
	const targetBytes = new TextEncoder().encode("synthetic target bytes");
	const keys = await signingKeys(configuration);
	const repository = await buildRepository({
		signingKeys: keys,
		targets: {
			"software/release.json": {
				length: targetBytes.byteLength,
				hashes: { sha256: await sha256(targetBytes) },
			},
		},
		consistentSnapshot: true,
		now: issuedAt,
		roleConfiguration: configuration,
	});
	if (!repository.ok)
		throw new Error(`fixture build failed: ${repository.reason}`);
	const objects = new Map<string, TufFetchResponse>();
	for (const metadata of [
		repository.value.root,
		repository.value.timestamp,
		repository.value.snapshot,
		repository.value.targets,
		...repository.value.delegatedTargets,
	]) {
		const filename = metadataFilename(
			metadata.roleName,
			metadata.version,
			true,
		);
		if (!filename.ok) throw new Error("fixture metadata filename failed");
		objects.set(filename.value, { kind: "ok", bytes: metadata.bytes });
	}
	objects.set("software/release.json", { kind: "ok", bytes: targetBytes });
	return {
		repository: repository.value,
		keys,
		fetch: createScriptedFetcher(objects),
		targetBytes,
	};
}

async function withStore(
	name: string,
	callback: (store: ReturnType<typeof openFileTrustStore>) => Promise<void>,
): Promise<void> {
	const directory = await mkdtemp(
		join(tmpdir(), `solstone-transparency-tuf-${name}-`),
	);
	try {
		await callback(openFileTrustStore(join(directory, "store.json")));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function persistedState(
	built: Awaited<ReturnType<typeof fixtureWithKeys>>,
	versions: TrustStoreState["versions"],
): TrustStoreState {
	return {
		schemaVersion: 1,
		trustedRoot: {
			version: versions.root,
			envelope: {
				signed: built.repository.root.envelope
					.signed as TrustStoreState["trustedRoot"]["envelope"]["signed"],
				signatures: built.repository.root.envelope.signatures,
			},
		},
		versions,
	};
}

async function replaceSnapshotAndTimestamp(
	built: Awaited<ReturnType<typeof fixtureWithKeys>>,
	snapshotSigned: Record<string, unknown>,
): Promise<void> {
	const snapshotBytes = await signMetadataFixture(
		snapshotSigned,
		built.keys.snapshot,
	);
	built.fetch.objects.set("1.snapshot.json", {
		kind: "ok",
		bytes: snapshotBytes,
	});
	const timestampSigned = {
		...built.repository.timestamp.envelope.signed,
		meta: { "snapshot.json": await descriptorFor(snapshotBytes) },
	};
	built.fetch.objects.set("timestamp.json", {
		kind: "ok",
		bytes: await signMetadataFixture(timestampSigned, built.keys.timestamp),
	});
}

async function replaceMetadataAndAncestors(
	built: Awaited<ReturnType<typeof fixtureWithKeys>>,
	roleName: string,
	signed: Record<string, unknown>,
	keys: readonly Ed25519SigningKey[],
): Promise<void> {
	const bytes = await signMetadataFixture(signed, keys);
	const filename = metadataFilename(roleName, 1, true);
	if (!filename.ok) throw new Error("fixture metadata filename failed");
	built.fetch.objects.set(filename.value, { kind: "ok", bytes });
	const snapshot = built.repository.snapshot.envelope.signed as Record<
		string,
		unknown
	>;
	const meta = {
		...(snapshot.meta as Record<string, unknown>),
		[`${roleName}.json`]: await descriptorFor(bytes),
	};
	await replaceSnapshotAndTimestamp(built, { ...snapshot, meta });
}

async function descriptorFor(bytes: Uint8Array) {
	return {
		version: 1,
		length: bytes.byteLength,
		hashes: { sha256: await sha256(bytes) },
	};
}

test("client completes root look-ahead, verifies every role and persists only after target success", async () => {
	const built = await fixtureWithKeys();
	const rotated = await buildRotatingRootChain(built.repository, built.keys);
	const softwareKey = built.keys.delegated["targets-software"]?.[0];
	const servicesKey = built.keys.delegated["targets-services"]?.[0];
	if (softwareKey === undefined || servicesKey === undefined) {
		throw new Error("fixture delegated keys missing");
	}
	built.fetch.objects.set("2.root.json", { kind: "ok", bytes: rotated });
	await withStore("client-success", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.versions.root).toBe(2);
		expect(
			result.value.authorizationChain.filter(
				(entry) => entry.subjectRole === "root",
			),
		).toHaveLength(3);
		expect(result.value.authorizationChain).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					subjectRole: "targets-software",
					delegationPath: ["root", "targets", "targets-software"],
					authorizingRole: "targets",
					satisfyingKeyids: [softwareKey.keyId],
				}),
				expect.objectContaining({
					subjectRole: "targets-services",
					delegationPath: ["root", "targets", "targets-services"],
					authorizingRole: "targets",
					satisfyingKeyids: [servicesKey.keyId],
				}),
			]),
		);
		expect(
			result.value.roleStatuses.every((status) => status.state === "verified"),
		).toBe(true);
		expect(result.value.fingerprint).toHaveLength(64);
		expect(
			built.fetch.requests.find(
				(request) => request.path === "software/release.json",
			),
		).toEqual({
			path: "software/release.json",
			maxBytes: built.targetBytes.byteLength,
		});
		const persisted = await store.read();
		expect(persisted.ok).toBe(true);
		if (!persisted.ok || persisted.value === undefined) return;
		expect(persisted.value.state.versions.root).toBe(2);
		const resumed = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(resumed).toMatchObject({
			ok: true,
			value: { versions: { root: 2 } },
		});
	});
});

test("root N+1 not-found terminates look-ahead and never probes a skipped root", async () => {
	const built = await fixtureWithKeys();
	built.fetch.objects.set("3.root.json", {
		kind: "error",
		error: new Error("must not fetch"),
	});
	await withStore("root-look-ahead", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result.ok).toBe(true);
		expect(
			built.fetch.requests.some((request) => request.path === "3.root.json"),
		).toBe(false);
	});
});

test("an existing store ignores a stale bootstrap root without regressing trust", async () => {
	const built = await fixtureWithKeys();
	built.fetch.objects.set("2.root.json", {
		kind: "ok",
		bytes: await buildRotatingRootChain(built.repository, built.keys),
	});
	await withStore("root-stale-bootstrap", async (store) => {
		const established = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(established).toMatchObject({
			ok: true,
			value: { versions: { root: 2 } },
		});

		// Root look-ahead only requests N+1: persisted-root hydration and the
		// store's version-lowering guard, not a fetch-time rollback comparison,
		// protect a caller that still supplies stale bootstrap root bytes.
		const resumed = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(resumed).toMatchObject({
			ok: true,
			value: { versions: { root: 2 } },
		});
	});
});

test("root rotation rejects a candidate missing the old-root threshold", async () => {
	const built = await fixtureWithKeys();
	built.fetch.objects.set("2.root.json", {
		kind: "ok",
		bytes: await buildRotatingRootChain(built.repository, built.keys, "new"),
	});
	await withStore("root-missing-old", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "threshold-unmet" });
	});
});

test("root rotation rejects a candidate missing the new-root threshold", async () => {
	const built = await fixtureWithKeys();
	built.fetch.objects.set("2.root.json", {
		kind: "ok",
		bytes: await buildRotatingRootChain(built.repository, built.keys, "old"),
	});
	await withStore("root-missing-new", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "threshold-unmet" });
	});
});

test("client keeps never-checked roles distinct when timestamp retrieval is unavailable", async () => {
	const built = await fixtureWithKeys();
	built.fetch.objects.delete("timestamp.json");
	await withStore("client-unavailable", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "unavailable" });
		if (result.ok) return;
		expect(result.partial.roleStatuses).toContainEqual({
			roleName: "timestamp",
			state: "failed",
			reason: "unavailable",
		});
		expect(result.partial.roleStatuses).toContainEqual({
			roleName: "snapshot",
			state: "never-checked",
		});
		expect(result.partial.roleStatuses).toContainEqual({
			roleName: "targets-software",
			state: "never-checked",
		});
	});
});

test("client maps fetcher error to retrieval-failed", async () => {
	const built = await fixtureWithKeys();
	built.fetch.objects.set("timestamp.json", {
		kind: "error",
		error: new Error("offline"),
	});
	await withStore("client-retrieval", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "retrieval-failed" });
	});
});

test("target bytes distinguish length and hash mismatches", async () => {
	const lengthFixture = await fixtureWithKeys();
	lengthFixture.fetch.objects.set("software/release.json", {
		kind: "ok",
		bytes: new Uint8Array(),
	});
	await withStore("client-length", async (store) => {
		const result = await updateTufRepository({
			fetcher: lengthFixture.fetch.fetcher,
			bootstrapRoot: lengthFixture.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "length-mismatch" });
	});

	const hashFixture = await fixtureWithKeys();
	hashFixture.fetch.objects.set("software/release.json", {
		kind: "ok",
		bytes: new TextEncoder().encode(
			"x".repeat(hashFixture.targetBytes.byteLength),
		),
	});
	await withStore("client-hash", async (store) => {
		const result = await updateTufRepository({
			fetcher: hashFixture.fetch.fetcher,
			bootstrapRoot: hashFixture.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "hash-mismatch" });
	});
});

test("authenticated expiration and unsupported spec major reject before child retrieval", async () => {
	const expiredFixture = await fixtureWithKeys();
	const expired = await signMetadataFixture(
		{
			...expiredFixture.repository.timestamp.envelope.signed,
			expires: "2030-01-01T00:00:00Z",
		},
		expiredFixture.keys.timestamp,
	);
	expiredFixture.fetch.objects.set("timestamp.json", {
		kind: "ok",
		bytes: expired,
	});
	await withStore("client-expired", async (store) => {
		const result = await updateTufRepository({
			fetcher: expiredFixture.fetch.fetcher,
			bootstrapRoot: expiredFixture.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "expired" });
	});

	const specFixture = await fixtureWithKeys();
	const unsupported = await signMetadataFixture(
		{
			...specFixture.repository.timestamp.envelope.signed,
			spec_version: "2.0.0",
		},
		specFixture.keys.timestamp,
	);
	specFixture.fetch.objects.set("timestamp.json", {
		kind: "ok",
		bytes: unsupported,
	});
	await withStore("client-spec", async (store) => {
		const result = await updateTufRepository({
			fetcher: specFixture.fetch.fetcher,
			bootstrapRoot: specFixture.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({
			ok: false,
			reason: "unsupported-spec-version",
		});
	});
});

test("expired root is rejected before timestamp retrieval", async () => {
	const built = await fixtureWithKeys();
	const expiredRoot = await signMetadataFixture(
		{
			...built.repository.root.envelope.signed,
			expires: "2030-01-01T00:00:00Z",
		},
		built.keys.root,
	);
	await withStore("expired-root", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: expiredRoot,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "expired" });
		expect(
			built.fetch.requests.some((request) => request.path === "timestamp.json"),
		).toBe(false);
	});
});

test("expired snapshot is rejected after its authenticated retrieval", async () => {
	const built = await fixtureWithKeys();
	await replaceSnapshotAndTimestamp(built, {
		...built.repository.snapshot.envelope.signed,
		expires: "2030-01-01T00:00:00Z",
	});
	await withStore("expired-snapshot", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "expired" });
	});
});

test("expired targets metadata is rejected after snapshot-link verification", async () => {
	const built = await fixtureWithKeys();
	await replaceMetadataAndAncestors(
		built,
		"targets",
		{
			...built.repository.targets.envelope.signed,
			expires: "2030-01-01T00:00:00Z",
		},
		built.keys.targets,
	);
	await withStore("expired-targets", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "expired" });
	});
});

test("expired delegated targets metadata is rejected", async () => {
	const built = await fixtureWithKeys();
	const delegated = built.repository.delegatedTargets.find(
		(metadata) => metadata.roleName === "targets-software",
	);
	const keys = built.keys.delegated["targets-software"];
	if (delegated === undefined || keys === undefined)
		throw new Error("software delegation fixture missing");
	await replaceMetadataAndAncestors(
		built,
		"targets-software",
		{ ...delegated.envelope.signed, expires: "2030-01-01T00:00:00Z" },
		keys,
	);
	await withStore("expired-delegated", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "expired" });
	});
});

test("metadata link mismatch is separate from target byte mismatch", async () => {
	const built = await fixtureWithKeys();
	const filename = metadataFilename("targets", 1, true);
	if (!filename.ok) throw new Error("targets filename failed");
	const current = built.fetch.objects.get(filename.value);
	if (current?.kind !== "ok") throw new Error("targets fixture missing");
	built.fetch.objects.set(filename.value, {
		kind: "ok",
		bytes: new Uint8Array([...current.bytes, 0x20]),
	});
	await withStore("client-snapshot-mismatch", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "snapshot-mismatch" });
	});
});

test("timestamp-to-snapshot descriptor disagreement uses snapshot-mismatch too", async () => {
	const built = await fixtureWithKeys();
	const alteredSnapshot = await signMetadataFixture(
		{
			...built.repository.snapshot.envelope.signed,
			expires: "2030-04-03T03:04:05Z",
		},
		built.keys.snapshot,
	);
	built.fetch.objects.set("1.snapshot.json", {
		kind: "ok",
		bytes: alteredSnapshot,
	});
	await withStore("client-snapshot-mismatch", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "snapshot-mismatch" });
	});
});

test("metadata descriptor version disagreement uses snapshot-mismatch", async () => {
	const result = await validateMetadataDescription(
		{ version: 1, length: 1, hashes: { sha256: "0".repeat(64) } },
		{
			roleName: "targets",
			filename: "2.targets.json",
			version: 2,
			signed: {},
			signatures: [],
			bytes: new Uint8Array([0]),
		},
	);
	expect(result).toMatchObject({ ok: false, reason: "snapshot-mismatch" });
});

test("snapshot dropping an authenticated delegated role is distinct from a malformed link", async () => {
	const built = await fixtureWithKeys();
	const snapshotSigned = built.repository.snapshot.envelope.signed as Record<
		string,
		unknown
	>;
	const meta = Object.fromEntries(
		Object.entries(snapshotSigned.meta as Record<string, unknown>).filter(
			([name]) => name !== "targets-software.json",
		),
	);
	await replaceSnapshotAndTimestamp(built, { ...snapshotSigned, meta });
	await withStore("client-drop", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({
			ok: false,
			reason: "snapshot-role-dropped",
		});
	});
});

test("verified metadata lower than the persisted ledger rejects as version-rollback", async () => {
	const built = await fixtureWithKeys();
	await withStore("client-rollback", async (store) => {
		const initial = await store.replace(undefined, {
			schemaVersion: 1,
			trustedRoot: {
				version: 1,
				envelope: {
					signed: built.repository.root.envelope.signed as Record<
						string,
						never
					>,
					signatures: built.repository.root.envelope.signatures,
				},
			},
			versions: {
				root: 1,
				timestamp: 2,
				snapshot: 1,
				targets: 1,
				delegatedTargets: {},
			},
		});
		expect(initial.ok).toBe(true);
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "version-rollback" });
	});
});

test("snapshot replay below its persisted version rejects as version-rollback", async () => {
	const built = await fixtureWithKeys();
	await withStore("snapshot-rollback", async (store) => {
		const seeded = await store.replace(
			undefined,
			persistedState(built, {
				root: 1,
				timestamp: 1,
				snapshot: 2,
				targets: 1,
				delegatedTargets: {},
			}),
		);
		expect(seeded.ok).toBe(true);
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "version-rollback" });
	});
});

test("targets replay below its persisted version rejects as version-rollback", async () => {
	const built = await fixtureWithKeys();
	await withStore("targets-rollback", async (store) => {
		const seeded = await store.replace(
			undefined,
			persistedState(built, {
				root: 1,
				timestamp: 1,
				snapshot: 1,
				targets: 2,
				delegatedTargets: {},
			}),
		);
		expect(seeded.ok).toBe(true);
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "version-rollback" });
	});
});

test("delegated targets replay below its persisted version rejects as version-rollback", async () => {
	const built = await fixtureWithKeys();
	await withStore("delegated-rollback", async (store) => {
		const seeded = await store.replace(
			undefined,
			persistedState(built, {
				root: 1,
				timestamp: 1,
				snapshot: 1,
				targets: 1,
				delegatedTargets: { "targets-software": 2 },
			}),
		);
		expect(seeded.ok).toBe(true);
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "version-rollback" });
	});
});

test("a failed later target check leaves the persisted trust store byte-identical", async () => {
	const built = await fixtureWithKeys();
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-atomic-"),
	);
	const path = join(directory, "store.json");
	try {
		const store = openFileTrustStore(path);
		const accepted = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(accepted.ok).toBe(true);
		const before = await readFile(path);
		built.fetch.objects.set("software/release.json", {
			kind: "ok",
			bytes: new Uint8Array(),
		});
		const rejected = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: issuedAt,
		});
		expect(rejected).toMatchObject({ ok: false, reason: "length-mismatch" });
		expect(await readFile(path)).toEqual(before);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("a trust-store persistence failure does not recast root verification as failed", async () => {
	const built = await fixtureWithKeys();
	const result = await updateTufRepository({
		fetcher: built.fetch.fetcher,
		bootstrapRoot: built.repository.root.bytes,
		trustStore: {
			async read() {
				return { ok: true as const, value: undefined };
			},
			async replace() {
				return rejection("malformed", {
					path: ["store"],
					expected: "a writable synthetic trust store",
					observed: "deliberate test failure",
				});
			},
		},
		now: issuedAt,
	});
	expect(result).toMatchObject({
		ok: false,
		classification: { kind: "trust-store" },
	});
	if (result.ok) return;
	expect(result.partial.roleStatuses).toContainEqual({
		roleName: "root",
		state: "verified",
		version: 1,
	});
});

test("client snapshots the injected clock before awaited retrievals", async () => {
	const built = await fixtureWithKeys();
	const mutableNow = new Date(issuedAt.getTime());
	let changed = false;
	await withStore("client-clock-snapshot", async (store) => {
		const result = await updateTufRepository({
			fetcher: {
				async fetch(path, maxBytes) {
					if (!changed) {
						changed = true;
						mutableNow.setTime(new Date("2040-01-02T03:04:05Z").getTime());
					}
					return built.fetch.fetcher.fetch(path, maxBytes);
				},
			},
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: mutableNow,
		});
		expect(result).toMatchObject({
			ok: true,
			value: { evaluatedAt: issuedAt.toISOString() },
		});
	});
});

test("equivalent metadata has one fingerprint across separate clients and stores", async () => {
	const built = await fixtureWithKeys();
	const reorderedObjects = new Map(built.fetch.objects);
	const reorderedFetch = createScriptedFetcher(reorderedObjects);
	const timestamp = reorderedObjects.get("timestamp.json");
	if (timestamp?.kind !== "ok") throw new Error("timestamp fixture missing");
	const parsed = JSON.parse(new TextDecoder().decode(timestamp.bytes)) as {
		signed: Record<string, unknown>;
		signatures: unknown;
	};
	reorderedObjects.set("timestamp.json", {
		kind: "ok",
		bytes: new TextEncoder().encode(
			JSON.stringify(
				{
					signatures: parsed.signatures,
					signed: Object.fromEntries(Object.entries(parsed.signed).reverse()),
				},
				null,
				2,
			),
		),
	});

	let firstFingerprint: string | undefined;
	let secondFingerprint: string | undefined;
	await withStore("fingerprint-equivalent-first", async (store) => {
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: new Date(issuedAt.getTime()),
		});
		expect(result.ok).toBe(true);
		if (result.ok) firstFingerprint = result.value.fingerprint;
	});
	await withStore("fingerprint-equivalent-second", async (store) => {
		const result = await updateTufRepository({
			fetcher: reorderedFetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: store,
			now: new Date(issuedAt.getTime()),
		});
		expect(result.ok).toBe(true);
		if (result.ok) secondFingerprint = result.value.fingerprint;
	});
	expect(secondFingerprint).toBe(firstFingerprint);
});

test("partial fingerprints distinguish which delegated role was never checked", async () => {
	const built = await fixtureWithKeys();
	const partialRun = async (
		unavailableRole: "targets-software" | "targets-services",
	): Promise<TufClientPartialView> => {
		const filename = metadataFilename(unavailableRole, 1, true);
		if (!filename.ok)
			throw new Error("delegated fixture metadata filename failed");
		const objects = new Map(built.fetch.objects);
		objects.set(filename.value, { kind: "not-found" });
		let partial: TufClientPartialView | undefined;
		await withStore(
			`partial-${unavailableRole.replaceAll("/", "-")}`,
			async (store) => {
				const result = await updateTufRepository({
					fetcher: createScriptedFetcher(objects).fetcher,
					bootstrapRoot: built.repository.root.bytes,
					trustStore: store,
					now: issuedAt,
				});
				expect(result).toMatchObject({ ok: false, reason: "unavailable" });
				if (!result.ok) partial = result.partial;
			},
		);
		if (partial === undefined)
			throw new Error("partial fingerprint fixture unexpectedly succeeded");
		return partial;
	};

	const softwareUnavailable = await partialRun("targets-software");
	const servicesUnavailable = await partialRun("targets-services");
	const neverChecked = (partial: TufClientPartialView): string[] =>
		partial.roleStatuses
			.filter((status) => status.state === "never-checked")
			.map((status) => status.roleName);
	expect(neverChecked(softwareUnavailable)).toEqual([
		"targets-services",
		"targets-verification",
		"targets-legacy",
	]);
	expect(neverChecked(servicesUnavailable)).toEqual([
		"targets-verification",
		"targets-legacy",
	]);
	expect(softwareUnavailable.fingerprint).not.toBe(
		servicesUnavailable.fingerprint,
	);
});

test("renewal advisories use renewalDays, including its approved timestamp and targets asymmetry", async () => {
	const timestampFixture = await fixtureWithKeys();
	await withStore("timestamp-advisory", async (store) => {
		const result = await updateTufRepository({
			fetcher: timestampFixture.fetch.fetcher,
			bootstrapRoot: timestampFixture.repository.root.bytes,
			trustStore: store,
			now: new Date("2030-01-08T03:04:05Z"),
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.advisories).toContainEqual({
			roleName: "timestamp",
			overdueByMilliseconds: 5 * 86_400_000,
		});
	});

	const configuration: RoleConfiguration = {
		topLevelRoles: {
			...TOP_LEVEL_ROLES,
			timestamp: { ...TOP_LEVEL_ROLES.timestamp, validityDays: 126 },
			snapshot: { ...TOP_LEVEL_ROLES.snapshot, validityDays: 130 },
		},
		delegatedRoles: DELEGATED_ROLES,
	};
	const targetsFixture = await fixtureWithKeys(configuration);
	await withStore("targets-advisory", async (store) => {
		const result = await updateTufRepository({
			fetcher: targetsFixture.fetch.fetcher,
			bootstrapRoot: targetsFixture.repository.root.bytes,
			trustStore: store,
			now: new Date("2030-05-07T03:04:05Z"),
			roleConfiguration: configuration,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.advisories).toContainEqual({
			roleName: "targets",
			overdueByMilliseconds: 5 * 86_400_000,
		});
	});
});

test("client rejects a corrupt trust store before retrieving repository metadata", async () => {
	const built = await fixtureWithKeys();
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-tuf-corrupt-"),
	);
	const path = join(directory, "store.json");
	try {
		await writeFile(path, "not a trust store");
		const result = await updateTufRepository({
			fetcher: built.fetch.fetcher,
			bootstrapRoot: built.repository.root.bytes,
			trustStore: openFileTrustStore(path),
			now: issuedAt,
		});
		expect(result).toMatchObject({ ok: false, reason: "trust-store-corrupt" });
		expect(built.fetch.requests).toEqual([]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
