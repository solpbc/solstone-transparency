// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { sha256 } from "./records.test-support";
import {
	IN_TOTO_STATEMENT_V1,
	parseInTotoStatementV1,
	verifyStatementSubjects,
} from "./statement";

describe("in-toto Statement v1", () => {
	test("AC 4: parses the required Statement fields and distinguishes wrong type", () => {
		const bytes = new TextEncoder().encode(
			JSON.stringify({
				_type: IN_TOTO_STATEMENT_V1,
				subject: [],
				predicateType: "example",
				predicate: {},
			}),
		);
		expect(parseInTotoStatementV1(bytes)).toMatchObject({
			ok: true,
			value: { predicateType: "example" },
		});
		const wrong = new TextEncoder().encode(
			JSON.stringify({
				_type: "wrong",
				subject: [],
				predicateType: "example",
				predicate: {},
			}),
		);
		expect(parseInTotoStatementV1(wrong)).toMatchObject({
			ok: false,
			reason: "metadata-type-mismatch",
		});
	});

	test("AC 5 and 5t: every subject needs matching SHA-256 bytes", async () => {
		const first = new TextEncoder().encode("first");
		const second = new TextEncoder().encode("second");
		const statementBytes = new TextEncoder().encode(
			JSON.stringify({
				_type: IN_TOTO_STATEMENT_V1,
				subject: [
					{ name: "software/a/v1", digest: { sha256: await sha256(first) } },
					{ name: "software/b/v1", digest: { sha256: await sha256(second) } },
				],
				predicateType: "example",
				predicate: {},
			}),
		);
		const parsed = parseInTotoStatementV1(statementBytes);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) throw new Error(parsed.reason);
		expect(
			await verifyStatementSubjects(
				parsed.value,
				new Map([
					["software/a/v1", first],
					["software/b/v1", second],
				]),
			),
		).toEqual({ ok: true, value: undefined });
		expect(
			await verifyStatementSubjects(
				parsed.value,
				new Map([
					["software/a/v1", first],
					["software/b/v1", first],
				]),
			),
		).toMatchObject({ ok: false, reason: "subject-mismatch" });
		const empty = parseInTotoStatementV1(
			new TextEncoder().encode(
				JSON.stringify({
					_type: IN_TOTO_STATEMENT_V1,
					subject: [],
					predicateType: "example",
					predicate: {},
				}),
			),
		);
		expect(empty.ok).toBe(true);
		if (!empty.ok) throw new Error(empty.reason);
		expect(await verifyStatementSubjects(empty.value, new Map())).toMatchObject(
			{ ok: false, reason: "subject-mismatch" },
		);
		const unsupported = parseInTotoStatementV1(
			new TextEncoder().encode(
				JSON.stringify({
					_type: IN_TOTO_STATEMENT_V1,
					subject: [
						{ name: "software/a/v1", digest: { sha1: "0".repeat(40) } },
					],
					predicateType: "example",
					predicate: {},
				}),
			),
		);
		expect(unsupported.ok).toBe(true);
		if (!unsupported.ok) throw new Error(unsupported.reason);
		expect(
			await verifyStatementSubjects(
				unsupported.value,
				new Map([["software/a/v1", first]]),
			),
		).toMatchObject({
			ok: false,
			reason: "subject-mismatch",
		});
	});
});
