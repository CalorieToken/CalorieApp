# Database capacity onboarding guard

Status: provider-neutral implementation and synthetic proof complete; provider
selection, exact quota configuration, alert delivery and live exercise remain
release-blocking.

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
budget. It is deliberately absent by default because no provider has been
selected and no exact live quota has been verified. Absence preserves the
current non-public development baseline but does not satisfy the public-release
gate.

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

This does not claim that any shortlisted free plan is durable or sufficient.
Before activation, a human must recheck provider terms, select the synthetic
staging candidate, set the exact verified quota, configure low-cardinality alert
delivery at 70/85/95 percent, approve the incident runbook and run the pause
exercise against that isolated provider project. No real user data is allowed
until that evidence is reviewed.
