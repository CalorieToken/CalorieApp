# Account-erasure restore-replay proof

Status: pure proof builder/verifier and an in-memory loopback PostgreSQL replay
drill prepared. Independent protected persistence, provider restore replay,
production key custody, migration and deployment remain unimplemented and
release-blocking.

An older encrypted backup can still contain an account after its primary-store
erasure. Restoring that backup must therefore reapply every still-relevant
erasure before the restored service can resume. A normal database row created
at deletion time is insufficient by itself because a backup captured before
that deletion does not contain the row.

`backend/app/account_erasure_replay_proof.py` defines one provider-neutral,
pure proof format for future independently persisted replay evidence. It covers
both `authenticated-user-request` and `inactive-account-retention` erasure. A
caller supplies a secret key of at least 32 bytes, the internal user identifier,
an explicit timezone-aware erasure timestamp and a lowercase SHA-256 digest of
the reviewed authorization reference.

The builder returns only:

- a domain-separated HMAC-SHA256 subject selector;
- the fixed erasure-reason key;
- erasure and 30-day replay-boundary timestamps normalized to naive UTC; and
- a separate domain-separated HMAC-SHA256 context digest.

The context digest binds the selector, reason, timestamps, schema version and
authorization-reference digest. The verifier recomputes the same values and
uses `hmac.compare_digest` for both comparisons. The raw internal identifier,
authorization reference and secret are not returned.

## Synthetic loopback replay evidence

The per-merge PostgreSQL backup drill now creates an older archive containing
two fixed synthetic accounts, then erases one account from the source and
holds its replay proof only in process memory outside that archive. After
restoring the archive, the drill first verifies that the deleted account has
reappeared. It then matches the HMAC proof, removes that account's synthetic
primary-store rows, clears an incoming session-replacement reference and
verifies that the unrelated account remains intact. A second replay is an
idempotent no-op.

The drill accepts only loopback PostgreSQL and the exact disposable CI database
names. Its hard-coded key is deliberately labelled non-secret and unfit for
production. No proof or archive is uploaded or retained.

## Privacy and non-activation boundary

The subject digest is pseudonymous personal data because a holder of the secret
can match it against account identifiers in a restored database. It must not be
placed in public logs, source control or unprotected artifacts. Its future
storage needs an independently reviewed location, restricted access, expiry,
key generation, custody, rotation and destruction process.

The proof module itself creates no key, database row, file, artifact or provider
record and does not alter the existing account-erasure paths. The separate CI
drill performs only fixed synthetic mutations in disposable loopback databases.
It does not claim restore-replay readiness. Production remains blocked until
protected independent persistence, real key lifecycle controls and a reviewed
provider staging restore/replay drill are implemented together.
