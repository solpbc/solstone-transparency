# Contributing to solstone-transparency

Thank you for your interest in contributing. This project is an early scaffold — see [`README.md`](README.md) for current status before sending substantial work.

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

### The one exception: `protocol/`

[`protocol/`](protocol/) is reserved for this project's public schemas, predicate/semantics documents, and conformance fixtures — interface material whose purpose is letting a third party build an independent verifier without this repository's code. sol pbc may, in the future, designate an additional permissive license for that directory once its contents become a stable published contract.

To keep that option open, **a contribution to `protocol/` is licensed under AGPL-3.0-only, and additionally under any OSI-approved license sol pbc subsequently designates for that directory.** This is narrower than a contributor license agreement: it reaches only `protocol/`, not the rest of the repository, and it grants no rights beyond that additional license grant. Contributions outside `protocol/` are AGPL-3.0-only only, per the section above.

A pull request touching `protocol/` requires review from its listed owner in [`.github/CODEOWNERS`](.github/CODEOWNERS) before it can merge, so this term is seen and not merged past by accident.

## Developer Certificate of Origin (DCO)

All contributions must be signed off using:

    git commit -s

This certifies compliance with the [Developer Certificate of Origin](https://developercertificate.org/).

## What this project does not accept

- Contributor License Agreements are not used here; the DCO sign-off above is sufficient.
- No GitHub Actions workflows. Releases and checks in every sol pbc repository run from an operator's local machine, not from CI infrastructure — this is a standing policy with no exception, not a preference for this project specifically. A pull request adding `.github/workflows/` will be declined regardless of what it does.
