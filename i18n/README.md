# Trust portal string catalog

The portal owns its English source in `catalog/`. It ships only `en-US`.
The generated module is `generated/esm/transparency/`. The Worker renders that
module. No request fetches a catalog.

Regenerate with the catalog compiler from solstone-journal, at the revision
recorded in `compiler.json`:

```sh
I18N_COMPILER=/path/to/i18n-catalog bun scripts/i18n.mjs
make test
```

For source edits, follow the compiler's `tools/i18n/README.md` instructions for
source locks, sidecar revisions and permanent identities before regenerating.
`make test` checks source ids, rendered English, and the committed hashes of
the catalog, the pin and the generated files. Build and test use committed
output and do not need the compiler or network access to render text.

The compiler replaces only a directory it created. This tree keeps no
destination marker, so the script regenerates into an empty directory and then
puts the result in place. `generated/esm/transparency/api.d.mts` is kept by
hand. The script restores it. The destination marker is not committed.
`catalog-table.ts` is also kept by hand. The sync test checks it against the
catalog. It is not compiler output.

Verifier command output stays English on purpose, in `src/v2/verify-cli.ts`
and `bin/verify-release.ts`. Messages under `trust.verify.*` are catalogued
and are not called from portal or command code.

English rendering keeps Fluent isolation off for `en-US`. Adding a language
requires registry membership, a reviewed catalog and an explicit caller change.
