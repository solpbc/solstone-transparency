// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createPrivateKey, createPublicKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import { type Ed25519SigningKey, computeKeyId } from "./tuf/ed25519";

/** Read a passphrase from the controlling terminal without echo or alternative inputs. */
export async function terminalPassphrase(label: string): Promise<Buffer> {
	if (!process.stdin.isTTY || !process.stderr.isTTY)
		throw new Error("tty-required: run at an interactive terminal");
	const input = process.stdin;
	const wasRaw = input.isRaw;
	const safeLabel = Array.from(label, (char) =>
		char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? "?" : char,
	).join("");
	return new Promise((resolve, reject) => {
		const secret = Buffer.alloc(4096);
		let length = 0;
		let finished = false;
		const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
		const onSignal = () => finish(new Error("ceremony-interrupted"));
		const finish = (error?: Error) => {
			let failure = error;
			if (finished) return;
			finished = true;
			for (const signal of signals) process.off(signal, onSignal);
			input.off("data", onData);
			input.off("error", onError);
			input.off("end", onEnd);
			try {
				input.setRawMode(wasRaw);
			} catch {
				failure ??= new Error("terminal-restore-failed");
			} finally {
				input.pause();
			}
			const result = Buffer.from(secret.subarray(0, length));
			secret.fill(0);
			try {
				process.stderr.write("\n");
			} catch {
				failure ??= new Error("terminal-write-failed");
			}
			if (failure) {
				result.fill(0);
				reject(failure);
			} else resolve(result);
		};
		const onError = () => finish(new Error("terminal-read-failed"));
		const onEnd = () => finish(new Error("terminal-closed"));
		const onData = (chunk: Buffer) => {
			for (const byte of chunk) {
				if (byte === 3 || byte === 4) {
					finish(new Error("ceremony-interrupted"));
					return;
				}
				if (byte === 13 || byte === 10) {
					finish();
					return;
				}
				if (byte === 127 || byte === 8) {
					if (length > 0) secret[--length] = 0;
					continue;
				}
				if (length === secret.length) {
					finish(new Error("passphrase-too-long"));
					return;
				}
				secret[length++] = byte;
			}
		};
		for (const signal of signals) process.once(signal, onSignal);
		input.on("data", onData);
		input.once("error", onError);
		input.once("end", onEnd);
		try {
			input.setRawMode(true);
			process.stderr.write(`passphrase for ${safeLabel}: `);
			input.resume();
		} catch {
			finish(new Error("terminal-setup-failed"));
		}
	});
}

/** Only encrypted PKCS#8 is admitted; public identity is derived from the private key. */
export async function readCeremonyKey(
	path: string,
): Promise<Ed25519SigningKey> {
	const encrypted = await readFile(path, "utf8");
	if (
		!/^-----BEGIN ENCRYPTED PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END ENCRYPTED PRIVATE KEY-----(?:\r?\n)?$/.test(
			encrypted,
		)
	) {
		throw new Error("encrypted-key-required: plaintext root keys are refused");
	}
	const passphrase = await terminalPassphrase(path);
	try {
		const privateKey = createPrivateKey({
			key: encrypted,
			format: "pem",
			passphrase,
		});
		if (privateKey.asymmetricKeyType !== "ed25519")
			throw new Error("ed25519-key-required");
		const publicJwk = createPublicKey(privateKey).export({ format: "jwk" });
		if (publicJwk.kty !== "OKP" || publicJwk.crv !== "Ed25519" || !publicJwk.x)
			throw new Error("public-key-derivation-failed");
		const rawPublic = Buffer.from(publicJwk.x, "base64url");
		if (rawPublic.length !== 32) throw new Error("public-key-length-invalid");
		const keyObject = {
			keytype: "ed25519" as const,
			scheme: "ed25519" as const,
			keyval: { public: rawPublic.toString("hex") },
		};
		const keyId = await computeKeyId(keyObject);
		if (!keyId.ok) throw new Error(keyId.reason);
		const der = privateKey.export({ format: "der", type: "pkcs8" });
		try {
			const imported = await crypto.subtle.importKey(
				"pkcs8",
				der,
				{ name: "Ed25519" },
				false,
				["sign"],
			);
			return { privateKey: imported, keyObject, keyId: keyId.value };
		} finally {
			der.fill(0);
		}
	} catch {
		throw new Error(
			"key-decryption-failed: check the encrypted key and passphrase",
		);
	} finally {
		passphrase.fill(0);
	}
}
