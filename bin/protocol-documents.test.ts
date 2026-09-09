// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { SCHEMA_URI_BASE } from "../src/v2/discovery";
import {
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	PREDICATE_URI_BASE,
	RELEASE_RECORD_PREDICATE_TYPE,
} from "../src/v2/records/predicates";
import { documentBytes, protocolDocuments } from "./protocol-documents";

test("every document sits at the key its identifier resolves to, under a locked top-level prefix", () => {
	const docs = protocolDocuments();
	expect(docs.length).toBe(6);
	for (const doc of docs) {
		expect(
			doc.key.startsWith("predicates/") || doc.key.startsWith("schemas/"),
		).toBe(true);
		expect(doc.key.startsWith("v2/")).toBe(false);
		if (doc.body.kind === "predicate-type")
			expect(`https://transparency.solstone.app/${doc.key}`).toBe(
				String(doc.body.predicate_type),
			);
		else
			expect(`https://transparency.solstone.app/${doc.key}`).toBe(
				`${SCHEMA_URI_BASE}${doc.body.schema}`,
			);
	}
	const predicateKeys = docs
		.filter((d) => d.body.kind === "predicate-type")
		.map((d) => d.body.predicate_type);
	expect(predicateKeys.sort()).toEqual(
		[MIGRATION_MANIFEST_PREDICATE_TYPE, RELEASE_RECORD_PREDICATE_TYPE].sort(),
	);
	for (const p of predicateKeys)
		expect(String(p).startsWith(PREDICATE_URI_BASE)).toBe(true);
});

test("bytes are deterministic JSON ending in one newline", () => {
	const [doc] = protocolDocuments();
	if (!doc) throw new Error("no documents");
	const a = documentBytes(doc.body);
	const b = documentBytes(doc.body);
	expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
	const text = new TextDecoder().decode(a);
	expect(text.endsWith("}\n")).toBe(true);
	expect(JSON.parse(text)).toEqual(doc.body);
});
