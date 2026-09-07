// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	composeRepositoryFiles,
	writePreparationOutput,
} from "./preparation-output";
import { buildDsseAuthorizationPolicyTargets } from "./records/dsse-policy-builder";
import { RELEASE_RECORD_SCHEMA } from "./records/release-record";
import {
	mergeRootRenewal,
	prepareRootRenewal,
	signRootRenewal,
} from "./root-renewal";
import { buildRepository } from "./tuf/builder";
import {
	generateSyntheticKeySet,
	loadRepositorySigningKeys,
} from "./tuf/keyset";
import { authenticateLocalRepository } from "./tuf/local-repository";
import { refreshTimestamp } from "./tuf/metadata-renewal";
import type { TufResult } from "./tuf/outcome";
import { sha256 } from "./tuf/prepared-metadata";
import { prepareIncrementalRelease } from "./tuf/release-preparation";
import { serializeRepository } from "./tuf/serializer";
import { targetStoragePath } from "./tuf/target-storage";

async function directory(): Promise<string> {
	return mkdtemp("/var/tmp/solstone-preparation-output-");
}

test("unsigned policy targets produce a clearly unsigned package without a publication manifest", async () => {
	const parent = await directory();
	const outputDirectory = join(parent, "out");
	try {
		const written = await writePreparationOutput({
			outputDirectory,
			files: [
				{
					relativePath: `targets/${"a".repeat(64)}.policy.json`,
					bytes: new TextEncoder().encode("policy"),
				},
			],
			operation: "test",
			expectedPriorTimestampSha256: "b".repeat(64),
			newTimestampSha256: null,
		});
		expect(written.ok).toBe(true);
		if (!written.ok) return;
		const manifest = JSON.parse(
			await readFile(join(outputDirectory, "manifest.json"), "utf-8"),
		);
		expect(manifest).toEqual(written.value);
		expect(manifest.files).toHaveLength(1);
		expect(manifest.verification).toBe("unsigned-targets");
		expect(
			await Bun.file(
				join(outputDirectory, "publication-manifest.json"),
			).exists(),
		).toBe(false);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("refuses an existing output directory without merging files", async () => {
	const parent = await directory();
	try {
		const written = await writePreparationOutput({
			outputDirectory: parent,
			files: [],
			operation: "test",
			expectedPriorTimestampSha256: "b".repeat(64),
			newTimestampSha256: null,
		});
		expect(written).toMatchObject({ ok: false, reason: "malformed" });
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("leaves no manifest when a later output path cannot be created", async () => {
	const parent = await directory();
	const outputDirectory = join(parent, "out");
	try {
		const written = await writePreparationOutput({
			outputDirectory,
			files: [
				{
					relativePath: "targets/blocker",
					bytes: new TextEncoder().encode("first"),
				},
				{
					relativePath: "targets/blocker/child.json",
					bytes: new TextEncoder().encode("second"),
				},
			],
			operation: "test",
			expectedPriorTimestampSha256: "b".repeat(64),
			newTimestampSha256: null,
		});
		expect(written).toMatchObject({ ok: false, reason: "malformed" });
		await expect(
			stat(join(outputDirectory, "targets", "blocker")),
		).resolves.toBeDefined();
		await expect(
			stat(join(outputDirectory, "manifest.json")),
		).rejects.toBeDefined();
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

const genesisTime = new Date("2030-01-01T00:00:00Z");
const renewalTime = new Date("2030-01-02T00:00:00Z");
const encode = (value: string) => new TextEncoder().encode(value);
function must<T>(result: TufResult<T>): T {
	if (!result.ok) throw new Error(`synthetic fixture failed: ${result.reason}`);
	return result.value;
}
const digest = async (bytes: Uint8Array) => must(await sha256(bytes));

async function fixture(parent: string, renewedRoots = false) {
	const keys = must(
		await loadRepositorySigningKeys(await generateSyntheticKeySet()),
	);
	const policy = must(
		await buildDsseAuthorizationPolicyTargets({
			version: 1,
			effectiveFrom: genesisTime.toISOString(),
			now: genesisTime,
			producerReleaseKeys: [{ keyObject: keys.dsseSigner.keyObject }],
			tufRoleKeyids: [
				...keys.signingKeys.root,
				...keys.signingKeys.targets,
				...keys.signingKeys.snapshot,
				...keys.signingKeys.timestamp,
				...Object.values(keys.signingKeys.delegated).flat(),
			].map((key) => key.keyId),
		}),
	);
	const targets = new Map<string, Uint8Array>([
		[policy.policyLogicalPath, policy.policyBytes],
		[policy.keysLogicalPath, policy.keysTargetBytes],
		["software/journal/existing.txt", encode("synthetic retained target")],
	]);
	const descriptions: Record<
		string,
		{ length: number; hashes: { sha256: string } }
	> = {};
	for (const [path, bytes] of targets)
		descriptions[path] = {
			length: bytes.length,
			hashes: { sha256: await digest(bytes) },
		};
	const built = must(
		await buildRepository({
			signingKeys: keys.signingKeys,
			targets: descriptions,
			consistentSnapshot: true,
			now: genesisTime,
		}),
	);
	const repositoryDirectory = join(parent, "prior");
	must(await serializeRepository(built, join(repositoryDirectory, "metadata")));
	for (const [path, bytes] of targets) {
		const storage = must(
			targetStoragePath(path, {
				sha256: await digest(bytes),
				consistentSnapshot: true,
			}),
		);
		await mkdir(dirname(join(repositoryDirectory, "targets", storage)), {
			recursive: true,
		});
		await writeFile(join(repositoryDirectory, "targets", storage), bytes);
	}
	const rootPath = join(parent, "original-pin.json");
	await writeFile(rootPath, built.root.bytes);
	if (renewedRoots) {
		const first = keys.signingKeys.root[0];
		if (!first) throw new Error("synthetic root missing");
		let previous = built.root.bytes;
		for (const version of [2, 3]) {
			const now = new Date(genesisTime.getTime() + version * 1000);
			const payload = await prepareRootRenewal(previous, now);
			const signatures = [await signRootRenewal(previous, payload, first)];
			previous = await mergeRootRenewal(previous, payload, signatures, now);
			await writeFile(
				join(repositoryDirectory, "metadata", `${version}.root.json`),
				previous,
			);
		}
	}
	const oldTimestamp = await digest(built.timestamp.bytes);
	const priorState = must(
		await authenticateLocalRepository({
			repositoryDirectory,
			rootPath,
			expectedTimestampSha256: oldTimestamp,
			now: renewalTime,
		}),
	);
	const timestampKey = keys.signingKeys.timestamp[0];
	if (!timestampKey) throw new Error("synthetic timestamp key missing");
	const renewed = must(
		await refreshTimestamp({
			priorState,
			expectedPriorTimestampSha256: oldTimestamp,
			timestampKey,
			now: renewalTime,
		}),
	);
	const files = must(
		composeRepositoryFiles({
			priorState,
			replacedMetadata: renewed.renewedRoles.map((metadata) => ({
				roleName: "timestamp",
				metadata,
			})),
		}),
	);
	return {
		keys,
		oldTimestamp,
		priorState,
		repositoryDirectory,
		rootPath,
		input: {
			outputDirectory: join(parent, "output"),
			files,
			operation: "timestamp-refresh",
			expectedPriorTimestampSha256: oldTimestamp,
			newTimestampSha256: renewed.newTimestampSha256,
			priorState,
			verification: { repositoryDirectory, rootPath, now: renewalTime },
		},
	};
}

async function noManifests(output: string) {
	expect(await Bun.file(join(output, "manifest.json")).exists()).toBe(false);
	expect(
		await Bun.file(join(output, "publication-manifest.json")).exists(),
	).toBe(false);
}

test("a signed package requires original-root verification context", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent);
		const { verification: _verification, ...withoutVerification } =
			created.input;
		expect(await writePreparationOutput(withoutVerification)).toMatchObject({
			ok: false,
			reason: "malformed",
		});
		await noManifests(created.input.outputDirectory);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("invalid signed metadata persists no completed manifest despite matching its requested digest", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent);
		const timestamp = created.input.files.find(
			(file) => file.relativePath === "metadata/timestamp.json",
		);
		if (!timestamp) throw new Error("missing timestamp");
		const parsed = JSON.parse(new TextDecoder().decode(timestamp.bytes));
		parsed.signatures[0].sig = "0".repeat(128);
		timestamp.bytes = encode(JSON.stringify(parsed));
		const result = await writePreparationOutput({
			...created.input,
			newTimestampSha256: await digest(timestamp.bytes),
		});
		expect(result.ok).toBe(false);
		expect(
			await Bun.file(
				join(created.input.outputDirectory, "metadata/timestamp.json"),
			).exists(),
		).toBe(true);
		await noManifests(created.input.outputDirectory);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("an injected write failure after a persisted object leaves no completed manifest", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent);
		const original = fs.writeFile;
		let written = 0;
		const injection = spyOn(fs, "writeFile").mockImplementation(
			async (...args: Parameters<typeof original>) => {
				await original(...args);
				if (++written === 1)
					throw new Error("synthetic write failure after one file");
			},
		);
		try {
			expect((await writePreparationOutput(created.input)).ok).toBe(false);
		} finally {
			injection.mockRestore();
		}
		expect(written).toBe(1);
		await noManifests(created.input.outputDirectory);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("timestamp publication delta is exactly one file and snapshots caller buffers", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent);
		const pending = writePreparationOutput(created.input);
		for (const file of created.input.files) file.bytes.fill(0);
		const result = await pending;
		expect(result.ok).toBe(true);
		const manifest = JSON.parse(
			await readFile(
				join(created.input.outputDirectory, "publication-manifest.json"),
				"utf8",
			),
		);
		expect(manifest.schema).toBe("publication-manifest-v1");
		expect(manifest.expectedTimestampSha256).toBe(created.oldTimestamp);
		expect(manifest.files.map((file: { path: string }) => file.path)).toEqual([
			"metadata/timestamp.json",
		]);
		const bytes = new Uint8Array(
			await readFile(
				join(created.input.outputDirectory, "metadata/timestamp.json"),
			),
		);
		expect(manifest.files[0]).toEqual({
			path: "metadata/timestamp.json",
			length: bytes.length,
			sha256: await digest(bytes),
		});
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("release publication delta contains exactly the new record and three changed metadata files", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent);
		const artifactDescriptors = [
			{
				url: "https://example.test/journal.tar.gz",
				length: 4,
				sha256: await digest(encode("test")),
			},
		];
		const snapshot = created.keys.signingKeys.snapshot[0];
		const timestamp = created.keys.signingKeys.timestamp[0];
		const targetsSoftware =
			created.keys.signingKeys.delegated["targets-software"]?.[0];
		if (!snapshot || !timestamp || !targetsSoftware)
			throw new Error("synthetic key missing");
		const release = must(
			await prepareIncrementalRelease({
				priorState: created.priorState,
				expectedPriorTimestampSha256: created.oldTimestamp,
				product: "journal",
				version: "2.0.0",
				artifactDescriptors,
				releasePredicate: {
					_comment: ["synthetic"],
					schema: RELEASE_RECORD_SCHEMA,
					product: "journal",
					version: "2.0.0",
					artifacts: artifactDescriptors,
					does_prove: ["synthetic"],
					does_not_prove: ["software safety"],
				},
				keys: {
					snapshot,
					timestamp,
					targetsSoftware,
					producerRelease: created.keys.dsseSigner,
				},
				now: renewalTime,
			}),
		);
		const files = must(
			composeRepositoryFiles({
				priorState: created.priorState,
				replacedMetadata: [
					{ roleName: "targets-software", metadata: release.targetsSoftware },
					{ roleName: "snapshot", metadata: release.snapshot },
					{ roleName: "timestamp", metadata: release.timestamp },
				],
				newTargets: [
					{
						logicalPath: release.releaseRecordLogicalPath,
						bytes: release.releaseRecordBytes,
						sha256: release.releaseRecordSha256,
					},
				],
			}),
		);
		// An unreferenced future object in the source directory is not part of the
		// authenticated prior repository and must not remove a required upload.
		await writeFile(
			join(created.repositoryDirectory, "metadata", release.snapshot.filename),
			release.snapshot.bytes,
		);
		const written = await writePreparationOutput({
			...created.input,
			operation: "release-prepare",
			files,
			newTimestampSha256: release.newTimestampSha256,
		});
		expect(written.ok).toBe(true);
		const manifest = JSON.parse(
			await readFile(
				join(created.input.outputDirectory, "publication-manifest.json"),
				"utf8",
			),
		);
		const recordStorage = must(
			targetStoragePath(release.releaseRecordLogicalPath, {
				sha256: release.releaseRecordSha256,
				consistentSnapshot: true,
			}),
		);
		expect(
			manifest.files.map((file: { path: string }) => file.path).sort(),
		).toEqual(
			[
				"metadata/2.snapshot.json",
				"metadata/2.targets-software.json",
				"metadata/timestamp.json",
				`targets/${recordStorage}`,
			].sort(),
		);
		for (const file of manifest.files) {
			const bytes = new Uint8Array(
				await readFile(join(created.input.outputDirectory, file.path)),
			);
			expect(file).toEqual({
				path: file.path,
				length: bytes.length,
				sha256: await digest(bytes),
			});
		}
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("output retains intermediate roots and verifies from the original root pin", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent, true);
		expect(created.priorState.versions.root).toBe(3);
		expect(
			created.input.files.some(
				(file) => file.relativePath === "metadata/2.root.json",
			),
		).toBe(false);
		expect((await writePreparationOutput(created.input)).ok).toBe(true);
		const verified = must(
			await authenticateLocalRepository({
				repositoryDirectory: created.input.outputDirectory,
				rootPath: created.rootPath,
				expectedTimestampSha256: created.input.newTimestampSha256,
				now: renewalTime,
			}),
		);
		expect(verified.versions.root).toBe(3);
		const middle = await readFile(
			join(created.input.outputDirectory, "metadata/2.root.json"),
		);
		expect(middle).toEqual(
			await readFile(join(created.repositoryDirectory, "metadata/2.root.json")),
		);
		const manifest = JSON.parse(
			await readFile(
				join(created.input.outputDirectory, "publication-manifest.json"),
				"utf8",
			),
		);
		expect(manifest.files.map((file: { path: string }) => file.path)).toEqual([
			"metadata/timestamp.json",
		]);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("symlink source roots are refused without copying through them", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent, true);
		const middle = join(created.repositoryDirectory, "metadata/2.root.json");
		const replacement = join(parent, "synthetic-root-copy.json");
		await writeFile(replacement, await readFile(middle));
		await rm(middle);
		await symlink(replacement, middle);
		expect((await writePreparationOutput(created.input)).ok).toBe(false);
		await noManifests(created.input.outputDirectory);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("a final manifest write failure removes both completion markers", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent);
		const original = fs.writeFile;
		const injection = spyOn(fs, "writeFile").mockImplementation(
			async (...args: Parameters<typeof original>) => {
				await original(...args);
				if (String(args[0]).endsWith("publication-manifest.json"))
					throw new Error("synthetic final write failure");
			},
		);
		try {
			expect((await writePreparationOutput(created.input)).ok).toBe(false);
		} finally {
			injection.mockRestore();
		}
		await noManifests(created.input.outputDirectory);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("an unchanged timestamp never produces a publication upload entry", async () => {
	const parent = await directory();
	try {
		const created = await fixture(parent);
		const files = must(
			composeRepositoryFiles({
				priorState: created.priorState,
				replacedMetadata: [],
			}),
		);
		expect(
			(
				await writePreparationOutput({
					...created.input,
					files,
					newTimestampSha256: created.oldTimestamp,
				})
			).ok,
		).toBe(true);
		expect(
			await Bun.file(
				join(created.input.outputDirectory, "manifest.json"),
			).exists(),
		).toBe(true);
		expect(
			await Bun.file(
				join(created.input.outputDirectory, "publication-manifest.json"),
			).exists(),
		).toBe(false);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});
