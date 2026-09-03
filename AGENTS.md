# AGENTS.md

sol pbc's transparency evidence-plane verifier, publisher, protocol schemas, and trust-portal source. `CLAUDE.md` and `GEMINI.md` are symlinks to this file, so there is one source of truth for every agent working in this repository.

## What this is, right now

**Status: the read-side legacy verifier/model exists; a read-only HTML presentation layer exists under `src/portal/`; it is deployed and live at `trust.solstone.app` (`worker.ts` wires `src/portal` over a model built by `make build-model` immediately before deploy).** `src/legacy/` fetches the existing historical (v1) release-transparency register, verifies each record (minisign signature, hash-chain linkage, schema shape), and builds a typed, already-verified model of the register — see that directory's own module comments for the exact contract. `src/portal/` renders that model as server-side HTML. It is read-only for v1: no record publishing and no mutation of evidence anywhere in this repository. `src/v2/` now carries an Ed25519 signing primitive, used only to build and sign v2 metadata from synthetic keys generated in-test; no production signing key exists in this repository or its history. See [`README.md`](README.md) for the current install/run/test instructions.

## Repo layout

| Path | Purpose |
|---|---|
| `src/` | Library entry point (`index.ts`) and CLI implementation (`cli.ts`) |
| `src/legacy/` | Read-side v1 legacy adapter/verifier and typed portal model — fetches, verifies, and models the existing historical register |
| `src/portal/` | Read-only server-rendered HTML over `PortalModel`. Live at `trust.solstone.app`, wired in by `worker.ts`. |
| `src/v2/` | v2 evidence-plane primitives: canonical JSON, bounded JSON admission, and Ed25519 key/signature handling (`crypto.subtle` only). Read-side building blocks; not yet wired into publishing, the CLI, or the portal. |
| `bin/` | The CLI executable, `solstone-transparency.ts` |
| `protocol/` | Reserved for public schemas, predicate/semantics documents, and conformance fixtures. Read its `README.md` and the licensing note in [`CONTRIBUTING.md`](CONTRIBUTING.md) before adding anything here. |

## Build system

```bash
make install   # bun install --frozen-lockfile
make test      # bun test
make ci        # lint, format check, typecheck, test: the pre-commit gate
make format    # auto-fix formatting
make clean     # remove node_modules and caches
```

Toolchain is [Bun](https://bun.sh) 1.x. TypeScript with `tsc --noEmit` handles types, Biome handles lint and format, `bun test` runs tests. Run `make ci` before every commit; it is the whole gate.

## Engineering principles for this repository

- **Open source is the product, not a distribution strategy.** Anyone should be able to verify this project's claims without taking sol pbc's word for them. A verification system whose verifier nobody can read defeats its own purpose, so every consequential behavior lives here in the open, not behind a private service.
- **No hidden dependencies on proprietary infrastructure.** The verifier, and later the portal, must stay buildable and runnable by a third party with no relationship to sol pbc.
- **Do not build ahead of what's approved.** This scaffold intentionally implements only an install, lint, typecheck, and test baseline. Evidence parsing, verification, record types, and portal routes each land as their own reviewed change against an actual approved contract, not speculatively now.
- **Fail loud, never silently.** Surface an error as an error. Don't swallow an exception, default to "unknown" quietly, or log something nobody reads. A verifier that treats "could not check" the same as "passed" is worse than having no verifier at all.
- **Keep verification states distinct.** Failing to verify, verifying something false, and never checking at all are three separate outcomes. Collapsing any two of them into one signal would be the most damaging bug this project could ship, since its whole purpose is that a clean result means something specific.
- **Every claim needs provenance.** Whatever this project asserts about a record has to trace back to the exact evidence and check that produced it. A signed fact and something merely inferred are not interchangeable, and neither should be presented as the other.
- **Treat dependencies as attack surface.** Prefer zero runtime dependencies where the task allows it, as this scaffold currently does. Before adding one that's genuinely needed, read its actual license text yourself rather than trusting a package-manager metadata field, and keep the tree small.
- **Vendor client-side assets.** Anything this project eventually serves to a browser should be downloaded and committed at a pinned version, served from sol pbc's own infrastructure. Never load a script live from a third-party CDN.
- **No CI/CD on GitHub, no exception.** This is absolute, not a preference: no `.github/workflows/` for tests, linting, or releases, ever. Every release and every check in a sol pbc repository runs from an operator's own machine. A pull request adding a workflow file gets declined regardless of what it does.
- **Never commit a secret.** No API token, signing key, credential, or `.env` file ever enters this repository or its history, in a commit, a test fixture, or a captured log line. This repository never contains a real signing or publishing credential. Any key that shows up in code or fixtures is synthetic, generated for the test, and clearly marked as such.

## No data about real people, in any form

This repository, and everything it will grow into, deals only in sol pbc's own build artifacts: version strings, filenames, byte counts, hashes, signatures, timestamps, and sol pbc's own statements about its own publication state. It never accepts data about a real person, device, account, or visit, whether that's a journal, an owner identifier, an access log, or anything derived from one.

This repository is licensed to the public under AGPL-3.0-only, which is a license grant to the world. Anything that entered it carrying data about a real person would be licensed by that same grant to everyone, permanently, the moment it was committed. There's no cleanup step for that afterward, which is why this is a hard rule about what goes into the repository rather than a style preference:

- **No data about a real person may enter this repository at any stage.** Not as collection, input, processing, storage, a test fixture, output, a log line, telemetry, analytics, or observability data, and not as a de-identified, anonymized, aggregated, pseudonymized, or encrypted derivative either. Transforming the data doesn't change what it is.
- **No production access log, ever, in any form**, including as a debugging input or a test fixture. Someone visiting a sol pbc web surface is a real person, and the record of that visit is real-person data.
- **Every fixture and test key in this repository is wholly synthetic.** No fixture is a copy, sample, or derivative of real evidence that was actually published, and no test key is ever a real signing key.

If you're unsure whether something you're about to add qualifies, treat it as if it does, and ask before committing it.

## Safety rails

- Never add a `.github/workflows/` file, for any reason.
- Never commit a real credential, signing key, or `.env` file. `.env` is gitignored from the first commit; keep it that way.
- Never add data about a real person, in any form, per the section above.
- Never add analytics, tracking pixels, third-party scripts, cookies, or visitor instrumentation anywhere in this repository, now or later. The surface this repository supports exists specifically to be trusted without tracking the people who check it.
- A pull request touching a path `CODEOWNERS` protects needs that owner's review before it can merge. That includes `protocol/` and `.github/CODEOWNERS` itself. Don't route around it.
- Do not add sample "evidence," parsing, verification, or routing logic to this scaffold speculatively. A change that needs one of those needs its own approved scope first.

## Local conventions

- `src/index.ts` is the library entry point, `src/cli.ts` implements the CLI, and `bin/solstone-transparency.ts` is the thin executable that wires the two together. Tests live beside the code they test (`*.test.ts`) and run with `bun test`.
- Every `.ts` source file, but not docs, config, generated files, or vendored files, carries an SPDX header immediately after any shebang:

  ```typescript
  // SPDX-License-Identifier: AGPL-3.0-only
  // Copyright (c) 2026 sol pbc
  ```
- "Done" for this scaffold means `make ci` is green. As real functionality lands, "done" will mean the change's own acceptance criteria are demonstrated, not merely that the build passes.
