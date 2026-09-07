// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type PassphraseSource, terminalPassphrase } from "./ceremony-key";

/** Select trusted local code explicitly; module loading errors can contain secrets. */
export async function loadPassphraseProvider(
	modulePath?: string,
): Promise<PassphraseSource> {
	if (modulePath === undefined) return terminalPassphrase;
	try {
		const provider = (await import(pathToFileURL(resolve(modulePath)).href))
			.default;
		if (typeof provider !== "function") throw new Error();
		return provider as PassphraseSource;
	} catch {
		throw new Error(
			"passphrase-provider-load-failed: supply a local module with a default function export",
		);
	}
}

/** The option names code, never a passphrase value. */
export function passphraseProviderOption(args: readonly string[]): {
	args: string[];
	modulePath?: string;
} {
	const positional: string[] = [];
	let modulePath: string | undefined;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === undefined) continue;
		if (arg !== "--passphrase-provider") {
			positional.push(arg);
			continue;
		}
		const value = args[++index];
		if (modulePath !== undefined || !value || value.startsWith("--"))
			throw new Error(
				"passphrase-provider-usage: specify one local module path",
			);
		modulePath = value;
	}
	return { args: positional, modulePath };
}
