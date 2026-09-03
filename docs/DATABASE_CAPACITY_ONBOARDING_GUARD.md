# Database capacity onboarding guard

Status: provider-neutral guard, alert-adapter interface and synthetic proof
complete. The 500,000,000-byte Neon Free database budget and keyless pre/post
observation path are approved for isolated synthetic staging only. External
alert delivery and a live pause exercise remain release-blocking for public
onboarding.

## Safety outcome

CalorieApp protects existing history before a finite database budget becomes
unsafe. The backend measures the current database, classifies usage at 70, 85
and 95 percent, and pauses only the creation of a new external identity at the
95-percent boundary. It never buys capacity or deletes existing history.

An already-linked identity does not enter the new-user guard. Existing users can
therefore still authenticate and use existing read, export and erasure routes
during an onboarding pause. A rejected callback returns HTTP 503 with a bounded
one-hour `Retry-After`, creates no user or external identity, and exposes no
quota, provider or account detail.

## Configuration and fail-closed behavior

`CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES` is the hard, operator-approved byte
budget. Isolated Neon synthetic staging uses `500000000`, matching the current
Free-plan storage limit. It remains absent by default and must be supplied only
to the separately approved staging operation or a later reviewed deployment.
Absence preserves the current non-public development baseline but does not
satisfy the public-release gate.

When set, the value must be a positive integer. A malformed value fails
application startup. If a configured deployment cannot read its database-size
signal, the backend fails closed for new onboarding while leaving existing-user
routes untouched.

PostgreSQL reads `pg_database_size(current_database())`. Local SQLite tests use
the equivalent page-count multiplied by page-size signal. Both queries are
read-only. Capacity levels are fixed policy, not operator-adjustable runtime
thresholds:

| Utilization | Classification | New onboarding |
|---:|---|---|
| below 70% | normal | allowed |
| 70% to below 85% | warning | allowed |
| 85% to below 95% | critical | allowed |
| 95% or more | pause | blocked |

## Evidence and remaining gate

Unit tests cover parsing, exact threshold boundaries, missing configuration,
measurement failure and SQLite measurement. Identity tests prove the guard runs
before a new user is written and that existing identities bypass it. Endpoint
tests prove the HTTP response, lack of a partial identity and continued existing
login. PostgreSQL CI reads the real PostgreSQL database-size signal.

`python -m app.capacity_probe` now converts that signal into deterministic,
low-cardinality JSON and stable monitoring exit codes. It exposes only the
policy level, crossed threshold, onboarding state and required action—not exact
bytes, utilization or user/request content. Operational response is defined in
`CAPACITY_ALERT_INCIDENT_RUNBOOK.md`.

This does not claim that the Free plan is durable or sufficient for public use.
The synthetic staging operation must run the probe and inspect provider counters
before and after every approved execution. Before public activation, a human
must recheck provider terms, connect the probe to an approved external alert
destination and prove delivery plus the pause exercise against the isolated
provider project. No real user data is allowed until that evidence is reviewed.
