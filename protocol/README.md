# Transparency protocol

These documents describe the evidence format and verification steps for independent implementations:

- [Evidence record v1](evidence-record-v1.md)
- [Migration manifest v1-to-v2](migration-manifest-v1-to-v2.md)
- [Release record v1](release-record-v1.md)

Everything here is licensed under AGPL-3.0-only, as described in [CONTRIBUTING.md](../CONTRIBUTING.md).

A predicate type is a URL under `https://transparency.solstone.app/predicates/v1/`, and a record's `schema` field is an identifier such as `solstone-transparency/release-record/v1`. Both are matched as exact strings by a verifier. For each one that has a specification here, `bun bin/protocol-documents.ts --out DIR` writes a small JSON document for the evidence host, keyed so that the predicate type is served at its own URL and the schema identifier is served at that identifier appended to `https://transparency.solstone.app/schemas/`. Those documents name the identifier, the specification file in this repository, and the source; they are not inputs to verification and they carry no rules of their own.

`tuf-root.json` in this directory is the root envelope the verifier in this repository pins; if it is not here, no v2 root has been pinned yet. Read `signed.version`, `signed.expires` and `signed.roles.root.keyids` off your copy rather than trusting anything written about them here, because sol pbc replaces this one slot at each root renewal. Cross-check your copy against https://solpbc.org/transparency/tuf-root.txt: find the sha256 line naming your copy's `signed.version`, match its digest against the SHA-256 of your copy's bytes, and match your copy's keyids against the nearest key id line above it. Then confirm no higher version line appears, or a superseded pin will match its own retained lines and read as agreement. Obtain the root itself through a channel independent of the metadata it signs. Both this pin and that page are sol pbc's, so their agreement shows only that the two have not diverged, and one publisher hands you the pin and the verifier that consumes it alike.
