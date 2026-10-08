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

const hex = (character: string) => character.repeat(64);
function component(target: string, id: string, delivery: string) {
	return {
		target,
		id,
		version: "1.0.0",
		delivery,
		source: `https://example.invalid/${id}`,
		inputs: [{ name: `${id}.tar.gz`, sha256: hex("1") }],
		members:
			delivery === "bundled" ? [{ path: `bin/${id}`, sha256: hex("2") }] : [],
	};
}
function withComponents() {
	return {
		...validPredicate(),
		component_targets: ["linux-aarch64", "linux-x86_64"],
		components: [
			component("linux-aarch64", "beta", "runtime-downloaded"),
			component("linux-x86_64", "alpha", "bundled"),
			component("linux-x86_64", "beta", "runtime-downloaded"),
		],
		component_baseline: "1.0.22",
		component_transitions: [
			{ target: "linux-aarch64", id: "gamma", from: "bundled", to: "absent" },
			{
				target: "linux-x86_64",
				id: "alpha",
				from: "runtime-downloaded",
				to: "bundled",
			},
		],
	};
}
/** Applies `change` to a record with components and returns the validation result, after checking the unchanged twin validates. */
async function variant(
	change: (predicate: Record<string, unknown>) => unknown,
) {
	expect(
		(await validateReleaseRecordPredicate(withComponents() as never)).ok,
	).toBe(true);
	const predicate: Record<string, unknown> = withComponents();
	const changed = JSON.parse(JSON.stringify(change(predicate) ?? predicate));
	return validateReleaseRecordPredicate(changed as never);
}

