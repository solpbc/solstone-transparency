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
	componentDeliveryChanges,
	prepareJournalReleaseRecord,
} from "./journal-adapter";
import {
	RELEASE_RECORD_SCHEMA,
	type ReleaseRecordPredicate,
	validateReleaseRecordPredicate,
} from "./records/release-record";

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
async function fixture(target = "linux-x86_64", includeInstaller = false) {
	const root = await mkdtemp(join(tmpdir(), "journal-adapter-"));
	roots.push(root);
	const version = "2.0.0-test.1";
	const base = `solstone-journal-${version}-${target}`;
	const members: Record<string, string> = {};
	const windows = target.startsWith("windows");
	const extensions = windows
		? []
		: target.startsWith("macos")
			? ["tar.gz"]
			: ["tar.gz", "deb", "rpm"];
	for (const ext of extensions)
		members[`${base}.${ext}`] = `synthetic ${target} ${ext} bytes\n`;
	if (windows) {
		members[`${base}-setup.exe`] = "synthetic windows setup bytes\n";
		members[`SolstoneJournal-${version}-full.nupkg`] =
			"synthetic windows full package bytes\n";
	}
	if (includeInstaller)
		members[`solstone-journal-${version}-install.sh`] =
			"#!/bin/sh\necho synthetic installer\n";
	if (!windows)
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
		lane: windows ? "release" : "staging",
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
		const combined = await prepareJournalReleaseRecord(input);
		const linuxResult = await adaptJournalRelease(linux.input);
		const macosResult = await adaptJournalRelease(macos.input);
		expect(combined.artifacts).toEqual(
			[...linuxResult.artifacts, ...macosResult.artifacts].sort(
				(left, right) => (left.url < right.url ? -1 : 1),
			),
		);
		await expect(
			prepareJournalReleaseRecord({
				...input,
				manifestPaths: [linux.input.manifestPath, linux.input.manifestPath],
			}),
		).rejects.toMatchObject({ reason: "duplicate-target" });
		await expect(
			prepareJournalReleaseRecord({ ...input, manifestPaths: [] }),
		).rejects.toMatchObject({ reason: "missing-manifest" });
		await writeFile(join(macos.root, `${macos.base}.tar.gz`), "tampered");
		await expect(prepareJournalReleaseRecord(input)).rejects.toMatchObject({
			reason: "artifact-hash-mismatch",
		});
	});

	test("deduplicates the byte-identical shared installer and refuses disagreement", async () => {
		const linuxX86 = await fixture("linux-x86_64", true);
		const linuxArm = await fixture("linux-aarch64", true);
		const macos = await fixture("macos-arm64", true);
		const input = {
			...linuxX86.input,
			manifestPaths: [
				linuxX86.input.manifestPath,
				linuxArm.input.manifestPath,
				macos.input.manifestPath,
			],
		};
		const combined = await prepareJournalReleaseRecord(input);
		const installerUrl = `https://updates.solstone.app/solstone-journal/staging/${linuxX86.input.version}/solstone-journal-${linuxX86.input.version}-install.sh`;
		expect(
			combined.artifacts.filter((item) => item.url === installerUrl),
		).toHaveLength(1);

		const installerName = `solstone-journal-${linuxArm.input.version}-install.sh`;
		const altered = "#!/bin/sh\necho different installer\n";
		await writeFile(join(linuxArm.root, installerName), altered);
		linuxArm.manifest.files[installerName] = digest(altered);
		const sidecarName = `${linuxArm.base}.sha256`;
		linuxArm.members[installerName] = altered;
		const sidecar = Object.entries(linuxArm.members)
			.filter(([name]) => name !== sidecarName)
			.map(([name, bytes]) => `${digest(bytes)}  ${name}\n`)
			.join("");
		await writeFile(join(linuxArm.root, sidecarName), sidecar);
		linuxArm.manifest.files[sidecarName] = digest(sidecar);
		await linuxArm.save();
		await expect(prepareJournalReleaseRecord(input)).rejects.toMatchObject({
			reason: "duplicate-target",
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

	test("measures the complete windows-x86_64 set under the Windows origin prefix", async () => {
		const f = await fixture("windows-x86_64");
		const result = await adaptJournalRelease(f.input);
		const expected = {
			...f.members,
			[`${f.base}.manifest.json`]: await readFile(f.input.manifestPath, "utf8"),
		};
		expect(result.artifacts).toEqual(
			Object.entries(expected)
				.map(([name, bytes]) => ({
					url: `https://updates.solstone.app/solstone-journal/release/windows/${name}`,
					length: Buffer.byteLength(bytes),
					sha256: digest(bytes),
				}))
				.sort((left, right) => (left.url < right.url ? -1 : 1)),
		);
		expect(result.artifacts).toHaveLength(4);
	});

	test("combines native and Windows sets, and a native-only set carries no Windows descriptor", async () => {
		const natives = [
			await fixture("linux-x86_64", true),
			await fixture("linux-aarch64", true),
			await fixture("macos-arm64", true),
		];
		const win = await fixture("windows-x86_64");
		const nativeOnly = await prepareJournalReleaseRecord({
			...win.input,
			manifestPaths: natives.map((n) => n.input.manifestPath),
		});
		const combined = await prepareJournalReleaseRecord({
			...win.input,
			manifestPaths: [
				...natives.map((n) => n.input.manifestPath),
				win.input.manifestPath,
			],
		});
		const windowsUrls = (urls: readonly { url: string }[]) =>
			urls.filter((a) => a.url.includes("/release/windows/"));
		expect(windowsUrls(nativeOnly.artifacts)).toEqual([]);
		expect(windowsUrls(combined.artifacts)).toEqual([
			...(await adaptJournalRelease(win.input)).artifacts,
		]);
		expect(combined.artifacts).toHaveLength(nativeOnly.artifacts.length + 4);
		await expect(
			prepareJournalReleaseRecord({
				...win.input,
				manifestPaths: [win.input.manifestPath, win.input.manifestPath],
			}),
		).rejects.toMatchObject({ reason: "duplicate-target" });
	});

	test("refuses a Windows set outside the release lane, or with a different version", async () => {
		const f = await fixture("windows-x86_64");
		for (const lane of ["staging", "dev"] as const)
			await expect(
				adaptJournalRelease({ ...f.input, lane }),
			).rejects.toMatchObject({ reason: "unsupported-lane" });
		await expect(
			adaptJournalRelease({ ...f.input, version: "2.0.1" }),
		).rejects.toMatchObject({ reason: "manifest-identity-mismatch" });
	});

	test("refuses an altered Windows container, a symlinked one, and missing or extra members", async () => {
		const f = await fixture("windows-x86_64");
		const nupkg = join(f.root, `SolstoneJournal-${f.input.version}-full.nupkg`);
		await writeFile(nupkg, "tampered");
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "artifact-hash-mismatch",
		});
		await writeFile(join(f.root, "elsewhere"), "tampered");
		await rm(nupkg);
		await symlink(join(f.root, "elsewhere"), nupkg);
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "artifact-read-failed",
		});

		for (const extra of [
			"RELEASES",
			"releases.win.json",
			`${f.base}.release`,
			`solstone-journal-${f.input.version}-install.sh`,
		]) {
			const g = await fixture("windows-x86_64");
			await writeFile(join(g.root, extra), "synthetic\n");
			g.manifest.files[extra] = digest("synthetic\n");
			await g.save();
			await expect(adaptJournalRelease(g.input)).rejects.toMatchObject({
				reason: "artifact-set-mismatch",
			});
		}
		const g = await fixture("windows-x86_64");
		delete g.manifest.files[`${g.base}-setup.exe`];
		await g.save();
		await expect(adaptJournalRelease(g.input)).rejects.toMatchObject({
			reason: "artifact-set-mismatch",
		});
	});

	test("refuses a rehashed Windows checksum file that does not name exactly the two containers", async () => {
		const f = await fixture("windows-x86_64");
		const name = `${f.base}.sha256`;
		const setup = `${f.base}-setup.exe`;
		const partial = `${digest(f.members[setup] ?? "")}  ${setup}\n`;
		await writeFile(join(f.root, name), partial);
		f.manifest.files[name] = digest(partial);
		await f.save();
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "checksum-sidecar-mismatch",
		});
	});

	test("refuses Windows targets other than x86_64", async () => {
		const f = await fixture("windows-aarch64");
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "unsupported-target",
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

// Synthetic component rows: names, versions and sources are placeholders.
const hex = (character: string) => character.repeat(64);
type Row = Record<string, unknown>;
type Fixture = Awaited<ReturnType<typeof fixture>>;
function bundled(id = "alpha", members?: unknown[]): Row {
	return {
		id,
		version: "1.0.0",
		delivery: "bundled",
		source: `https://example.invalid/${id}-1.0.0.tar.gz`,
		inputs: [{ name: `${id}-1.0.0.tar.gz`, sha256: hex("1") }],
		members: members ?? [
			{ path: `bin/${id}`, sha256: hex("2") },
			{ path: `lib/lib${id}.so.1`, sha256: hex("3") },
		],
	};
}
function downloaded(id = "beta"): Row {
	return {
		id,
		version: "2.0.0",
		delivery: "runtime-downloaded",
		source: `https://example.invalid/${id}-2.0.0.bin`,
		inputs: [
			{ name: `${id}-2.0.0.bin`, sha256: hex("4") },
			{ name: `${id}-2.0.0.json`, sha256: hex("5") },
		],
		members: [],
	};
}
async function withComponents(target: string, rows: unknown) {
	const f = await fixture(target);
	(f.manifest as Record<string, unknown>).components = rows;
	await f.save();
	return f;
}
/**
 * A synthetic previous release record. With `rows`, it lists components for
 * the targets in `targets`; without, it lists none, as before the first
 * release to list them, and no comparison is made against it.
 */
function previousRecord(
	rows?: Row[],
	targets: string[] = ["linux-x86_64", "macos-arm64"],
): ReleaseRecordPredicate {
	return {
		_comment: ["Synthetic previous record."],
		schema: RELEASE_RECORD_SCHEMA,
		product: "journal",
		version: "1.9.0",
		artifacts: [
			{
				url: "https://updates.solstone.app/solstone-journal/staging/1.9.0/x",
				length: 1,
				sha256: hex("9"),
			},
		],
		...(rows === undefined
			? {}
			: {
					component_targets: targets,
					components: rows as never,
					component_baseline: "1.8.0",
				}),
		does_prove: ["Synthetic."],
		does_not_prove: ["Synthetic."],
	};
}
/** Prepares a record for the given target sets against `previousRecord()` unless `extra` says otherwise. */
function prepare(sets: Fixture[], extra: Record<string, unknown> = {}) {
	const first = sets[0];
	if (first === undefined) throw new Error("no fixture");
	return prepareJournalReleaseRecord({
		...first.input,
		manifestPaths: sets.map((set) => set.input.manifestPath),
		previousRecord: previousRecord(),
		...extra,
	});
}
/** JSON-quotes a path for a test name, spelling out U+007F to U+009F, which JSON leaves raw. */
function visible(path: string): string {
	return [...JSON.stringify(path)]
		.map((character) => {
			const code = character.charCodeAt(0);
			return code >= 0x7f && code <= 0x9f
				? `\\u${code.toString(16).padStart(4, "0")}`
				: character;
		})
		.join("");
}
// Today's predicate key order, written out so a change to it is visible here.
const OLD_KEYS = [
	"_comment",
	"schema",
	"product",
	"version",
	"artifacts",
	"does_prove",
	"does_not_prove",
];
const COMPONENT_KEYS = [
	...OLD_KEYS.slice(0, 5),
	"component_targets",
	"components",
	"component_baseline",
	...OLD_KEYS.slice(5),
];

describe("journal component inventory", () => {
	test("a manifest without components yields exactly the predicate shape and bytes it did before", async () => {
		const linux = await fixture();
		const macos = await fixture("macos-arm64");
		const expectedArtifacts = Object.entries({
			...linux.members,
			[`${linux.base}.manifest.json`]: await readFile(
				linux.input.manifestPath,
				"utf8",
			),
		})
			.map(([name, bytes]) => ({
				url: `https://updates.solstone.app/solstone-journal/staging/${linux.input.version}/${name}`,
				length: Buffer.byteLength(bytes),
				sha256: digest(bytes),
			}))
			.sort((left, right) => (left.url < right.url ? -1 : 1));
		const expected: ReleaseRecordPredicate = {
			_comment: claims._comment,
			schema: RELEASE_RECORD_SCHEMA,
			product: "journal",
			version: linux.input.version,
			artifacts: expectedArtifacts,
			does_prove: claims.does_prove,
			does_not_prove: claims.does_not_prove,
		};
		for (const result of [
			await adaptJournalRelease(linux.input),
			await prepare([linux], { previousRecord: undefined }),
			await prepare([linux]),
			await prepare([linux], {
				previousRecord: previousRecord([
					{ target: "linux-x86_64", ...bundled() },
				]),
			}),
		]) {
			expect(result).toStrictEqual(expected);
			expect(Object.keys(result)).toEqual(OLD_KEYS);
			expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
		}
		expect(Object.keys(await prepare([linux, macos]))).toEqual(OLD_KEYS);
	});

	test("bundled and runtime-downloaded rows are carried with their target, the covered targets, and the baseline", async () => {
		const f = await withComponents("linux-x86_64", [
			bundled("alpha"),
			downloaded("beta"),
		]);
		const result = await prepare([f]);
		expect(result.component_targets).toEqual(["linux-x86_64"]);
		expect(result.components).toEqual([
			{ target: "linux-x86_64", ...bundled("alpha") },
			{ target: "linux-x86_64", ...downloaded("beta") },
		] as never);
		expect(result.component_baseline).toBe("1.9.0");
		expect(Object.keys(result)).toEqual(COMPONENT_KEYS);
		expect(Object.keys(result.components?.[0] ?? {})).toEqual([
			"target",
			"id",
			"version",
			"delivery",
			"source",
			"inputs",
			"members",
		]);
		expect(result.component_transitions).toBeUndefined();
		expect((await validateReleaseRecordPredicate(result as never)).ok).toBe(
			true,
		);
	});

	test("an empty components list covers its target with no rows", async () => {
		const f = await withComponents("linux-x86_64", []);
		const result = await prepare([f]);
		expect(result.component_targets).toEqual(["linux-x86_64"]);
		expect(result.components).toEqual([]);
	});

	test("a mixed set covers only the targets whose manifest has a components list", async () => {
		const x86 = await withComponents("linux-x86_64", [
			bundled("alpha"),
			downloaded("gamma"),
		]);
		const arm = await withComponents("linux-aarch64", [
			bundled("beta"),
			downloaded("gamma"),
		]);
		const macos = await withComponents("macos-arm64", []);
		const windows = await fixture("windows-x86_64");
		const result = await prepare([windows, x86, macos, arm]);
		expect(result.component_targets).toEqual([
			"linux-aarch64",
			"linux-x86_64",
			"macos-arm64",
		]);
		expect(result.components?.map((row) => `${row.target}/${row.id}`)).toEqual([
			"linux-aarch64/beta",
			"linux-aarch64/gamma",
			"linux-x86_64/alpha",
			"linux-x86_64/gamma",
		]);
		// The twin: the same targets with no components lists carry no component fields.
		const plain = await prepare([
			windows,
			await fixture("linux-x86_64"),
			await fixture("macos-arm64"),
		]);
		expect(Object.keys(plain)).toEqual(OLD_KEYS);
	});

	test("refuses components without a previous record, and accepts them with one", async () => {
		const f = await withComponents("linux-x86_64", [bundled("alpha")]);
		await expect(
			prepare([f], { previousRecord: undefined }),
		).rejects.toMatchObject({ reason: "missing-previous-record" });
		await expect(adaptJournalRelease(f.input)).rejects.toMatchObject({
			reason: "missing-previous-record",
		});
		expect(
			(
				await adaptJournalRelease({
					...f.input,
					previousRecord: previousRecord(),
				})
			).component_baseline,
		).toBe("1.9.0");
	});

	test("refuses a previous record for the version being prepared, and accepts an earlier one", async () => {
		const f = await withComponents("linux-x86_64", [bundled("alpha")]);
		await expect(
			prepare([f], {
				previousRecord: { ...previousRecord(), version: f.input.version },
			}),
		).rejects.toMatchObject({ reason: "previous-record-same-version" });
		expect((await prepare([f])).component_baseline).toBe("1.9.0");
	});

	const invalid: [string, () => unknown][] = [
		["components that are not an array", () => ({ alpha: bundled() })],
		["an id with an uppercase letter", () => [bundled("Alpha")]],
		["an id starting with a hyphen", () => [bundled("-alpha")]],
		["an empty id", () => [bundled("")]],
		["an unknown delivery", () => [{ ...bundled(), delivery: "vendored" }]],
		[
			"a runtime-downloaded row with members",
			() => [
				{
					...downloaded(),
					members: [{ path: "bin/beta", sha256: hex("2") }],
				},
			],
		],
		["a bundled row with no members", () => [bundled("alpha", [])]],
		["unsorted rows", () => [downloaded("beta"), bundled("alpha")]],
		["duplicate rows", () => [bundled("alpha"), downloaded("alpha")]],
		[
			"unsorted inputs",
			() => [
				{
					...downloaded(),
					inputs: [...(downloaded().inputs as unknown[])].reverse(),
				},
			],
		],
		[
			"duplicate inputs",
			() => [
				{
					...downloaded(),
					inputs: [
						{ name: "same", sha256: hex("4") },
						{ name: "same", sha256: hex("5") },
					],
				},
			],
		],
		["no inputs", () => [{ ...downloaded(), inputs: [] }]],
		[
			"unsorted members",
			() => [
				bundled("alpha", [
					{ path: "lib/x", sha256: hex("2") },
					{ path: "bin/x", sha256: hex("3") },
				]),
			],
		],
		[
			"duplicate members",
			() => [
				bundled("alpha", [
					{ path: "bin/x", sha256: hex("2") },
					{ path: "bin/x", sha256: hex("3") },
				]),
			],
		],
		["an extra row key", () => [{ ...bundled(), license: "synthetic" }]],
		["a row without its source", () => [{ ...bundled(), source: undefined }]],
		["an empty version", () => [{ ...bundled(), version: "" }]],
		["an empty source", () => [{ ...bundled(), source: "" }]],
		[
			"an extra input key",
			() => [
				{
					...downloaded(),
					inputs: [{ name: "x", sha256: hex("4"), url: "x" }],
				},
			],
		],
		[
			"an empty input name",
			() => [{ ...downloaded(), inputs: [{ name: "", sha256: hex("4") }] }],
		],
		[
			"an extra member key",
			() => [bundled("alpha", [{ path: "bin/x", sha256: hex("2"), mode: 1 }])],
		],
		...(
			[
				"bin/../etc/x",
				"/bin/x",
				"etc/x",
				"bin//x",
				"bin/./x",
				"bin/",
				"bin",
				"./bin/x",
				"bin\\x",
				"bin/x\n",
				"bin/x\u007f",
				"bin/x\u0085",
				"bin/\u009fx",
			] as const
		).map((path): [string, () => unknown] => [
			`the member path ${visible(path)}`,
			() => [bundled("alpha", [{ path, sha256: hex("2") }])],
		]),
		[
			"an uppercase member sha256",
			() => [bundled("alpha", [{ path: "bin/x", sha256: hex("A") }])],
		],
		[
			"a short input sha256",
			() => [{ ...downloaded(), inputs: [{ name: "x", sha256: "ab" }] }],
		],
	];
	for (const [name, rows] of invalid) {
		test(`refuses ${name} as invalid-components, and accepts the valid twin`, async () => {
			const valid = await withComponents("linux-x86_64", [
				bundled("alpha"),
				downloaded("beta"),
			]);
			expect((await prepare([valid])).components).toHaveLength(2);
			const f = await withComponents(
				"linux-x86_64",
				JSON.parse(JSON.stringify(rows())),
			);
			await expect(prepare([f])).rejects.toMatchObject({
				reason: "invalid-components",
			});
		});
	}

	test("accepts nested member paths under each of bin/, lib/ and share/", async () => {
		const f = await withComponents("linux-x86_64", [
			bundled("alpha", [
				{ path: "bin/alpha", sha256: hex("2") },
				{ path: "lib/alpha/plugins/a.so", sha256: hex("3") },
				{ path: "share/alpha/..data", sha256: hex("4") },
				{ path: "share/alpha/\u00e9t\u00e9", sha256: hex("5") },
			]),
		]);
		expect((await prepare([f])).components?.[0]?.members).toHaveLength(4);
	});
});

describe("declared component transitions", () => {
	const current = () => [
		bundled("alpha"),
		bundled("beta"),
		downloaded("epsilon"),
	];
	const linux = (rows: unknown[] = current()) =>
		withComponents("linux-x86_64", rows);
	// The previous release, against which `current` changes beta, epsilon and
	// gamma. Its macOS row is for a target the new record does not cover, so
	// it is never compared.
	const previous = () =>
		previousRecord([
			...[bundled("alpha"), downloaded("beta"), bundled("gamma")].map(
				(row) => ({ target: "linux-x86_64", ...row }),
			),
			{ target: "macos-arm64", ...bundled("delta") },
		]);
	const changes = [
		{
			target: "linux-x86_64",
			id: "beta",
			from: "runtime-downloaded",
			to: "bundled",
		},
		{
			target: "linux-x86_64",
			id: "epsilon",
			from: "absent",
			to: "runtime-downloaded",
		},
		{ target: "linux-x86_64", id: "gamma", from: "bundled", to: "absent" },
	];

	test("a valid declaration is attached after the baseline", async () => {
		const result = await prepare([await linux()], { transitions: changes });
		expect(result.component_transitions).toEqual(changes as never);
		expect(Object.keys(result)).toEqual([
			...COMPONENT_KEYS.slice(0, 8),
			"component_transitions",
			...OLD_KEYS.slice(5),
		]);
	});

	const refused: [string, () => unknown][] = [
		[
			"a transition to absent for a listed component",
			() => [
				{ target: "linux-x86_64", id: "alpha", from: "bundled", to: "absent" },
			],
		],
		[
			"a to state that is not the listed delivery",
			() => [
				{
					target: "linux-x86_64",
					id: "alpha",
					from: "absent",
					to: "runtime-downloaded",
				},
			],
		],
		[
			"a transition to a component that is not listed",
			() => [
				{ target: "linux-x86_64", id: "zeta", from: "absent", to: "bundled" },
			],
		],
		[
			"a transition for a target outside component_targets",
			() => [
				...changes,
				{ target: "macos-arm64", id: "delta", from: "bundled", to: "absent" },
			],
		],
		[
			"from equal to to",
			() => [
				{ target: "linux-x86_64", id: "alpha", from: "bundled", to: "bundled" },
			],
		],
		["unsorted transitions", () => [...changes].reverse()],
		["duplicate transitions", () => [changes[0], changes[0]]],
		["an unknown state", () => [{ ...changes[2], to: "removed" }]],
		["an extra transition key", () => [{ ...changes[2], reason: "synthetic" }]],
		["a non-array declaration", () => changes[0]],
	];
	for (const [name, transitions] of refused) {
		test(`refuses ${name}, and accepts the valid twin`, async () => {
			const f = await linux();
			expect(
				(await prepare([f], { transitions: changes })).component_transitions,
			).toHaveLength(3);
			await expect(
				prepare([f], { transitions: transitions() }),
			).rejects.toMatchObject({ reason: "invalid-transitions" });
		});
	}

	test("refuses transitions when no supplied manifest lists components, and accepts them once one does", async () => {
		const declared = [
			{ target: "linux-x86_64", id: "gamma", from: "bundled", to: "absent" },
		];
		await expect(
			prepare([await fixture()], { transitions: declared }),
		).rejects.toMatchObject({ reason: "transitions-without-components" });
		expect(
			(await prepare([await linux([])], { transitions: declared }))
				.component_transitions,
		).toEqual(declared as never);
	});

	test("the delivery changes are computed over targets both records cover", async () => {
		const next = await prepare([await linux()]);
		expect(componentDeliveryChanges(previous(), next)).toEqual(
			changes as never,
		);
		// The previous record covers macos-arm64 and the new one does not;
		// the twin, where both cover it, compares it.
		const macosNext = {
			...next,
			component_targets: ["linux-x86_64", "macos-arm64"],
		};
		expect(componentDeliveryChanges(previous(), macosNext)).toEqual([
			...changes,
			{ target: "macos-arm64", id: "delta", from: "bundled", to: "absent" },
		] as never);
	});

	test("a target only the new record covers is not compared, and is compared once both cover it", async () => {
		const x86 = await linux();
		const arm = await withComponents("linux-aarch64", [bundled("theta")]);
		const result = await prepare([x86, arm], {
			transitions: changes,
			previousRecord: previous(),
		});
		expect(result.component_targets).toEqual(["linux-aarch64", "linux-x86_64"]);
		expect(result.component_transitions).toEqual(changes as never);
		const covering = previousRecord(previous().components as never, [
			"linux-aarch64",
			"linux-x86_64",
			"macos-arm64",
		]);
		await expect(
			prepare([x86, arm], { transitions: changes, previousRecord: covering }),
		).rejects.toMatchObject({ reason: "undeclared-component-transitions" });
		const declared = [
			{ target: "linux-aarch64", id: "theta", from: "absent", to: "bundled" },
			...changes,
		];
		expect(
			(
				await prepare([x86, arm], {
					transitions: declared,
					previousRecord: covering,
				})
			).component_transitions,
		).toEqual(declared as never);
	});

	test("declarations equal to the changes since the previous record are accepted, in either previous-record form", async () => {
		const f = await linux();
		for (const record of [
			previous(),
			{ product: "journal", version: "1.9.0", releasePredicate: previous() },
		]) {
			const result = await prepare([f], {
				transitions: changes,
				previousRecord: record,
			});
			expect(result.component_transitions).toEqual(changes as never);
			expect(result.component_baseline).toBe("1.9.0");
		}
	});

	test("a missing declaration is refused", async () => {
		const f = await linux();
		await expect(
			prepare([f], {
				transitions: changes.slice(0, 2),
				previousRecord: previous(),
			}),
		).rejects.toMatchObject({ reason: "undeclared-component-transitions" });
		await expect(
			prepare([f], { previousRecord: previous() }),
		).rejects.toMatchObject({ reason: "undeclared-component-transitions" });
	});

	test("an extra declaration is refused", async () => {
		await expect(
			prepare([await linux()], {
				transitions: [
					{
						target: "linux-x86_64",
						id: "alpha",
						from: "runtime-downloaded",
						to: "bundled",
					},
					...changes,
				],
				previousRecord: previous(),
			}),
		).rejects.toMatchObject({ reason: "undeclared-component-transitions" });
	});

	test("an unchanged inventory needs no declaration", async () => {
		const unchanged = previousRecord(
			current().map((row) => ({ target: "linux-x86_64", ...row })),
		);
		const result = await prepare([await linux()], {
			previousRecord: unchanged,
		});
		expect(result.component_transitions).toBeUndefined();
	});

	test("a previous record without components imposes no comparison", async () => {
		const f = await linux();
		expect((await prepare([f])).components).toHaveLength(3);
		expect(
			(await prepare([f], { transitions: changes.slice(1, 2) }))
				.component_transitions,
		).toEqual(changes.slice(1, 2) as never);
	});

	test("refuses an unusable previous record", async () => {
		const f = await linux();
		const { component_targets: _omitted, ...untargeted } = previous();
		for (const record of [
			{ ...previous(), releasePredicate: previous() },
			{ releasePredicate: { ...previous(), schema: "other" } },
			"not a record",
			{ ...previousRecord(), component_transitions: [] },
			untargeted,
			{ ...previousRecord(), version: "1.9.0 beta" },
		]) {
			await expect(
				prepare([f], { previousRecord: JSON.parse(JSON.stringify(record)) }),
			).rejects.toMatchObject({ reason: "invalid-previous-record" });
		}
		await expect(
			prepare([f], {
				previousRecord: { ...previousRecord(), product: "other" },
			}),
		).rejects.toMatchObject({ reason: "previous-record-mismatch" });
	});

	test("CLI attaches declared transitions and checks them against the previous output", async () => {
		const f = await linux();
		const claimsPath = join(f.root, "claims.json");
		const transitionsPath = join(f.root, "transitions.json");
		const previousPath = join(f.root, "previous.json");
		await writeFile(claimsPath, JSON.stringify(claims));
		await writeFile(transitionsPath, JSON.stringify(changes));
		await writeFile(
			previousPath,
			JSON.stringify({
				product: "journal",
				version: "1.9.0",
				releasePredicate: previous(),
				artifactDescriptors: previous().artifacts,
			}),
		);
		const run = async (...extra: string[]) => {
			const child = Bun.spawn(
				[
					process.execPath,
					resolve("bin/journal-artifacts.ts"),
					"--manifest",
					f.input.manifestPath,
					"--version",
					f.input.version,
					"--lane",
					"staging",
					"--claims",
					claimsPath,
					...extra,
				],
				{ stdout: "pipe", stderr: "pipe" },
			);
			return {
				code: await child.exited,
				stdout: await new Response(child.stdout).text(),
				stderr: await new Response(child.stderr).text(),
			};
		};
		const accepted = await run(
			"--transitions",
			transitionsPath,
			"--previous-record",
			previousPath,
		);
		expect(accepted.code).toBe(0);
		const output = JSON.parse(accepted.stdout);
		expect(output.releasePredicate.component_transitions).toEqual(changes);
		expect(output.releasePredicate.components).toHaveLength(3);
		expect(output.releasePredicate.component_targets).toEqual(["linux-x86_64"]);
		expect(output.releasePredicate.component_baseline).toBe("1.9.0");
		expect(
			(await validateReleaseRecordPredicate(output.releasePredicate)).ok,
		).toBe(true);

		const undeclared = await run("--previous-record", previousPath);
		expect(undeclared.code).toBe(1);
		expect(JSON.parse(undeclared.stderr).reason).toBe(
			"undeclared-component-transitions",
		);
		const unanchored = await run("--transitions", transitionsPath);
		expect(unanchored.code).toBe(1);
		expect(JSON.parse(unanchored.stderr).reason).toBe(
			"missing-previous-record",
		);
		await writeFile(transitionsPath, "not json");
		const unreadable = await run("--transitions", transitionsPath);
		expect(unreadable.code).toBe(1);
		expect(JSON.parse(unreadable.stderr).reason).toBe("invalid-transitions");
	});
});

describe("components files", () => {
	/** Writes a components file beside the target's release set, outside its manifest. */
	async function componentsFile(
		f: Fixture,
		rows: unknown,
		overrides: Record<string, unknown> = {},
		name = `${f.base}.components.json`,
	) {
		const path = join(f.root, name);
		await writeFile(
			path,
			`${JSON.stringify(
				{
					product: "solstone-journal",
					version: f.input.version,
					target: f.manifest.target,
					components: rows,
					...overrides,
				},
				null,
				2,
			)}\n`,
		);
		return path;
	}
	const rows = () => [bundled("alpha"), downloaded("beta")];

	test("a file-sourced inventory yields the same component fields as a manifest-sourced one, and leaves the artifacts untouched", async () => {
		const fromManifest = await prepare([
			await withComponents("linux-x86_64", rows()),
		]);
		const plain = await fixture();
		const fromFile = await prepare([plain], {
			componentsPaths: [await componentsFile(plain, rows())],
		});
		const withoutComponents = await prepare([plain]);
		// The manifest carrying a components key has different bytes, so only
		// its descriptor differs; every other member is identical.
		expect({ ...fromFile, artifacts: [] }).toStrictEqual({
			...fromManifest,
			artifacts: [],
		});
		expect(JSON.stringify({ ...fromFile, artifacts: [] })).toBe(
			JSON.stringify({ ...fromManifest, artifacts: [] }),
		);
		expect(Object.keys(fromFile)).toEqual(COMPONENT_KEYS);
		expect(fromFile.artifacts).toStrictEqual(withoutComponents.artifacts);
		expect(
			fromFile.artifacts.some((artifact) =>
				artifact.url.endsWith(".components.json"),
			),
		).toBe(false);
	});

	test("an empty file list covers its target with no rows, and no file leaves it uncovered", async () => {
		const linux = await fixture();
		const macos = await fixture("macos-arm64");
		const result = await prepare([linux, macos], {
			componentsPaths: [await componentsFile(macos, [])],
		});
		expect(result.component_targets).toEqual(["macos-arm64"]);
		expect(result.components).toEqual([]);
		const none = await prepare([linux, macos], { componentsPaths: [] });
		expect(Object.keys(none)).toEqual(OLD_KEYS);
	});

	test("manifest and file sources combine across targets, and a target with neither stays uncovered", async () => {
		const x86 = await withComponents("linux-x86_64", [bundled("alpha")]);
		const macos = await fixture("macos-arm64");
		const windows = await fixture("windows-x86_64");
		const result = await prepare([windows, x86, macos], {
			componentsPaths: [await componentsFile(macos, [downloaded("beta")])],
		});
		expect(result.component_targets).toEqual(["linux-x86_64", "macos-arm64"]);
		expect(result.components?.map((row) => `${row.target}/${row.id}`)).toEqual([
			"linux-x86_64/alpha",
			"macos-arm64/beta",
		]);
	});

	test("refuses file-sourced components without a previous record, and accepts them with one", async () => {
		const f = await fixture();
		const path = await componentsFile(f, rows());
		await expect(
			prepare([f], { componentsPaths: [path], previousRecord: undefined }),
		).rejects.toMatchObject({ reason: "missing-previous-record" });
		expect(
			(await prepare([f], { componentsPaths: [path] })).component_baseline,
		).toBe("1.9.0");
	});

	test("refuses a file for a target with no supplied manifest, and accepts it once the manifest is supplied", async () => {
		const linux = await fixture();
		const macos = await fixture("macos-arm64");
		const path = await componentsFile(macos, rows());
		await expect(
			prepare([linux], { componentsPaths: [path] }),
		).rejects.toMatchObject({ reason: "components-target-mismatch" });
		expect(
			(await prepare([linux, macos], { componentsPaths: [path] }))
				.component_targets,
		).toEqual(["macos-arm64"]);
	});

	test("refuses two files for one target, and accepts one", async () => {
		const f = await fixture();
		const first = await componentsFile(f, rows());
		const second = await componentsFile(f, rows(), {}, "second.json");
		await expect(
			prepare([f], { componentsPaths: [first, second] }),
		).rejects.toMatchObject({ reason: "duplicate-components-source" });
		await expect(
			prepare([f], { componentsPaths: [first, first] }),
		).rejects.toMatchObject({ reason: "duplicate-components-source" });
		expect(
			(await prepare([f], { componentsPaths: [first] })).components,
		).toHaveLength(2);
	});

	test("refuses a file for a target whose manifest has a components key, and accepts either source alone", async () => {
		const f = await withComponents("linux-x86_64", rows());
		const path = await componentsFile(f, rows());
		await expect(
			prepare([f], { componentsPaths: [path] }),
		).rejects.toMatchObject({ reason: "duplicate-components-source" });
		expect((await prepare([f])).components).toHaveLength(2);
		const plain = await fixture();
		expect(
			(
				await prepare([plain], {
					componentsPaths: [await componentsFile(plain, rows())],
				})
			).components,
		).toHaveLength(2);
	});

	const releaseMismatches: [string, Record<string, unknown>][] = [
		["another product", { product: "solstone-linux" }],
		["another version", { version: "2.0.1" }],
	];
	for (const [name, overrides] of releaseMismatches) {
		test(`refuses a file for ${name}, and accepts the matching twin`, async () => {
			const f = await fixture();
			expect(
				(
					await prepare([f], {
						componentsPaths: [await componentsFile(f, rows())],
					})
				).components,
			).toHaveLength(2);
			await expect(
				prepare([f], {
					componentsPaths: [await componentsFile(f, rows(), overrides)],
				}),
			).rejects.toMatchObject({ reason: "components-release-mismatch" });
		});
	}

	const malformed: [string, (f: Fixture, path: string) => Promise<unknown>][] =
		[
			["an extra key", (f) => componentsFile(f, rows(), { lane: "staging" })],
			[
				"a missing key",
				(f) => componentsFile(f, rows(), { product: undefined }),
			],
			["a non-string target", (f) => componentsFile(f, rows(), { target: 1 })],
			[
				"a duplicate member name",
				(_f, path) =>
					writeFile(
						path,
						(
							JSON.stringify({
								product: "solstone-journal",
								version: "2.0.0-test.1",
								target: "linux-x86_64",
								components: [],
							}) as string
						).replace('"target":', '"target":"macos-arm64","target":'),
					),
			],
			["text that is not JSON", (_f, path) => writeFile(path, "not json")],
			["a JSON array", (_f, path) => writeFile(path, "[]")],
			[
				"a symlink",
				async (f, path) => {
					const real = join(f.root, "elsewhere.json");
					await writeFile(real, await readFile(path));
					await rm(path);
					await symlink(real, path);
				},
			],
			["a missing file", (_f, path) => rm(path)],
		];
	for (const [name, change] of malformed) {
		test(`refuses a components file with ${name} as invalid-components-file, and accepts the valid twin`, async () => {
			const f = await fixture();
			const path = await componentsFile(f, rows());
			expect(
				(await prepare([f], { componentsPaths: [path] })).components,
			).toHaveLength(2);
			await change(f, path);
			await expect(
				prepare([f], { componentsPaths: [path] }),
			).rejects.toMatchObject({ reason: "invalid-components-file" });
		});
	}

	test("refuses invalid rows in a file as invalid-components, and accepts the valid twin", async () => {
		const f = await fixture();
		expect(
			(
				await prepare([f], {
					componentsPaths: [await componentsFile(f, rows())],
				})
			).components,
		).toHaveLength(2);
		for (const invalid of [
			[downloaded("beta"), bundled("alpha")],
			[bundled("alpha", [])],
			[bundled("alpha", [{ path: "etc/x", sha256: hex("2") }])],
			{ alpha: bundled() },
		]) {
			await expect(
				prepare([f], {
					componentsPaths: [await componentsFile(f, invalid)],
				}),
			).rejects.toMatchObject({ reason: "invalid-components" });
		}
	});

	test("CLI reads repeated --components files", async () => {
		const linux = await fixture();
		const macos = await fixture("macos-arm64");
		const claimsPath = join(linux.root, "claims.json");
		const previousPath = join(linux.root, "previous.json");
		await writeFile(claimsPath, JSON.stringify(claims));
		await writeFile(previousPath, JSON.stringify(previousRecord()));
		const linuxFile = await componentsFile(linux, rows());
		const macosFile = await componentsFile(macos, []);
		const run = async (...extra: string[]) => {
			const child = Bun.spawn(
				[
					process.execPath,
					resolve("bin/journal-artifacts.ts"),
					"--manifest",
					linux.input.manifestPath,
					"--manifest",
					macos.input.manifestPath,
					"--version",
					linux.input.version,
					"--lane",
					"staging",
					"--claims",
					claimsPath,
					"--previous-record",
					previousPath,
					...extra,
				],
				{ stdout: "pipe", stderr: "pipe" },
			);
			return {
				code: await child.exited,
				stdout: await new Response(child.stdout).text(),
				stderr: await new Response(child.stderr).text(),
			};
		};
		const accepted = await run(
			"--components",
			linuxFile,
			"--components",
			macosFile,
		);
		expect(accepted.code).toBe(0);
		const predicate = JSON.parse(accepted.stdout).releasePredicate;
		expect(predicate.component_targets).toEqual([
			"linux-x86_64",
			"macos-arm64",
		]);
		expect(predicate.components).toHaveLength(2);
		expect((await validateReleaseRecordPredicate(predicate)).ok).toBe(true);
		const refused = await run(
			"--components",
			linuxFile,
			"--components",
			linuxFile,
		);
		expect(refused.code).toBe(1);
		expect(JSON.parse(refused.stderr).reason).toBe(
			"duplicate-components-source",
		);
	});
});
