// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import {
	logicalTargetPathFromStoragePath,
	targetStoragePath,
} from "./target-storage";

const SHA256 =
	"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("target storage paths", () => {
	test("round trips a logical path without consistent snapshots", () => {
		const context = { sha256: SHA256, consistentSnapshot: false };
		const storagePath = targetStoragePath(
			"software/journal/1.0.0/release.json",
			context,
		);

		expect(storagePath).toEqual({
			ok: true,
			value: "software/journal/1.0.0/release.json",
		});
		if (!storagePath.ok) throw new Error("expected target storage path");
		expect(
			logicalTargetPathFromStoragePath(storagePath.value, context),
		).toEqual(storagePath);
	});

	test("round trips a nested logical path with consistent snapshots", () => {
		const context = { sha256: SHA256, consistentSnapshot: true };
		const storagePath = targetStoragePath(
			"software/journal/1.0.0/release.json",
			context,
		);

		expect(storagePath).toEqual({
			ok: true,
			value: `software/journal/1.0.0/${SHA256}.release.json`,
		});
		if (!storagePath.ok) throw new Error("expected target storage path");
		expect(
			logicalTargetPathFromStoragePath(storagePath.value, context),
		).toEqual({
			ok: true,
			value: "software/journal/1.0.0/release.json",
		});
	});

	test("rejects unsafe logical target paths", () => {
		expect(
			targetStoragePath("software/../release.json", {
				sha256: SHA256,
				consistentSnapshot: true,
			}),
		).toMatchObject({ ok: false, reason: "unsafe-target-path" });
	});

	test("rejects malformed SHA-256 values", () => {
		expect(
			targetStoragePath("release.json", {
				sha256: "ABC",
				consistentSnapshot: true,
			}),
		).toMatchObject({ ok: false, reason: "malformed" });
	});

	test("rejects a different SHA-256 prefix when parsing a storage path", () => {
		const otherSha256 =
			"fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
		expect(
			logicalTargetPathFromStoragePath(`${otherSha256}.release.json`, {
				sha256: SHA256,
				consistentSnapshot: true,
			}),
		).toMatchObject({ ok: false, reason: "hash-mismatch" });
	});

	test("does not fall back to a raw target name in consistent-snapshot mode", () => {
		expect(
			logicalTargetPathFromStoragePath("release.json", {
				sha256: SHA256,
				consistentSnapshot: true,
			}),
		).toMatchObject({ ok: false, reason: "malformed" });
	});
});
