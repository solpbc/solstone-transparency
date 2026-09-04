// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import {
	RELEASE_RECORD_SCHEMA,
	type ReleaseRecordPredicate,
	validateReleaseRecordPredicate,
} from "./release-record";

function validPredicate(): ReleaseRecordPredicate {
	return {
		_comment: ["Release evidence for solstone journal 1.0.23"],
		schema: RELEASE_RECORD_SCHEMA,
		product: "journal",
		version: "1.0.23",
		artifacts: [
			{
				url: "https://transparency.solstone.app/releases/solstone-journal/v/1.0.23/solstone_core-1.0.23.tar.gz",
				length: 1024,
				sha256:
					"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			},
		],
		does_prove: [
			"sol pbc built and recorded these exact bytes as the release artifact",
		],
		does_not_prove: [
			"the software is suitable for any particular purpose or free of defects",
		],
	};
}

describe("release-record predicate validator", () => {
	test("accepts a well-formed release-record predicate", async () => {
		const predicate = validPredicate();
		const result = await validateReleaseRecordPredicate(predicate as never);
		expect(result).toMatchObject({
			ok: true,
			value: predicate,
		});
	});

	test("rejects a non-record input", async () => {
		const result = await validateReleaseRecordPredicate(
			"not an object" as never,
		);
		expect(result).toMatchObject({
			ok: false,
			reason: "malformed",
		});
	});

	test("rejects invalid schema constant", async () => {
		const predicate = { ...validPredicate(), schema: "invalid-schema" };
		const result = await validateReleaseRecordPredicate(predicate as never);
		expect(result).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["schema"] },
		});
	});

	test("rejects missing or malformed _comment", async () => {
		const predicate = { ...validPredicate(), _comment: "not an array" };
		const result = await validateReleaseRecordPredicate(predicate as never);
		expect(result).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["_comment"] },
		});
	});

	test("rejects empty product or version string", async () => {
		const emptyProduct = { ...validPredicate(), product: "" };
		expect(
			await validateReleaseRecordPredicate(emptyProduct as never),
		).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["product"] },
		});

		const emptyVersion = { ...validPredicate(), version: "" };
		expect(
			await validateReleaseRecordPredicate(emptyVersion as never),
		).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["version"] },
		});
	});

	test("rejects malformed artifact entries", async () => {
		const badLength = {
			...validPredicate(),
			artifacts: [
				{
					url: "https://transparency.solstone.app/artifact.tar.gz",
					length: -1,
					sha256:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				},
			],
		};
		expect(
			await validateReleaseRecordPredicate(badLength as never),
		).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["artifacts", "0"] },
		});

		const badSha256 = {
			...validPredicate(),
			artifacts: [
				{
					url: "https://transparency.solstone.app/artifact.tar.gz",
					length: 100,
					sha256: "invalid-hex",
				},
			],
		};
		expect(
			await validateReleaseRecordPredicate(badSha256 as never),
		).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["artifacts", "0"] },
		});

		const emptyUrl = {
			...validPredicate(),
			artifacts: [
				{
					url: "",
					length: 100,
					sha256:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				},
			],
		};
		expect(
			await validateReleaseRecordPredicate(emptyUrl as never),
		).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["artifacts", "0"] },
		});
	});

	test("rejects duplicate artifact URLs", async () => {
		const duplicate = {
			...validPredicate(),
			artifacts: [
				{
					url: "https://transparency.solstone.app/artifact.tar.gz",
					length: 100,
					sha256:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				},
				{
					url: "https://transparency.solstone.app/artifact.tar.gz",
					length: 200,
					sha256:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				},
			],
		};
		expect(
			await validateReleaseRecordPredicate(duplicate as never),
		).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["artifacts"], expected: "artifacts with unique URLs" },
		});
	});

	test("rejects empty does_prove or does_not_prove arrays", async () => {
		const emptyProve = { ...validPredicate(), does_prove: [] };
		expect(
			await validateReleaseRecordPredicate(emptyProve as never),
		).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["does_prove"] },
		});

		const emptyNotProve = { ...validPredicate(), does_not_prove: [] };
		expect(
			await validateReleaseRecordPredicate(emptyNotProve as never),
		).toMatchObject({
			ok: false,
			reason: "malformed",
			detail: { path: ["does_not_prove"] },
		});
	});
});
