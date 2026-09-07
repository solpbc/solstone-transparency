// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { run } from "./cli";
import { buildDsseAuthorizationPolicyTargets } from "./v2/records/dsse-policy-builder";
import { RELEASE_RECORD_SCHEMA } from "./v2/records/release-record";
import { buildRepository } from "./v2/tuf/builder";
import { generateEd25519SigningKey } from "./v2/tuf/ed25519";
import {
	generateSyntheticKeySet,
	loadRepositorySigningKeys,
} from "./v2/tuf/keyset";
import { authenticateLocalRepository } from "./v2/tuf/local-repository";
import { serializeRepository } from "./v2/tuf/serializer";
import { targetStoragePath } from "./v2/tuf/target-storage";

async function capture(
	fn: () => Promise<number>,
): Promise<{ code: number; out: string[] }> {
	const out: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => {
		out.push(args.join(" "));
	};
	try {
		const code = await fn();
		return { code, out };
	} finally {
		console.log = original;
	}
}

async function cliRepositoryFixture() {
	const directory = await mkdtemp("/var/tmp/solstone-cli-");
	const repositoryDirectory = join(directory, "repository");
	const generated = await generateSyntheticKeySet();
	const loaded = await loadRepositorySigningKeys(generated);
	if (!loaded.ok)
		throw new Error(`synthetic key load failed: ${loaded.reason}`);
	const now = new Date("2030-01-02T03:04:05.000Z");
	const built = await buildRepository({
		signingKeys: loaded.value.signingKeys,
		targets: {},
		consistentSnapshot: true,
		now,
	});
	if (!built.ok) throw new Error(`repository build failed: ${built.reason}`);
	const metadata = await serializeRepository(
		built.value,
		join(repositoryDirectory, "metadata"),
	);
	if (!metadata.ok)
		throw new Error(`metadata serialization failed: ${metadata.reason}`);
	const timestampSha256 = Array.from(
		new Uint8Array(
			await crypto.subtle.digest(
				"SHA-256",
				new Uint8Array(built.value.timestamp.bytes),
			),
		),
		(byte) => byte.toString(16).padStart(2, "0"),
	).join("");
	return { directory, repositoryDirectory, generated, now, timestampSha256 };
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

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

describe("run", () => {
	test("--help prints usage and exits 0", async () => {
		const { code, out } = await capture(() => run(["--help"]));
		expect(code).toBe(0);
		expect(out.join("\n")).toContain("Usage: solstone-transparency");
	});

	test("no arguments also prints usage and exits 0", async () => {
		const { code, out } = await capture(() => run([]));
		expect(code).toBe(0);
		expect(out.join("\n")).toContain("Usage: solstone-transparency");
	});

	test("--version prints the installed version and exits 0", async () => {
		const { code, out } = await capture(() => run(["--version"]));
		expect(code).toBe(0);
		expect(out[0]).toMatch(/^\d+\.\d+\.\d+/);
	});

	test("legacy-model without --out fails with a clear message and exits 1", async () => {
		const code = await run(["legacy-model"]);
		expect(code).toBe(1);
	});

	test("--help includes publish-v2 usage and options", async () => {
		const { code, out } = await capture(() => run(["--help"]));
		expect(code).toBe(0);
		const fullText = out.join("\n");
		expect(fullText).toContain("publish-v2 --artifacts <path>");
		expect(fullText).toContain(
			"publish-v2          Build and publish a v2 TUF repository",
		);
	});

	test("publish-v2 missing required flags fails with exit code 1", async () => {
		expect(await run(["publish-v2"])).toBe(1);
		expect(await run(["publish-v2", "--artifacts", "foo.json"])).toBe(1);
		expect(
			await run([
				"publish-v2",
				"--artifacts",
				"foo.json",
				"--product",
				"journal",
			]),
		).toBe(1);
		expect(
			await run([
				"publish-v2",
				"--artifacts",
				"foo.json",
				"--product",
				"journal",
				"--keys",
				"keys.json",
			]),
		).toBe(1);
		expect(
			await run([
				"publish-v2",
				"--artifacts",
				"foo.json",
				"--product",
				"journal",
				"--keys",
				"keys.json",
				"--policy-sha256",
				"a".repeat(64),
			]),
		).toBe(1);
	});

	test("verify-v2 requires a locally trusted root file", async () => {
		expect(await run(["verify-v2"])).toBe(1);
	});

	test("--help documents all incremental preparation commands", async () => {
		const { out } = await capture(() => run(["--help"]));
		const help = out.join("\n");
		expect(help).toContain("policy build --root <file>");
		expect(help).toContain("release prepare --root <file>");
		expect(help).toContain("timestamp refresh --root <file>");
		expect(help).toContain("metadata renew <role>");
		expect(help).toContain("targets-legacy");
	});

	test("policy build, timestamp refresh, and metadata renew prepare complete output packages", async () => {
		const fixture = await cliRepositoryFixture();
		try {
			const producer = await generateEd25519SigningKey();
			if (!producer.ok)
				throw new Error("synthetic producer key generation failed");
			const producerPath = join(fixture.directory, "producer.json");
			await writeFile(
				producerPath,
				JSON.stringify([{ public: producer.value.keyObject.keyval.public }]),
			);
			const rootPath = join(
				fixture.repositoryDirectory,
				"metadata",
				"1.root.json",
			);
			const policyOut = join(fixture.directory, "policy-out");
			expect(
				await run([
					"policy",
					"build",
					"--root",
					rootPath,
					"--repository",
					fixture.repositoryDirectory,
					"--expected-timestamp-sha256",
					fixture.timestampSha256,
					"--version",
					"1",
					"--effective-from",
					fixture.now.toISOString(),
					"--producer-release-keys",
					producerPath,
					"--out",
					policyOut,
					"--now",
					fixture.now.toISOString(),
				]),
			).toBe(0);
			const timestampKeysPath = join(fixture.directory, "timestamp-keys.json");
			await writeFile(
				timestampKeysPath,
				JSON.stringify({ timestamp: fixture.generated.timestamp[0] }),
			);
			const refreshOut = join(fixture.directory, "refresh-out");
			expect(
				await run([
					"timestamp",
					"refresh",
					"--root",
					rootPath,
					"--repository",
					fixture.repositoryDirectory,
					"--expected-timestamp-sha256",
					fixture.timestampSha256,
					"--keys",
					timestampKeysPath,
					"--out",
					refreshOut,
					"--now",
					fixture.now.toISOString(),
				]),
			).toBe(0);
			const manifest = JSON.parse(
				await readFile(join(refreshOut, "manifest.json"), "utf-8"),
			) as { operation: string; files: { path: string }[] };
			expect(manifest.operation).toBe("timestamp refresh");
			expect(manifest.files).toHaveLength(8);
			expect(manifest.files.map((file) => file.path)).toContain(
				"metadata/timestamp.json",
			);
			const legacyKeysPath = join(fixture.directory, "legacy-keys.json");
			await writeFile(
				legacyKeysPath,
				JSON.stringify({
					"targets-legacy": fixture.generated.delegated["targets-legacy"]?.[0],
					snapshot: fixture.generated.snapshot[0],
					timestamp: fixture.generated.timestamp[0],
				}),
			);
			const legacyOut = join(fixture.directory, "legacy-out");
			expect(
				await run([
					"metadata",
					"renew",
					"targets-legacy",
					"--root",
					rootPath,
					"--repository",
					fixture.repositoryDirectory,
					"--expected-timestamp-sha256",
					fixture.timestampSha256,
					"--keys",
					legacyKeysPath,
					"--out",
					legacyOut,
					"--now",
					fixture.now.toISOString(),
				]),
			).toBe(0);
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	});

	test("release prepare composes two independently verifiable repository trees", async () => {
		const directory = await mkdtemp("/var/tmp/solstone-cli-release-");
		const repositoryDirectory = join(directory, "genesis");
		const now = new Date("2030-01-02T03:04:05.000Z");
		try {
			const generated = await generateSyntheticKeySet();
			const loaded = await loadRepositorySigningKeys(generated);
			if (!loaded.ok) throw new Error(`key load failed: ${loaded.reason}`);
			const producer = await generateEd25519SigningKey();
			if (!producer.ok)
				throw new Error("synthetic producer key generation failed");
			const producerPkcs8 = new Uint8Array(
				await crypto.subtle.exportKey("pkcs8", producer.value.privateKey),
			);
			const producerEntry = {
				keyid: producer.value.keyId,
				public: producer.value.keyObject.keyval.public,
				pkcs8: bytesToBase64(producerPkcs8),
			};
			const signingKeys = loaded.value.signingKeys;
			const tufRoleKeyids = [
				...signingKeys.root,
				...signingKeys.targets,
				...signingKeys.snapshot,
				...signingKeys.timestamp,
				...Object.values(signingKeys.delegated).flat(),
			].map((key) => key.keyId);
			const policy = await buildDsseAuthorizationPolicyTargets({
				version: 1,
				effectiveFrom: now.toISOString(),
				now,
				producerReleaseKeys: [{ keyObject: producer.value.keyObject }],
				tufRoleKeyids,
			});
			if (!policy.ok) throw new Error(`policy build failed: ${policy.reason}`);
			const policyTargets = [
				[policy.value.policyLogicalPath, policy.value.policyBytes],
				[policy.value.keysLogicalPath, policy.value.keysTargetBytes],
			] as const;
			const targets: Record<
				string,
				{ length: number; hashes: { sha256: string } }
			> = {};
			for (const [logicalPath, bytes] of policyTargets) {
				targets[logicalPath] = {
					length: bytes.byteLength,
					hashes: { sha256: await sha256(bytes) },
				};
			}
			const genesis = await buildRepository({
				signingKeys,
				targets,
				consistentSnapshot: true,
				now,
			});
			if (!genesis.ok)
				throw new Error(`genesis build failed: ${genesis.reason}`);
			const metadata = await serializeRepository(
				genesis.value,
				join(repositoryDirectory, "metadata"),
			);
			if (!metadata.ok)
				throw new Error(`genesis serialization failed: ${metadata.reason}`);
			for (const [logicalPath, bytes] of policyTargets) {
				const descriptor = targets[logicalPath];
				if (descriptor === undefined)
					throw new Error("policy descriptor missing");
				const storage = targetStoragePath(logicalPath, {
					sha256: descriptor.hashes.sha256,
					consistentSnapshot: true,
				});
				if (!storage.ok)
					throw new Error(`storage path failed: ${storage.reason}`);
				const path = join(repositoryDirectory, "targets", storage.value);
				await mkdir(dirname(path), { recursive: true });
				await writeFile(path, bytes);
			}
			const rootPath = join(repositoryDirectory, "metadata", "1.root.json");
			const genesisTimestampSha256 = await sha256(
				genesis.value.timestamp.bytes,
			);
			const releaseKeysPath = join(directory, "release-keys.json");
			await writeFile(
				releaseKeysPath,
				JSON.stringify({
					"targets-software": generated.delegated["targets-software"]?.[0],
					snapshot: generated.snapshot[0],
					timestamp: generated.timestamp[0],
					"producer.release": producerEntry,
				}),
			);
			const releaseInput = async (version: string) => {
				const artifacts = [
					{
						url: `https://example.test/software/journal/${version}/journal.tar.gz`,
						length: 123,
						sha256: "a".repeat(64),
					},
				];
				const path = join(directory, `release-${version}.json`);
				await writeFile(
					path,
					JSON.stringify({
						product: "journal",
						version,
						releasePredicate: {
							_comment: ["synthetic CLI release"],
							schema: RELEASE_RECORD_SCHEMA,
							product: "journal",
							version,
							artifacts,
							does_prove: ["synthetic release"],
							does_not_prove: ["defect-free"],
						},
						artifactDescriptors: artifacts,
					}),
				);
				return path;
			};
			const firstRelease = await releaseInput("2.0.0");
			const firstOutput = join(directory, "first-output");
			expect(
				await run([
					"release",
					"prepare",
					"--root",
					rootPath,
					"--repository",
					repositoryDirectory,
					"--expected-timestamp-sha256",
					genesisTimestampSha256,
					"--keys",
					releaseKeysPath,
					"--release-record",
					firstRelease,
					"--out",
					firstOutput,
					"--now",
					now.toISOString(),
				]),
			).toBe(0);
			const firstManifest = JSON.parse(
				await readFile(join(firstOutput, "manifest.json"), "utf-8"),
			) as { new_timestamp_sha256: string | null };
			if (firstManifest.new_timestamp_sha256 === null) {
				throw new Error(
					"release preparation manifest omitted timestamp digest",
				);
			}
			const firstAuthenticated = await authenticateLocalRepository({
				repositoryDirectory: firstOutput,
				rootPath,
				expectedTimestampSha256: firstManifest.new_timestamp_sha256,
				now,
			});
			expect(firstAuthenticated.ok).toBe(true);
			if (!firstAuthenticated.ok) return;
			const firstTimestampSha256 = await sha256(
				firstAuthenticated.value.authenticatedMetadata.timestamp
					?.bytes as Uint8Array,
			);
			const secondRelease = await releaseInput("2.0.1");
			const secondOutput = join(directory, "second-output");
			expect(
				await run([
					"release",
					"prepare",
					"--root",
					rootPath,
					"--repository",
					firstOutput,
					"--expected-timestamp-sha256",
					firstTimestampSha256,
					"--keys",
					releaseKeysPath,
					"--release-record",
					secondRelease,
					"--out",
					secondOutput,
					"--now",
					now.toISOString(),
				]),
			).toBe(0);
			const secondManifest = JSON.parse(
				await readFile(join(secondOutput, "manifest.json"), "utf-8"),
			) as { new_timestamp_sha256: string | null };
			if (secondManifest.new_timestamp_sha256 === null) {
				throw new Error(
					"release preparation manifest omitted timestamp digest",
				);
			}
			const secondAuthenticated = await authenticateLocalRepository({
				repositoryDirectory: secondOutput,
				rootPath,
				expectedTimestampSha256: secondManifest.new_timestamp_sha256,
				now,
			});
			expect(secondAuthenticated.ok).toBe(true);
			const firstTarget =
				firstAuthenticated.value.authenticatedTargets["targets-software"]?.[
					"software/journal/2.0.0/release-record.json"
				];
			if (firstTarget === undefined)
				throw new Error("first release target missing");
			const firstStorage = targetStoragePath(firstTarget.logicalPath, {
				sha256: firstTarget.descriptor.hashes.sha256 ?? "",
				consistentSnapshot: true,
			});
			if (!firstStorage.ok) throw new Error("first target storage path failed");
			expect(
				await readFile(join(secondOutput, "targets", firstStorage.value)),
			).toEqual(
				await readFile(join(firstOutput, "targets", firstStorage.value)),
			);
			for (const filename of [
				"1.root.json",
				"1.targets.json",
				"1.targets-services.json",
				"1.targets-verification.json",
				"1.targets-legacy.json",
			]) {
				const genesisBytes = await readFile(
					join(repositoryDirectory, "metadata", filename),
				);
				expect(await readFile(join(firstOutput, "metadata", filename))).toEqual(
					genesisBytes,
				);
				expect(
					await readFile(join(secondOutput, "metadata", filename)),
				).toEqual(genesisBytes);
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
