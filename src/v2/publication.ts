// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
	link,
	lstat,
	mkdir,
	open,
	realpath,
	rename,
	unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export type PublicationReason =
	| "invalid-prefix"
	| "invalid-manifest"
	| "invalid-condition"
	| "unsafe-path"
	| "local-bytes-mismatch"
	| "local-read-failed"
	| "timestamp-only-violation"
	| "prior-state-mismatch"
	| "create-conflict"
	| "timestamp-conflict"
	| "precondition-failed"
	| "object-locked"
	| "transport-failed"
	| "readback-mismatch"
	| "receipt-write-failed"
	| "delivery-not-ready";

export class PublicationError extends Error {
	constructor(
		public readonly reason: PublicationReason,
		public readonly status?: number,
	) {
		super(reason);
	}
}

export interface PublicationFile {
	path: string;
	sha256: string;
	length: number;
}
export interface PublicationManifest {
	schema: "publication-manifest-v1";
	files: PublicationFile[];
	expectedTimestampSha256: string | null;
}
export type PutCondition = { ifNoneMatch: "*" } | { ifMatch: string };
export interface ObjectHeaders {
	contentType: string;
	cacheControl: string;
}
export interface RemoteObject {
	bytes: Uint8Array;
	etag: string;
}
export interface PublicationTransport {
	get(key: string): Promise<RemoteObject | null>;
	put(
		key: string,
		bytes: Uint8Array,
		condition: PutCondition,
		headers: ObjectHeaders,
	): Promise<{ etag: string | null }>;
}
export type ArtifactDeliveryState =
	| "not_attempted"
	| "failed"
	| "succeeded"
	| "ambiguous";
export interface PublicationReceipt {
	schema: "publication-receipt-v1";
	transactionId: string;
	prefix: string;
	manifestSha256: string;
	startedAt: string;
	updatedAt: string;
	dryRun: boolean;
	delivery: ArtifactDeliveryState;
	uploadProgress: "not_started" | "in_progress" | "complete" | "failed";
	evidence:
		| "not_ready"
		| "archived_pending_publication"
		| "published_verified"
		| "terminal_conflict"
		| "publication_indeterminate";
	nextAction:
		| "none"
		| "publish-evidence-only"
		| "resolve-conflict-without-redelivery"
		| "requery-timestamp-before-evidence-retry"
		| "resolve-delivery-before-evidence"
		| "repair-receipt-storage";
	archive: null;
	reason: PublicationReason | null;
	priorTimestamp: { sha256: string | null; etag: string | null };
	objects: (PublicationFile & {
		key: string;
		state: "planned" | "writing" | "uploaded" | "verified";
		condition: PutCondition | null;
		etag: string | null;
		readbackSha256: string | null;
		outcome: "created" | "already-identical" | "replaced" | null;
	})[];
}
export interface PublicationOptions {
	repositoryDir: string;
	prefix: string;
	manifest: unknown;
	receiptPath: string;
	transport?: PublicationTransport;
	dryRun?: boolean;
	timestampOnly?: boolean;
	/** An observed artifact-delivery result. Evidence retries never change it or redeliver artifacts. */
	delivery?: ArtifactDeliveryState;
}
export type PublicationResult =
	| { ok: true; receipt: PublicationReceipt }
	| {
			ok: false;
			reason: PublicationReason;
			receipt: PublicationReceipt | null;
	  };

