// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { signEvidenceRecord } from "./records/build-evidence-record";
import { descriptorDigest } from "./records/migration-manifest";
import { RELEASE_RECORD_PREDICATE_TYPE } from "./records/predicates";
import { basePolicy } from "./records/records.test-support";
import {
	RELEASE_RECORD_SCHEMA,
	type ReleaseArtifact,
} from "./records/release-record";
import {
	type PublicFetch,
	type ReleaseVerifierOptions,
	auditDeliveryHeads,
	authenticateRepository,
	releaseDescriptorBytes,
	verifyRelease,
} from "./release-verifier";
import { buildRepository } from "./tuf/builder";
import { canonicalizeTufJson } from "./tuf/canonical";
import { generateEd25519SigningKey } from "./tuf/ed25519";
import {
	generateSyntheticKeySet,
	loadRepositorySigningKeys,
} from "./tuf/keyset";
import { type TufJsonValue, type TufResult, rejection } from "./tuf/outcome";
import { metadataFilename } from "./tuf/serializer";
import { targetStoragePath } from "./tuf/target-storage";
import type { TrustStoreState, TufTrustStore } from "./tuf/trust-store";

const now = new Date("2027-06-01T00:00:00.000Z");
const metadataBase = "https://evidence.example/staging/v2/metadata/";
const targetsBase = "https://evidence.example/staging/v2/targets/";
const artifactUrl = "https://delivery.example/journal/2.0.0/archive.tar.gz";
const latestUrl = "https://delivery.example/journal/release/latest";
const targetPath = "software/journal/2.0.0/release-record.json";
const encode = (text: string) => new TextEncoder().encode(text);
const hash = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");
function must<T>(result: TufResult<T>): T {
	if (!result.ok) throw new Error(`synthetic fixture: ${result.reason}`);
	return result.value;
}
function canonical(value: unknown): Uint8Array {
	return must(canonicalizeTufJson(value));
}
function memoryStore(): TufTrustStore {
	let state: TrustStoreState | undefined;
	let revision: string | undefined;
	return {
		async read() {
			return {
				ok: true,
				value:
					state && revision
						? { state: structuredClone(state), revision }
						: undefined,
			};
		},
		async replace(expected, next) {
			if (expected !== revision)
				return rejection("malformed", {
					path: [],
					expected,
					observed: revision,
				});
			state = structuredClone(next);
			revision = String(Number(revision ?? "0") + 1);
			return { ok: true, value: undefined };
		},
	};
}
interface FixtureOptions {
	collision?: "root" | "delegated";
	signer?: "audit" | "unknown";
	policyMismatch?: boolean;
	subjectName?: string;
	predicateProduct?: string;
	emptyArtifacts?: boolean;
	omitRecord?: boolean;
	future?: boolean;
	compromised?: boolean;
	badSignatureAndPayload?: boolean;
	artifactUrl?: string;
	policyVersionMismatch?: boolean;
}
async function fixture(options: FixtureOptions = {}) {
	// Every key and every artifact in this fixture is synthetic and memory-only.
	const keys = must(
		await loadRepositorySigningKeys(await generateSyntheticKeySet()),
	);
	const audit = must(await generateEd25519SigningKey());
	const unknown = must(await generateEd25519SigningKey());
	const producer =
		options.collision === "root"
			? keys.signingKeys.root[0]
			: options.collision === "delegated"
				? keys.signingKeys.delegated["targets-software"]?.[0]
				: keys.dsseSigner;
	if (!producer) throw new Error("missing synthetic collision key");
	const policy = basePolicy(producer, audit);
	if (options.compromised)
		policy.roles = policy.roles.map((role) =>
			role.id === "producer.release" ? { ...role, compromised: true } : role,
		);
	if (options.policyVersionMismatch) policy.version = 2;
	const policyBytes = canonical(policy);
	const artifact = encode("wholly synthetic archive bytes");
	const artifacts: ReleaseArtifact[] = options.emptyArtifacts
		? []
		: [
				{
					url: options.artifactUrl ?? artifactUrl,
					length: artifact.length,
					sha256: hash(artifact),
				},
			];
	const record = must(
		await signEvidenceRecord({
			predicateType: RELEASE_RECORD_PREDICATE_TYPE,
			predicate: {
				_comment: ["synthetic release fixture"],
				schema: RELEASE_RECORD_SCHEMA,
				product: options.predicateProduct ?? "journal",
				version: "2.0.0",
				artifacts,
				does_prove: ["synthetic assertion"],
				does_not_prove: ["software safety"],
			} as unknown as TufJsonValue,
			subjectName: options.subjectName ?? "software/journal/2.0.0",
			subjectSha256: await descriptorDigest(artifacts),
			policySha256: options.policyMismatch ? "0".repeat(64) : hash(policyBytes),
			issuedAt: options.future ? "2027-06-02T00:00:00.000Z" : now.toISOString(),
			signingKeys: [
				options.signer === "audit"
					? audit
					: options.signer === "unknown"
						? unknown
						: producer,
			],
		}),
	);
	if (options.badSignatureAndPayload)
		record.envelope = { ...record.envelope, payload: btoa("{broken") };
	const targetBytes = new Map<string, Uint8Array>([
		["policy/dsse-authorization/1.json", policyBytes],
		[
			"keys/dsse/1.json",
			canonical({
				schema: "solstone-transparency/dsse-keys/v1",
				keys: {
					[producer.keyId]: producer.keyObject,
					[audit.keyId]: audit.keyObject,
				},
			}),
		],
	]);
	if (!options.omitRecord) targetBytes.set(targetPath, canonical(record));
	const repository = must(
		await buildRepository({
			signingKeys: keys.signingKeys,
			consistentSnapshot: true,
			now,
			targets: Object.fromEntries(
				[...targetBytes].map(([path, bytes]) => [
					path,
					{ length: bytes.length, hashes: { sha256: hash(bytes) } },
				]),
			),
		}),
	);
	const objects = new Map<string, Uint8Array>();
	for (const metadata of [
		repository.root,
		repository.targets,
		repository.snapshot,
		repository.timestamp,
		...repository.delegatedTargets,
	])
		objects.set(
			metadataBase +
				must(metadataFilename(metadata.roleName, metadata.version, true)),
			metadata.bytes,
		);
	for (const [path, bytes] of targetBytes) {
		objects.set(
			targetsBase +
				must(
					targetStoragePath(path, {
						sha256: hash(bytes),
						consistentSnapshot: true,
					}),
				),
			bytes,
		);
	}
	objects.set(artifactUrl, artifact);
	objects.set(latestUrl, encode("version=2.0.0\n"));
	const requests: { url: string; init?: RequestInit }[] = [];
	const fetcher: PublicFetch = async (url, init) => {
		requests.push({ url, init });
		const bytes = objects.get(url);
		return bytes
			? new Response(bytes.slice())
			: new Response(null, { status: 404 });
	};
	const input: ReleaseVerifierOptions = {
		bootstrapRoot: repository.root.bytes,
		trustStore: memoryStore(),
		metadataBase,
		targetsBase,
		now,
		fetch: fetcher,
	};
	return {
		input,
		objects,
		requests,
		artifact,
		fetcher,
		keys,
		repository,
		targetBytes,
	};
}
const verify = (input: ReleaseVerifierOptions) =>
	verifyRelease({ ...input, product: "journal", version: "2.0.0" });

