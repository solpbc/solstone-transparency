# solstone-transparency
# Toolchain is bun. Every target is hermetic to this repo checkout.

.PHONY: install test ci format lint typecheck clean build-model deploy

# Frozen install: fails if bun.lock is out of date rather than silently
# rewriting it, so the committed lockfile is always what CI/gate ran against.
install:
	bun install --frozen-lockfile

test:
	bun test

typecheck:
	bun run tsc --noEmit

lint:
	bun run biome check src/ bin/

format:
	bun run biome format --write src/ bin/

# Full pre-commit gate: format+lint check (biome check covers both) + type check + test.
ci: lint typecheck test
	bun run bin/solstone-transparency.ts --help > /dev/null
	bun run bin/solstone-transparency.ts --version > /dev/null

clean:
	rm -rf node_modules/ .bun-cache/

# Fetches and verifies the live v1 register from transparency.solstone.app
# and writes the complete PortalModelResult worker.ts embeds, then verifies
# the v2 repository from the PINNED root and writes the v2 portal model
# beside it. Never commits either output (see .gitignore) -- re-run this
# immediately before every deploy so the deployed portal always reflects a
# freshly re-verified register.
#
# The v2 half is configured, never discovered: V2_ROOT is a file path the
# operator controls (the production pin lands at protocol/tuf-root.json at
# genesis and is absent until then). An absent pin, an empty base, or a
# repository that does not verify each produce an honest v2 model state that
# the portal renders as exactly that -- never a fabricated register and never
# a build failure that hides the v1 register. Override for a rehearsal:
#   make build-model V2_ROOT=/path/to/1.root.json #     V2_METADATA_BASE=https://transparency.solstone.app/staging/v2/metadata #     V2_TARGETS_BASE=https://transparency.solstone.app/staging/v2/targets
# V2_EXPECT names releases the register is expected to carry
# (`product@version[:basis]`, space-separated); a missing one renders as a gap.
# The basis is READER-FACING: it is printed on the portal as the reason the
# record was expected (e.g. "the release lane lists it"), so write it in
# plain words, never an internal reference.
V2_ROOT ?= protocol/tuf-root.json
V2_METADATA_BASE ?= https://transparency.solstone.app/v2/metadata
V2_TARGETS_BASE ?= https://transparency.solstone.app/v2/targets
V2_EXPECT ?=
build-model:
	bun run bin/solstone-transparency.ts legacy-model --out model.generated.json
	bun run src/v2view/build-cli.ts --out model-v2.generated.json 		--root "$(V2_ROOT)" 		--metadata-base "$(V2_METADATA_BASE)" --targets-base "$(V2_TARGETS_BASE)" 		$(foreach e,$(V2_EXPECT),--expect "$(e)")

# Always rebuilds the model immediately before deploying, so a deploy can
# never ship a stale or hand-edited snapshot.
deploy: build-model
	wrangler deploy
