# Account-erasure restore-replay proof

Status: pure proof builder and verifier prepared. Independent protected
persistence, restore scanning, replay execution, provider configuration,
migration and deployment remain unimplemented and release-blocking.

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

## Privacy and non-activation boundary

The subject digest is pseudonymous personal data because a holder of the secret
can match it against account identifiers in a restored database. It must not be
placed in public logs, source control or unprotected artifacts. Its future
storage needs an independently reviewed location, restricted access, expiry,
key generation, custody, rotation and destruction process.

This module creates no key, database row, file, artifact or provider record. It
does not alter the existing account-erasure paths, scan a backup, select a
candidate, delete an account, commit a transaction, configure a provider or
claim restore-replay readiness. Production remains blocked until independent
persistence and a complete synthetic restore/replay drill are implemented and
reviewed together.
