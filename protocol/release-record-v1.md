# Release record v1

Predicate type: `https://transparency.solstone.app/predicates/v1/release-record`.

The predicate contains schema `solstone-transparency/release-record/v1`, `product`, `version`, an `artifacts` array, explanatory `_comment` strings, and explicit `does_prove` and `does_not_prove` arrays. Each artifact has an HTTPS `url`, measured byte `length`, and lowercase SHA-256 `sha256`.

## Components (optional)

A predicate may also carry `component_targets`, `components`, `component_baseline` and `component_transitions`. The first three are present together or not at all. `component_transitions` may appear only when they are present. A predicate that breaks either rule is malformed. A predicate without these members makes no statement about the third-party components of the release.

These members are data inside the signed assertion. They are not claims; the `_comment`, `does_prove` and `does_not_prove` arrays keep their meaning, and only those arrays state what a record proves.

Every sorted list below is sorted in UTF-16 code-unit order.

`component_targets` is an array of the release targets the record makes a component statement for, sorted, without duplicates. Each target matches `^[a-z0-9][a-z0-9._-]*$`. A target in `component_targets` with no `components` rows has no components. A target not in `component_targets` has no component statement in this record, whether or not the release covers it.

`components` is an array of rows, one per component of one release target, sorted by `target` and then by `id`, with no two rows sharing a `target` and `id`. An empty array is allowed. Each row has exactly these members:

- `target`: a target listed in `component_targets`.
- `id`: the component identifier, matching `^[a-z0-9][a-z0-9._-]*$`.
- `version`: a non-empty string, the component's own version.
- `delivery`: `bundled` when the component's files ship inside the release package for that target, or `runtime-downloaded` when the installed software fetches the component after installation.
- `source`: a non-empty string naming where the component's inputs were obtained.
- `inputs`: at least one `{ "name", "sha256" }` object, each with exactly those two members, a non-empty `name` and a lowercase hexadecimal SHA-256, sorted by `name`, without duplicate names. These are the inputs the component was built or taken from.
- `members`: `{ "path", "sha256" }` objects, each with exactly those two members, sorted by `path`, without duplicate paths. A `path` is a relative POSIX path whose first segment is `bin`, `lib` or `share`, with at least one further segment, no empty, `.` or `..` segment, no backslash, and no character below U+0020 or in U+007F to U+009F. A `bundled` row has at least one member; a `runtime-downloaded` row has none. These are the files the component contributes to an installation, with their SHA-256.

`component_baseline` is the `version` of another release record of the same product, named by the publisher as the baseline this record's transitions were compared against. The record does not show that the baseline is the immediately preceding release. It matches `^[A-Za-z0-9][A-Za-z0-9._-]*$` and differs from this record's `version`.

`component_transitions` is the publisher's declaration of which components changed delivery between the baseline release and this one. It is an array of `{ "target", "id", "from", "to" }` objects, each with exactly those members, sorted by `target` and then by `id`, with no two entries sharing a `target` and `id`. Each `target` is listed in `component_targets`. `from` and `to` are each `bundled`, `runtime-downloaded` or `absent`, and differ. `absent` means the record in question has no `components` row for that `target` and `id`. Within one predicate, an entry whose `to` is `absent` names no `components` row, and every other entry names a `components` row whose `delivery` equals `to`.

Anyone can check the declaration with this record and the baseline record alone:

1. Take this record's `component_baseline`, fetch the release record of that version for the same product, and verify it as described under Publication and verification. If no verified record exists for that version, the declaration cannot be checked.
2. If that record has no `components` member, there is nothing to compare, and the declared transitions cannot be checked against it. An empty `components` array is still compared.
3. For each target listed in both records' `component_targets`, compare the `delivery` of each `id` between the two records, using `absent` where a record has no row for that `target` and `id`.
4. This record's `component_transitions`, read as an empty list when omitted, must equal exactly the pairs whose delivery differs, as `{ "target", "id", "from", "to" }` entries with `from` taken from the baseline record and `to` from this record.

When steps 3 and 4 run, a difference that is not declared, or a declaration with no matching difference, is a disagreement between the two records. A record's `components` are carried as listed by the producer for each target; the record does not, by itself, show that the release packages contain the listed members.

The subject digest described below binds only the artifact descriptors. These four predicate members are covered by the DSSE signature over the statement, like every other predicate member.

## Publication and verification

The [evidence record](evidence-record-v1.md) is a `targets-software` target at `software/<product>/<version>/release-record.json`. A consistent-snapshot repository stores it as `<sha256>.release-record.json` in that directory; signed metadata keeps the logical filename.

The statement has exactly one subject, `software/<product>/<version>`, matching the predicate. Its SHA-256 binds the artifact descriptors using the URL-sorted (UTF-16 code-unit order), newline-delimited construction described for the [migration corpus](migration-manifest-v1-to-v2.md). The authorized DSSE role is `producer.release`.

After the TUF, policy, DSSE and subject checks, retrieve each artifact URL and verify byte length and SHA-256. An unavailable or mismatching artifact has not passed release verification. This establishes correspondence with the signed assertion; it does not prove reproducibility, software safety, or a third-party audit.