describe("release-record component inventory", () => {
	test("a record without components validates to exactly the fields it had before", async () => {
		const result = await validateReleaseRecordPredicate(
			validPredicate() as never,
		);
		if (!result.ok) throw new Error("expected ok");
		expect(Object.keys(result.value)).toEqual([
			"_comment",
			"schema",
			"product",
			"version",
			"artifacts",
			"does_prove",
			"does_not_prove",
		]);
		expect(JSON.stringify(result.value)).toBe(JSON.stringify(validPredicate()));
	});

	test("preserves the component fields in a fixed position", async () => {
		const predicate = withComponents();
		const result = await validateReleaseRecordPredicate(predicate as never);
		if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result)}`);
		expect(result.value).toStrictEqual(predicate as never);
		expect(Object.keys(result.value)).toEqual([
			"_comment",
			"schema",
			"product",
			"version",
			"artifacts",
			"component_targets",
			"components",
			"component_baseline",
			"component_transitions",
			"does_prove",
			"does_not_prove",
		]);
	});

	test("a covered target with no rows, and a record with no transitions, are valid", async () => {
		const result = await variant((predicate) => {
			predicate.component_targets = [
				"linux-aarch64",
				"linux-x86_64",
				"macos-arm64",
			];
			predicate.component_transitions = undefined;
		});
		expect(result.ok).toBe(true);
		const emptied = await variant((predicate) => {
			predicate.components = [];
			predicate.component_transitions = [
				{ target: "linux-x86_64", id: "alpha", from: "bundled", to: "absent" },
			];
		});
		expect(emptied.ok).toBe(true);
	});

	const unpaired: [string, string[], string][] = [
		[
			"component_targets alone",
			["components", "component_baseline", "component_transitions"],
			"component_targets",
		],
		[
			"components alone",
			["component_targets", "component_baseline", "component_transitions"],
			"components",
		],
		[
			"component_baseline alone",
			["component_targets", "components", "component_transitions"],
			"component_baseline",
		],
		[
			"components without component_targets",
			["component_targets"],
			"components",
		],
		[
			"components without component_baseline",
			["component_baseline"],
			"component_targets",
		],
		[
			"component_transitions alone",
			["component_targets", "components", "component_baseline"],
			"component_transitions",
		],
	];
	for (const [name, removed, path] of unpaired) {
		test(`rejects ${name}, and accepts the complete twin`, async () => {
			expect(
				await variant((predicate) => {
					for (const key of removed) predicate[key] = undefined;
				}),
			).toMatchObject({
				ok: false,
				reason: "malformed",
				detail: { path: [path] },
			});
		});
	}

	const invalid: [
		string,
		(predicate: Record<string, unknown>) => void,
		string[],
	][] = [
		[
			"component_targets out of order",
			(predicate) => {
				predicate.component_targets = ["linux-x86_64", "linux-aarch64"];
			},
			["component_targets", "1"],
		],
		[
			"a duplicate in component_targets",
			(predicate) => {
				predicate.component_targets = [
					"linux-aarch64",
					"linux-aarch64",
					"linux-x86_64",
				];
			},
			["component_targets", "1"],
		],
		[
			"a row whose target is not in component_targets",
			(predicate) => {
				predicate.component_targets = ["linux-x86_64"];
				predicate.component_transitions = undefined;
			},
			["components", "0", "target"],
		],
		[
			"a transition whose target is not in component_targets",
			(predicate) => {
				predicate.component_targets = ["linux-aarch64", "linux-x86_64"];
				predicate.component_transitions = [
					{ target: "macos-arm64", id: "delta", from: "bundled", to: "absent" },
				];
			},
			["component_transitions", "0", "target"],
		],
		[
			"an empty baseline",
			(predicate) => {
				predicate.component_baseline = "";
			},
			["component_baseline"],
		],
		[
			"an unsafe baseline",
			(predicate) => {
				predicate.component_baseline = "../1.0.22";
			},
			["component_baseline"],
		],
		[
			"a baseline equal to the record's own version",
			(predicate) => {
				predicate.component_baseline = predicate.version;
			},
			["component_baseline"],
		],
		[
			"rows out of (target, id) order",
			(predicate) => {
				const rows = predicate.components as unknown[];
				predicate.components = [rows[1], rows[0], rows[2]];
			},
			["components", "1"],
		],
		[
			"a duplicate (target, id)",
			(predicate) => {
				const rows = predicate.components as unknown[];
				predicate.components = [rows[0], rows[1], rows[1]];
			},
			["components", "2"],
		],
		[
			"a row without a target",
			(predicate) => {
				const rows = predicate.components as Record<string, unknown>[];
				rows[0] = { ...rows[0], target: undefined };
			},
			["components", "0"],
		],
		[
			"an unsafe row target",
			(predicate) => {
				const rows = predicate.components as Record<string, unknown>[];
				rows[0] = { ...rows[0], target: "../linux" };
			},
			["components", "0", "target"],
		],
		[
			"a bundled row with no members",
			(predicate) => {
				const rows = predicate.components as Record<string, unknown>[];
				rows[1] = { ...rows[1], members: [] };
			},
			["components", "1", "members"],
		],
		[
			"a member path outside bin/, lib/ and share/",
			(predicate) => {
				const rows = predicate.components as Record<string, unknown>[];
				rows[1] = {
					...rows[1],
					members: [{ path: "etc/alpha", sha256: hex("2") }],
				};
			},
			["components", "1", "members", "0"],
		],
		[
			"a C1 control character in a member path",
			(predicate) => {
				const rows = predicate.components as Record<string, unknown>[];
				rows[1] = {
					...rows[1],
					members: [{ path: "bin/alpha\u0085", sha256: hex("2") }],
				};
			},
			["components", "1", "members", "0"],
		],
	];
	for (const [name, change, path] of invalid) {
		test(`rejects ${name}, and accepts the valid twin`, async () => {
			expect(await variant(change)).toMatchObject({
				ok: false,
				reason: "malformed",
				detail: { path },
			});
		});
	}

	const invalidTransitions: [string, (rows: unknown[]) => unknown][] = [
		[
			"a transition to absent for a listed component",
			(rows) => [
				rows[0],
				{ ...(rows[1] as object), from: "bundled", to: "absent" },
			],
		],
		[
			"a to state other than the listed delivery",
			(rows) => [rows[0], { ...(rows[1] as object), to: "runtime-downloaded" }],
		],
		[
			"a transition to a state for an unlisted component",
			(rows) => [rows[0], rows[1], { ...(rows[1] as object), id: "zeta" }],
		],
		["from equal to to", (rows) => [{ ...(rows[0] as object), to: "bundled" }]],
		["transitions out of order", (rows) => [rows[1], rows[0]]],
		["a duplicate transition", (rows) => [rows[0], rows[0]]],
		[
			"an unknown state",
			(rows) => [{ ...(rows[0] as object), from: "vendored" }],
		],
		["an extra key", (rows) => [{ ...(rows[0] as object), note: "synthetic" }]],
		["not an array", (rows) => rows[0]],
	];
	for (const [name, mutate] of invalidTransitions) {
		test(`rejects transitions with ${name}, and accepts the valid twin`, async () => {
			expect(
				await variant((predicate) => {
					predicate.component_transitions = mutate(
						predicate.component_transitions as unknown[],
					);
				}),
			).toMatchObject({ ok: false, reason: "malformed" });
		});
	}
});
