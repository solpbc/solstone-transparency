// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHash } from "node:crypto";
import {
	parseClientMetadata,
	parseRootDeclarations,
	verifyClientMetadata,
} from "./tuf/client-metadata";

/** Describe an explicitly supplied root; discovery itself grants no trust. */
export async function generateDiscovery(
	rootBytes: Uint8Array,
	base = "https://transparency.solstone.app/v2/",
) {
	const url = new URL(base);
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		!url.pathname.endsWith("/")
	)
		throw new Error("discovery-base-invalid");
	const root = parseClientMetadata("root", "root.json", rootBytes);
	if (!root.ok) throw new Error(root.reason);
	const declarations = parseRootDeclarations(root.value.signed);
	if (!declarations.ok) throw new Error(declarations.reason);
	const verified = await verifyClientMetadata(
		root.value,
		"root",
		declarations.value.roles.root,
		declarations.value.keys,
		undefined,
		true,
	);
	if (!verified.ok) throw new Error(verified.reason);
	return {
		protocol_version: "2.0.0",
		trust_note:
			"Obtain the root through a trusted channel. This discovery document does not establish trust.",
		tuf: {
			metadata_base: new URL("metadata/", url).href,
			targets_base: new URL("targets/", url).href,
			consistent_snapshot: declarations.value.consistentSnapshot,
			root_version: root.value.version,
			root_sha256: createHash("sha256").update(rootBytes).digest("hex"),
		},
		schemas: { base: new URL("schemas/", url).href },
		predicates: { base: new URL("predicates/", url).href },
		verifier: {
			source: "https://github.com/solpbc/solstone-transparency",
			license: "AGPL-3.0-only",
		},
		legacy: { register_base: "https://transparency.solstone.app/releases/" },
	};
}
