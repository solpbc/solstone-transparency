// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TrustStoreState } from "../src/v2/tuf/trust-store";
import { openFileTrustStore } from "../src/v2/tuf/trust-store";
import { verifierInputs } from "./verify-release";

// verifierInputs backs both verify-release and audit-v2 (bin/audit-v2.ts imports it),
// so this is the one place that guards the ambient-trust-store defect for both commands.

// ephemeralTrustStore.replace() does not validate its argument's shape (unlike
// openFileTrustStore, which round-trips through the canonical-JSON parser); any
// object stands in for a "some root got accepted here" write for this test's purpose.
const FAKE_ACCEPTED_STATE = {
	fake: "accepted-root",
} as unknown as TrustStoreState;

test("verifierInputs gives every --store-less call its own ephemeral trust store", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-verifier-inputs-"),
	);
	try {
		const rootPath = join(directory, "root.json");
		await writeFile(rootPath, "not a real root, only stat/read matter here");

		const first = await verifierInputs({ root: rootPath });
		const accepted = await first.trustStore.replace(
			undefined,
			FAKE_ACCEPTED_STATE,
		);
		expect(accepted).toEqual({ ok: true, value: undefined });
		expect(await first.trustStore.read()).toEqual({
			ok: true,
			value: { state: FAKE_ACCEPTED_STATE, revision: "1" },
		});

		// A second --store-less call must not see the first call's accepted root --
		// this is exactly the ambient-trust-store defect this test guards against.
		const second = await verifierInputs({ root: rootPath });
		expect(await second.trustStore.read()).toEqual({
			ok: true,
			value: undefined,
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("verifierInputs opens a persisted store only when --store is given explicitly", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "solstone-transparency-verifier-inputs-store-"),
	);
	try {
		const rootPath = join(directory, "root.json");
		await writeFile(rootPath, "not a real root, only stat/read matter here");
		const storePath = join(directory, "nested", "trust.json");

		const inputs = await verifierInputs({ root: rootPath, store: storePath });
		expect(await inputs.trustStore.read()).toEqual({
			ok: true,
			value: undefined,
		});

		// The store directory did not exist before this call; verifierInputs creates it,
		// and a plain openFileTrustStore at the same path sees exactly what was written.
		const reopened = openFileTrustStore(storePath);
		expect(await reopened.read()).toEqual({ ok: true, value: undefined });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
