// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

// Ambient type for the gitignored, build-time-generated model snapshot
// (`make build-model`). This lets `tsc --noEmit` type-check `worker.ts`
// whether or not the file has been generated locally yet -- the bundler
// (wrangler/esbuild) still requires the real file to exist at deploy time
// and fails loudly if it doesn't; this declaration only supplies its type.
declare module "*model.generated.json" {
	import type { PortalModelResult } from "./src/legacy/types";
	const value: PortalModelResult;
	export default value;
}

// The v2 half of the same build (`src/v2view/build-cli.ts`), written beside
// the v1 model by `make build-model` and embedded the same way.
declare module "*model-v2.generated.json" {
	import type { V2Model } from "./src/v2view/types";
	const value: V2Model;
	export default value;
}
