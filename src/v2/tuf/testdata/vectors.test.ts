// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { loadTufConformanceVectors } from "./vectors";

test("loads and integrity-checks the independent TUF conformance vectors", async () => {
	const vectors = await loadTufConformanceVectors();
	expect(vectors.canonical_json).toHaveLength(9);
	expect(vectors.keyid).toHaveLength(3);
});
