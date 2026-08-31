# External adapter admission control

Status: shared egress rate governance implemented; queue and circuit admission
remain per backend process for Open Food Facts search.

## Active boundary

One non-coalesced search action may use the existing end-to-end budget of one
primary attempt and at most one alternate-transport attempt. Every actual
attempt passes through the same bounded adapter admission controller.

| Control | Current value |
| --- | ---: |
| Active upstream attempts | 2 per backend process |
| Queued attempts | 4 per backend process |
| Maximum queue wait | 2 seconds |
| Consecutive failed actions before open circuit | 3 |
| Open-circuit interval | 30 seconds |
| Parallel half-open probes | 1 |
| Maximum emitted `Retry-After` | 60 seconds |

Before either the primary or alternate transport starts, it must also reserve
one of eight provider-attempt slots in the shared sixty-second sliding window.
PostgreSQL stores these low-cardinality admission timestamps and serializes the
decision with a provider-keyed transaction advisory lock. This bounds the total
across backend processes that share the production database, rather than eight
per process. No query, user identifier or IP address is stored. A full window
returns `429`; database or governor failure returns `503`. Both responses carry
a bounded `Retry-After` and occur before provider network access.

Identical concurrent searches use the normalized query and page size as their
short-lived in-memory key and share one task. The key and result disappear when
that task completes. No search text is written to a durable abuse profile.

Queue overflow, queue timeout, an open circuit or an already-running recovery
probe fails locally with `503 Service Unavailable` and a bounded `Retry-After`.
These rejections do not start a primary or fallback request. Canceling one
coalesced waiter does not cancel the shared upstream task. The same-origin
frontend proxy preserves `Retry-After` in its response.

## Circuit behavior

The circuit counts consecutive failures of complete, non-coalesced search
actions. A primary transport failure followed by a successful fallback is a
successful action. Upstream HTTP statuses are still never bypassed through the
fallback transport. Once the recovery interval expires, exactly one action may
probe the source. Its success closes the circuit; failure opens a fresh interval.
Late results from older in-flight requests cannot close a newer open circuit.

## Remaining shared gate

The semaphore, queue, coalescer and circuit state are process-local. They bound a
single backend process but do not claim aggregate queue or circuit state across
multiple instances. The shared PostgreSQL egress governor is separately proven
with concurrent processes in PostgreSQL CI. SQLite uses an equivalent in-memory
gate for local development and is not live multi-instance proof. V2 therefore
remains blocked on the shared route limiter and the broader multi-instance
admission and proxy-topology proof listed in
`contracts/operations/v2/abuse-capacity-mutation.json`.
