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
# and writes the complete PortalModelResult worker.ts embeds. Never commits
# the output (see .gitignore) -- re-run this immediately before every deploy
# so the deployed portal always reflects a freshly re-verified register.
build-model:
	bun run bin/solstone-transparency.ts legacy-model --out model.generated.json

# Always rebuilds the model immediately before deploying, so a deploy can
# never ship a stale or hand-edited snapshot.
deploy: build-model
	wrangler deploy
