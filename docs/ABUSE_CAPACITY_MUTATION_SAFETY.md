# Abuse, capacity and mutation safety

Status: partial and release-blocking for V2.

## Goal

The free CalorieApp service must fail predictably before request storms, retries,
unbounded data or hostile integrations endanger existing history or upstream
services. The same boundary prevents unauthorized mutation of the official app
and the separate ecosystem.

## Layered limits without permanent tracking

Limits apply by route and source adapter, then—where applicable—by registered
client, authenticated pseudonymous subject and a short-lived keyed network
signal. Raw IP addresses and search text may not become long-term abuse profiles.
An IP signal is never the only durable identity because mobile carriers,
workplaces and households share addresses.

Mutation routes now receive fail-closed body-byte bounds before FastAPI parses
JSON. Both the declared `Content-Length` and the body bytes actually received are
enforced, so absent or misleading headers do not bypass the boundary. Oversize
bodies return `413` without `Retry-After`; malformed or ambiguous
`Content-Length` returns `400`. The body content is not logged. The exact current
limits and extension rule are documented in `REQUEST_BODY_LIMITS.md`.

Every current public route now has a shared global rate budget before endpoint
work. PostgreSQL coordinates a strict sliding window across backend processes
using fixed low-cardinality route keys. Dynamic IDs and arbitrary paths are not
stored; unmatched traffic shares one fixed key. No query, body, user, session or
IP is recorded. A full route window returns `429`; database/governor failure
fails closed with `503`. Both include bounded `Retry-After`. Health and readiness
remain exempt for cold-start and monitoring, and health must not trigger source
calls. Exact route budgets and proof are in `SHARED_ROUTE_RATE_LIMITER.md`.

Identity login starts additionally receive a strict registered-client budget of
20 starts per rolling minute and a cap of 50 retained unexpired transactions.
PostgreSQL serializes both decisions across backend processes. State, locale and
the hashed origin-browser handoff are committed atomically, so a partial login
transaction cannot be left behind. Full budgets return `429`; database failure
fails closed with `503`, both with bounded `Retry-After`. The key is fixed server
configuration and the admission rows store no IP or network fingerprint. See
`IDENTITY_START_ADMISSION_CONTROL.md` for limits, proof and non-claims.

Every PostgreSQL advisory-lock path sets a transaction-local one-second
`lock_timeout` before acquisition. A contended wait ends with PostgreSQL
SQLSTATE `55P03`; the caller rolls back and returns its documented fail-closed
`503` with `Retry-After: 5`. CI holds a real advisory lock to prove that bound.

Identity status checks now preserve five-second responsiveness for the first 30
seconds, then slow to ten seconds and finally twenty seconds after 90 seconds.
Consecutive transient failures back off to 10, 20 and 30 seconds, while bounded
`Retry-After` guidance is respected up to 60 seconds. The CalorieApp handoff and
WordPress/Xaman finish layers share this policy. Focus and page-show events
cannot bypass an existing timer. Exact behavior and deterministic proof are in
`ADAPTIVE_IDENTITY_STATUS_POLLING.md`.

The Open Food Facts adapter now admits at most two active upstream attempts per
backend process, queues at most four for no longer than two seconds and merges
identical in-flight searches. Three consecutive failed search actions open its
circuit for thirty seconds; recovery permits exactly one probe. Local admission
rejections return `503` with a bounded `Retry-After` and never trigger another
transport attempt. These queue and circuit controls remain process-local.

Separately, every actual primary or fallback attempt must reserve one of eight
slots in a shared sixty-second strict sliding window before network access.
PostgreSQL serializes admission across backend processes with a provider-keyed
transaction advisory lock. It stores only the provider key and short-lived
admission time—not the query, user or IP. A full window returns `429`; governor
or database failure fails closed with `503`. Both include bounded
`Retry-After`. Concurrent-process PostgreSQL CI proves the aggregate eight-slot
boundary; SQLite's in-memory equivalent is only for local development.

Authenticated private food logging now admits at most 10,000 retained rows per
internal CalorieApp user. PostgreSQL serializes the count-and-insert decision
across backend processes with a user-keyed transaction advisory lock. A full
budget returns `409` without time-based retry guidance; user-directed deletion
makes space, while existing history is never removed automatically. Database or
lock failure returns a bounded `503` and creates no row. The current Open Food
Facts search remains read-only. Exact behavior and proof are documented in
`PER_SUBJECT_STORAGE_BUDGET.md`.

Internal catalog ingestion now requires an enabled registered source with a
positive retained-record limit. PostgreSQL serializes duplicate lookup, source
count and insertion across processes. The immutable source/version key is
idempotent and duplicates do not consume budget; every new record enters
quarantine and no raw source payload is stored. A full source returns persistent
`409`, while storage failure returns bounded `503`. There is no public source
onboarding or catalog-write endpoint. See `PER_SOURCE_INGEST_BUDGET.md`.

