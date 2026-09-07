# Release record v1

Predicate type: `https://transparency.solstone.app/predicates/v1/release-record`.

The predicate contains schema `solstone-transparency/release-record/v1`, `product`, `version`, an `artifacts` array, explanatory `_comment` strings, and explicit `does_prove` and `does_not_prove` arrays. Each artifact has an HTTPS `url`, measured byte `length`, and lowercase SHA-256 `sha256`.

The [evidence record](evidence-record-v1.md) is a `targets-software` target at `software/<product>/<version>/release-record.json`. A consistent-snapshot repository stores it as `<sha256>.release-record.json` in that directory; signed metadata keeps the logical filename.

The statement has exactly one subject, `software/<product>/<version>`, matching the predicate. Its SHA-256 binds the artifact descriptors using the URL-sorted, newline-delimited construction described for the [migration corpus](migration-manifest-v1-to-v2.md). The authorized DSSE role is `producer.release`.

After the TUF, policy, DSSE and subject checks, retrieve each artifact URL and verify byte length and SHA-256. An unavailable or mismatching artifact has not passed release verification. This establishes correspondence with the signed assertion; it does not prove reproducibility, software safety, or a third-party audit.