test("artifact URL tampering is rejected before the authentic bytes are accepted", async () => {
	const built = await fixture();
	built.objects.set(artifactUrl, encode("x".repeat(built.artifact.length)));
	expect(await verify(built.input)).toMatchObject({
		ok: false,
		link: "artifact",
		reason: "hash-mismatch",
	});
	built.objects.set(artifactUrl, built.artifact);
	expect(await verify(built.input)).toMatchObject({
		ok: true,
		product: "journal",
		version: "2.0.0",
		recordPath: targetPath,
		recordSha256: hash(built.targetBytes.get(targetPath) ?? new Uint8Array()),
		policyVersion: 1,
	});
});

test("an audit signer cannot assert a producer release and an unknown signer stays unknown", async () => {
	const audit = await fixture({ signer: "audit" });
	expect(await verify(audit.input)).toMatchObject({
		ok: false,
		link: "dsse",
		reason: "role-not-authorized",
	});
	const unknown = await fixture({ signer: "unknown" });
	expect(await verify(unknown.input)).toMatchObject({
		ok: false,
		link: "dsse",
		reason: "unknown-key",
	});
});

test("policy digest and version mismatches reject authenticated but unbound records", async () => {
	const mismatch = await fixture({ policyMismatch: true });
	expect(await verify(mismatch.input)).toMatchObject({
		ok: false,
		link: "policy",
		reason: "policy-sha256-mismatch",
	});
	const version = await fixture({ policyVersionMismatch: true });
	expect(await verify(version.input)).toMatchObject({
		ok: false,
		link: "policy",
		reason: "policy-version-mismatch",
	});
});

