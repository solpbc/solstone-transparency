// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { afterEach, describe, expect, test } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	type ObjectHeaders,
	PublicationError,
	type PublicationManifest,
	type PublicationTransport,
	type PutCondition,
	type RemoteObject,
	publicationSha256,
	publishTransaction,
} from "./publication";
import { type R2Fetch, loadR2Transport } from "./s3-transport";

const encoder = new TextEncoder();
const PREFIX = "staging/v2/test/";
const TIMESTAMP = "metadata/timestamp.json";
const temporary: string[] = [];
afterEach(async () => {
	for (const path of temporary.splice(0))
		await rm(path, { recursive: true, force: true });
});

class MemoryTransport implements PublicationTransport {
	objects = new Map<string, RemoteObject>();
	calls: string[] = [];
	headers: ObjectHeaders[] = [];
	conditions: PutCondition[] = [];
	corrupt: string | null = null;
	failOn: string | null = null;
	beforePut: ((key: string) => Promise<void>) | null = null;
	putThenThrow: string | null = null;
	throwStatus: number | undefined;
	locked: string | null = null;
	async get(key: string): Promise<RemoteObject | null> {
		this.calls.push(`GET ${key}`);
		const value = this.objects.get(key);
		if (!value) return null;
		return {
			...value,
			bytes:
				this.corrupt === key
					? encoder.encode("corrupted")
					: value.bytes.slice(),
		};
	}
	async put(
		key: string,
		bytes: Uint8Array,
		condition: PutCondition,
		headers: ObjectHeaders,
	) {
		this.calls.push(`PUT ${key}`);
		this.headers.push(headers);
		this.conditions.push(condition);
		await this.beforePut?.(key);
		if (this.failOn === key) throw new PublicationError("transport-failed");
		const previous = this.objects.get(key);
		if (previous && this.locked === key)
			throw new PublicationError("object-locked", 409);
		if (
			"ifNoneMatch" in condition
				? previous !== undefined
				: previous?.etag !== condition.ifMatch
		)
			throw new PublicationError("precondition-failed", 412);
		const etag = `"${publicationSha256(bytes)}"`;
		this.objects.set(key, { bytes: bytes.slice(), etag });
		if (this.putThenThrow === key)
			throw new PublicationError("transport-failed", this.throwStatus);
		return { etag };
	}
}

async function fixture(
	paths = [
		TIMESTAMP,
		"metadata/2.snapshot.json",
		"metadata/2.targets.json",
		"metadata/2.targets-software.json",
		"metadata/1.root.json",
		"targets/software/test/abc.record.json",
	],
) {
	const dir = await mkdtemp(join(tmpdir(), "publication-"));
	temporary.push(dir);
	const repositoryDir = join(dir, "repository");
	await mkdir(repositoryDir);
	const files = [];
	for (const path of paths) {
		const bytes = encoder.encode(JSON.stringify({ synthetic: true, path }));
		await mkdir(dirname(join(repositoryDir, path)), { recursive: true });
		await writeFile(join(repositoryDir, path), bytes);
		files.push({
			path,
			sha256: publicationSha256(bytes),
			length: bytes.length,
		});
	}
	const manifest: PublicationManifest = {
		schema: "publication-manifest-v1",
		files,
		expectedTimestampSha256: null,
	};
	return {
		repositoryDir,
		manifest,
		prefix: PREFIX,
		receiptPath: join(dir, "receipt.json"),
		transport: new MemoryTransport(),
	};
}
function puts(transport: MemoryTransport) {
	return transport.calls.filter((call) => call.startsWith("PUT "));
}

