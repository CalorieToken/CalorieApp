# Per-subject private food-log storage budget

Status: implemented and PostgreSQL multi-process verified for the current
authenticated food-log write path.

## Boundary

Each internal CalorieApp user may retain at most 10,000 private food-log rows.
The key is the server-created internal user identifier, not an email address,
XRPL address, raw IP address, browser fingerprint or request-supplied subject.
Legacy rows without proven ownership do not count toward any user's budget and
remain unavailable through normal private-history queries.

The limit is deliberately a retained-row budget rather than a time window. A
full budget returns `409` without `Retry-After`: waiting cannot create storage
space. The user may export their data and choose to delete one or more entries;
deletion then makes space available. CalorieApp never deletes or shortens
existing history automatically to satisfy this control.

## Atomic admission

`POST /log-food` counts and inserts inside one serialized admission boundary.
PostgreSQL uses a transaction advisory lock derived from the internal user ID,
so concurrent backend processes cannot all observe the same final free slot.
The owner index added by migration `20260831_0005` keeps the count scoped and
efficient. The lock key is computed at request time and is not stored. A
transaction-local one-second `lock_timeout` prevents indefinite lock waits.

SQLite uses a process-local lock for development and unit tests only. It is not
production or multi-instance proof. CI exercises the PostgreSQL path from
separate processes and proves that an eight-entry test budget admits exactly
eight of twelve concurrent writes.

If the database, lock or count is unavailable, admission fails closed with
`503` and a five-second `Retry-After`; no unbudgeted row is created. Logs record
only the fixed rejection reason, not the food payload or user identifier.

## Scope and remaining gate

Open Food Facts search results remain read-only and are not automatically
persisted as catalog records. The separate per-source retained-record budget is
now implemented in `PER_SOURCE_INGEST_BUDGET.md`; public source onboarding and
the remaining product/assertion mutation controls are still disabled.

This implementation adds one index but no provider, external service, paid
capacity, recurring request or extra CI job. It is a repository change only and
does not claim a production migration or deployment.