test("target, subject and predicate product/version must describe the same release", async () => {
	const wrongSubject = await fixture({ subjectName: "software/journal/other" });
	expect(await verify(wrongSubject.input)).toMatchObject({
		ok: false,
		link: "subject",
		reason: "subject-mismatch",
	});
	const wrongProduct = await fixture({ predicateProduct: "linux" });
	expect(await verify(wrongProduct.input)).toMatchObject({
		ok: false,
		link: "subject",
		reason: "subject-mismatch",
	});
});

test("DSSE cryptographic rejection precedes parsing a malformed statement", async () => {
	const built = await fixture({ badSignatureAndPayload: true });
	expect(await verify(built.input)).toMatchObject({
		ok: false,
		link: "dsse",
		reason: "signature-invalid",
	});
});

test("future issuance, suspect keys and empty artifacts are refused", async () => {
	const future = await fixture({ future: true });
	expect(await verify(future.input)).toMatchObject({
		ok: false,
		link: "record",
		reason: "future-issued-at",
	});
	const suspect = await fixture({ compromised: true });
	expect(await verify(suspect.input)).toMatchObject({
		ok: false,
		link: "dsse",
		reason: "suspect-key",
	});
	const empty = await fixture({ emptyArtifacts: true });
	expect(await verify(empty.input)).toMatchObject({
		ok: false,
		link: "artifact",
		reason: "artifacts-empty",
	});
});

test("authenticated TUF bytes are consumed once and never replaced by an unauthenticated refetch", async () => {
	const built = await fixture();
	expect(await verify(built.input)).toMatchObject({ ok: true });
	const counts = new Map<string, number>();
	for (const request of built.requests)
		counts.set(request.url, (counts.get(request.url) ?? 0) + 1);
	for (const count of counts.values()) expect(count).toBe(1);
	expect(
		built.requests.some((request) =>
			request.url.includes("release-record.json"),
		),
	).toBe(true);
	for (const request of built.requests) {
		expect(request.init?.redirect).toBe("error");
		expect(request.init?.credentials).toBe("omit");
		expect(request.init?.signal).toBeDefined();
	}
});

test("expired timestamp and damaged pinned root reject before artifact fetching", async () => {
	const stale = await fixture();
	expect(
		await verify({
			...stale.input,
			now: new Date(now.getTime() + 8 * 86_400_000),
		}),
	).toMatchObject({ ok: false, link: "tuf", reason: "expired" });
	expect(stale.requests.some((request) => request.url === artifactUrl)).toBe(
		false,
	);
	const corrupt = await fixture();
	expect(
		await verify({ ...corrupt.input, bootstrapRoot: encode("{}") }),
	).toMatchObject({ ok: false, link: "root" });
});

test("streamed artifact length limits reject oversized and truncated responses", async () => {
	const huge = await fixture();
	huge.objects.set(artifactUrl, encode("x".repeat(huge.artifact.length + 1)));
	expect(await verify(huge.input)).toMatchObject({
		ok: false,
		link: "artifact",
		reason: "response-too-large",
	});
	const short = await fixture();
	short.objects.set(artifactUrl, short.artifact.slice(1));
	expect(await verify(short.input)).toMatchObject({
		ok: false,
		link: "artifact",
		reason: "length-mismatch",
	});
});

