// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import {
	TUF_CLIENT_FINGERPRINT_DOMAIN,
	type TufFingerprintView,
	computeTufFingerprint,
} from "./fingerprint";

function fingerprintView() {
	return {
		metadata: {
			root: { version: 1, signed: { _type: "root", marker: "root" } },
			timestamp: {
				version: 1,
				signed: { _type: "timestamp", marker: "timestamp" },
			},
			snapshot: {
				version: 1,
				signed: { _type: "snapshot", marker: "snapshot" },
			},
			targets: {
				version: 1,
				signed: { _type: "targets", marker: "targets" },
			},
			"targets/software": {
				version: 1,
				signed: { _type: "targets", marker: "delegated" },
			},
		},
		targets: {
			targets: {},
			"targets/software": {
				"software/release.json": {
					length: 1,
					hashes: { sha256: "a".repeat(64) },
				},
			},
		},
		roleStatuses: [
			{ roleName: "root", state: "verified" as const, version: 1 },
			{ roleName: "timestamp", state: "verified" as const, version: 1 },
			{ roleName: "snapshot", state: "verified" as const, version: 1 },
			{ roleName: "targets", state: "verified" as const, version: 1 },
			{
				roleName: "targets/software",
				state: "verified" as const,
				version: 1,
			},
		],
	} satisfies TufFingerprintView;
}

async function expectFingerprintChange(
	mutate: (view: ReturnType<typeof fingerprintView>) => void,
): Promise<void> {
	const original = await computeTufFingerprint(fingerprintView());
	const changedView = fingerprintView();
	mutate(changedView);
	const changed = await computeTufFingerprint(changedView);
	expect(original.ok).toBe(true);
	expect(changed.ok).toBe(true);
	if (!original.ok || !changed.ok) return;
	expect(changed.value).not.toBe(original.value);
}

test("fingerprint is stable for canonical-equivalent views", async () => {
	const first = await computeTufFingerprint(fingerprintView());
	const reordered = fingerprintView();
	reordered.metadata.root.signed = { marker: "root", _type: "root" };
	const second = await computeTufFingerprint(reordered);
	expect(first.ok).toBe(true);
	expect(second.ok).toBe(true);
	if (!first.ok || !second.ok) return;
	expect(first.value).toBe(second.value);
	expect(TUF_CLIENT_FINGERPRINT_DOMAIN).toBe(
		"solstone-transparency:tuf-client-fingerprint:v1",
	);
});

test("fingerprint changes when trusted root changes", async () => {
	await expectFingerprintChange((view) => {
		view.metadata.root.signed.marker = "changed-root";
	});
});

test("fingerprint changes when timestamp changes", async () => {
	await expectFingerprintChange((view) => {
		view.metadata.timestamp.signed.marker = "changed-timestamp";
	});
});

test("fingerprint changes when snapshot changes", async () => {
	await expectFingerprintChange((view) => {
		view.metadata.snapshot.signed.marker = "changed-snapshot";
	});
});

test("fingerprint changes when top-level targets changes", async () => {
	await expectFingerprintChange((view) => {
		view.metadata.targets.signed.marker = "changed-targets";
	});
});

test("fingerprint changes when delegated targets metadata changes", async () => {
	await expectFingerprintChange((view) => {
		view.metadata["targets/software"].signed.marker = "changed-delegated";
	});
});

test("fingerprint changes when a recorded target digest changes", async () => {
	await expectFingerprintChange((view) => {
		view.targets["targets/software"]["software/release.json"].hashes.sha256 =
			"b".repeat(64);
	});
});

test("fingerprint distinguishes failed and never-checked states", async () => {
	const base = { metadata: {}, targets: {} };
	const failed = await computeTufFingerprint({
		...base,
		roleStatuses: [
			{ roleName: "timestamp", state: "failed", reason: "unavailable" },
		],
	});
	const never = await computeTufFingerprint({
		...base,
		roleStatuses: [{ roleName: "timestamp", state: "never-checked" }],
	});
	expect(failed.ok).toBe(true);
	expect(never.ok).toBe(true);
	if (!failed.ok || !never.ok) return;
	expect(failed.value).not.toBe(never.value);
});
