# Per-source catalog ingest budget

Status: implemented and PostgreSQL multi-process verified for the internal
immutable source-record persistence service. No public source-onboarding or
catalog-write endpoint is enabled.

## Registered source boundary

Every persisted catalog source must first have a `food_source` row containing a
fixed source key, category, operator, licence, terms reference, attribution,
status and positive retained-record limit. Only a source with status `enabled`
may ingest. Unknown, staged, paused and disabled sources fail closed.

The database enforces positive limits and unique source keys. There is no
request-supplied limit and no unlimited fallback. Registering or enabling a
source remains an explicit operator-reviewed action; the application exposes no
HTTP route for it.

## Immutable and idempotent records

`food_source_record` stores only the source link, external record identifier,
source version or content digest, timestamp and verification status. It has no
raw-payload, private-user, session, email, wallet or IP column.

The internal service exposes insert-or-return-existing behavior only; it has no
record update or delete operation. Database-level moderation audit,
expected-version enforcement and reviewed correction/supersession remain the
separate mutation-control gate and are not claimed here.

The unique idempotency key is `(source_id, external_record_id,
source_version_or_content_digest)`. Repeating the same key returns the existing
record and consumes no extra budget. A genuinely new source version creates a
new immutable record. Every new record enters as `quarantined`; later validation,
moderation, product linking and assertion activation remain separate controls.

## Atomic admission

PostgreSQL serializes idempotency lookup, retained-record count and insertion
with a transaction advisory lock derived from the fixed source key. CI starts
separate processes and proves that an eight-record synthetic source admits
exactly eight of twelve simultaneous distinct records. A duplicate remains
idempotent even after that source is full.

A full retained-record budget returns an internal persistent `409` without
`Retry-After`; waiting does not create capacity. Database or lock failure returns
a bounded `503` and persists no unadmitted record. SQLite uses a process-local
equivalent for development and unit tests only and is not multi-instance proof.

## Scope and non-claims

Migration `20260831_0006` creates only the reviewed `food_source` and
`food_source_record` foundation. Product identity, source links, factual
assertions, moderation audit and expected-version enforcement remain future
forward migrations and release gates.

Open Food Facts remains the enabled read-only search adapter. Search results are
not automatically retained as catalog records, and no second source is
activated. This adds no provider, paid capacity, recurring request, GitHub
Actions job or production deployment.
