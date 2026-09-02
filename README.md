# solstone-transparency

This repository is being bootstrapped as the shared verifier/publisher code, public protocol schemas, and trust-portal source for sol pbc's public trust and transparency surface.

**Status: read-side legacy verifier and a read-only HTML presentation layer landed; nothing is deployed.** `src/legacy/` reads the existing historical (v1) release-transparency register, verifies each record's minisign signature and hash-chain linkage, and builds a typed model of what it found. `src/portal/` renders that already-verified model as server-side HTML (home, software index, per-product history, per-release detail, verify, keys, about, not-found). It does not re-verify, re-fetch, or publish, and this repository does not yet serve `trust.solstone.app`. These are historical records of what sol pbc published; this code does not claim they are current, reproducible, or a complete account of every release.

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
| `src/legacy/` | Read-side v1 verifier and typed portal model |
| `src/portal/` | Read-only HTML presentation over that model; not a live host |
| `bin/` | The CLI executable |
| `protocol/` | Reserved for the public schemas, predicate/semantics documents, and conformance fixtures that later work will add. See [`protocol/README.md`](protocol/README.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the licensing note that applies to this directory specifically. |

## License

AGPL-3.0-only. See [`LICENSE`](LICENSE) for the full text and [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution terms, including a narrow forward-designation clause that applies only to `protocol/`.

"solstone" is a trademark of sol pbc. This license does not grant rights to use the solstone name or marks.
