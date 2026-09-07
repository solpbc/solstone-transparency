# Evidence record v1

An evidence record is a JSON TUF target with these fields:

| Field | Meaning |
|---|---|
| `schema` | The exact identifier `solstone-transparency/evidence-record/v1` |
| `policy_sha256` | Lowercase SHA-256 of the exact authorization-policy target bytes |
| `issued_at` | Issuance instant in canonical UTC ISO format, including milliseconds |
| `envelope` | A DSSE envelope with `payloadType`, base64 `payload`, and `signatures` containing `keyid` and base64 `sig` |

The payload type is `application/vnd.in-toto+json`. The payload contains an in-toto Statement v1, with `_type`, `subject`, `predicateType`, and `predicate`. Each subject names its immutable identity and digest.

Start with an independently trusted TUF root. Verify metadata signatures, versions, expiry, delegations, target length and target digest before interpreting a record. Load the exact policy named by `policy_sha256` from a top-level `targets` target at `policy/dsse-authorization/<version>.json`. Its public keys come from the corresponding target `keys/dsse/<version>.json`; that document has schema `solstone-transparency/dsse-keys/v1` and a `keys` map of computed IDs to TUF public-key objects.

Verify DSSE signatures over the DSSE pre-authentication encoding before interpreting the assertion. Apply the policy's predicate, subject, threshold, issuance-window and revocation rules. TUF and evidence keys are disjoint; producers cannot grant themselves verifier authority. Then check subject digests and the predicate's required evidence. A valid signature establishes who made an assertion, not that the assertion is true.

Unknown predicates, unavailable evidence, rejected evidence and compromised-key assertions do not count as successful verification. See the [release](release-record-v1.md) and [migration](migration-manifest-v1-to-v2.md) contracts.