test("artifact URLs reject plaintext transport, credentials and fragments", async () => {
	for (const url of [
		"http://delivery.example/file",
		"https://user:pass@delivery.example/file",
		"https://delivery.example/file#part",
	]) {
		const built = await fixture({ artifactUrl: url });
		expect(await verify(built.input)).toMatchObject({
			ok: false,
			link: "artifact",
			reason: "unsafe-url",
		});
		expect(built.requests.some((request) => request.url === url)).toBe(false);
	}
});

test("delivery-head audit reports a withheld record as a gap, then accepts published evidence", async () => {
	const lanes = [
		{ product: "journal", latestUrl, format: "version-line" as const },
	];
	const missing = await fixture({ omitRecord: true });
	expect(await auditDeliveryHeads(lanes, missing.input)).toMatchObject({
		coverage: "delivery-heads-only",
		ok: false,
		heads: [
			{
				state: "gap",
				product: "journal",
				version: "2.0.0",
				reason: "record-missing",
			},
		],
	});
	const present = await fixture();
	expect(await auditDeliveryHeads(lanes, present.input)).toMatchObject({
		coverage: "delivery-heads-only",
		ok: true,
		heads: [{ state: "accepted", version: "2.0.0" }],
	});
});

test("lane unavailability and a present rejected record remain distinct from an evidence gap", async () => {
	const missingLane = await fixture();
	missingLane.objects.delete(latestUrl);
	expect(
		await auditDeliveryHeads(
			[{ product: "journal", latestUrl, format: "version-line" }],
			missingLane.input,
		),
	).toMatchObject({
		ok: false,
		heads: [{ state: "lane-unavailable", reason: "http-404" }],
	});
	const badRecord = await fixture({ policyMismatch: true });
	expect(
		await auditDeliveryHeads(
			[{ product: "journal", latestUrl, format: "version-line" }],
			badRecord.input,
		),
	).toMatchObject({
		ok: false,
		heads: [
			{ state: "rejected", link: "policy", reason: "policy-sha256-mismatch" },
		],
	});
});

test("GitHub delivery heads use tag_name and version-line lanes reject ambiguous heads", async () => {
	const github = await fixture();
	github.objects.set(
		latestUrl,
		encode(JSON.stringify({ tag_name: "v2.0.0", draft: false })),
	);
	expect(
		await auditDeliveryHeads(
			[{ product: "journal", latestUrl, format: "github-release" }],
			github.input,
		),
	).toMatchObject({
		ok: true,
		heads: [{ state: "accepted", version: "2.0.0" }],
	});
	const ambiguous = await fixture();
	ambiguous.objects.set(latestUrl, encode("version=2.0.0\nversion=2.0.1\n"));
	expect(
		await auditDeliveryHeads(
			[{ product: "journal", latestUrl, format: "version-line" }],
			ambiguous.input,
		),
	).toMatchObject({
		ok: false,
		heads: [{ state: "lane-unavailable", reason: "lane-version-malformed" }],
	});
});

test("descriptor subject bytes match the independently used descriptorDigest preimage", async () => {
	const artifacts = [
		{ url: "https://example.test/z", length: 12, sha256: "0".repeat(64) },
		{ url: "https://example.test/a", length: 3, sha256: "1".repeat(64) },
	];
	expect(hash(releaseDescriptorBytes(artifacts))).toBe(
		await descriptorDigest(artifacts),
	);
});

test("policy loading rejects both root and delegated TUF signer collisions", async () => {
	for (const collision of ["root", "delegated"] as const) {
		const built = await fixture({ collision });
		expect(await verify(built.input)).toMatchObject({
			ok: false,
			link: "policy",
			reason: "degenerate-role-configuration",
		});
	}
});

test("invalid release coordinates fail before any network request", async () => {
	const built = await fixture();
	expect(
		await verifyRelease({
			...built.input,
			product: "../journal",
			version: "2.0.0",
		}),
	).toMatchObject({ ok: false, reason: "invalid-coordinate" });
	expect(built.requests).toHaveLength(0);
});

