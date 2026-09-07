// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * `bun run src/v2view/build-cli.ts` — the `make build-model` half that writes
 * the v2 portal model. Not a verb of the public `solstone-transparency` CLI
 * (that command's verbs are the release rail's); this is portal build
 * plumbing and lives beside the model it emits.
 *
 *   --out <path>             where to write the model JSON (required)
 *   --root <path>            the pinned root envelope; absent → no v2 register
 *   --metadata-base <url>    default https://transparency.solstone.app/v2/metadata
 *   --targets-base <url>     default https://transparency.solstone.app/v2/targets
 *   --expect <p>@<v>[:basis] an expected release; repeatable; missing → gap
 *   --witness <label>=<url>  a witness location; repeatable; replaces defaults
 *   --now <iso-8601>         evaluation instant (tests and rehearsals)
 *
 * Exit 0 whenever a model was written, including the absent and unverified
 * models: an unreachable or unverifiable v2 repository is a STATE the portal
 * renders honestly, never a build failure that would hide the v1 register.
 * Exit 1 only for unusable arguments or an unwritable output path.
 */

import {
	type V2Expectation,
	type V2Witness,
	buildV2Model,
	parseExpectation,
} from "./build";

function flag(argv: string[], name: string): string | undefined {
	const index = argv.indexOf(name);
	return index >= 0 ? argv[index + 1] : undefined;
}

function flags(argv: string[], name: string): string[] {
	const out: string[] = [];
	argv.forEach((arg, index) => {
		const value = argv[index + 1];
		if (arg === name && value !== undefined) out.push(value);
	});
	return out;
}

export async function run(argv: string[]): Promise<number> {
	const outPath = flag(argv, "--out");
	if (!outPath) {
		console.error("v2 model build requires --out <path>");
		return 1;
	}
	const expectations: V2Expectation[] = [];
	for (const text of flags(argv, "--expect")) {
		const parsed = parseExpectation(text);
		if (parsed === undefined) {
			console.error(
				`--expect must be <product>@<version>[:basis], got ${text}`,
			);
			return 1;
		}
		expectations.push(parsed);
	}
	const witnessFlags = flags(argv, "--witness");
	const witnesses: V2Witness[] = [];
	for (const text of witnessFlags) {
		const eq = text.indexOf("=");
		if (eq <= 0) {
			console.error(`--witness must be <label>=<url>, got ${text}`);
			return 1;
		}
		witnesses.push({ label: text.slice(0, eq), url: text.slice(eq + 1) });
	}
	const nowText = flag(argv, "--now");
	const now = nowText ? new Date(nowText) : new Date();
	if (Number.isNaN(now.getTime())) {
		console.error(`--now must be an ISO-8601 instant, got ${nowText}`);
		return 1;
	}
	const model = await buildV2Model({
		metadataBase:
			flag(argv, "--metadata-base") ??
			"https://transparency.solstone.app/v2/metadata",
		targetsBase:
			flag(argv, "--targets-base") ??
			"https://transparency.solstone.app/v2/targets",
		rootPath: flag(argv, "--root"),
		now,
		expectations,
		witnesses: witnessFlags.length > 0 ? witnesses : undefined,
	});
	try {
		await Bun.write(outPath, `${JSON.stringify(model, null, 2)}\n`);
	} catch (error) {
		console.error(
			`could not write ${outPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 1;
	}
	if (model.state === "absent") {
		console.log(
			`wrote v2 portal model to ${outPath}: absent (${model.reason})`,
		);
	} else if (model.state === "unverified") {
		console.log(
			`wrote v2 portal model to ${outPath}: unverified (${model.failure.roleName ?? "?"}: ${model.failure.reason})`,
		);
	} else {
		const releases = model.software.filter((s) => s.kind === "release").length;
		const gaps = model.software.length - releases;
		console.log(
			`wrote v2 portal model to ${outPath}: verified, root v${model.root.version}, ${releases} release record(s), ${gaps} gap(s), legacy ${model.legacy.state}, timestamp asserted until ${model.freshness.assertedUntil}`,
		);
	}
	return 0;
}

if (import.meta.main) {
	process.exit(await run(process.argv.slice(2)));
}
