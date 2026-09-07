// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCeremonyKey, terminalPassphrase } from "./ceremony-key";

const saved = {
	stdinTTY: Object.getOwnPropertyDescriptor(process.stdin, "isTTY"),
	stderrTTY: Object.getOwnPropertyDescriptor(process.stderr, "isTTY"),
	raw: Object.getOwnPropertyDescriptor(process.stdin, "isRaw"),
	setRaw: Object.getOwnPropertyDescriptor(process.stdin, "setRawMode"),
};
let restoreMocks: (() => void)[] = [];

test("multiple PEM blocks are refused before a passphrase prompt", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ceremony-pem-test-"));
	try {
		const path = join(directory, "synthetic.pem");
		const block =
			"-----BEGIN ENCRYPTED PRIVATE KEY-----\nQUJD\n-----END ENCRYPTED PRIVATE KEY-----\n";
		await writeFile(path, block + block);
		await expect(readCeremonyKey(path)).rejects.toThrow(
			"encrypted-key-required",
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
afterEach(() => {
	for (const restore of restoreMocks) restore();
	restoreMocks = [];
	for (const [object, key, descriptor] of [
		[process.stdin, "isTTY", saved.stdinTTY],
		[process.stderr, "isTTY", saved.stderrTTY],
		[process.stdin, "isRaw", saved.raw],
		[process.stdin, "setRawMode", saved.setRaw],
	] as const) {
		if (descriptor) Object.defineProperty(object, key, descriptor);
		else Reflect.deleteProperty(object, key);
	}
});

function terminal(prompt?: () => void) {
	let raw = false;
	Object.defineProperty(process.stdin, "isTTY", {
		configurable: true,
		value: true,
	});
	Object.defineProperty(process.stderr, "isTTY", {
		configurable: true,
		value: true,
	});
	Object.defineProperty(process.stdin, "isRaw", {
		configurable: true,
		get: () => raw,
	});
	Object.defineProperty(process.stdin, "setRawMode", {
		configurable: true,
		value: (value: boolean) => {
			raw = value;
			return process.stdin;
		},
	});
	const write = spyOn(process.stderr, "write").mockImplementation((value) => {
		if (String(value).startsWith("passphrase for")) {
			expect(raw).toBe(true);
			prompt?.();
		}
		return true;
	});
	const resume = spyOn(process.stdin, "resume").mockImplementation(
		() => process.stdin,
	);
	const pause = spyOn(process.stdin, "pause").mockImplementation(
		() => process.stdin,
	);
	restoreMocks.push(
		() => write.mockRestore(),
		() => resume.mockRestore(),
		() => pause.mockRestore(),
	);
	return () => raw;
}

test("signal at prompt sees installed cleanup handlers and restores the terminal", async () => {
	const before = process.listenerCount("SIGTERM");
	const raw = terminal(() => process.emit("SIGTERM"));
	await expect(terminalPassphrase("synthetic")).rejects.toThrow(
		"ceremony-interrupted",
	);
	expect(raw()).toBe(false);
	expect(process.listenerCount("SIGTERM")).toBe(before);
});

test("typed synthetic passphrase is returned without echo and terminal state restored", async () => {
	const raw = terminal();
	const pending = terminalPassphrase("synthetic");
	process.stdin.emit("data", Buffer.from("synthetic-only\r"));
	const value = await pending;
	expect(value.toString()).toBe("synthetic-only");
	expect(raw()).toBe(false);
	value.fill(0);
});

test("raw Ctrl-C rejects and removes listeners", async () => {
	const before = process.stdin.listenerCount("data");
	const raw = terminal();
	const pending = terminalPassphrase("synthetic");
	process.stdin.emit("data", Buffer.from([3]));
	await expect(pending).rejects.toThrow("ceremony-interrupted");
	expect(raw()).toBe(false);
	expect(process.stdin.listenerCount("data")).toBe(before);
});
