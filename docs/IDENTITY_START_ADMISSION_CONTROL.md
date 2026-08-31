# Identity-start admission control

Status: implemented and PostgreSQL multi-process verified for the registered-
client start budget and retained unexpired transaction cap. A short-lived
network-signal layer remains a release gate; adaptive status polling is
documented separately.

## Purpose

`POST /api/identity/login/start` allocates database state before the external
sign-in completes. Unbounded starts could therefore consume storage even when
no login succeeds. CalorieApp now admits that work against two fixed budgets:

- at most 20 starts in a strict rolling 60-second window per registered client;
- at most 50 retained, unexpired login transactions per registered client.

The outstanding count includes every unexpired status, including consumed,
completed or failed transactions retained temporarily for replay protection.
Changing status cannot bypass the storage cap. Expired state, locale and handoff
records remain subject to the existing transient cleanup lifecycle.

## Shared PostgreSQL decision

The admission key is the server-configured `CALORIEAPP_CLIENT_ID`; it is not
accepted from the browser request. PostgreSQL takes a transaction advisory lock
derived from that low-cardinality registered-client value. While holding the
lock, the backend uses the database clock, checks both budgets and commits the
pending state, locale context and hashed origin-handoff proof in one
transaction. A transaction-local one-second `lock_timeout` bounds the advisory
lock wait before any state is created.

This makes the decision strict across all backend processes that share the
primary database. A concurrent-process CI scenario proves that only the allowed
number is created and that every admitted state has exactly one locale and one
handoff record. SQLite uses a process-local lock solely for local development
and unit-test equivalence; it is not production or multi-process evidence.

## Responses and failure mode

A full start window or outstanding-state budget returns `429` with a
`Retry-After` value bounded to 1–60 seconds. Database, schema or admission
failure returns `503` with `Retry-After: 5`. Both responses are marked
`no-store`. Database failure cannot fall through to state creation.

The existing shared route budget still runs first. It provides a global
30-per-minute boundary for the login-start route; the identity-specific layer
then enforces the narrower registered-client and storage controls.

## Privacy and cost boundary

Only the fixed registered-client identifier is added to the hashed transient
login-state row. No raw IP address, forwarded header, network fingerprint,
search content, session token or handoff token is stored for admission. The
handoff continues to be stored only as a hash.

The control reuses the required primary PostgreSQL database. It adds no Redis
instance, paid provider, external call, workflow or separate CI job.

## Deliberate non-claims

This change does not claim a short-lived network-signal limit. CalorieApp has
not yet proved its deployed proxy chain and therefore must not treat proxy
egress as an end-user address or trust arbitrary forwarding headers. Adaptive
status polling is now implemented as described in
`ADAPTIVE_IDENTITY_STATUS_POLLING.md`; it does not replace the missing network
and deployed-proxy controls.

## Deployment and rollback boundary

Migration `20260831_0004` adds the non-null `client_id` column with the
compatibility value `legacy` for existing rows and adds client/time indexes.
Apply and validate that migration before starting the updated backend. A
production schema change still requires the separate approved migration role
and normal deployment approval; this repository change is not proof that a live
deployment occurred.

If the new admission path causes an incident, stop new identity starts, preserve
the database for diagnosis and restore the previously approved application
version. Do not drop the new column or delete transient rows automatically as a
rollback shortcut.