const TIMESTAMP = "metadata/timestamp.json";
const DIGEST = /^[0-9a-f]{64}$/;
export const MAX_PUBLICATION_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
export function publicationSha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}
function fail(reason: PublicationReason): never {
	throw new PublicationError(reason);
}
function safePath(path: string): boolean {
	return (
		path.length > 0 &&
		path.length <= 1024 &&
		path
			.split("/")
			.every(
				(part) =>
					/^[A-Za-z0-9._+-]+$/.test(part) && part !== "." && part !== "..",
			)
	);
}
export function validatePublicationPrefix(prefix: string): void {
	if (
		typeof prefix !== "string" ||
		!prefix.endsWith("/") ||
		!safePath(prefix.slice(0, -1)) ||
		!(
			prefix === "v2/" ||
			prefix === "staging/v2/" ||
			prefix.startsWith("staging/v2/")
		)
	)
		fail("invalid-prefix");
}
export function validatePublicationKey(prefix: string, key: string): void {
	validatePublicationPrefix(prefix);
	if (!key.startsWith(prefix) || !safePath(key.slice(prefix.length)))
		fail("unsafe-path");
}
function order(path: string): number {
	if (path === TIMESTAMP) return 5;
	if (!path.startsWith("metadata/")) return 0;
	if (/^metadata\/[1-9][0-9]*\.root\.json$/.test(path)) return 1;
	if (/^metadata\/[1-9][0-9]*\.snapshot\.json$/.test(path)) return 4;
	if (/^metadata\/[1-9][0-9]*\.targets\.json$/.test(path)) return 3;
	if (
		/^metadata\/[1-9][0-9]*\.[A-Za-z0-9_-]+\.json$/.test(path) &&
		!path.endsWith(".timestamp.json")
	)
		return 2;
	return fail("unsafe-path");
}
function parseManifest(
	value: unknown,
	timestampOnly: boolean,
): PublicationManifest {
	if (typeof value !== "object" || value === null) fail("invalid-manifest");
	const m = value as Partial<PublicationManifest>;
	if (
		m.schema !== "publication-manifest-v1" ||
		!Array.isArray(m.files) ||
		m.files.length === 0 ||
		m.files.length > 10000 ||
		!(
			m.expectedTimestampSha256 === null ||
			(typeof m.expectedTimestampSha256 === "string" &&
				DIGEST.test(m.expectedTimestampSha256))
		)
	)
		fail("invalid-manifest");
	const seen = new Set<string>();
	let total = 0;
	const files = m.files.map((file: PublicationFile) => {
		if (
			!file ||
			typeof file.path !== "string" ||
			!safePath(file.path) ||
			!/^(metadata|targets|schemas|predicates|keys|\.well-known)\//.test(
				file.path,
			)
		)
			fail("unsafe-path");
		order(file.path);
		if (
			typeof file.sha256 !== "string" ||
			!DIGEST.test(file.sha256) ||
			!Number.isSafeInteger(file.length) ||
			file.length < 0 ||
			file.length > MAX_PUBLICATION_FILE_BYTES ||
			seen.has(file.path)
		)
			fail("invalid-manifest");
		seen.add(file.path);
		total += file.length;
		return { path: file.path, sha256: file.sha256, length: file.length };
	});
	if (total > MAX_TOTAL_BYTES || !seen.has(TIMESTAMP)) fail("invalid-manifest");
	if (timestampOnly && (files.length !== 1 || files[0]?.path !== TIMESTAMP))
		fail("timestamp-only-violation");
	files.sort(
		(a, b) =>
			order(a.path) - order(b.path) ||
			(a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
	);
	return {
		schema: "publication-manifest-v1",
		files,
		expectedTimestampSha256: m.expectedTimestampSha256,
	};
}
function inside(root: string, path: string): boolean {
	const rel = relative(root, path);
	return (
		rel === "" ||
		(rel !== ".." &&
			!rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
			!isAbsolute(rel))
	);
}
async function loadBytes(
	root: string,
	file: PublicationFile,
): Promise<Uint8Array> {
	let path = root;
	for (const part of file.path.split("/")) {
		path = join(path, part);
		if ((await lstat(path)).isSymbolicLink()) fail("unsafe-path");
	}
	const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const stat = await handle.stat();
		const actual = await realpath(path);
		const named = await lstat(path);
		if (
			!stat.isFile() ||
			!inside(root, actual) ||
			stat.dev !== named.dev ||
			stat.ino !== named.ino
		)
			fail("unsafe-path");
		if (stat.size !== file.length) fail("local-bytes-mismatch");
		const bytes = await handle.readFile();
		if (
			bytes.length !== file.length ||
			publicationSha256(bytes) !== file.sha256
		)
			fail("local-bytes-mismatch");
		return bytes;
	} finally {
		await handle.close();
	}
}
function objectHeaders(path: string, staging: boolean): ObjectHeaders {
	return {
		contentType: path.endsWith(".json")
			? "application/json"
			: /\.(txt|pub)$/.test(path)
				? "text/plain; charset=utf-8"
				: "application/octet-stream",
		cacheControl:
			staging || path === TIMESTAMP
				? "no-store"
				: path.startsWith(".well-known/")
					? "max-age=300"
					: "public, max-age=31536000, immutable",
	};
}
async function saveReceipt(
	path: string,
	receipt: PublicationReceipt,
	first: boolean,
): Promise<void> {
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		receipt.updatedAt = new Date().toISOString();
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`);
			await handle.sync();
		} finally {
			await handle.close();
		}
		if (first) {
			await link(temporary, path);
			await unlink(temporary);
		} else await rename(temporary, path);
		const directory = await open(dirname(path), "r");
		try {
			await directory.sync();
		} finally {
			await directory.close();
		}
	} catch {
		await unlink(temporary).catch(() => undefined);
		fail("receipt-write-failed");
	}
}

/** Moves an already TUF-verified repository's declared bytes; does not sign or verify TUF. */
export async function publishTransaction(
	options: PublicationOptions,
): Promise<PublicationResult> {
	const prefix = options.prefix;
	let receipt: PublicationReceipt | null = null;
	let receiptPath: string | null = null;
	let receiptOwned = false;
	let timestampAttempted = false;
	try {
		validatePublicationPrefix(prefix);
		const manifest = parseManifest(
			options.manifest,
			options.timestampOnly === true,
		);
		if (
			options.delivery !== undefined &&
			!["not_attempted", "failed", "succeeded", "ambiguous"].includes(
				options.delivery,
			)
		)
			fail("invalid-manifest");
		if ((await lstat(options.repositoryDir)).isSymbolicLink())
			fail("unsafe-path");
		const root = await realpath(options.repositoryDir);
		const bytes: Uint8Array[] = [];
		for (const file of manifest.files) {
			validatePublicationKey(prefix, prefix + file.path);
			try {
				bytes.push(await loadBytes(root, file));
			} catch (error) {
				if (error instanceof PublicationError) throw error;
				fail("local-read-failed");
			}
		}
		const destination = resolve(options.receiptPath);
		if (inside(root, destination)) fail("unsafe-path");
		await mkdir(dirname(destination), { recursive: true });
		const parent = await realpath(dirname(destination));
		receiptPath = join(parent, relative(dirname(destination), destination));
		if (inside(root, receiptPath)) fail("unsafe-path");
		const startedAt = new Date().toISOString();
		receipt = {
			schema: "publication-receipt-v1",
			transactionId: randomUUID(),
			prefix,
			manifestSha256: publicationSha256(
				new TextEncoder().encode(JSON.stringify(manifest)),
			),
			startedAt,
			updatedAt: startedAt,
			dryRun: options.dryRun === true,
			delivery: options.delivery ?? "not_attempted",
			uploadProgress: "not_started",
			evidence: "not_ready",
			archive: null,
			reason: null,
			nextAction: "publish-evidence-only",
			priorTimestamp: { sha256: manifest.expectedTimestampSha256, etag: null },
			objects: manifest.files.map((file) => ({
				...file,
				key: prefix + file.path,
				state: "planned",
				condition: null,
				etag: null,
				readbackSha256: null,
				outcome: null,
			})),
		};
		await saveReceipt(receiptPath, receipt, true);
		receiptOwned = true;
		if (options.dryRun) return { ok: true, receipt };
		if (receipt.delivery === "failed" || receipt.delivery === "ambiguous") {
			receipt.nextAction = "resolve-delivery-before-evidence";
			fail("delivery-not-ready");
		}
		const transport = options.transport;
		if (!transport) fail("transport-failed");
		const previous = await transport.get(prefix + TIMESTAMP);
		if (
			manifest.expectedTimestampSha256 === null
				? previous !== null
				: previous === null ||
					publicationSha256(previous.bytes) !== manifest.expectedTimestampSha256
		)
			fail("prior-state-mismatch");
		if (previous && !/^"[\x21\x23-\x7e]+"$/.test(previous.etag))
			fail("prior-state-mismatch");
		receipt.priorTimestamp.etag = previous?.etag ?? null;
		receipt.uploadProgress = "in_progress";
		await saveReceipt(receiptPath, receipt, false);
		for (let i = 0; i < receipt.objects.length; i++) {
			const item = receipt.objects[i];
			const body = bytes[i];
			if (!item || !body) fail("invalid-manifest");
			const timestamp = item.path === TIMESTAMP;
			item.condition =
				timestamp && previous
					? { ifMatch: previous.etag }
					: { ifNoneMatch: "*" };
			item.state = "writing";
			await saveReceipt(receiptPath, receipt, false);
			if (timestamp) timestampAttempted = true;
			try {
				const response = await transport.put(
					item.key,
					body,
					item.condition,
					objectHeaders(item.path, prefix.startsWith("staging/")),
				);
				item.etag = response.etag;
				item.outcome = timestamp && previous ? "replaced" : "created";
			} catch (error) {
				if (
					timestamp &&
					error instanceof PublicationError &&
					(error.reason === "precondition-failed" ||
						error.reason === "object-locked")
				)
					timestampAttempted = false;
				if (
					!(error instanceof PublicationError) ||
					(error.reason !== "precondition-failed" &&
						(timestamp || error.reason !== "object-locked"))
				)
					throw error;
				if (timestamp) {
					timestampAttempted = false;
					fail("timestamp-conflict");
				}
				const existing = await transport.get(item.key);
				if (
					!existing ||
					existing.bytes.length !== item.length ||
					publicationSha256(existing.bytes) !== item.sha256
				)
					fail("create-conflict");
				item.etag = existing.etag;
				item.outcome = "already-identical";
			}
			item.state = "uploaded";
			await saveReceipt(receiptPath, receipt, false);
			const downloaded = await transport.get(item.key);
			if (
				!downloaded ||
				downloaded.bytes.length !== item.length ||
				publicationSha256(downloaded.bytes) !== item.sha256
			)
				fail("readback-mismatch");
			item.readbackSha256 = publicationSha256(downloaded.bytes);
			item.etag = downloaded.etag;
			item.state = "verified";
			if (timestamp) receipt.evidence = "published_verified";
			await saveReceipt(receiptPath, receipt, false);
		}
		receipt.uploadProgress = "complete";
		receipt.nextAction = "none";
		await saveReceipt(receiptPath, receipt, false);
		return { ok: true, receipt };
	} catch (error) {
		let reason: PublicationReason =
			error instanceof PublicationError ? error.reason : "transport-failed";
		if (receipt) {
			receipt.uploadProgress = "failed";
			receipt.reason = reason;
			if (
				[
					"create-conflict",
					"timestamp-conflict",
					"prior-state-mismatch",
				].includes(reason)
			) {
				receipt.evidence = "terminal_conflict";
				receipt.nextAction = "resolve-conflict-without-redelivery";
			} else if (
				timestampAttempted &&
				receipt.evidence !== "published_verified"
			) {
				receipt.evidence = "publication_indeterminate";
				receipt.nextAction = "requery-timestamp-before-evidence-retry";
			}
			if (reason === "receipt-write-failed")
				receipt.nextAction = "repair-receipt-storage";
			if (receiptOwned && receiptPath) {
				try {
					await saveReceipt(receiptPath, receipt, false);
				} catch {
					reason = "receipt-write-failed";
					receipt.reason = reason;
				}
			}
			if (reason === "receipt-write-failed")
				receipt.nextAction = "repair-receipt-storage";
		}
		return { ok: false, reason, receipt };
	}
}
