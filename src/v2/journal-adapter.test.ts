// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	type JournalAdapterInput,
	adaptJournalRelease,
	adaptJournalReleaseSet,
} from "./journal-adapter";
import { validateReleaseRecordPredicate } from "./records/release-record";

const roots: string[] = [];
const claims = {
	_comment: ["Synthetic release fixture."],
	does_prove: ["Synthetic artifact byte bindings."],
	does_not_prove: ["Software correctness."],
};
const digest = (bytes: string | Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");

afterEach(async () => {
	for (const root of roots.splice(0))
		await rm(root, { recursive: true, force: true });
});

// Synthetic bytes in the schema and member order emitted by the Rust distribution producer.
async function fixture(target = "linux-x86_64") {
	const root = await mkdtemp(join(tmpdir(), "journal-adapter-"));
	roots.push(root);
	const version = "2.0.0-test.1";
	const base = `solstone-journal-${version}-${target}`;
	const members: Record<string, string> = {};
	const extensions = target.startsWith("macos")
		? ["tar.gz", "pkg"]
		: ["tar.gz", "deb", "rpm"];
	for (const ext of extensions)
		members[`${base}.${ext}`] = `synthetic ${target} ${ext} bytes\n`;
	members[`${base}.release`] =
		`product=solstone-journal\nversion=${version}\ntarget=${target}\ncommit=${"a".repeat(40)}\nlock_sha256=${"b".repeat(64)}\nupgrade_epoch=journal-v2\nretention_window=3\nmin_bootstrap_revision=1\n`;
	if (target.startsWith("macos")) {
		members[`${base}.release`] +=
			`archive_prebuild_input_sha256=${"c".repeat(64)}\narchive_delivery_contract_sha256=${"d".repeat(64)}\narchive_final_invocation_sha256=${"e".repeat(64)}\n`;
		members[`${base}.signing.json`] = '{"synthetic":true}\n';
	}
	members[`${base}.sha256`] = Object.entries(members)
		.map(([name, bytes]) => `${digest(bytes)}  ${name}\n`)
		.join("");
	const manifest = {
		product: "solstone-journal",
		version,
		target,
		files: Object.fromEntries(
			Object.entries(members).map(([name, bytes]) => [name, digest(bytes)]),
		),
	};
	for (const [name, bytes] of Object.entries(members))
		await writeFile(join(root, name), bytes);
	const manifestPath = join(root, `${base}.manifest.json`);
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	const input: JournalAdapterInput = {
		manifestPath,
		version,
		lane: "staging",
		claims,
	};
	return {
		root,
		base,
		members,
		manifest,
		input,
		save: () =>
			writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
	};
}

describe("journal distribution evidence adapter", () => {
	test("combines target sets and refuses duplicate or partially invalid input", async () => {
		const linux = await fixture();
		const macos = await fixture("macos-arm64");
		const input = {
			...linux.input,
			manifestPaths: [linux.input.manifestPath, macos.input.manifestPath],
		};
		const combined = await adaptJournalReleaseSet(input);
		const linuxResult = await adaptJournalRelease(linux.input);
		const macosResult = await adaptJournalRelease(macos.input);
		expect(combined.artifacts).toEqual(
			[...linuxResult.artifacts, ...macosResult.artifacts].sort(
				(left, right) => (left.url < right.url ? -1 : 1),
			),
		);
		await expect(
			adaptJournalReleaseSet({
				...input,
				manifestPaths: [linux.input.manifestPath, linux.input.manifestPath],
			}),
		).rejects.toMatchObject({ reason: "duplicate-target" });
		await expect(
			adaptJournalReleaseSet({ ...input, manifestPaths: [] }),
		).rejects.toMatchObject({ reason: "missing-manifest" });
		await writeFile(join(macos.root, `${macos.base}.tar.gz`), "tampered");
		await expect(adaptJournalReleaseSet(input)).rejects.toMatchObject({
			reason: "artifact-hash-mismatch",
		});
	});
	for (const target of ["linux-x86_64", "linux-aarch64", "macos-arm64"]) {
		test(`measures the complete ${target} set with exact lane URLs`, async () => {
			const f = await fixture(target);
			const result = await adaptJournalRelease(f.input);
			expect(result.product).toBe("journal");
			expect(result.version).toBe(f.input.version);
			expect(result._comment).toEqual(claims._comment);
			const expected = {
				...f.members,
				[`${f.base}.manifest.json`]: await readFile(
					f.input.manifestPath,
					"utf8",
				),
			};
			expect(result.artifacts).toEqual(
				Object.entries(expected)
					.map(([name, bytes]) => ({
						url: `https://updates.solstone.app/solstone-journal/staging/${f.input.version}/${name}`,
						length: Buffer.byteLength(bytes),
						sha256: digest(bytes),
					}))
					.sort((left, right) => (left.url < right.url ? -1 : 1)),
			);
		});
	}

	test("tampering fails instead of rehashing changed bytes into new evidence", async () => {
		const f = await fixture();
		await writeFile(join(f.root, `${f.base}.tar.gz`), "tampered");
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "artifact-hash-mismatch",
		});
	});

	test("missing files and symlink members fail", async () => {
		const f = await fixture();
		const path = join(f.root, `${f.base}.tar.gz`);
		await rm(path);
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "artifact-read-failed",
		});
		await writeFile(
			join(f.root, "elsewhere"),
			f.members[`${f.base}.tar.gz`] ?? "",
		);
		await symlink(join(f.root, "elsewhere"), path);
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "artifact-read-failed",
		});
	});

	test("rejects empty or unsafe member sets before reading artifacts", async () => {
		const f = await fixture();
		f.manifest.files = {};
		await f.save();
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "artifact-set-mismatch",
		});
		f.manifest.files["../elsewhere"] = "a".repeat(64);
		await f.save();
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "artifact-set-mismatch",
		});
	});

	test("rejects duplicate JSON members without accepting the last value", async () => {
		const f = await fixture();
		const raw = JSON.stringify(f.manifest);
		await writeFile(
			f.input.manifestPath,
			raw.replace('"product":', '"product":"other","product":'),
		);
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "invalid-manifest",
		});
	});

	test("rejects caller identity, manifest identity, filename, and version traversal mismatches", async () => {
		const f = await fixture();
		await expect(
			adaptJournalRelease({ ...f.input, version: "2.0.1" }),
		).rejects.toMatchObject({ reason: "manifest-identity-mismatch" });
		await expect(
			adaptJournalRelease({ ...f.input, version: "../2.0.0" }),
		).rejects.toMatchObject({ reason: "unsafe-version" });
		const renamed = join(f.root, "other.manifest.json");
		await writeFile(renamed, JSON.stringify(f.manifest));
		await expect(
			adaptJournalRelease({ ...f.input, manifestPath: renamed }),
		).rejects.toMatchObject({ reason: "manifest-filename-mismatch" });
		f.manifest.product = "solstone-linux";
		await f.save();
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "manifest-identity-mismatch",
		});
	});

	test("does not trust declared length extensions", async () => {
		const f = await fixture();
		await writeFile(
			f.input.manifestPath,
			JSON.stringify({ ...f.manifest, lengths: { [`${f.base}.tar.gz`]: 0 } }),
		);
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "manifest-identity-mismatch",
		});
	});

	test("a rehashed mismatching release declaration still fails", async () => {
		const f = await fixture();
		const name = `${f.base}.release`;
		const altered =
			f.members[name]?.replace("product=solstone-journal", "product=other") ??
			"";
		await writeFile(join(f.root, name), altered);
		f.manifest.files[name] = digest(altered);
		await f.save();
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "release-declaration-mismatch",
		});
	});

	test("a rehashed but incomplete checksum sidecar still fails", async () => {
		const f = await fixture();
		const name = `${f.base}.sha256`;
		await writeFile(join(f.root, name), "");
		f.manifest.files[name] = digest("");
		await f.save();
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "checksum-sidecar-mismatch",
		});
	});

	test("CLI emits release-prepare input with measured descriptors and refuses output collisions", async () => {
		const f = await fixture();
		const claimsPath = join(f.root, "claims.json");
		await writeFile(claimsPath, JSON.stringify(claims));
		const out = join(f.root, "artifacts.json");
		const command = [
			process.execPath,
			resolve("bin/journal-artifacts.ts"),
			"--manifest",
			f.input.manifestPath,
			"--version",
			f.input.version,
			"--lane",
			"dev",
			"--claims",
			claimsPath,
			"--out",
			out,
		];
		const run = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
		expect(await run.exited).toBe(0);
		const before = await readFile(out, "utf8");
		const preparedInput = JSON.parse(before);
		expect(Object.keys(preparedInput).sort()).toEqual([
			"artifactDescriptors",
			"product",
			"releasePredicate",
			"version",
		]);
		expect(preparedInput.product).toBe("journal");
		expect(preparedInput.version).toBe(f.input.version);
		const expectedDescriptors = Object.entries({
			...f.members,
			[`${f.base}.manifest.json`]: await readFile(f.input.manifestPath, "utf8"),
		})
			.map(([name, bytes]) => ({
				url: `https://updates.solstone.app/solstone-journal/dev/${f.input.version}/${name}`,
				length: Buffer.byteLength(bytes),
				sha256: digest(bytes),
			}))
			.sort((left, right) => (left.url < right.url ? -1 : 1));
		expect(preparedInput.artifactDescriptors).toEqual(expectedDescriptors);
		expect(preparedInput.releasePredicate).toMatchObject({
			...claims,
			product: "journal",
			version: f.input.version,
			artifacts: expectedDescriptors,
		});
		// Exercise the same predicate admission used by release prepare on the
		// parsed CLI file, with descriptor values derived independently above.
		expect(
			(await validateReleaseRecordPredicate(preparedInput.releasePredicate)).ok,
		).toBe(true);
		const again = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
		expect(await again.exited).toBe(1);
		expect(JSON.parse(await new Response(again.stderr).text()).reason).toBe(
			"input-output-failed",
		);
		expect(await readFile(out, "utf8")).toBe(before);
	});
});
