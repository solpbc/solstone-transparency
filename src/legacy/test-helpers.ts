// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Test-only helpers: generate a throwaway minisign keypair and sign
 * synthetic fixture bytes with it. Nothing here is ever a real signing key
 * or real evidence — every keypair is freshly generated per call and never
 * persisted outside a short-lived temp directory. Used only from `*.test.ts`
 * files.
 */

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Fetcher } from "./adapter";
import { GENESIS_SHA256, canonicalize, sha256Hex } from "./canonical";
import { CATALOG } from "./inventory";
import type { LedgerEntryV1Raw } from "./verify";

export const TEST_KEY_FILENAME = "solpbc-transparency-1.pub";

/** An in-memory Fetcher backed by a plain object store, used so tests never touch the network. */
export class FakeFetcher implements Fetcher {
	private bytes = new Map<string, Uint8Array>();
	private text = new Map<string, string>();
	private status = new Map<string, number>();

	setBytes(path: string, body: Uint8Array, status = 200) {
		this.bytes.set(path, body);
		this.status.set(path, status);
	}
	setText(path: string, body: string, status = 200) {
		this.text.set(path, body);
		this.status.set(path, status);
	}

	async getBytes(path: string) {
		const status = this.status.get(path) ?? 404;
		return { status, body: this.bytes.get(path) ?? new Uint8Array() };
	}
	async getText(path: string) {
		const status = this.status.get(path) ?? 404;
		return { status, body: this.text.get(path) ?? "" };
	}
}

export interface SeedProductChainOptions {
	/** Version list to seed; defaults to the frozen CATALOG for this product. */
	versions?: string[];
	/** Map of version → distributed-artifact file name (hostile-string injection). */
	artifactNames?: Record<string, string>;
	/** Map of version → extra manifest names appended to that entry (allowlist-rejection fixtures). */
	extraManifestNames?: Record<string, string[]>;
	/** Signed pointer valid_until; defaults to a past timestamp so freshness is expired. */
	pointerValidUntil?: string;
}

/**
 * Populates a FakeFetcher with a genuinely signed, correctly chained set of
 * entries for one product. Optional `versions` lets a test seed a catalog
 * override; optional `artifactNames` / `extraManifestNames` let a test inject
 * hostile or rejected member names into an otherwise-valid signed entry.
 */
