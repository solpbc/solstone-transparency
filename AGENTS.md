# AGENTS.md

sol pbc's transparency evidence-plane verifier, publisher, protocol schemas, and trust-portal source. `CLAUDE.md` and `GEMINI.md` are symlinks to this file — there is one source of truth for every agent working in this repository.

## What this is, right now

**Status: bootstrap scaffold.** As of this commit, nothing beyond what's described below exists: no evidence parsing, no signature verification, no record publishing, and no portal routes or UI. Treat any future claim about "verifying" or "publishing" evidence as unimplemented until the code that does it actually lands and is reviewed. See [`README.md`](README.md) for the current install/run/test instructions.

## Repo layout

| Path | Purpose |
|---|---|
| `src/` | Library entry point (`index.ts`) and CLI implementation (`cli.ts`) |
| `bin/` | The CLI executable, `solstone-transparency.ts` |
| `protocol/` | Reserved for public schemas, predicate/semantics documents, and conformance fixtures. Read its `README.md` and the licensing note in [`CONTRIBUTING.md`](CONTRIBUTING.md) before adding anything here. |

## Build system

```bash
make install   # bun install --frozen-lockfile
make test      # bun test
make ci        # lint + format check + typecheck + test — the pre-commit gate
make format    # auto-fix formatting
make clean     # remove node_modules and caches
```

Toolchain is [Bun](https://bun.sh) 1.x: TypeScript with `tsc --noEmit` for types, Biome for lint/format, `bun test` for tests. Run `make ci` before every commit; it is the whole gate.

## Engineering principles for this repository

- **Open source is the product, not a distribution strategy.** This project's premise is that anyone can verify its claims without taking sol pbc's word for them. A verification system whose verifier nobody can read is a contradiction. Every consequential behavior lives here, in the open — not behind a private service.
- **No hidden dependencies on proprietary infrastructure.** The verifier and, later, the portal must stay buildable and runnable by a third party with no relationship to sol pbc.
- **YAGNI — do not build ahead of what's approved.** This scaffold intentionally implements only an install/lint/typecheck/test baseline. Do not add evidence parsing, verification, record types, or portal routes speculatively; each lands as its own reviewed change against an actual approved contract.
- **Fail loud, never silently.** An error surfaces as an error, not a swallowed exception, a default standing in for "unknown," or a log line nobody reads. A verifier that silently treats "could not check" as "passed" is worse than none at all.
- **"Did not verify," "verified false," and "did not check" are three different states.** Collapsing any two of them into one signal is the most damaging bug class this project can ship — its entire purpose is that its "yes" means something specific.
- **Every claim needs provenance.** Anything asserted about a record — validity, freshness, coverage — must trace to the exact evidence and check that produced it. An inference, a stated absence, and a signed fact are three different kinds of statement and must never be rendered as if they were the same kind.
- **Dependencies are attack surface.** Prefer zero runtime dependencies where the task allows it, as this scaffold currently does. When a dependency is genuinely needed, verify its license against its own license text — not a package-manager metadata field — before adding it, and keep the tree as small as it can be.
- **Vendor client-side assets.** Anything this project eventually serves to a browser is served from sol pbc's own infrastructure, downloaded and committed at a pinned version — never loaded live from a third-party CDN.
- **No CI/CD on GitHub. No exception.** This is an absolute policy, not a preference: no `.github/workflows/` for tests, linting, or releases, ever. Every release and every check in a sol pbc repository runs from an operator's own machine. A pull request adding a workflow file is declined regardless of what it does.
- **Never commit a secret.** No API token, signing key, credential, or `.env` file ever enters this repository or its history — not in a commit, not in a test fixture, not in a captured log line. This repository never contains a real signing or publishing credential; any key appearing in code or fixtures here is a synthetic, test-only key generated for that purpose and clearly marked as such.

## No Customer Data, at any stage, ever

sol pbc's Articles of Incorporation (Article 8) prohibit selling, licensing, sublicensing, or leasing Customer Data under any circumstances. This repository is licensed to the public under AGPL-3.0-only — a license grant to the world — so anything that entered it carrying Customer Data would be licensed by that grant to everyone, irrevocably, the moment it was committed. There is no cure for that after the fact, which is why this is a structural rule for the repository rather than a style preference:

- **No Customer Data may enter this repository at any stage of its lifecycle** — not as collection, input, processing, storage, a test fixture, output, a log line, telemetry, analytics, or observability data — **and not as any derivative of Customer Data**, including a version that is de-identified, anonymized, aggregated, pseudonymized, encrypted, or otherwise transformed. Transforming Customer Data does not make it stop being Customer Data.
- **No production access log, ever, in any form** — including as a debugging input or a test fixture. A visitor to a sol pbc web surface is a customer accessing sol pbc's software, and the record of that visit is Customer Data.
- **Every evidence subject in this repository is one of sol pbc's own build artifacts or service images** — a version string, a filename, a byte count, a hash, a signature, a timestamp, or an organizational statement about sol pbc's own publication state. Never a person, a device, an account, or anything derived from one.
- **Every fixture and test key in this repository is wholly synthetic.** No fixture is ever a copy, sample, or derivative of real evidence that was actually published. No test key is ever a real signing key.

If you're unsure whether something you're about to add is Customer Data, treat it as Customer Data and ask before committing it.

## Safety rails

- Never add a `.github/workflows/` file, for any reason.
- Never commit a real credential, signing key, or `.env` file. `.env` is gitignored from the first commit — keep it that way.
- Never add Customer Data, in any form, per the section above.
- Never add analytics, tracking pixels, third-party scripts, cookies, or visitor instrumentation to anything in this repository, now or later. The surface this repository supports exists specifically to be trusted without tracking the people who check it.
- A pull request touching a path `CODEOWNERS` protects needs that owner's review before it can merge — that includes `protocol/` and `.github/CODEOWNERS` itself. Don't route around it.
- Do not add sample "evidence," parsing, verification, or routing logic to this scaffold speculatively. A change that needs one of those needs its own approved scope first.

## Local conventions

- `src/index.ts` is the library entry point; `src/cli.ts` implements the CLI; `bin/solstone-transparency.ts` is the thin executable wiring the two together. Tests live beside the code they test (`*.test.ts`) and run with `bun test`.
- Every `.ts` source file — not docs, not config, not generated or vendored files — carries an SPDX header immediately after any shebang:

  ```typescript
  // SPDX-License-Identifier: AGPL-3.0-only
  // Copyright (c) 2026 sol pbc
  ```
- "Done" for this scaffold means `make ci` is green. As real functionality lands, "done" means the change's own acceptance criteria are demonstrated, not merely that the build is green.
