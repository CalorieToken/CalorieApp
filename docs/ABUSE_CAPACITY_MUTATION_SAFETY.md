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

Every public route receives explicit body, field, pagination, concurrency and
queue bounds. Over-limit requests return `429` with bounded `Retry-After`;
temporary queue or circuit exhaustion returns `503`. Health checks remain cheap
and must not trigger source calls.

## One retry budget

Retries are counted end-to-end per user action, not independently in browser,
proxy, backend and adapter. Open Food Facts search now permits one primary
request plus at most one alternate-transport request. An upstream HTTP status,
including `429` or `503`, is not bypassed through fallback. Nested curl or urllib
retries have been removed.

The official Open Food Facts API documentation currently states a limit of ten
search requests per minute per IP and warns against search-as-you-type. V2 must
use a shared egress governor with a safety margin of at most eight per minute,
bounded concurrency, in-flight duplicate coalescing, jittered backoff and a
per-source circuit breaker before release.

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

## Capacity and incident boundary

Metrics use low-cardinality counters and never contain request contents, secrets
or tokens. Alerts fire at 70, 85 and 95 percent of the approved capacity budget.
There is no automatic paid upgrade and no automatic deletion of existing
history. New onboarding pauses before capacity can compromise durability.

V2 remains blocked until the shared limiter, adapter queue/circuit breaker,
payload and storage quotas, Identity Bridge limits, mutation quarantine/audit,
capacity alerts and multi-instance topology tests exist. Exact tunable values
belong in reviewed configuration, while the safety invariants remain fixed in
`contracts/operations/v2/abuse-capacity-mutation.json`.

Primary references:

- Open Food Facts API usage and rate limits:
  <https://openfoodfacts.github.io/openfoodfacts-server/api/>
- OWASP denial-of-service guidance:
  <https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html>
- HTTP `Retry-After` semantics (RFC 9110):
  <https://www.rfc-editor.org/rfc/rfc9110.html>
