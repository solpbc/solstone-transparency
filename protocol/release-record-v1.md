# Release record v1

Predicate type: `https://transparency.solstone.app/predicates/v1/release-record`.

The predicate contains schema `solstone-transparency/release-record/v1`, `product`, `version`, an `artifacts` array, an explanatory `_comment` array of strings, and explicit `does_prove` and `does_not_prove` arrays. Each artifact has an HTTPS `url`, measured byte `length`, and lowercase SHA-256 `sha256`.

## Components (optional)

A predicate may also carry `component_targets`, `components`, and `component_baseline`. These three members are present together or not at all. A component-bearing predicate may carry `component_changes` or the historical `component_transitions`, never both. A predicate without the three inventory members makes no statement about the third-party components of the release.

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

`component_baseline` is the `version` of another release record of the same product, named by the publisher as the comparison baseline. The record does not show that the baseline is the immediately preceding release. It matches `^[A-Za-z0-9][A-Za-z0-9._-]*$` and differs from this record's `version`.

### Complete component changes

New component-bearing records require `component_changes`, including an explicit empty array when nothing changed. Each entry has exactly `{ "target", "id", "from", "to" }`, sorted by `target` and then by `id`, with no duplicate pair. Each target is listed in `component_targets`.

Each endpoint is either `null`, meaning that the component is absent on a covered target, or exactly `{ "version", "delivery", "source", "inputs", "members" }`. Snapshot fields follow the same rules as the corresponding component row. `from` and `to` differ. `to` is the current row without its `target` and `id`, or `null` if there is no row. Object key order does not change a snapshot's meaning; array order follows the sorting rules above.

The declaration carries every difference between component rows: addition, removal, delivery mode, version, source, inputs, and member paths or digests. A single entry carries simultaneous differences. Signing-only digest changes are included.

Anyone can check the declaration with this record and the baseline record alone:

1. Fetch the release record named by `component_baseline` for the same product and verify it as described under Publication and verification. If there is no verified record, the comparison cannot be checked.
2. Require both records to have inventory statements with non-empty `component_targets`, and every target in this record's `component_targets` to appear in the baseline's. A baseline target that this record omits has no statement here and is not compared. Missing inventory or a newly covered target prevents comparison. Unknown inventory is never component absence.
3. For every target in this record's `component_targets`, and every `id` present for that target in either inventory, compare the complete snapshots, using `null` only when a covered target has no row for that component.
4. Require `component_changes` to equal exactly the changed pairs, with `from` taken from the baseline and `to` from the current record. Reject omissions, fabricated before-images, and declarations without a matching difference.

The journal adapter performs this comparison before producing a record. It accepts the publisher's declaration through `--changes`; it does not generate the declaration. It refuses an uncomparable baseline or coverage, and refuses `--transitions`. Release preparation and repository publication also require the complete declaration before signing a new component-bearing predicate. Their admission check validates the current snapshot and declaration shape; it does not independently retrieve and compare the baseline.

### Historical delivery transitions

Historical records may carry `component_transitions`, the publisher's delivery-only declaration. Each entry has exactly `{ "target", "id", "from", "to" }`, sorted by `target` and then by `id`, without duplicate pairs. Its target is listed in `component_targets`. `from` and `to` are each `bundled`, `runtime-downloaded` or `absent`, and differ. `absent` means there is no component row for that pair. An entry's `to` matches the current row's `delivery`, or is `absent` when no row exists.

To check these historical declarations, verify the named baseline, then compare delivery modes only for targets covered by both records, using `absent` for a missing row. The declared transitions, read as an empty list when omitted, must equal the pairs whose delivery differs. A baseline without inventory prevents comparison. An empty component inventory is still compared. These declarations do not express same-mode version, source, input or member changes.

Historical predicates retain their original meaning and remain readable. They are not rewritten into complete change declarations.

A record's components are carried as listed by the producer; the record does not, by itself, show that the release packages contain the listed members. The subject digest described below binds only the artifact descriptors. All component inventory and declaration members are covered by the DSSE signature over the statement.

## Publication and verification

The [evidence record](evidence-record-v1.md) is a `targets-software` target at `software/<product>/<version>/release-record.json`. A consistent-snapshot repository stores it as `<sha256>.release-record.json` in that directory; signed metadata keeps the logical filename.

The statement has exactly one subject, `software/<product>/<version>`, matching the predicate. Its SHA-256 binds the artifact descriptors using the URL-sorted (UTF-16 code-unit order), newline-delimited construction described for the [migration corpus](migration-manifest-v1-to-v2.md). The authorized DSSE role is `producer.release`.

After the TUF, policy, DSSE and subject checks, retrieve each artifact URL and verify byte length and SHA-256. An unavailable or mismatching artifact has not passed release verification. This establishes correspondence with the signed assertion; it does not prove reproducibility, software safety, or a third-party audit.
