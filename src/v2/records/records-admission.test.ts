// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import {
	DEFAULT_MAX_JSON_DEPTH,
	DEFAULT_MAX_METADATA_BYTES,
} from "../tuf/admission";
import { EVIDENCE_RECORD_SCHEMA, parseEvidenceRecord } from "./record";

describe("evidence-record admission", () => {
	test("AC 14: uses bounded JSON admission before record shape checks", () => {
		expect(
			parseEvidenceRecord(new Uint8Array(DEFAULT_MAX_METADATA_BYTES + 1)),
		).toMatchObject({
			ok: false,
			reason: "oversized",
		});
		expect(
			parseEvidenceRecord(new TextEncoder().encode("[".repeat(33))),
		).toMatchObject({
			ok: false,
			reason: "too-deep",
		});
	});

	test("AC 15: duplicate keys fail before a record can be interpreted", () => {
		const bytes = new TextEncoder().encode(
			`{"schema":"${EVIDENCE_RECORD_SCHEMA}","schema":"other"}`,
		);
		expect(parseEvidenceRecord(bytes)).toMatchObject({
			ok: false,
			reason: "duplicate-key",
		});
	});

	test("AC 16: default bounds are finite, stated configuration values", () => {
		expect(DEFAULT_MAX_METADATA_BYTES).toBe(1024 * 1024);
		expect(DEFAULT_MAX_JSON_DEPTH).toBe(32);
		expect(Number.isFinite(DEFAULT_MAX_METADATA_BYTES)).toBe(true);
		expect(Number.isFinite(DEFAULT_MAX_JSON_DEPTH)).toBe(true);
	});
});
