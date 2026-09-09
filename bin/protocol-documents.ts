#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SCHEMA_URI_BASE } from "../src/v2/discovery";
import {
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	MIGRATION_MANIFEST_SCHEMA,
	PREDICATE_URI_BASE,
	RELEASE_RECORD_PREDICATE_TYPE,
	RELEASE_RECORD_SCHEMA,
} from "../src/v2/records/predicates";
import { EVIDENCE_RECORD_SCHEMA } from "../src/v2/records/record";

const SOURCE = "https://github.com/solpbc/solstone-transparency";
const LICENSE = "AGPL-3.0-only";
const DSSE_KEYS_SCHEMA = "solstone-transparency/dsse-keys/v1";
const CONTENT_TYPE = "application/json";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const PREDICATE_COMMENT =
	"This document identifies a predicate type. A verifier matches predicateType as an exact string; this document is not an input to verification. The specification is the named file in the source repository.";
const SCHEMA_COMMENT =
	"This document identifies a record schema. A verifier matches the schema field as an exact string; this document is not an input to verification. The specification is the named file in the source repository.";

interface ProtocolDocument {
	key: string;
	body: Record<string, unknown>;
}

/** Predicate types with a specification in protocol/. An identifier without one is not written. */
const PREDICATE_TYPES: readonly {
	type: string;
	schema: string;
	specification: string;
}[] = [
	{
		type: RELEASE_RECORD_PREDICATE_TYPE,
		schema: RELEASE_RECORD_SCHEMA,
		specification: "protocol/release-record-v1.md",
	},
	{
		type: MIGRATION_MANIFEST_PREDICATE_TYPE,
		schema: MIGRATION_MANIFEST_SCHEMA,
		specification: "protocol/migration-manifest-v1-to-v2.md",
	},
];

/** Record schemas with a specification in protocol/. */
const SCHEMAS: readonly {
	schema: string;
	predicateType?: string;
	specification: string;
}[] = [
	{
		schema: RELEASE_RECORD_SCHEMA,
		predicateType: RELEASE_RECORD_PREDICATE_TYPE,
		specification: "protocol/release-record-v1.md",
	},
	{
		schema: MIGRATION_MANIFEST_SCHEMA,
		predicateType: MIGRATION_MANIFEST_PREDICATE_TYPE,
		specification: "protocol/migration-manifest-v1-to-v2.md",
	},
	{
		schema: EVIDENCE_RECORD_SCHEMA,
		specification: "protocol/evidence-record-v1.md",
	},
	{
		schema: DSSE_KEYS_SCHEMA,
		specification: "protocol/evidence-record-v1.md",
	},
];

function keyFor(url: string, base: string): string {
	if (!url.startsWith(base)) throw new Error("document-outside-base");
	return new URL(url).pathname.replace(/^\//, "");
}

export function protocolDocuments(): ProtocolDocument[] {
	const out: ProtocolDocument[] = [];
	for (const p of PREDICATE_TYPES)
		out.push({
			key: keyFor(p.type, PREDICATE_URI_BASE),
			body: {
				kind: "predicate-type",
				predicate_type: p.type,
				predicate_schema: p.schema,
				specification: p.specification,
				source: SOURCE,
				license: LICENSE,
				_comment: PREDICATE_COMMENT,
			},
		});
	for (const s of SCHEMAS)
		out.push({
			key: keyFor(`${SCHEMA_URI_BASE}${s.schema}`, SCHEMA_URI_BASE),
			body: {
				kind: "record-schema",
				schema: s.schema,
				...(s.predicateType === undefined
					? {}
					: { predicate_type: s.predicateType }),
				specification: s.specification,
				source: SOURCE,
				license: LICENSE,
				_comment: SCHEMA_COMMENT,
			},
		});
	return out;
}

export function documentBytes(body: Record<string, unknown>): Uint8Array {
	return new TextEncoder().encode(`${JSON.stringify(body, null, 2)}\n`);
}

const HELP = [
	"Usage: bun bin/protocol-documents.ts --out DIR [--json]",
	"Writes the predicate-type and record-schema documents this repository defines, at the",
	`object keys their identifiers resolve to (${PREDICATE_URI_BASE}<name> and`,
	`${SCHEMA_URI_BASE}<schema identifier>), plus publish-set.json listing each key with its`,
	"sha256, length, content-type and cache-control for the operator who publishes them.",
	"Only identifiers with a specification under protocol/ are written. Each document is written once:",
	"its cache-control marks it immutable, and an existing key is not rewritten.",
].join("\n");

export async function protocolDocumentsMain(args: string[]): Promise<number> {
	if (args.includes("--help")) {
		console.log(HELP);
		return 0;
	}
	const outIndex = args.indexOf("--out");
	const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
	const json = args.includes("--json");
	const extra = args.filter(
		(a, i) => a !== "--json" && a !== "--out" && i !== outIndex + 1,
	);
	if (!out || extra.length > 0) {
		console.error(HELP);
		return 2;
	}
	const objects = [];
	for (const doc of protocolDocuments()) {
		const bytes = documentBytes(doc.body);
		const path = join(out, doc.key);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, bytes, { flag: "wx" });
		objects.push({
			key: doc.key,
			sha256: createHash("sha256").update(bytes).digest("hex"),
			length: bytes.length,
			content_type: CONTENT_TYPE,
			cache_control: CACHE_CONTROL,
		});
	}
	const set = {
		schema: "protocol-publish-set-v1",
		source: SOURCE,
		objects,
	};
	await writeFile(
		join(out, "publish-set.json"),
		`${JSON.stringify(set, null, 2)}\n`,
		{ flag: "wx" },
	);
	if (json) console.log(JSON.stringify(set));
	else
		for (const o of objects)
			console.log(`${o.sha256}  ${o.length}\t${o.content_type}\t${o.key}`);
	return 0;
}

if (import.meta.main)
	process.exitCode = await protocolDocumentsMain(process.argv.slice(2));
