# solstone-transparency

This repository is being bootstrapped as the shared verifier/publisher code, public protocol schemas, and trust-portal source for sol pbc's public trust and transparency surface.

**Status: read-side legacy verifier landed; no portal UI yet.** `src/legacy/` reads the existing historical (v1) release-transparency register, verifies each record's minisign signature and hash-chain linkage, and builds a typed model of what it found. It publishes nothing, signs nothing, and mutates no evidence. There is still no portal route, HTML, or UI — this repository does not yet serve `trust.solstone.app`. These are historical records of what sol pbc published; this code does not claim they are current, reproducible, or a complete account of every release.

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
