# Contributing to solstone-transparency

See [`README.md`](README.md) for current status before sending substantial work.

## Development

```bash
git clone https://github.com/solpbc/solstone-transparency.git
cd solstone-transparency
make install
make ci
```

Requires [Bun](https://bun.sh) 1.x. `make ci` runs the full pre-commit gate: lint, format check, type check, and test.

## License of contributions

By contributing to this repository, you agree that your contributions are licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only), the same license as the project.

You represent that you have the right to submit the contribution and that it does not include proprietary, confidential, or third-party code that is incompatible with the AGPL.

### Protocol contributions

The AGPL-3.0-only license also applies to [`protocol/`](protocol/), including its schemas, predicate documents, and conformance fixtures. Protocol contributions grant no additional license-designation rights.

A pull request touching `protocol/` requires review from its listed owner in [`.github/CODEOWNERS`](.github/CODEOWNERS) before it can merge.

## Developer Certificate of Origin (DCO)

All contributions must be signed off using:

    git commit -s

This certifies compliance with the [Developer Certificate of Origin](https://developercertificate.org/).

## What this project does not accept

- Contributor License Agreements are not used here; the DCO sign-off above is sufficient.
- No GitHub Actions workflows. This repository does not accept `.github/workflows/` files.
