# Shared provider rate governor

Status: implemented for Open Food Facts search egress.

## Guarantee

Every actual Open Food Facts primary or fallback transport attempt must acquire
shared admission immediately before network access. The production boundary is
a strict sliding window of at most eight admitted attempts in any sixty seconds
for the `open_food_facts_search` provider key.

The primary PostgreSQL database is the shared coordination store. A
provider-keyed `pg_advisory_xact_lock` serializes each decision while expired
events are removed, the current window is counted and at most one new event is
inserted. PostgreSQL's clock is authoritative, avoiding backend-host clock
skew. The table remains bounded to roughly the active window per provider.

| Condition | Response | Provider request started |
| --- | ---: | --- |
| Slot available | continue | yes |
| Eight active events | `429` plus bounded `Retry-After` | no |
| Database, table or governor unavailable | `503` plus `Retry-After: 5` | no |

An acquired slot is intentionally not refunded after a timeout, cancellation or
transport failure: the attempt may already have reached the provider. The
fallback, when permitted by the existing end-to-end retry policy, consumes a
second slot.

## Data and cost boundary

`provider_rate_event` stores only a random row ID, the low-cardinality provider
key and admission timestamp. It contains no search text, account, session, IP,
food result or provider response. Expired rows are deleted during admission.

The design reuses CalorieApp's required primary PostgreSQL database. It adds no
Redis service, paid rate-limit provider or recurring external request. The
production application role needs only normal row access; schema creation stays
in the separately approved migration path.

## Proof and non-claims

PostgreSQL integration tests start independent processes against one database
and prove that twelve simultaneous attempts yield exactly eight admissions and
four bounded `429` rejections. They also prove fail-closed behavior when the
operational table is absent. Unit tests cover expiry boundaries, concurrency and
response mapping.

SQLite uses an equivalent locked in-memory window for local development and
unit tests. It is deliberately not presented as live multi-process proof. The
existing adapter semaphore, queue, request coalescer and circuit breaker remain
per backend process. The companion `SHARED_ROUTE_RATE_LIMITER.md` now proves the
shared public-route window. Neither control proves shared adapter queue/circuit
state or the deployed frontend-proxy topology; those remain explicit V2 gates.

## Rollout

Migration `20260831_0002` creates the operational event table and composite
provider/time index. Apply and validate migrations before starting the new
backend. A mixed deployment must not send traffic through instances lacking the
governor. After rollout, exercise provider searches through the deployed proxy
and verify bounded `429`/`503` propagation without logging request content.
