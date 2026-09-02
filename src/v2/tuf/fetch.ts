// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/** One bounded retrieval result for a repository-relative path. */
export type TufFetchResponse =
	| { kind: "not-found" }
	| { kind: "error"; error: unknown }
	| { kind: "ok"; bytes: Uint8Array };

/** Supplies repository-relative bytes; the client never supplies a URL. */
export interface TufFetcher {
	fetch(relativePath: string, maxBytes: number): Promise<TufFetchResponse>;
}
