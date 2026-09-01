// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { verifyMinisig } from "./minisign";
import { generateThrowawayKeypair } from "./test-helpers";

describe("verifyMinisig", () => {
	test("a genuinely signed payload verifies and returns its trusted comment", async () => {
		const kp = await generateThrowawayKeypair();
		const data = new TextEncoder().encode("hello world");
		const sig = await kp.sign(data, "a test comment");
		const result = await verifyMinisig(kp.pubKeyText, sig, data);
		expect(result.verified).toBe(true);
		expect(result.trustedComment).toBe("a test comment");
	});

	test("a tampered payload fails verification, and is not reported as tool-unavailable", async () => {
		const kp = await generateThrowawayKeypair();
		const data = new TextEncoder().encode("hello world");
		const sig = await kp.sign(data, "a test comment");
		const tampered = new TextEncoder().encode("hello worlD");
		const result = await verifyMinisig(kp.pubKeyText, sig, tampered);
		expect(result.verified).toBe(false);
		expect(result.toolUnavailable).toBeFalsy();
	});

	test("a signature from a different keypair fails against this public key", async () => {
		const kp1 = await generateThrowawayKeypair();
		const kp2 = await generateThrowawayKeypair();
		const data = new TextEncoder().encode("hello world");
		const sig = await kp2.sign(data, "signed by kp2");
		const result = await verifyMinisig(kp1.pubKeyText, sig, data);
		expect(result.verified).toBe(false);
	});

	// A "binary genuinely missing" test is deliberately not exercised here via
	// `process.env.PATH` mutation: confirmed by direct experiment that Bun's
	// ambient PATH resolution for `Bun.spawn` is captured independent of a
	// mid-process `process.env.PATH` write (an explicit `env:` spawn option
	// DOES correctly produce ENOENT, and a genuinely nonexistent command name
	// does too) — mutating the live `process.env.PATH` after startup does not
	// reproduce the "binary missing" condition in this runtime, so a test
	// built on that premise would assert a scenario that isn't what it claims
	// to be. `verifyMinisig`'s `toolUnavailable` branch is exercised by the
	// `Bun.spawn` ENOENT catch path directly; see `minisign.ts`.
});
