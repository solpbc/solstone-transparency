// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { afterEach, expect, test } from "bun:test";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	PublicationError,
	type PublicationTransport,
	publicationSha256,
} from "./publication";
import type { AuthenticatedRepositoryView } from "./release-verifier";
import {
	type TimestampRailConfig,
	type TimestampRailDependencies,
	runRailCommand,
	runTimestampRail,
} from "./timestamp-rail";
import { type RepositorySigningKeys, buildRepository } from "./tuf/builder";
import { canonicalizeTufJson } from "./tuf/canonical";
import { generateEd25519SigningKey, signEd25519 } from "./tuf/ed25519";
import type { TufResult } from "./tuf/outcome";
import { DELEGATED_ROLES } from "./tuf/role-config";
import { metadataFilename } from "./tuf/serializer";

const scratch: string[] = [];
afterEach(async () => {
	for (const path of scratch.splice(0))
		await rm(path, { recursive: true, force: true });
});
function must<T>(value: TufResult<T>): T {
	if (!value.ok) throw new Error(value.reason);
	return value.value;
}
const NOW = new Date("2030-01-07T12:00:00Z");

async function fixture(nearExpiry = false) {
	const path = await mkdtemp(join(tmpdir(), "timestamp-rail-"));
	scratch.push(path);
	const generate = async () => must(await generateEd25519SigningKey());
	const keys: RepositorySigningKeys = {
		root: [await generate()],
		targets: [await generate()],
		timestamp: [await generate()],
		snapshot: [await generate()],
		delegated: Object.fromEntries(
			await Promise.all(
				DELEGATED_ROLES.map(async (role) => [role.name, [await generate()]]),
			),
		),
	};
	const built = must(
		await buildRepository({
			signingKeys: keys,
			targets: {},
			consistentSnapshot: true,
			now: nearExpiry ? new Date(NOW.getTime() - 5.5 * 86_400_000) : NOW,
		}),
	);
	const metadata = new Map(
		[
			built.root,
			built.targets,
			...built.delegatedTargets,
			built.snapshot,
			built.timestamp,
		].map((m) => [
			must(metadataFilename(m.roleName, m.version, true)),
			m.bytes,
		]),
	);
	const view: AuthenticatedRepositoryView = {
		rootBytes: built.root.bytes,
		metadata,
		bytes: new Map(),
		versions: {
			root: 1,
			timestamp: 1,
			snapshot: 1,
			targets: 1,
			delegatedTargets: Object.fromEntries(
				DELEGATED_ROLES.map((role) => [role.name, 1]),
			),
		},
		topLevelTargets: new Set(),
		tufKeyids: new Set(),
		fingerprint: "synthetic",
	};
	async function renewed(invalidSnapshot = false): Promise<Uint8Array> {
		const signed = structuredClone(built.timestamp.envelope.signed);
		signed.version = 2;
		signed.expires = new Date(NOW.getTime() + 7 * 86_400_000)
			.toISOString()
			.replace(".000Z", "Z");
		if (invalidSnapshot)
			signed.meta = {
				"snapshot.json": {
					version: 2,
					length: 0,
					hashes: { sha256: "0".repeat(64) },
				},
			};
		const key = keys.timestamp[0];
		if (!key) throw new Error("synthetic key missing");
		const sig = must(
			await signEd25519(key.privateKey, must(canonicalizeTufJson(signed))),
		);
		return must(
			canonicalizeTufJson({
				signed,
				signatures: [
					{ keyid: key.keyId, sig: Buffer.from(sig).toString("hex") },
				],
			}),
		);
	}
	const config: TimestampRailConfig = {
		schema: "timestamp-rail-config-v1",
		repositoryBase: "https://example.test/staging/v2/test/",
		prefix: "staging/v2/test/",
		rootPath: join(path, "root.json"),
		timestampKeysPath: join(path, "synthetic-timestamp-keys.json"),
		credentialsPath: join(path, "synthetic-r2.json"),
		bucket: "test-bucket",
		stateDir: join(path, "state"),
		runtimePath: "/synthetic/bun",
		cliPath: "/synthetic/cli.ts",
		alertArgv: ["/synthetic/alert", "{message}"],
	};
	await writeFile(config.rootPath, built.root.bytes);
	const commands: string[][] = [];
	const writes: string[] = [];
	let current = built.timestamp.bytes;
	const transport: PublicationTransport = {
		async get() {
			return { bytes: current, etag: `"${publicationSha256(current)}"` };
		},
		async put(key, bytes, condition) {
			if (
				!("ifMatch" in condition) ||
				condition.ifMatch !== `"${publicationSha256(current)}"`
			)
				throw new PublicationError("precondition-failed", 412);
			writes.push(key);
			current = bytes.slice();
			return { etag: `"${publicationSha256(current)}"` };
		},
	};
	const dependencies: TimestampRailDependencies = {
		now: () => NOW,
		authenticate: async (options) => {
			expect(options.metadataBase).toBe(`${config.repositoryBase}metadata/`);
			expect(publicationSha256(options.bootstrapRoot)).toBe(
				publicationSha256(built.root.bytes),
			);
			return {
				...view,
				metadata: new Map([...view.metadata, ["timestamp.json", current]]),
			};
		},
		runCommand: async (argv) => {
			commands.push(argv);
			if (argv[0] === "/synthetic/alert")
				return { exitCode: 0, timedOut: false };
			expect(argv.slice(2, 4)).toEqual(["timestamp", "refresh"]);
			expect(argv[argv.indexOf("--expected-timestamp-sha256") + 1]).toBe(
				publicationSha256(built.timestamp.bytes),
			);
			const out = argv[argv.indexOf("--out") + 1];
			if (!out) throw new Error("missing output");
			await mkdir(join(out, "metadata"), { recursive: true });
			await writeFile(join(out, "metadata/timestamp.json"), await renewed());
			await writeFile(
				join(out, "metadata/99.root.json"),
				"synthetic extra file must not upload",
			);
			return { exitCode: 0, timedOut: false };
		},
		transport,
		fetch: async () => new Response(current),
	};
	return { config, dependencies, commands, writes, path, renewed, view };
}

