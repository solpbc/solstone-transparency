// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHash } from "node:crypto";
import { PREDICATE_URI_BASE } from "./records/predicates";
import {
	parseClientMetadata,
	parseRootDeclarations,
	verifyClientMetadata,
} from "./tuf/client-metadata";

/**
 * Where a record's `schema` identifier resolves: the identifier appended to
 * this base, with no transformation. Fixed to the evidence host's top-level
 * `schemas/` prefix, which carries an indefinite retention lock, so it does
 * not move with the repository base the way `metadata/` and `targets/` do.
 */
export const SCHEMA_URI_BASE = "https://transparency.solstone.app/schemas/";

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
		// The predicate base is the one every signed record embeds
		// (`PREDICATE_URI_BASE`), fixed by signature; it and the schema base
		// are properties of the evidence host, not of the repository prefix.
		schemas: { base: SCHEMA_URI_BASE },
		predicates: { base: PREDICATE_URI_BASE },
		verifier: {
			source: "https://github.com/solpbc/solstone-transparency",
			license: "AGPL-3.0-only",
		},
		legacy: { register_base: "https://transparency.solstone.app/releases/" },
	};
}
