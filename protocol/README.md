# Transparency protocol

These documents describe the evidence format and verification steps for independent implementations:

- [Evidence record v1](evidence-record-v1.md)
- [Migration manifest v1-to-v2](migration-manifest-v1-to-v2.md)
- [Release record v1](release-record-v1.md)

Everything here is licensed under AGPL-3.0-only, as described in [CONTRIBUTING.md](../CONTRIBUTING.md).

The production root pin belongs at `protocol/tuf-root.json` after its separate publication and verification. An absent pin means no production v2 root has been committed here. Obtain a trusted root independently; downloading it alongside metadata does not establish trust.