test("authenticates current bytes and publishes exactly the signed timestamp, preserving receipts", async () => {
	const f = await fixture();
	const result = await runTimestampRail(f.config, f.dependencies);
	expect(result).toMatchObject({
		ok: true,
		reason: null,
		advisories: [],
		scratch: null,
		alert: { attempted: false },
	});
	expect(f.writes).toEqual([`${f.config.prefix}metadata/timestamp.json`]);
	if (!result.publicationReceipt) throw new Error("missing receipt");
	expect(
		JSON.parse(await readFile(result.publicationReceipt, "utf8")),
	).toMatchObject({ evidence: "published_verified", archive: null });
	expect(f.commands).toHaveLength(1);
});
test("authentication failure alerts without invoking the refresh command or any PUT", async () => {
	const f = await fixture();
	f.dependencies.authenticate = async () => {
		throw new Error("untrusted diagnostic not logged");
	};
	const result = await runTimestampRail(f.config, f.dependencies);
	expect(result).toMatchObject({
		ok: false,
		reason: "authentication-failed",
		detail: null,
		alert: { attempted: true, delivered: true },
	});
	expect(f.writes).toEqual([]);
	expect(f.commands).toHaveLength(1);
	expect(f.commands[0]?.[0]).toBe("/synthetic/alert");
	if (!result.scratch) throw new Error("failure scratch missing");
	await access(result.scratch);
});
test("real authenticated reader advances the persisted timestamp version only after publication", async () => {
	const f = await fixture();
	f.dependencies.authenticate = undefined;
	f.dependencies.fetch = async (url) => {
		const path = new URL(url).pathname;
		const name = path.slice(`/${f.config.prefix}metadata/`.length);
		const bytes =
			name === "timestamp.json"
				? (
						await f.dependencies.transport?.get(
							`${f.config.prefix}metadata/timestamp.json`,
						)
					)?.bytes
				: f.view.metadata.get(name);
		return bytes
			? new Response(new Uint8Array(bytes))
			: new Response(null, { status: 404 });
	};
	expect(await runTimestampRail(f.config, f.dependencies)).toMatchObject({
		ok: true,
	});
	expect(
		JSON.parse(await readFile(join(f.config.stateDir, "trust.json"), "utf8"))
			.versions.timestamp,
	).toBe(2);
});
test("rejects a prior timestamp replayed between public readback and final authentication", async () => {
	const f = await fixture();
	f.dependencies.authenticate = undefined;
	let timestampReads = 0;
	f.dependencies.fetch = async (url) => {
		const name = new URL(url).pathname.slice(
			`/${f.config.prefix}metadata/`.length,
		);
		let bytes = f.view.metadata.get(name);
		if (name === "timestamp.json") {
			timestampReads++;
			if (timestampReads === 2) {
				bytes = (
					await f.dependencies.transport?.get(
						`${f.config.prefix}metadata/timestamp.json`,
					)
				)?.bytes;
			}
		}
		return bytes
			? new Response(new Uint8Array(bytes))
			: new Response(null, { status: 404 });
	};
	const result = await runTimestampRail(f.config, f.dependencies);
	expect(timestampReads).toBe(3);
	expect(f.writes).toEqual([`${f.config.prefix}metadata/timestamp.json`]);
	expect(result).toMatchObject({
		ok: false,
		reason: "public-verification-failed",
		detail: "timestamp-changed",
		alert: { attempted: true, delivered: true },
		nextAction: "inspect-retained-evidence-without-redelivery",
	});
	if (!result.scratch) throw new Error("failure scratch missing");
	await access(result.scratch);
});
test("forced refresh failure retains its exit status even when the alert fails", async () => {
	const f = await fixture();
	f.dependencies.runCommand = async (argv) => {
		f.commands.push(argv);
		return {
			exitCode: argv[0] === "/synthetic/alert" ? 9 : 7,
			timedOut: false,
		};
	};
	const result = await runTimestampRail(f.config, f.dependencies);
	expect(result).toMatchObject({
		ok: false,
		reason: "refresh-command-failed",
		refreshExitCode: 7,
		alert: { attempted: true, delivered: false, exitCode: 9 },
		nextAction: "inspect-retained-evidence-without-redelivery",
	});
	expect(f.commands[1]?.[1]).toContain("refresh-command-failed");
	expect(f.writes).toEqual([]);
});
test("a successful renewal with a near-expiry prior timestamp emits an advisory alert", async () => {
	const f = await fixture(true);
	const result = await runTimestampRail(f.config, f.dependencies);
	expect(result).toMatchObject({
		ok: true,
		advisories: ["prior-timestamp-near-expiry"],
		alert: { attempted: true, delivered: true },
	});
	expect(f.commands).toHaveLength(2);
});
test("a correctly signed timestamp pointing at a different snapshot is rejected before PUT", async () => {
	const f = await fixture();
	const original = f.dependencies.runCommand;
	f.dependencies.runCommand = async (argv) => {
		if (!original) throw new Error("missing runner");
		const result = await original(argv);
		if (argv[0] !== "/synthetic/alert") {
			const out = argv[argv.indexOf("--out") + 1];
			if (!out) throw new Error("missing output");
			await writeFile(
				join(out, "metadata/timestamp.json"),
				await f.renewed(true),
			);
		}
		return result;
	};
	expect(await runTimestampRail(f.config, f.dependencies)).toMatchObject({
		ok: false,
		reason: "candidate-invalid",
		detail: "snapshot-mismatch",
		alert: { delivered: true },
	});
	expect(f.writes).toEqual([]);
});
test("a public readback mismatch remains a failure after successful S3 publication", async () => {
	const f = await fixture();
	f.dependencies.fetch = async () => new Response("stale public bytes");
	expect(await runTimestampRail(f.config, f.dependencies)).toMatchObject({
		ok: false,
		reason: "public-readback-mismatch",
		alert: { delivered: true },
	});
	expect(f.writes).toHaveLength(1);
});
test("base/prefix mismatch cannot invoke any subprocess or transport", async () => {
	const f = await fixture();
	f.config.repositoryBase = "https://example.test/v2/";
	expect(await runTimestampRail(f.config, f.dependencies)).toMatchObject({
		ok: false,
		reason: "invalid-config",
	});
	expect(f.commands).toEqual([]);
	expect(f.writes).toEqual([]);
});
test("command runner preserves child exit and discards its diagnostic output", async () => {
	expect(
		await runRailCommand([
			process.execPath,
			"-e",
			"console.error('synthetic-private-diagnostic'); process.exit(7)",
		]),
	).toEqual({ exitCode: 7, timedOut: false });
});
test("an advisory whose alert fails retains the candidate for operator follow-up", async () => {
	const f = await fixture(true);
	const original = f.dependencies.runCommand;
	f.dependencies.runCommand = async (argv) => {
		if (argv[0] === "/synthetic/alert") return { exitCode: 9, timedOut: false };
		if (!original) throw new Error("missing runner");
		return original(argv);
	};
	expect(await runTimestampRail(f.config, f.dependencies)).toMatchObject({
		ok: false,
		reason: "alert-failed",
		alert: { delivered: false },
		nextAction: "inspect-retained-evidence-without-redelivery",
	});
});
test("a configured passphrase provider reaches the refresh argv, so an unattended run needs no terminal", async () => {
	const f = await fixture();
	f.config.passphraseProviderPath = "/synthetic/vault-passphrase.ts";
	expect(await runTimestampRail(f.config, f.dependencies)).toMatchObject({
		ok: true,
		reason: null,
	});
	const argv = f.commands[0];
	if (!argv) throw new Error("missing refresh command");
	expect(argv).toContain("--passphrase-provider");
	expect(argv[argv.indexOf("--passphrase-provider") + 1]).toBe(
		"/synthetic/vault-passphrase.ts",
	);
});
test("an omitted passphrase provider leaves the refresh argv free of the flag", async () => {
	const f = await fixture();
	expect(await runTimestampRail(f.config, f.dependencies)).toMatchObject({
		ok: true,
		reason: null,
	});
	const argv = f.commands[0];
	if (!argv) throw new Error("missing refresh command");
	expect(argv).not.toContain("--passphrase-provider");
});
test("a relative passphrase provider path cannot invoke any subprocess or transport", async () => {
	const f = await fixture();
	f.config.passphraseProviderPath = "relative/vault-passphrase.ts";
	expect(await runTimestampRail(f.config, f.dependencies)).toMatchObject({
		ok: false,
		reason: "invalid-config",
	});
	expect(f.commands).toEqual([]);
	expect(f.writes).toEqual([]);
});
