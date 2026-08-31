# Mutation request-body limits

Status: implemented and release-tested for current backend mutation routes.

## Boundary

`RequestBodyLimitMiddleware` runs before FastAPI reads or validates a mutation
body. It rejects a declared body above the route limit without reading it and
also counts the actual ASGI body chunks. An absent or falsely small
`Content-Length` therefore cannot bypass the limit. Malformed, negative or
duplicate `Content-Length` headers fail closed with `400`.

Oversize bodies return `413 Request Entity Too Large`, include private-response
security headers and do not include `Retry-After`. Request content is never
written to logs by this control.

## Current limits

| Method and route | Maximum body |
| --- | ---: |
| `POST /api/identity/login/start` | 2 KiB |
| `POST /api/identity/login/state/validate` | 2 KiB |
| `POST /api/identity/callback` | 4 KiB |
| `POST /api/identity/login/status` | 4 KiB |
| `DELETE /api/identity/account` | 4 KiB |
| `POST /api/identity/logout` | 1 KiB |
| `POST /log-food` | 16 KiB |
| `DELETE /logs/{log_id}` | 16 KiB default |
| `DELETE /logs` | 16 KiB default |

Any future `POST`, `PUT`, `PATCH` or `DELETE` route is protected by the 16 KiB
default until a narrower reviewed route limit is added. Read-only methods bypass
the body middleware.

## Evidence and remaining gate

Direct ASGI tests prove declared, chunked, misleading-header, exact-boundary and
invalid-header behavior. The endpoint integration test proves an oversize food
log cannot create a database row.

This closes only the request-body part of the wider growth-control gate. V2
remains blocked on per-subject storage budgets, per-source ingest budgets and the
other missing controls listed in
`contracts/operations/v2/abuse-capacity-mutation.json`.
