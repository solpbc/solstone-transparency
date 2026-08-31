// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { VERSION } from "./index";

const HELP = `solstone-transparency ${VERSION}

Usage: solstone-transparency [--version] [--help]

Bootstrap scaffold for sol pbc's transparency evidence-plane verifier,
publisher, and trust portal. This build implements no evidence, parsing,
verification, or portal behavior.

Options:
  --version   Print the installed version and exit
  --help      Show this help text and exit
`;

/** Runs the CLI against argv (excluding the node/bun/script entries) and returns the process exit code. */
export function run(argv: string[]): number {
	if (argv[0] === "--version") {
		console.log(VERSION);
		return 0;
	}
	console.log(HELP);
	return 0;
}
