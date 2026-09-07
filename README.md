# solstone-transparency

This repository is being bootstrapped as the shared verifier/publisher code, public protocol schemas, and trust-portal source for sol pbc's public trust and transparency surface.

**Status: read-side legacy verifier and a read-only HTML presentation layer landed; it is deployed and live at `trust.solstone.app`.** `src/legacy/` reads the existing historical (v1) release-transparency register, verifies each record's minisign signature and hash-chain linkage, and builds a typed model of what it found. `src/portal/` renders that already-verified model as server-side HTML (home, software index, per-product history, per-release detail, verify, keys, about, not-found). It does not re-verify, re-fetch, or publish. `src/v2view/` is the portal's build-time view of the v2 register: `make build-model` verifies the v2 repository from a pinned root file and writes a second model beside the v1 one; with no pinned root the portal says nothing about v2; a repository that does not verify is shown as unverified, and never as a fabricated register. The v1 records are historical records of what sol pbc published; this code does not claim they are current, reproducible, or a complete account of every release.

## Install

```bash
make install
```

Requires [Bun](https://bun.sh) 1.x.

## Run

```bash
bun run bin/solstone-transparency.ts --help
```

## v2 tools

The v2 tools build signed repositories, prepare release records, publish bytes conditionally, and verify records against their artifact URLs. A successful release check establishes the recorded bytes and signing authority; it does not establish software safety or reproducibility.

Start with an independently obtained root file. Use a separate trust-store file for each repository:

```bash
bun bin/verify-release.ts --root /path/to/trusted-root.json \
  --product journal --version VERSION --store /path/to/trust-state.json --json
bun bin/audit-v2.ts --root /path/to/trusted-root.json \
  --store /path/to/trust-state.json --json
```

Both commands default to the production `/v2/metadata/` and `/v2/targets/` bases. Supply `--metadata-base` and `--targets-base` explicitly for another repository. `audit-v2` checks configured delivery heads; it does not enumerate every historical release. Its `--lanes` option accepts a JSON array of `{product, latestUrl, format}`, where `format` is `version-line` or `github-release`.

The production pin is reserved at `protocol/tuf-root.json` and is absent until separately published. A root downloaded beside the metadata is not an independent trust anchor. [Protocol documents](protocol/README.md) describe the record and predicate formats.

| Command | Purpose |
|---|---|
| `bun bin/tuf-ceremony.ts --help` | Build and re-verify a repository using encrypted PKCS#8 keys and an explicit passphrase provider or terminal prompts |
| `bun bin/root-renew.ts --help` | Prepare a renewal, sign it in separate one-key invocations, and merge the threshold signatures |
| `bun bin/journal-artifacts.ts --help` | Measure journal distribution files against their manifests and construct release input |
| `bun bin/publish-transaction.ts --help` | Publish a verified candidate with conditional writes, timestamp last, and a durable receipt; supports `--dry-run` |
| `bun bin/timestamp-rail.ts --help` | Authenticate the repository, refresh only its timestamp, and report failures through configured alert arguments |
| `bun bin/discovery.ts --help` | Derive discovery fields from a supplied root envelope |

The ceremony and detached signing commands accept `--passphrase-provider MODULE`. This selects trusted local code whose default export receives an encrypted key's path and returns `Promise<Buffer>` containing its passphrase. The reader takes ownership of that buffer and clears it after use. Without the option, the terminal adapter prompts without echo. Providers determine how to obtain the secret; no vault layout is assumed by the public tool. Keep passphrase values out of command arguments and environment variables.

The [timestamp service](systemd/solstone-transparency-timestamp.service) and [calendar timer](systemd/solstone-transparency-timestamp.timer) are templates. Configure and exercise the job against the intended repository before enabling it. The repository ships neither credentials nor an enabled timer.

An optional read-only network conformance check walks the journal migration constructor's actual output, first rejecting a tampered response:

```bash
bun bin/check-migration-constructor.ts --live
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
| `src/portal/` | Read-only HTML renderer; served live at `trust.solstone.app` by `worker.ts` |
| `src/v2view/` | Build-time view of the v2 register from a pinned root; writes the second model the portal embeds |
| `src/v2/` | TUF metadata, DSSE policy and records, publication, and release verification |
| `bin/` | CLI entry points and operator tools |
| `protocol/` | Public evidence-record and predicate documents for independent verifiers. See [`protocol/README.md`](protocol/README.md). |

## License

AGPL-3.0-only, including `protocol/`. See [`LICENSE`](LICENSE) for the full text and [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution terms.

"solstone" is a trademark of sol pbc. This license does not grant rights to use the solstone name or marks.
