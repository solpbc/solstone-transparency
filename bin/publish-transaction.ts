#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
	type ArtifactDeliveryState,
	PublicationError,
	publishTransaction,
} from "../src/v2/publication";
import { loadR2Transport } from "../src/v2/s3-transport";

const HELP = `publish-transaction --repository DIR --manifest FILE --prefix PREFIX --receipt FILE
  [--credentials FILE --bucket NAME] [--delivery STATE] [--timestamp-only] [--dry-run] [--json]

upload a composed, locally verified repository with timestamp.json last.
--manifest       publication-manifest-v1: files [{path, sha256, length}], expectedTimestampSha256 (digest or null)
--prefix         v2/ or a normalized staging/v2/ prefix
--receipt        new receipt file outside the repository; retained on failure
--credentials    R2 credential JSON file (endpoint, access_key_id, secret_access_key)
--bucket         R2 bucket name; required except with --dry-run
--delivery       observed artifact delivery: not_attempted, failed, succeeded, ambiguous
--timestamp-only permit only metadata/timestamp.json
--dry-run        check local bytes and save a plan without network access or credentials
--json           print the machine-readable result (also the default)

this command does not deliver artifacts, sign metadata, or verify TUF signatures.
archive receipt remains null until a v2 archive channel is configured.
exit 0: byte publication verified or dry run valid; 1: operation failed; 2: invalid arguments.
`;

export async function publicationMain(args: string[]): Promise<number> {
	try {
		const { values } = parseArgs({
			args,
			strict: true,
			allowPositionals: false,
			options: {
				repository: { type: "string" },
				manifest: { type: "string" },
				prefix: { type: "string" },
				receipt: { type: "string" },
				credentials: { type: "string" },
				bucket: { type: "string" },
				delivery: { type: "string" },
				"timestamp-only": { type: "boolean" },
				"dry-run": { type: "boolean" },
				json: { type: "boolean" },
				help: { type: "boolean" },
			},
		});
		if (values.help) {
			console.log(HELP);
			return 0;
		}
		if (
			!values.repository ||
			!values.manifest ||
			!values.prefix ||
			!values.receipt ||
			(!values["dry-run"] && (!values.credentials || !values.bucket))
		) {
			console.log(JSON.stringify({ ok: false, reason: "invalid-arguments" }));
			return 2;
		}
		const manifest: unknown = JSON.parse(
			await readFile(values.manifest, "utf8"),
		);
		const transport = values["dry-run"]
			? undefined
			: await loadR2Transport({
					credentialsPath: values.credentials ?? "",
					bucket: values.bucket ?? "",
					prefix: values.prefix,
				});
		const result = await publishTransaction({
			repositoryDir: values.repository,
			manifest,
			prefix: values.prefix,
			receiptPath: values.receipt,
			transport,
			dryRun: values["dry-run"],
			timestampOnly: values["timestamp-only"],
			delivery: values.delivery as ArtifactDeliveryState | undefined,
		});
		console.log(JSON.stringify(result));
		return result.ok ? 0 : 1;
	} catch (error) {
		console.log(
			JSON.stringify({
				ok: false,
				reason:
					error instanceof PublicationError
						? error.reason
						: "invalid-arguments",
			}),
		);
		return error instanceof PublicationError ? 1 : 2;
	}
}

if (import.meta.main)
	process.exitCode = await publicationMain(process.argv.slice(2));
