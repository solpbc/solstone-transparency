# Migration manifest v1-to-v2

Predicate type: `https://transparency.solstone.app/predicates/v1/migration-manifest-v1-to-v2`.

The predicate binds a frozen inventory of historical v1 objects. It carries schema `solstone-transparency/migration-manifest/v1-to-v2`, explanatory `_comment` strings, the v1 `verification_contract`, `corpus_sha256`, `object_count`, `products`, and `objects`. Each object has `url`, measured `length`, and lowercase `sha256`. Each product summary records its chain length and tip, declared gaps, object count, and corpus digest. An empty collection remains explicitly empty.

The statement subject is `software/legacy-corpus/v1`. The [evidence record](evidence-record-v1.md) is a target under `legacy/<product>/migration-manifest.json`, signed by the `targets-legacy` TUF role. Its DSSE signer needs the migration predicate grant under `producer.release`. Target-path and statement-subject authority are separate checks.

For the corpus digest, sort object descriptors by URL and concatenate `url`, newline, decimal `length`, newline, lowercase `sha256`, newline for each object. Hash the resulting UTF-8 bytes with SHA-256. Recompute the complete corpus and each product's subset. Retrieve every declared object and verify its exact length and digest. Refuse missing, altered or unsafe URLs.

This inventory does not re-sign historical records, extend old pointer validity, replace v1 verification, or establish a new release. The original v1 signature and chain rules still apply. The `verification_contract` names the minisign algorithm, public-key URL, and explanatory note.
