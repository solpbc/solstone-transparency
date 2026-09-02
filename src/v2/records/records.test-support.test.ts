// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { basePolicy, generatedKey } from "./records.test-support";

test("synthetic record fixtures expose only the two approved Wave 2 signing roles", async () => {
	const release = await generatedKey();
	const audit = await generatedKey();
	expect(
		basePolicy(release, audit).roles.map((role) => [
			role.id,
			role.keyids.length,
		]),
	).toEqual([
		["producer.release", 1],
		["producer.image", 0],
		["verifier.repro", 0],
		["verifier.audit", 1],
		["appraiser.runtime", 0],
		["key-events", 0],
	]);
});
