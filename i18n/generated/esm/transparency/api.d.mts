// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/** Types for the generated catalog runtime. The generator ships JavaScript. */
export function render(
	locale: string,
	messageId: string,
	args?: ReadonlyArray<
		readonly [
			string,
			(
				| string
				| number
				| boolean
				| { readonly type: "cardinal" | "integer"; readonly value: number }
			),
		]
	>,
	options?: { readonly useIsolating?: boolean },
): string;