Internal assertion ingest now has its own positive retained-assertion budget per
registered source. It requires an enabled source, active product, validated
record and validated product/record link at the expected record version. Every
new assertion is quarantined, an exact duplicate is idempotent, and the minimal
audit receipt commits atomically. PostgreSQL serializes record, idempotency and
source-budget decisions across processes. A full budget returns `409`; database
failure returns bounded `503`. No public endpoint exists. See
`SOURCE_ASSERTION_INGEST.md`.

That ingest path now also applies versioned content policy `1.0.0` before any
database work. The initial allowlist contains only bounded, source-neutral
numeric nutrition values per 100g. Unknown attributes, mismatched units and
arbitrary text are rejected, closing the previously unrestricted text path into
the generic assertion value. Numeric assertions still require quarantine and
human moderation. Policy expansion always requires human review; it cannot
activate a provider or public write route.

Quarantined source assertions now have one terminal internal moderation path.
It requires the fixed `catalog:source-assertion:moderate` scope, expected
version, idempotency key, pseudonymous moderator reference and controlled reason
code. Only quarantine to validated/rejected is allowed. The status/version
change and minimal audit commit atomically; PostgreSQL advisory locks serialize
decisions across processes. A validated decision also rechecks canonical
content policy and the current enabled/validated/active source lineage. No
public moderation endpoint exists. See
`SOURCE_ASSERTION_MODERATION.md`.

## One retry budget

Retries are counted end-to-end per user action, not independently in browser,
proxy, backend and adapter. Open Food Facts search now permits one primary
request plus at most one alternate-transport request. An upstream HTTP status,
including `429` or `503`, is not bypassed through fallback. Nested curl or urllib
retries have been removed.

The official Open Food Facts API documentation currently states a limit of ten
search requests per minute per IP and warns against search-as-you-type. The
shared egress governor enforces the reviewed safety margin of at most eight
actual attempts per minute. The still-process-local queue and circuit layer does
not replace the remaining shared route and complete topology controls.

## Unwanted mutation

External ecosystem clients are read-only by default and never receive direct
database, session-store or Identity Bridge access. A contribution creates a new
source assertion in quarantine. Schema validation and moderation are required
before public activation; corrections preserve the superseded assertion rather
than silently rewriting it.

Every allowed mutation needs authentication, a purpose-limited scope,
idempotency, an expected version or optimistic concurrency check and a minimal
append-only audit event. The production application role cannot execute DDL.
Migrations use a separate approved role. Mass changes require dry-run scope
preview and explicit approval. No automated component creates, signs or pays for
an XRPL transaction.

The first internal source-record moderation path now enforces this pattern. It
accepts only a fixed moderation scope and controlled pseudonymous references,
requires an idempotency key and expected version, permits only quarantine to
validated/rejected transitions, and appends one minimal audit event in the same
transaction. PostgreSQL serializes both record and idempotency conflicts across
processes. No public route exists. The source-neutral product/link/assertion
schema, read-only licensed evidence query and bounded internal assertion-ingest
service now exist. Public contribution, assertion correction, real caller
authentication and production audit-table privilege proof remain open. The combined mutation
release gate is therefore not yet claimed complete. Exact boundaries are in
`SOURCE_RECORD_MODERATION.md`, `SOURCE_ASSERTION_CATALOG.md` and
`SOURCE_ASSERTION_INGEST.md`.

## Capacity and incident boundary

Metrics use low-cardinality counters and never contain request contents, secrets
or tokens. Alerts fire at 70, 85 and 95 percent of the approved capacity budget.
There is no automatic paid upgrade and no automatic deletion of existing
history. The backend now classifies its database-size signal at those fixed
thresholds and pauses only new identity onboarding at 95 percent. If an exact
limit is configured but database usage cannot be measured, new onboarding fails
closed. Existing identities bypass this onboarding-only guard, so login and
existing read, export and erasure routes remain available.

The byte limit is intentionally unset until a human verifies the selected
provider's exact live quota. `CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES` accepts
only a positive integer and malformed values fail startup. PostgreSQL uses the
read-only `pg_database_size(current_database())` signal; SQLite uses page count
and page size only for local and unit-test equivalence. The full design and
operator boundary are in `DATABASE_CAPACITY_ONBOARDING_GUARD.md`.

The provider-neutral `python -m app.capacity_probe` command supplies stable JSON
and exit codes for later monitoring integration. It omits exact byte counts,
utilization and request/user content. The response process is fixed in
`CAPACITY_ALERT_INCIDENT_RUNBOOK.md`; choosing and proving an external alert
destination remains a live, human-approved release gate.

V2 remains blocked until the complete shared multi-instance adapter admission
and proxy-topology proof, the Identity Bridge short-lived network-signal
control, authenticated assertion correction and production audit privileges,
chosen-provider alert delivery,
chosen-provider quota proof and proxy topology tests exist. Exact
tunable values belong in reviewed configuration, while the safety invariants
remain fixed in
`contracts/operations/v2/abuse-capacity-mutation.json`.

Primary references:

- Open Food Facts API usage and rate limits:
  <https://openfoodfacts.github.io/openfoodfacts-server/api/>
- OWASP denial-of-service guidance:
  <https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html>
- HTTP `Retry-After` semantics (RFC 9110):
  <https://www.rfc-editor.org/rfc/rfc9110.html>