export async function seedProductChain(
	fetcher: FakeFetcher,
	kp: ThrowawayKeypair,
	product: "journal" | "linux",
	fullProduct: string,
	options: SeedProductChainOptions = {},
) {
	const versions = options.versions ?? CATALOG[product];
	let prevSha256 = GENESIS_SHA256;
	let prevVersion = "";
	let lastEntryBytes: Uint8Array | undefined;
	for (let i = 0; i < versions.length; i++) {
		const version = versions[i];
		if (version === undefined) continue;
		const seq = i + 1;
		const artifactName =
			options.artifactNames?.[version] ?? `${fullProduct}-${version}.tar.gz`;
		const extraManifests = (options.extraManifestNames?.[version] ?? []).map(
			(name) => ({
				name,
				sha256: "cd".repeat(32),
				bytes: 200,
			}),
		);
		const entry: LedgerEntryV1Raw = {
			artifacts: [
				{
					name: artifactName,
					sha256: "ab".repeat(32),
					bytes: 1000,
				},
			],
			manifests: [
				{
					name: `${fullProduct}-${version}.rust-release-manifest.json`,
					sha256: "cd".repeat(32),
					bytes: 200,
				},
				...extraManifests,
			],
			proofs: [
				{
					name: `${fullProduct}-${version}.proof.json`,
					sha256: "ef".repeat(32),
					bytes: 50,
				},
			],
			prev_sha256: prevSha256,
			prev_version: prevVersion,
			product: fullProduct,
			published_utc: `2026-01-${String(seq).padStart(2, "0")}T00:00:00Z`,
			schema: "https://solpbc.org/schemas/transparency-ledger-entry/v1.json",
			seq,
			source_commit: "0123456789abcdef0123456789abcdef01234567",
			version,
		};
		const bytes = canonicalize(entry);
		const entrySha256 = await sha256Hex(bytes);
		const sig = await kp.sign(
			bytes,
			`solpbc-transparency-v1 entry product=${fullProduct} seq=${seq} version=${version} sha256=${entrySha256} prev=${prevSha256}`,
		);
		const entryPath = `releases/${fullProduct}/v/${version}/ledger-entry.json`;
		fetcher.setBytes(entryPath, bytes);
		fetcher.setText(`${entryPath}.minisig`, sig);
		for (const m of entry.manifests ?? []) {
			fetcher.setBytes(
				`releases/${fullProduct}/v/${version}/${m.name}`,
				new Uint8Array([1]),
			);
		}
		for (const p of entry.proofs ?? []) {
			fetcher.setBytes(
				`releases/${fullProduct}/v/${version}/${p.name}`,
				new Uint8Array([1]),
			);
		}
		prevSha256 = entrySha256;
		prevVersion = version;
		lastEntryBytes = bytes;
	}
	if (lastEntryBytes) {
		const tipSha256 = await sha256Hex(lastEntryBytes);
		const validUntil = options.pointerValidUntil ?? "2026-01-15T00:00:00Z";
		const pointer = {
			chain_length: versions.length,
			product: fullProduct,
			schema: "https://solpbc.org/schemas/transparency-latest/v1.json",
			signed_at: "2026-01-01T00:00:00Z",
			tip_sha256: tipSha256,
			valid_until: validUntil,
			version: versions[versions.length - 1],
		};
		const pointerBytes = canonicalize(pointer);
		const pointerSig = await kp.sign(
			pointerBytes,
			`solpbc-transparency-v1 latest product=${fullProduct} chain_length=${pointer.chain_length} tip=${tipSha256} valid_until=${pointer.valid_until}`,
		);
		fetcher.setBytes(`releases/${fullProduct}/latest.json`, pointerBytes);
		fetcher.setText(`releases/${fullProduct}/latest.json.minisig`, pointerSig);
	}
}

export interface ThrowawayKeypair {
	pubKeyText: string;
	sign(dataBytes: Uint8Array, trustedComment: string): Promise<string>;
}

/** Generates a fresh, unencrypted, throwaway minisign keypair for this test only. */
export async function generateThrowawayKeypair(): Promise<ThrowawayKeypair> {
	const dir = await mkdtemp(join(tmpdir(), "solstone-transparency-testkey-"));
	const secPath = join(dir, "test.key");
	const pubPath = join(dir, "test.pub");
	const gen = Bun.spawn(
		["minisign", "-G", "-f", "-W", "-s", secPath, "-p", pubPath],
		{ stdout: "pipe", stderr: "pipe" },
	);
	await gen.exited;
	if (gen.exitCode !== 0) {
		throw new Error(
			`minisign -G failed: ${await new Response(gen.stderr).text()}`,
		);
	}
	const pubKeyText = await readFile(pubPath, "utf8");

	return {
		pubKeyText,
		async sign(dataBytes: Uint8Array, trustedComment: string): Promise<string> {
			const dataPath = join(dir, `data-${crypto.randomUUID()}`);
			const sigPath = `${dataPath}.minisig`;
			await writeFile(dataPath, dataBytes);
			const proc = Bun.spawn(
				[
					"minisign",
					"-S",
					"-s",
					secPath,
					"-x",
					sigPath,
					"-t",
					trustedComment,
					"-m",
					dataPath,
				],
				{
					stdin: "pipe",
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			proc.stdin.end();
			await proc.exited;
			if (proc.exitCode !== 0) {
				throw new Error(
					`minisign -S failed: ${await new Response(proc.stderr).text()}`,
				);
			}
			return readFile(sigPath, "utf8");
		},
	};
}
