# solstone-transparency

This repository is being bootstrapped as the shared verifier/publisher code, public protocol schemas, and trust-portal source for sol pbc's public trust and transparency surface.

**Status: early scaffold.** Nothing beyond this bootstrap exists yet. This checkout implements no evidence parsing, no signature verification, no record publishing, and no portal routes or UI. It exposes only an installable package with a versioned library entry point and a `--help`/`--version` CLI surface, so that later work has a working install/lint/typecheck/test baseline to build on.

## Install

```bash
make install
```

Requires [Bun](https://bun.sh) 1.x.

## Run

```bash
bun run bin/solstone-transparency.ts --help
```

## Test

```bash
make test
```

`make ci` runs the full gate: lint, format check, type check, and test.

## Repository layout

| Path | What's here |
|------|-------------|
| `src/` | The library entry point and CLI implementation |
| `bin/` | The CLI executable |
| `protocol/` | Reserved for the public schemas, predicate/semantics documents, and conformance fixtures that later work will add. See [`protocol/README.md`](protocol/README.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the licensing note that applies to this directory specifically. |

## License

AGPL-3.0-only. See [`LICENSE`](LICENSE) for the full text and [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution terms, including a narrow forward-designation clause that applies only to `protocol/`.

"solstone" is a trademark of sol pbc. This license does not grant rights to use the solstone name or marks.