describe("publication transaction", () => {
	test("preflights all bytes, publishes in TUF order, verifies reads, preserves delivery", async () => {
		const f = await fixture();
		const result = await publishTransaction({ ...f, delivery: "succeeded" });
		expect(result.ok).toBe(true);
		expect(puts(f.transport)).toEqual(
			[
				"targets/software/test/abc.record.json",
				"metadata/1.root.json",
				"metadata/2.targets-software.json",
				"metadata/2.targets.json",
				"metadata/2.snapshot.json",
				TIMESTAMP,
			].map((path) => `PUT ${PREFIX}${path}`),
		);
		const receipt = JSON.parse(await readFile(f.receiptPath, "utf8"));
		expect(receipt).toMatchObject({
			delivery: "succeeded",
			uploadProgress: "complete",
			evidence: "published_verified",
			archive: null,
			nextAction: "none",
		});
		expect(
			receipt.objects.every(
				(o: { state: string; sha256: string; readbackSha256: string }) =>
					o.state === "verified" && o.sha256 === o.readbackSha256,
			),
		).toBe(true);
		expect(
			f.transport.headers.every((h) => h.cacheControl === "no-store"),
		).toBe(true);
	});
	test("dry run admits all local bytes without a transport or network access", async () => {
		const f = await fixture();
		const result = await publishTransaction({
			...f,
			transport: undefined,
			dryRun: true,
		});
		expect(result.ok).toBe(true);
		expect(result.receipt).toMatchObject({
			dryRun: true,
			uploadProgress: "not_started",
			evidence: "not_ready",
		});
		expect(f.transport.calls).toEqual([]);
	});
	test("a late local digest failure causes no remote reads or writes", async () => {
		const f = await fixture();
		await writeFile(join(f.repositoryDir, TIMESTAMP), "tamper");
		const result = await publishTransaction(f);
		expect(result).toMatchObject({ ok: false, reason: "local-bytes-mismatch" });
		expect(f.transport.calls).toEqual([]);
	});
	test("uploads the preflight snapshot even if a local file changes during upload", async () => {
		const f = await fixture();
		f.transport.beforePut = async () => {
			await writeFile(
				join(f.repositoryDir, TIMESTAMP),
				"tampered after preflight",
			);
		};
		const result = await publishTransaction(f);
		expect(result.ok).toBe(true);
		expect(
			publicationSha256(
				f.transport.objects.get(PREFIX + TIMESTAMP)?.bytes ?? new Uint8Array(),
			),
		).toBe(f.manifest.files[0]?.sha256 ?? "missing fixture timestamp");
	});
	test("rejects duplicate, missing timestamp, traversal and encoded paths before transport", async () => {
		for (const path of [
			"../outside.json",
			"metadata/../timestamp.json",
			"targets/%2e%2e/secret",
			"targets/a\\b",
			"targets//file",
			"/targets/file",
			"metadata/snapshot.json",
			"metadata/1.timestamp.json",
		]) {
			const f = await fixture();
			f.manifest.files.push({ path, sha256: "0".repeat(64), length: 0 });
			expect(await publishTransaction(f)).toMatchObject({
				ok: false,
				reason: "unsafe-path",
			});
			expect(f.transport.calls).toEqual([]);
		}
		for (const duplicate of [true, false]) {
			const f = await fixture();
			if (duplicate)
				f.manifest.files.push({
					...(f.manifest.files[0] as {
						path: string;
						sha256: string;
						length: number;
					}),
				});
			else
				f.manifest.files = f.manifest.files.filter(
					(file) => file.path !== TIMESTAMP,
				);
			expect(await publishTransaction(f)).toMatchObject({
				ok: false,
				reason: "invalid-manifest",
			});
			expect(f.transport.calls).toEqual([]);
		}
	});
	test("rejects unsafe prefixes and all non-timestamp paths in timestamp-only mode", async () => {
		for (const prefix of [
			"releases/",
			"v2/targets/",
			"staging/v2x/",
			"staging/v2/../",
			"staging/v2/%2e%2e/",
			"/v2/",
			"staging/v2//",
		]) {
			const f = await fixture();
			expect(await publishTransaction({ ...f, prefix })).toMatchObject({
				ok: false,
				reason: "invalid-prefix",
			});
			expect(f.transport.calls).toEqual([]);
		}
		const f = await fixture();
		expect(
			await publishTransaction({ ...f, timestampOnly: true }),
		).toMatchObject({ ok: false, reason: "timestamp-only-violation" });
		expect(f.transport.calls).toEqual([]);
	});
	test("rejects symlink directories/files and receipt aliases into the staging tree", async () => {
		for (const directory of [true, false]) {
			const f = await fixture([TIMESTAMP]);
			const path = join(
				f.repositoryDir,
				directory ? "targets" : "targets/link.json",
			);
			if (!directory) await mkdir(dirname(path));
			await symlink(
				directory ? dirname(f.repositoryDir) : join(f.repositoryDir, TIMESTAMP),
				path,
			);
			f.manifest.files.push({
				path: directory ? "targets/file.json" : "targets/link.json",
				length: 0,
				sha256: "0".repeat(64),
			});
			expect(await publishTransaction(f)).toMatchObject({
				ok: false,
				reason: "unsafe-path",
			});
			expect(f.transport.calls).toEqual([]);
		}
		const f = await fixture();
		const alias = join(dirname(f.repositoryDir), "alias");
		await symlink(f.repositoryDir, alias);
		expect(
			await publishTransaction({
				...f,
				receiptPath: join(alias, "receipt.json"),
			}),
		).toMatchObject({ ok: false, reason: "unsafe-path" });
		expect(f.transport.calls).toEqual([]);
	});
	test("existing receipt is never overwritten and prevents public writes", async () => {
		const f = await fixture();
		await writeFile(f.receiptPath, "owned by another transaction");
		expect(await publishTransaction(f)).toMatchObject({
			ok: false,
			reason: "receipt-write-failed",
		});
		expect(await readFile(f.receiptPath, "utf8")).toBe(
			"owned by another transaction",
		);
		expect(f.transport.calls).toEqual([]);
	});
	test("receipt checkpoint failure stops writes and retains an explicit repair action", async () => {
		const f = await fixture();
		f.transport.beforePut = async () => {
			await rm(f.receiptPath);
			await mkdir(f.receiptPath);
		};
		const result = await publishTransaction({ ...f, delivery: "succeeded" });
		expect(result).toMatchObject({
			ok: false,
			reason: "receipt-write-failed",
			receipt: { delivery: "succeeded", nextAction: "repair-receipt-storage" },
		});
		expect(puts(f.transport)).toHaveLength(1);
		expect(puts(f.transport)).not.toContain(`PUT ${PREFIX}${TIMESTAMP}`);
	});
	test("standalone CLI dry run works without any credential file", async () => {
		const f = await fixture([TIMESTAMP]);
		const manifestPath = join(dirname(f.repositoryDir), "manifest.json");
		await writeFile(manifestPath, JSON.stringify(f.manifest));
		const child = Bun.spawn(
			[
				process.execPath,
				join(import.meta.dir, "../../bin/publish-transaction.ts"),
				"--repository",
				f.repositoryDir,
				"--manifest",
				manifestPath,
				"--prefix",
				PREFIX,
				"--receipt",
				f.receiptPath,
				"--dry-run",
				"--json",
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const output = await new Response(child.stdout).text();
		expect(await child.exited).toBe(0);
		expect(JSON.parse(output)).toMatchObject({
			ok: true,
			receipt: { dryRun: true, uploadProgress: "not_started", archive: null },
		});
	});
	test("prior timestamp mismatch refuses before any PUT and preserves succeeded delivery", async () => {
		const f = await fixture();
		f.transport.objects.set(PREFIX + TIMESTAMP, {
			bytes: encoder.encode("prior"),
			etag: '"prior"',
		});
		const result = await publishTransaction({ ...f, delivery: "succeeded" });
		expect(result).toMatchObject({
			ok: false,
			reason: "prior-state-mismatch",
			receipt: { delivery: "succeeded", evidence: "terminal_conflict" },
		});
		expect(puts(f.transport)).toEqual([]);
	});
	test("timestamp-only CAS uses ETag from the same prior GET", async () => {
		const f = await fixture([TIMESTAMP]);
		const prior = encoder.encode("prior");
		f.manifest.expectedTimestampSha256 = publicationSha256(prior);
		f.transport.objects.set(PREFIX + TIMESTAMP, {
			bytes: prior,
			etag: '"prior-etag"',
		});
		expect((await publishTransaction({ ...f, timestampOnly: true })).ok).toBe(
			true,
		);
		expect(f.transport.conditions).toEqual([{ ifMatch: '"prior-etag"' }]);
	});
	test("timestamp race is a conflict, never an unconditional retry", async () => {
		const f = await fixture([TIMESTAMP]);
		f.transport.beforePut = async (key) => {
			f.transport.objects.set(key, {
				bytes: encoder.encode("winner"),
				etag: '"winner"',
			});
		};
		const result = await publishTransaction({ ...f, delivery: "succeeded" });
		expect(result).toMatchObject({
			ok: false,
			reason: "timestamp-conflict",
			receipt: { delivery: "succeeded", evidence: "terminal_conflict" },
		});
		expect(puts(f.transport)).toHaveLength(1);
		expect(f.transport.conditions).toEqual([{ ifNoneMatch: "*" }]);
	});
	test("immutable collision accepts identical bytes only; conflict never advances timestamp", async () => {
		for (const identical of [false, true]) {
			const f = await fixture();
			const path = "targets/software/test/abc.record.json";
			f.transport.objects.set(PREFIX + path, {
				bytes: identical
					? new Uint8Array(await readFile(join(f.repositoryDir, path)))
					: encoder.encode("conflict"),
				etag: '"existing"',
			});
			const result = await publishTransaction({ ...f, delivery: "succeeded" });
			expect(result.ok).toBe(identical);
			if (!identical) {
				expect(result).toMatchObject({
					reason: "create-conflict",
					receipt: { delivery: "succeeded", evidence: "terminal_conflict" },
				});
				expect(puts(f.transport)).not.toContain(`PUT ${PREFIX}${TIMESTAMP}`);
			} else
				expect(result.receipt?.objects[0]?.outcome).toBe("already-identical");
		}
	});
	test("upload failure and corrupt readback stop before timestamp; receipts persist progress", async () => {
		for (const corruption of [false, true]) {
			const f = await fixture();
			const key = `${PREFIX}metadata/2.snapshot.json`;
			if (corruption) f.transport.corrupt = key;
			else f.transport.failOn = key;
			const result = await publishTransaction({ ...f, delivery: "succeeded" });
			expect(result).toMatchObject({
				ok: false,
				reason: corruption ? "readback-mismatch" : "transport-failed",
				receipt: {
					delivery: "succeeded",
					evidence: "not_ready",
					uploadProgress: "failed",
				},
			});
			expect(puts(f.transport)).not.toContain(`PUT ${PREFIX}${TIMESTAMP}`);
			expect(
				JSON.parse(await readFile(f.receiptPath, "utf8")).objects.some(
					(o: { state: string }) => o.state === "verified",
				),
			).toBe(true);
		}
	});
	test("lost timestamp acknowledgement is indeterminate even when storage changed", async () => {
		const f = await fixture([TIMESTAMP]);
		f.transport.putThenThrow = PREFIX + TIMESTAMP;
		const result = await publishTransaction({ ...f, delivery: "succeeded" });
		expect(result).toMatchObject({
			ok: false,
			receipt: {
				delivery: "succeeded",
				evidence: "publication_indeterminate",
				nextAction: "requery-timestamp-before-evidence-retry",
			},
		});
		expect(f.transport.objects.has(PREFIX + TIMESTAMP)).toBe(true);
	});
	test("a server error after timestamp PUT is also indeterminate", async () => {
		const f = await fixture([TIMESTAMP]);
		f.transport.putThenThrow = PREFIX + TIMESTAMP;
		f.transport.throwStatus = 500;
		expect(await publishTransaction(f)).toMatchObject({
			ok: false,
			receipt: {
				evidence: "publication_indeterminate",
				nextAction: "requery-timestamp-before-evidence-retry",
			},
		});
	});
	test("corrupt timestamp readback never reports publication verified", async () => {
		const f = await fixture([TIMESTAMP]);
		f.transport.corrupt = PREFIX + TIMESTAMP;
		expect(await publishTransaction(f)).toMatchObject({
			ok: false,
			reason: "readback-mismatch",
			receipt: { evidence: "publication_indeterminate" },
		});
	});
	test("locked immutable bytes admit an identical retry but never a replacement", async () => {
		for (const identical of [true, false]) {
			const f = await fixture();
			const path = "targets/software/test/abc.record.json";
			f.transport.locked = PREFIX + path;
			f.transport.objects.set(PREFIX + path, {
				bytes: identical
					? new Uint8Array(await readFile(join(f.repositoryDir, path)))
					: encoder.encode("different"),
				etag: '"locked"',
			});
			const result = await publishTransaction(f);
			expect(result.ok).toBe(identical);
			if (!identical)
				expect(result).toMatchObject({ reason: "create-conflict" });
		}
	});
	test("failed or ambiguous artifact delivery cannot become successful evidence", async () => {
		for (const delivery of ["failed", "ambiguous"] as const) {
			const f = await fixture();
			const result = await publishTransaction({ ...f, delivery });
			expect(result).toMatchObject({
				ok: false,
				reason: "delivery-not-ready",
				receipt: {
					delivery,
					evidence: "not_ready",
					nextAction: "resolve-delivery-before-evidence",
				},
			});
			expect(f.transport.calls).toEqual([]);
		}
	});
});

describe("R2 transport", () => {
	async function adapter(fetcher: R2Fetch) {
		const f = await fixture([TIMESTAMP]);
		const credentialsPath = join(
			dirname(f.repositoryDir),
			"synthetic-credentials.json",
		);
		await writeFile(
			credentialsPath,
			JSON.stringify({
				endpoint:
					"https://00000000000000000000000000000000.r2.cloudflarestorage.com",
				access_key_id: "synthetic-access",
				secret_access_key: "synthetic-secret",
			}),
		);
		return loadR2Transport({
			credentialsPath,
			bucket: "test-bucket",
			prefix: PREFIX,
			fetch: fetcher,
			now: () => new Date("2026-09-07T12:00:00Z"),
		});
	}
	test("signed PUT matches independent botocore S3SigV4Auth vector including condition and plus encoding", async () => {
		// Golden computed with botocore S3SigV4Auth, synthetic credentials, UTC 2026-09-07 12:00.
		const transport = await adapter((async (input, init) => {
			expect(String(input)).toEndWith(
				"/test-bucket/staging/v2/test/targets/test%2Bfile.json",
			);
			expect(new Headers(init?.headers).get("authorization")).toBe(
				"AWS4-HMAC-SHA256 Credential=synthetic-access/20260907/auto/s3/aws4_request, SignedHeaders=cache-control;content-type;host;if-none-match;x-amz-content-sha256;x-amz-date, Signature=cfb91ff1d6eed5fd0f8682fd97ac32a50dc4f1aaebf98ad8822ce28eb674937f",
			);
			expect(init?.redirect).toBe("error");
			expect(init?.signal).toBeDefined();
			return new Response(null, {
				status: 200,
				headers: { etag: '"synthetic"' },
			});
		}) as R2Fetch);
		await transport.put(
			`${PREFIX}targets/test+file.json`,
			encoder.encode("{}"),
			{ ifNoneMatch: "*" },
			{ contentType: "application/json", cacheControl: "no-store" },
		);
	});
	test("maps conditional and lock errors without exposing response text", async () => {
		for (const [status, text, reason] of [
			[412, "private body", "precondition-failed"],
			[
				409,
				"<Error><Code>ObjectLockedByBucketPolicy</Code></Error>",
				"object-locked",
			],
			[403, "private credential error", "transport-failed"],
		] as const) {
			const transport = await adapter(
				(async () => new Response(text, { status })) as R2Fetch,
			);
			await expect(
				transport.put(
					PREFIX + TIMESTAMP,
					encoder.encode("{}"),
					{ ifMatch: '"prior"' },
					{ contentType: "application/json", cacheControl: "no-store" },
				),
			).rejects.toMatchObject({ reason, status, message: reason });
		}
	});
	test("GET requests identity encoding and retains the strong storage ETag for replacement", async () => {
		const transport = await adapter(async (_input, init) => {
			const headers = new Headers(init.headers);
			if (init.method === "GET") {
				return new Response("{}", {
					headers: {
						etag:
							headers.get("accept-encoding") === "identity"
								? '"stored"'
								: 'W/"stored"',
					},
				});
			}
			expect(headers.get("if-match")).toBe('"stored"');
			return new Response(null, { headers: { etag: '"next"' } });
		});
		const prior = await transport.get(PREFIX + TIMESTAMP);
		expect(prior?.etag).toBe('"stored"');
		if (!prior) throw new Error("expected prior timestamp");
		await expect(
			transport.put(
				PREFIX + TIMESTAMP,
				encoder.encode("next"),
				{ ifMatch: prior.etag },
				{ contentType: "application/json", cacheControl: "no-store" },
			),
		).resolves.toEqual({ etag: '"next"' });
	});
	test("direct transport rejects missing, mixed or weak conditions before fetch", async () => {
		let called = false;
		const transport = await adapter(async () => {
			called = true;
			throw new Error("must not fetch");
		});
		for (const condition of [
			{},
			{ ifNoneMatch: "not-a-wildcard" },
			{ ifMatch: 'W/"weak"' },
			{ ifMatch: '"etag"', ifNoneMatch: "*" },
		]) {
			await expect(
				transport.put(
					PREFIX + TIMESTAMP,
					encoder.encode("{}"),
					condition as PutCondition,
					{ contentType: "application/json", cacheControl: "no-store" },
				),
			).rejects.toMatchObject({ reason: "invalid-condition" });
		}
		expect(called).toBe(false);
	});
	test("direct transport rejects keys outside its configured prefix without fetch", async () => {
		let called = false;
		const transport = await adapter((async () => {
			called = true;
			throw new Error("must not fetch");
		}) as R2Fetch);
		await expect(
			transport.get("v2/metadata/timestamp.json"),
		).rejects.toMatchObject({ reason: "unsafe-path" });
		expect(called).toBe(false);
	});
});
