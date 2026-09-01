# Bounded source-assertion ingest

Status: implemented for an internal service only. Retained correction and
terminal moderation are separate internal services. No public catalog-write
route, source activation or production migration is enabled.

## Admission boundary

Migration `20260831_0009` adds a positive `assertion_limit` to every registered
`food_source` and creates `food_attribute_assertion_ingest_audit`. The internal
service accepts a source assertion only when all of these conditions hold:

- the fixed authorization scope is `catalog:source-assertion:ingest`;
- the registered source is enabled;
- the immutable source record is already validated at the supplied expected
  verification version;
- the source-neutral product is active;
- the exact product/source-record link exists and is validated; and
- the request fields use bounded controlled formats.

Before any database work, content policy `1.0.0` accepts only the reviewed,
source-neutral nutrition keys listed in `SOURCE_ASSERTION_CONTENT_POLICY.md`.
Each key has one exact per-100g unit and a numeric range. Unknown keys, mismatched
units, negative or non-finite numbers, exponent notation, excessive precision
and arbitrary text are rejected. Equivalent decimal forms are canonicalized
before idempotency and duplicate checks.

Every admitted assertion is a new immutable version-1 row in `quarantined`
state with no correction predecessor. Validation or public activation is not
part of this service.

## Idempotency and retained-data budget

An idempotency key identifies the complete ingest request. Repeating an exact
request returns its existing assertion and audit receipt and consumes no extra
budget. Reusing a key for different content, or submitting evidence that already
exists under another key, returns persistent `409` without `Retry-After`.

Each source has a reviewed positive retained-assertion limit. PostgreSQL holds
transaction advisory locks for the record, idempotency key and source while it
checks lineage, counts retained assertions and inserts. Independent-process CI
proves that a limit of eight admits exactly eight of twelve simultaneous writes,
and that an admitted duplicate remains idempotent after the budget is full.
Each advisory-lock wait has a transaction-local one-second `lock_timeout`.
SQLite uses a process-local lock for local development and tests only; it is not
multi-instance evidence.

A full budget or stale/invalid lineage returns `409`. A missing record or
product returns `404`. An invalid scope returns `403`. Database or locking
failure rolls back and returns `503` with a bounded five-second `Retry-After`.

## Minimal audit receipt

The assertion and audit receipt commit atomically. The receipt keeps only the
assertion/product/record lineage, idempotency key, expected record version,
resulting assertion version, controlled pseudonymous submitter reference, fixed
scope and timestamp. Composite foreign keys prevent it from claiming different
lineage than the assertion.

The service never updates an audit row and the schema contains no raw source
payload, free-text reason, email, IP address, session, wallet or private user
identifier. The content policy closes the prior arbitrary-text path through the
assertion `value` field; quarantine and human moderation still apply to numeric
values. Production insert-only privileges remain a separate deployment proof.

## Deliberate non-claims

This slice does not expose an HTTP endpoint, persist Open Food Facts search
results, enable community contributions, add a second source or choose a
provider. Terminal moderation and retained correction are separate services
documented in `SOURCE_ASSERTION_MODERATION.md` and
`SOURCE_ASSERTION_CORRECTION.md`; the complete contribution mutation gate
therefore remains open.

The change adds no provider, paid service, recurring upstream request, extra
GitHub Actions job, production migration or deployment.
