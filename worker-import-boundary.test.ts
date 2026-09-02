// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { isAbsolute, relative, resolve, sep } from "node:path";

const repoRoot = import.meta.dir;
const workerEntry = resolve(repoRoot, "worker.ts");
const fixtureEntry = resolve(
	repoRoot,
	"test/fixtures/worker-imports-v2.fixture.ts",
);
const v2Root = resolve(repoRoot, "src/v2");

function isUnderV2(path: string): boolean {
	if (path.includes(":")) return false;
	const fromV2 = relative(v2Root, resolve(repoRoot, path));
	return (
		fromV2 === "" ||
		(!fromV2.startsWith(`..${sep}`) && fromV2 !== ".." && !isAbsolute(fromV2))
	);
}

async function reachableInputs(entrypoint: string): Promise<Set<string>> {
	const result = await Bun.build({
		entrypoints: [entrypoint],
		target: "browser",
		metafile: true,
		plugins: [
			{
				name: "model-generated-json-stub",
				setup(build) {
					build.onResolve(
						{ filter: /^\.\/model\.generated\.json$/ },
						(args) => {
							if (
								resolve(args.resolveDir, args.path) !==
								resolve(repoRoot, "model.generated.json")
							) {
								return undefined;
							}
							return { path: "model.generated.json", namespace: "model-stub" };
						},
					);
					build.onLoad({ filter: /.*/, namespace: "model-stub" }, () => ({
						contents: "{}",
						loader: "json",
					}));
				},
			},
		],
	});
	if (!result.success || result.metafile === undefined) {
		throw new Error(
			`static module-graph build failed: ${result.logs.map(String).join("\n")}`,
		);
	}
	return new Set(Object.keys(result.metafile.inputs));
}

test("worker's static module graph excludes v2, and the graph check detects a v2 import", async () => {
	const workerInputs = await reachableInputs(workerEntry);
	expect([...workerInputs].filter(isUnderV2)).toEqual([]);

	const fixtureInputs = await reachableInputs(fixtureEntry);
	expect([...fixtureInputs].some(isUnderV2)).toBe(true);
});
