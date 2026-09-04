// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import {
	MIGRATION_MANIFEST_PREDICATE_TYPE,
	RELEASE_RECORD_PREDICATE_TYPE,
	validateKnownPredicate,
} from "./predicates";
import { migrationPredicate } from "./records.test-support";

describe("predicate registry", () => {
	test("AC 12: migration and release-record URIs are recognized", async () => {
		const fixture = await migrationPredicate();
		expect(
			await validateKnownPredicate(
				MIGRATION_MANIFEST_PREDICATE_TYPE,
				fixture.predicate as never,
			),
		).toMatchObject({ ok: true });
		expect(
			await validateKnownPredicate(RELEASE_RECORD_PREDICATE_TYPE, {}),
		).toMatchObject({ ok: false, reason: "malformed" });
		expect(
			await validateKnownPredicate("https://example.invalid/new", {}),
		).toMatchObject({ ok: false, reason: "unrecognized-predicate" });
	});

	test("AC 12: a known migration predicate with a bad body is predicate-malformed", async () => {
		const fixture = await migrationPredicate();
		const malformed = { ...fixture.predicate, object_count: 2 };
		expect(
			await validateKnownPredicate(
				MIGRATION_MANIFEST_PREDICATE_TYPE,
				malformed as never,
			),
		).toMatchObject({ ok: false, reason: "predicate-malformed" });
	});
});
