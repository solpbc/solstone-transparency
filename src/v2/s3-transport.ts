// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
	MAX_PUBLICATION_FILE_BYTES,
	PublicationError,
	type PublicationTransport,
	publicationSha256,
	validatePublicationKey,
	validatePublicationPrefix,
} from "./publication";

export type R2Fetch = (input: string, init: RequestInit) => Promise<Response>;

export interface R2TransportOptions {
	credentialsPath: string;
	bucket: string;
	prefix: string;
	fetch?: R2Fetch;
	now?: () => Date;
}

function hmac(key: string | Uint8Array, value: string): Buffer {
	return createHmac("sha256", key).update(value).digest();
}
function encode(value: string): string {
	return encodeURIComponent(value).replace(
		/[!'()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}
async function responseBytes(response: Response): Promise<Uint8Array> {
	if (
		Number(response.headers.get("content-length")) > MAX_PUBLICATION_FILE_BYTES
	)
		throw new PublicationError("transport-failed");
	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			length += next.value.length;
			if (length > MAX_PUBLICATION_FILE_BYTES) {
				await reader.cancel();
				throw new PublicationError("transport-failed");
			}
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}

/** R2 S3 SigV4, path-style URLs, signed payloads and conditions, no redirects. */
export async function loadR2Transport(
	options: R2TransportOptions,
): Promise<PublicationTransport> {
	const prefix = options.prefix;
	const bucket = options.bucket;
	validatePublicationPrefix(prefix);
	if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))
		throw new PublicationError("invalid-prefix");
	let credential: {
		endpoint: string;
		access_key_id: string;
		secret_access_key: string;
	};
	try {
		const value = JSON.parse(await readFile(options.credentialsPath, "utf8"));
		if (
			!value ||
			typeof value.endpoint !== "string" ||
			!/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/.test(
				value.endpoint,
			) ||
			typeof value.access_key_id !== "string" ||
			!/^[A-Za-z0-9_-]{1,128}$/.test(value.access_key_id) ||
			typeof value.secret_access_key !== "string" ||
			!/^[A-Za-z0-9/+_=-]{1,256}$/.test(value.secret_access_key)
		)
			throw new Error("invalid credential");
		credential = value;
	} catch {
		throw new PublicationError("transport-failed");
	}
	const endpoint = new URL(credential.endpoint);
	const fetcher = options.fetch ?? fetch;
	async function request(
		method: "GET" | "PUT",
		key: string,
		body: Uint8Array,
		extra: Record<string, string>,
	): Promise<Response> {
		validatePublicationKey(prefix, key);
		const path = `/${encode(bucket)}/${key.split("/").map(encode).join("/")}`;
		const date = (options.now?.() ?? new Date())
			.toISOString()
			.replace(/[:-]|\.\d{3}/g, "");
		const day = date.slice(0, 8);
		const payloadHash = publicationSha256(body);
		const headers: Record<string, string> = {
			...extra,
			host: endpoint.host,
			"x-amz-date": date,
			"x-amz-content-sha256": payloadHash,
		};
		const names = Object.keys(headers).sort();
		const canonicalHeaders = names
			.map((name) => `${name}:${headers[name]?.trim().replace(/\s+/g, " ")}\n`)
			.join("");
		const signedHeaders = names.join(";");
		const canonical = [
			method,
			path,
			"",
			canonicalHeaders,
			signedHeaders,
			payloadHash,
		].join("\n");
		const scope = `${day}/auto/s3/aws4_request`;
		const toSign = `AWS4-HMAC-SHA256\n${date}\n${scope}\n${publicationSha256(new TextEncoder().encode(canonical))}`;
		const signingKey = hmac(
			hmac(
				hmac(hmac(`AWS4${credential.secret_access_key}`, day), "auto"),
				"s3",
			),
			"aws4_request",
		);
		headers.authorization = `AWS4-HMAC-SHA256 Credential=${credential.access_key_id}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hmac(signingKey, toSign).toString("hex")}`;
		try {
			return await fetcher(`${endpoint.origin}${path}`, {
				method,
				headers,
				body: method === "PUT" ? new Uint8Array(body) : undefined,
				redirect: "error",
				signal: AbortSignal.timeout(30_000),
			});
		} catch {
			throw new PublicationError("transport-failed");
		}
	}
	async function check(response: Response): Promise<void> {
		if (response.status === 200) return;
		if (response.status === 412)
			throw new PublicationError("precondition-failed", 412);
		if (response.status === 409) {
			const body = new TextDecoder().decode(await responseBytes(response));
			if (/<Code>ObjectLockedByBucketPolicy<\/Code>/.test(body))
				throw new PublicationError("object-locked", 409);
			if (/<Code>ConditionalRequestConflict<\/Code>/.test(body))
				throw new PublicationError("precondition-failed", 409);
		}
		throw new PublicationError("transport-failed", response.status);
	}
	return {
		async get(key) {
			const response = await request("GET", key, new Uint8Array(), {});
			if (response.status === 404) return null;
			await check(response);
			const etag = response.headers.get("etag");
			if (!etag) throw new PublicationError("transport-failed");
			return { bytes: await responseBytes(response), etag };
		},
		async put(key, bytes, condition, headers) {
			if (
				!condition ||
				typeof condition !== "object" ||
				!("ifMatch" in condition
					? !("ifNoneMatch" in condition) &&
						typeof condition.ifMatch === "string" &&
						/^"[\x21\x23-\x7e]+"$/.test(condition.ifMatch)
					: condition.ifNoneMatch === "*")
			) {
				throw new PublicationError("invalid-condition");
			}
			const conditional: Record<string, string> =
				"ifMatch" in condition
					? { "if-match": condition.ifMatch }
					: { "if-none-match": condition.ifNoneMatch };
			const response = await request("PUT", key, bytes, {
				...conditional,
				"content-type": headers.contentType,
				"cache-control": headers.cacheControl,
			});
			await check(response);
			return { etag: response.headers.get("etag") };
		},
	};
}
