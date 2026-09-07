// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CeremonyConfiguration, runCeremony } from "./ceremony-driver";
import { type PassphraseSource, readCeremonyKey } from "./ceremony-key";
import {
	loadPassphraseProvider,
	passphraseProviderOption,
} from "./passphrase-provider";
import { DELEGATED_ROLES } from "./tuf/role-config";

const syntheticPassphrase = "synthetic-provider-test-only";

async function encryptedKey(directory: string, name = "synthetic.pem") {
	const pair = generateKeyPairSync("ed25519");
	const path = join(directory, name);
	await writeFile(
		path,
		pair.privateKey.export({
			format: "pem",
			type: "pkcs8",
			cipher: "aes-256-cbc",
			passphrase: syntheticPassphrase,
		}),
	);
	return { path, ...pair };
}

async function temporary(run: (directory: string) => Promise<void>) {
	const directory = await mkdtemp(
		join(tmpdir(), "synthetic-passphrase-provider-"),
	);
	try {
		await run(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function ownedSource(value = syntheticPassphrase) {
	const buffers: Buffer[] = [];
	const paths: string[] = [];
	const source: PassphraseSource = async (path) => {
		paths.push(path);
		const buffer = Buffer.from(value);
		buffers.push(buffer);
		return buffer;
	};
	return { source, buffers, paths };
}

test("callback decrypts without a TTY and clears its owned Buffer", async () =>
	temporary(async (directory) => {
		const fixture = await encryptedKey(directory);
		const source = ownedSource();
		const key = await readCeremonyKey(fixture.path, source.source);
		const publicJwk = createPublicKey(fixture.privateKey).export({
			format: "jwk",
		});
		expect(key.keyObject.keyval.public).toBe(
			Buffer.from(publicJwk.x ?? "", "base64url").toString("hex"),
		);
		expect(key.privateKey.extractable).toBe(false);
		expect(source.paths).toEqual([fixture.path]);
		expect(source.buffers[0]?.every((byte) => byte === 0)).toBe(true);
	}));

test("wrong passphrase and invalid encrypted key both clear the returned Buffer", async () =>
	temporary(async (directory) => {
		const fixture = await encryptedKey(directory);
		const wrong = ownedSource("synthetic-wrong-passphrase");
		await expect(readCeremonyKey(fixture.path, wrong.source)).rejects.toThrow(
			"key-decryption-failed",
		);
		expect(wrong.buffers[0]?.every((byte) => byte === 0)).toBe(true);
		const invalid = join(directory, "invalid.pem");
		await writeFile(
			invalid,
			"-----BEGIN ENCRYPTED PRIVATE KEY-----\nQUJD\n-----END ENCRYPTED PRIVATE KEY-----\n",
		);
		const source = ownedSource();
		await expect(readCeremonyKey(invalid, source.source)).rejects.toThrow(
			"key-decryption-failed",
		);
		expect(source.buffers[0]?.every((byte) => byte === 0)).toBe(true);
	}));

test("plaintext is refused before calling the provider", async () =>
	temporary(async (directory) => {
		const fixture = await encryptedKey(directory);
		const plaintext = join(directory, "synthetic-plaintext.pem");
		await writeFile(
			plaintext,
			fixture.privateKey.export({ format: "pem", type: "pkcs8" }),
		);
		const source = ownedSource();
		await expect(readCeremonyKey(plaintext, source.source)).rejects.toThrow(
			"encrypted-key-required",
		);
		expect(source.paths).toEqual([]);
	}));

test("provider exceptions and invalid return values never appear in errors", async () =>
	temporary(async (directory) => {
		const fixture = await encryptedKey(directory);
		const failure: PassphraseSource = async () => {
			throw new Error(syntheticPassphrase);
		};
		await expect(readCeremonyKey(fixture.path, failure)).rejects.toThrow(
			/^passphrase-source-failed$/,
		);
		const invalid = async () => syntheticPassphrase;
		await expect(
			readCeremonyKey(fixture.path, invalid as unknown as PassphraseSource),
		).rejects.toThrow(/^passphrase-source-invalid: return a Buffer$/);
	}));

test("local provider import failures and invalid exports are sanitized", async () =>
	temporary(async (directory) => {
		const throwing = join(directory, "throwing.ts");
		await writeFile(
			throwing,
			`throw new Error(${JSON.stringify(syntheticPassphrase)}); export default async () => Buffer.alloc(0);`,
		);
		const invalid = join(directory, "invalid.ts");
		await writeFile(
			invalid,
			`export default ${JSON.stringify(syntheticPassphrase)};`,
		);
		for (const path of [throwing, invalid, join(directory, "missing.ts")]) {
			await expect(loadPassphraseProvider(path)).rejects.toThrow(
				/^passphrase-provider-load-failed: supply a local module with a default function export$/,
			);
		}
	}));

async function genesisFixture(directory: string) {
	const config: CeremonyConfiguration = {
		keys: { root: [], targets: [], snapshot: [], timestamp: [], delegated: {} },
		targets: {},
	};
	for (const role of [
		"root",
		"targets",
		"snapshot",
		"timestamp",
		...DELEGATED_ROLES.map((role) => role.name),
	]) {
		const paths = [];
		for (let i = 0; i < 1; i++)
			paths.push((await encryptedKey(directory, `${role}-${i}.pem`)).path);
		if (role.startsWith("targets-")) config.keys.delegated[role] = paths;
		else
			config.keys[role as "root" | "targets" | "snapshot" | "timestamp"] =
				paths;
	}
	return config;
}

test("genesis forwards the callback to every key and verifies persisted output", async () =>
	temporary(async (directory) => {
		const config = await genesisFixture(directory);
		const source = ownedSource();
		const output = join(directory, "genesis");
		const receipt = await runCeremony(
			config,
			output,
			new Date(),
			source.source,
		);
		const expected = [
			...config.keys.root,
			...config.keys.targets,
			...config.keys.snapshot,
			...config.keys.timestamp,
			...Object.values(config.keys.delegated).flat(),
		];
		expect(source.paths).toEqual(expected);
		expect(
			source.buffers.every((buffer) => buffer.every((byte) => byte === 0)),
		).toBe(true);
		expect(
			JSON.parse(await readFile(join(output, "ceremony-receipt.json"), "utf8")),
		).toEqual(receipt);
		expect(receipt.keyids.root?.length).toBe(1);
	}));

async function cli(script: string, args: string[]) {
	const path = new URL(`../../bin/${script}`, import.meta.url).pathname;
	const child = Bun.spawn(["bun", path, ...args], {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exit, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exit, stdout, stderr };
}

test("genesis and detached sign CLIs use an explicit local provider without a TTY", async () =>
	temporary(async (directory) => {
		const config = await genesisFixture(directory);
		const configPath = join(directory, "config.json");
		await writeFile(configPath, JSON.stringify(config));
		const provider = join(directory, "synthetic-provider.ts");
		await writeFile(
			provider,
			`export default async (_keyPath: string) => Buffer.from(${JSON.stringify(syntheticPassphrase)});`,
		);
		const output = join(directory, "genesis");
		const genesis = await cli("tuf-ceremony.ts", [
			"genesis",
			configPath,
			output,
			"--passphrase-provider",
			provider,
		]);
		expect(genesis.exit).toBe(0);
		expect(genesis.stderr).not.toContain(syntheticPassphrase);
		// Backdate only the fixture's root expiry through the driver clock so prepare
		// can extend it immediately, without a test sleep or a CLI clock override.
		const earlier = join(directory, "earlier-genesis");
		await runCeremony(
			config,
			earlier,
			new Date(Date.now() - 3000),
			ownedSource().source,
		);
		const previous = join(earlier, "metadata/1.root.json");
		const payload = join(directory, "payload.json");
		expect(
			(await cli("root-renew.ts", ["prepare", previous, payload])).exit,
		).toBe(0);
		const signature = join(directory, "signature.json");
		const signed = await cli("root-renew.ts", [
			"sign",
			previous,
			payload,
			config.keys.root[0] ?? "",
			signature,
			"--passphrase-provider",
			provider,
		]);
		expect(signed.exit).toBe(0);
		expect(signed.stderr).not.toContain(syntheticPassphrase);
		expect(JSON.parse(await readFile(signature, "utf8")).keyid).toHaveLength(
			64,
		);
		const failing = join(directory, "failing-provider.ts");
		await writeFile(
			failing,
			`export default async () => { throw new Error(${JSON.stringify(syntheticPassphrase)}); };`,
		);
		const refused = await cli("root-renew.ts", [
			"sign",
			previous,
			payload,
			config.keys.root[0] ?? "",
			join(directory, "refused.json"),
			"--passphrase-provider",
			failing,
		]);
		expect(refused.exit).toBe(1);
		expect(JSON.parse(refused.stderr)).toEqual({
			ok: false,
			reason: "passphrase-source-failed",
		});
		expect(await Bun.file(join(directory, "refused.json")).exists()).toBe(
			false,
		);
	}));

test("provider option rejects missing and repeated module selections", () => {
	expect(() => passphraseProviderOption(["--passphrase-provider"])).toThrow(
		"passphrase-provider-usage",
	);
	expect(() =>
		passphraseProviderOption([
			"--passphrase-provider",
			"a.ts",
			"--passphrase-provider",
			"b.ts",
		]),
	).toThrow("passphrase-provider-usage");
});
