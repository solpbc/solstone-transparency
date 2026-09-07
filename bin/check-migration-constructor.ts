#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { walkMigrationManifest } from "../src/v2/records/migration-manifest";
import { buildMigrationManifestPredicate } from "../src/v2/records/migration-manifest-constructor";

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
	console.log(
		"Usage: bun bin/check-migration-constructor.ts --live\nRuns an explicit, read-only network conformance check of the journal migration constructor.\nA tampered response must fail before the original inventory can pass length, digest and minisign checks.\nNo fetched evidence is saved as a test fixture. This live check is separate from the offline CI suite.",
	);
} else {
	try {
		if (args.length !== 1 || args[0] !== "--live")
			throw new Error("explicit-live-check-required");
		const predicate = await buildMigrationManifestPredicate("journal");
		const first = predicate.objects[0];
		if (!first) throw new Error("empty-journal-inventory");
		const descriptors = new Map(
			predicate.objects.map((object) => [object.url, object]),
		);
		const cache = new Map<string, Uint8Array>();
		const get = async (url: string) => {
			const cached = cache.get(url);
			if (cached) return cached.slice();
			const response = await fetch(url, {
				redirect: "error",
				signal: AbortSignal.timeout(30_000),
			});
			if (!response.ok || !response.body)
				throw new Error("live-object-unavailable");
			const limit = descriptors.get(url)?.length ?? 4096;
			const reader = response.body.getReader();
			const chunks: Uint8Array[] = [];
			let length = 0;
			try {
				for (;;) {
					const chunk = await reader.read();
					if (chunk.done) break;
					length += chunk.value.length;
					if (length > limit) throw new Error("live-object-oversized");
					chunks.push(chunk.value);
				}
			} finally {
				await reader.cancel();
				reader.releaseLock();
			}
			const bytes = new Uint8Array(length);
			let offset = 0;
			for (const chunk of chunks) {
				bytes.set(chunk, offset);
				offset += chunk.length;
			}
			cache.set(url, bytes.slice());
			return bytes;
		};
		const red = await walkMigrationManifest(predicate, {
			async fetch(url) {
				const bytes = await get(url);
				if (url === first.url) bytes[0] = (bytes[0] ?? 0) ^ 1;
				return { kind: "ok", bytes };
			},
		});
		if (red.verdict.ok || red.verdict.reason !== "migration-target-mismatch")
			throw new Error("negative-control-failed");
		const green = await walkMigrationManifest(predicate, {
			async fetch(url) {
				return { kind: "ok", bytes: await get(url) };
			},
		});
		if (!green.verdict.ok || green.objects.length !== predicate.object_count)
			throw new Error("live-migration-walk-failed");
		console.log(
			JSON.stringify({
				ok: true,
				evaluatedAt: new Date().toISOString(),
				source:
					"buildMigrationManifestPredicate(journal), committed INVENTORY/CATALOG",
				negative: red.verdict.reason,
				declared: predicate.object_count,
				verified: green.objects.length,
				corpusSha256: predicate.corpus_sha256,
			}),
		);
	} catch (error) {
		console.error(
			JSON.stringify({
				ok: false,
				reason: error instanceof Error ? error.message : "live-check-failed",
			}),
		);
		process.exitCode = 1;
	}
}
