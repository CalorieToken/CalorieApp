# Shared public-route rate limiter

Status: implemented for the current backend route surface.

## Guarantee

Protected requests must reserve route capacity before FastAPI validation,
endpoint work, application-data mutation or external provider access.
Production uses a strict sixty-second sliding window shared by every backend
process connected to the primary PostgreSQL database.

A fixed low-cardinality route key selects the budget. Dynamic log identifiers
normalize to `food_log_delete_one`; arbitrary unknown paths normalize to
`unmatched_request`. The operational table never stores the raw path, query,
body, user, session, cookie or IP address.

| Route or route class | Requests per 60 seconds |
| --- | ---: |
| API metadata routes combined | 120 |
| `POST /api/identity/login/start` | 30 |
| `POST /api/identity/login/state/validate` | 120 |
| `POST /api/identity/callback` | 30 |
| `POST /api/identity/login/status` | 240 |
| `GET /api/identity/me` | 240 |
| `GET /api/identity/export` | 30 |
| `DELETE /api/identity/account` | 10 |
| `POST /api/identity/logout` | 120 |
| `POST /log-food` | 120 |
| `GET /logs` | 240 |
| `DELETE /logs` | 30 |
| `DELETE /logs/{log_id}` | 120 |
| `GET /search-food` | 60 |
| Unmatched request traffic | 120 |

The login-status budget supports twenty simultaneous flows polling at the
required five-second interval. Login-start, callback, export and delete-all
have smaller budgets because they create state, call the bridge, or perform
broader work. Food search remains separately constrained to eight actual Open
Food Facts attempts per minute by the provider governor.

`GET /health` and `GET /ready` are exempt so cold-start and monitoring probes
cannot deadlock behind the database-backed limiter. Readiness still checks the
database and exact migration head. CORS wraps limiter responses, while body
limits reject invalid or oversize mutations before a route slot is consumed.

## Responses and failure behavior

| Condition | Response | Endpoint runs |
| --- | ---: | --- |
| Route slot available | continue | yes |
| Route window full | `429` plus bounded `Retry-After` | no |
| PostgreSQL table, connection or governor unavailable | `503` plus `Retry-After: 5` | no |

The PostgreSQL decision uses `clock_timestamp()` and a route-keyed transaction
advisory lock. Expired events are removed during admission. A slot is not
refunded after endpoint failure because the protected work may already have
started.

## Cost, privacy and proof

Migration `20260831_0003` adds `route_rate_event` and its route/time index. The
design reuses the required primary PostgreSQL database and adds no Redis
instance, paid rate-limit service or recurring external request.

PostgreSQL CI starts independent processes against one database and proves
that simultaneous requests cannot exceed one shared window. It also proves
fail-closed behavior when the route event table is absent. SQLite uses a locked
in-memory equivalent for local development and unit tests; that is not live
multi-process evidence.

This is deliberately a route-global capacity layer. It does not provide shared
adapter queue/circuit state or a deployed frontend/backend topology exercise.
Per-client login-start, outstanding-state and adaptive polling controls are
documented separately. The remaining topology gate prevents this global control
from being misrepresented as complete abuse attribution.

## Rollout

Apply and validate migration `20260831_0003` before starting the new backend.
Do not route traffic through a mixed deployment containing instances without
the limiter. After rollout, exercise representative `429` and fail-closed `503`
responses through the deployed same-origin proxy and verify `Retry-After`
propagation without logging request content.
