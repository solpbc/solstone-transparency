// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishRepository } from "./publish-cli";
import { RELEASE_RECORD_SCHEMA } from "./records/release-record";
import { generateSyntheticKeySet } from "./tuf/keyset";
import { verifyRepository } from "./verify-cli";

describe("publish-cli and end-to-end TUF round-trip", () => {
	let testDir: string;
	let keysPath: string;
	let artifactsPath: string;
	const dummyPolicyHex = "a".repeat(64);

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "solstone-publish-test-"));
		keysPath = join(testDir, "keys.json");
		artifactsPath = join(testDir, "artifacts.json");

		const keysJson = await generateSyntheticKeySet();
		await writeFile(keysPath, JSON.stringify(keysJson));

		const artifacts = {
			_comment: ["Release evidence fixture"],
			schema: RELEASE_RECORD_SCHEMA,
			product: "journal",
			version: "1.0.23",
			artifacts: [
				{
					url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.23/journal-1.0.23.tar.gz",
					length: 1234,
					sha256: "b".repeat(64),
				},
			],
			does_prove: ["sol pbc built and published this artifact"],
			does_not_prove: ["defect-free"],
		};
		await writeFile(artifactsPath, JSON.stringify(artifacts));
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("fails closed on missing or malformed artifacts file", async () => {
		const outDir = join(testDir, "out-bad-art");
		const code = await publishRepository({
			artifactsPath: join(testDir, "nonexistent.json"),
			product: "journal",
			keysPath,
			policySha256: dummyPolicyHex,
			outDir,
		});
		expect(code).toBe(1);
		expect(await readdir(testDir)).not.toContain("out-bad-art");
	});

	test("fails closed on unknown product name", async () => {
		const outDir = join(testDir, "out-bad-prod");
		const code = await publishRepository({
			artifactsPath,
			product: "macos",
			keysPath,
			policySha256: dummyPolicyHex,
			outDir,
		});
		expect(code).toBe(1);
		expect(await readdir(testDir)).not.toContain("out-bad-prod");
	});

	test("fails closed on invalid policy-sha256 format", async () => {
		const outDir = join(testDir, "out-bad-policy");
		const code = await publishRepository({
			artifactsPath,
			product: "journal",
			keysPath,
			policySha256: "not-64-hex-chars",
			outDir,
		});
		expect(code).toBe(1);
		expect(await readdir(testDir)).not.toContain("out-bad-policy");
	});

	test("fails closed on missing or malformed keys file", async () => {
		const outDir = join(testDir, "out-bad-keys");
		const badKeysPath = join(testDir, "bad-keys.json");
		await writeFile(badKeysPath, JSON.stringify({ invalid: true }));
		const code = await publishRepository({
			artifactsPath,
			product: "journal",
			keysPath: badKeysPath,
			policySha256: dummyPolicyHex,
			outDir,
		});
		expect(code).toBe(1);
		expect(await readdir(testDir)).not.toContain("out-bad-keys");
	});

	test("AC 7 & AC 8: publishes v2 TUF repository and verifies end-to-end via verify-v2", async () => {
		const outDir = join(testDir, "out-repo");
		const now = new Date("2026-09-01T00:00:00Z");

		const exitCode = await publishRepository({
			artifactsPath,
			product: "journal",
			keysPath,
			policySha256: dummyPolicyHex,
			outDir,
			now,
		});
		expect(exitCode).toBe(0);

		// Confirm metadata directory has expected TUF files
		const metadataFiles = await readdir(join(outDir, "metadata"));
		expect(metadataFiles).toContain("1.root.json");
		expect(metadataFiles).toContain("1.targets.json");
		expect(metadataFiles).toContain("1.snapshot.json");
		expect(metadataFiles).toContain("timestamp.json");
		expect(metadataFiles).toContain("1.targets-software.json");
		expect(metadataFiles).toContain("1.targets-legacy.json");

		// Confirm targets directory has target payloads
		const releaseRecordPath = join(
			outDir,
			"targets/software/journal/1.0.23/release-record.json",
		);
		const migrationManifestPath = join(
			outDir,
			"targets/legacy/journal/migration-manifest.json",
		);
		const releaseContent = await readFile(releaseRecordPath, "utf-8");
		const migrationContent = await readFile(migrationManifestPath, "utf-8");
		expect(JSON.parse(releaseContent).schema).toBe(
			"solstone-transparency/evidence-record/v1",
		);
		expect(JSON.parse(migrationContent).schema).toBe(
			"solstone-transparency/evidence-record/v1",
		);

		// Spin up local HTTP server classifying metadata vs target URLs
		const server = Bun.serve({
			port: 0,
			async fetch(req) {
				const url = new URL(req.url);
				const pathname = decodeURIComponent(url.pathname);
				let filePath: string;
				if (pathname.startsWith("/metadata/")) {
					const rel = pathname.slice("/metadata/".length);
					filePath = join(outDir, "metadata", rel);
				} else if (pathname.startsWith("/targets/")) {
					const rel = pathname.slice("/targets/".length);
					filePath = join(outDir, "targets", rel);
				} else {
					return new Response("Not Found", { status: 404 });
				}
				try {
					const content = await readFile(filePath);
					return new Response(content, {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch {
					return new Response("Not Found", { status: 404 });
				}
			},
		});

		const storePath = join(testDir, "trust-store.json");
		const serverBase = `http://localhost:${server.port}`;

		/**
		 * Note: This proves TUF-level target resolution, hash-matching, and role-signature
		 * acceptance end-to-end, not the DSSE envelope's own policy authorization (which
		 * is verified in the dedicated DSSE test in build-evidence-record.test.ts).
		 * In this lode, --policy-sha256 is a placeholder and verify-v2 verifies TUF metadata and target digests.
		 */
		const verifyCode = await verifyRepository({
			metadataBase: `${serverBase}/metadata`,
			targetsBase: `${serverBase}/targets`,
			storePath,
			json: true,
		});

		server.stop();
		expect(verifyCode).toBe(0);
	});
});
