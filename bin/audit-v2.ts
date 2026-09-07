#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile, stat } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
	DEFAULT_DELIVERY_LANES,
	type DeliveryLane,
	auditDeliveryHeads,
} from "../src/v2/release-verifier";
import {
	DEFAULT_MAX_METADATA_BYTES,
	admitTufJson,
} from "../src/v2/tuf/admission";
import { verifierInputs } from "./verify-release";

async function readLanes(path: string): Promise<readonly DeliveryLane[]> {
	const info = await stat(path);
	if (!info.isFile() || info.size > DEFAULT_MAX_METADATA_BYTES)
		throw new Error("invalid-lanes");
	const parsed = admitTufJson(new Uint8Array(await readFile(path)));
	if (
		!parsed.ok ||
		!Array.isArray(parsed.value) ||
		parsed.value.length === 0 ||
		parsed.value.length > 64
	)
		throw new Error("invalid-lanes");
	return parsed.value.map((lane) => {
		if (
			lane === null ||
			typeof lane !== "object" ||
			Array.isArray(lane) ||
			typeof lane.product !== "string" ||
			typeof lane.latestUrl !== "string" ||
			(lane.format !== "version-line" && lane.format !== "github-release")
		)
			throw new Error("invalid-lanes");
		return {
			product: lane.product,
			latestUrl: lane.latestUrl,
			format: lane.format,
		};
	});
}

export async function runAuditV2(args: string[]): Promise<number> {
	try {
		const { values } = parseArgs({
			args,
			options: {
				root: { type: "string" },
				"metadata-base": { type: "string" },
				"targets-base": { type: "string" },
				store: { type: "string" },
				lanes: { type: "string" },
				json: { type: "boolean" },
				help: { type: "boolean" },
			},
			strict: true,
			allowPositionals: false,
		});
		if (values.help) {
			console.log(`Usage: audit-v2 --root FILE [--lanes FILE] [--metadata-base URL] [--targets-base URL] [--store FILE] [--json]

Discover the current version from each configured delivery lane and check its release record.
Coverage is delivery heads only, not a complete history. The default lane is journal release/latest.
A lanes file is a JSON array of {product, latestUrl, format}; format is version-line or github-release.
Missing records are gaps. Unavailable lanes and rejected evidence have separate outcomes.
Exit 0 means every head passed; exit 1 means a gap or failed check; exit 2 means unreadable inputs.`);
			return 0;
		}
		const lanes = values.lanes
			? await readLanes(values.lanes)
			: DEFAULT_DELIVERY_LANES;
		const result = await auditDeliveryHeads(
			lanes,
			await verifierInputs(values),
		);
		if (values.json) console.log(JSON.stringify(result, null, 2));
		else {
			console.log("coverage: delivery heads only");
			for (const head of result.heads)
				console.log(
					`${head.product}: ${head.state}${"version" in head ? ` ${head.version}` : ""}${"reason" in head ? ` (${head.reason})` : ""}`,
				);
		}
		return result.ok ? 0 : 1;
	} catch {
		console.error(
			JSON.stringify({
				ok: false,
				reason: "input-unavailable",
				message:
					"Supply a readable local --root file and valid --lanes JSON if used. Use --help for options.",
			}),
		);
		return 2;
	}
}

if (import.meta.main)
	process.exitCode = await runAuditV2(process.argv.slice(2));