test("an artifact fetch deadline produces a distinct timeout rejection", async () => {
	const built = await fixture();
	const injected: PublicFetch = async (url, init) => {
		if (url !== artifactUrl) return built.fetcher(url, init);
		return new Promise((_resolve, reject) => {
			const fallback = setTimeout(
				() => reject(new Error("test deadline exceeded")),
				1000,
			);
			init?.signal?.addEventListener(
				"abort",
				() => {
					clearTimeout(fallback);
					reject(new Error("aborted"));
				},
				{ once: true },
			);
		});
	};
	expect(
		await verify({ ...built.input, timeoutMs: 5, fetch: injected }),
	).toMatchObject({ ok: false, link: "artifact", reason: "timeout" });
});

test("consistent snapshots reject a repository serving only raw target names", async () => {
	const built = await fixture();
	for (const [path, bytes] of built.targetBytes) {
		built.objects.delete(
			targetsBase +
				must(
					targetStoragePath(path, {
						sha256: hash(bytes),
						consistentSnapshot: true,
					}),
				),
		);
		built.objects.set(targetsBase + path, bytes);
	}
	expect(await verify(built.input)).toMatchObject({ ok: false, link: "tuf" });
	for (const path of built.targetBytes.keys())
		expect(
			built.requests.some((request) => request.url === targetsBase + path),
		).toBe(false);
});

test("authenticated view keeps the exact store commit, every TUF key namespace, and independent byte copies", async () => {
	const built = await fixture();
	const store = built.input.trustStore;
	let reads = 0;
	const view = await authenticateRepository({
		...built.input,
		trustStore: {
			async read() {
				if (++reads !== 1)
					throw new Error("unexpected post-verification store read");
				return store.read();
			},
			async replace(revision, state) {
				const stored = await store.replace(revision, state);
				// A store implementation may retain and change its own argument after writing.
				// It must not mutate the client's authenticated envelope or our captured commit.
				state.trustedRoot.envelope.signed.version = 999;
				return stored;
			},
		},
	});
	expect(reads).toBe(1);
	expect(
		JSON.parse(new TextDecoder().decode(view.rootBytes)).signed.version,
	).toBe(1);
	expect(view.versions.root).toBe(1);
	expect(view.metadata.has("1.root.json")).toBe(true);
	expect(view.metadata.has("bootstrap.root.json")).toBe(false);
	const expectedKeys = [
		...built.keys.signingKeys.root,
		...built.keys.signingKeys.targets,
		...built.keys.signingKeys.snapshot,
		...built.keys.signingKeys.timestamp,
		...Object.values(built.keys.signingKeys.delegated).flat(),
	].map((key) => key.keyId);
	expect([...view.tufKeyids].sort()).toEqual(expectedKeys.sort());
	expect([...view.topLevelTargets].sort()).toEqual([
		"keys/dsse/1.json",
		"policy/dsse-authorization/1.json",
	]);
	const preservedRoot = view.metadata.get("1.root.json")?.slice();
	if (!preservedRoot) throw new Error("authenticated root missing");
	view.rootBytes.fill(0);
	expect(view.metadata.get("1.root.json")).toEqual(preservedRoot);
	expect(built.repository.root.bytes).toEqual(preservedRoot);
	const target = view.bytes.get(targetPath);
	expect(target).toEqual(built.targetBytes.get(targetPath));
	target?.fill(0);
	expect(target).not.toEqual(built.targetBytes.get(targetPath));
});

test("an unsuccessful trust-store commit cannot expose an authenticated repository view", async () => {
	const built = await fixture();
	await expect(
		authenticateRepository({
			...built.input,
			trustStore: {
				read: () => built.input.trustStore.read(),
				async replace() {
					return rejection("malformed", {
						path: [],
						expected: "synthetic successful commit",
						observed: "synthetic refusal",
					});
				},
			},
		}),
	).rejects.toThrow("malformed");
});
