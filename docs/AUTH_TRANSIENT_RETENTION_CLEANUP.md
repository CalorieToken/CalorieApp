# Authentication-transient retention cleanup

Status: bounded provider-neutral runner implemented and tested; scheduler and
production execution disabled.

## Covered records

One cleanup pass covers these six tables:

- `authorizationcode`;
- `pendingloginstate`;
- `pendingloginlocale`;
- `originloginhandoff`;
- `authsession`; and
- `bridgeauthnonce`.

Expired rows are eligible at their shorter operational expiry. A revoked session
is eligible only when its `revoked_at` value is on or before the fixed run
cutoff. Session batches are ordered by the earliest applicable expiry or
revocation timestamp so revoked sessions with a future expiry cannot be starved
by a continuing expired-session backlog. The runner clears any inbound
`replaced_by_session_id` reference before deleting an eligible session.

## Safety boundary

The runner:

- defaults to dry-run, performs no flush or commit in that mode and rolls its
  read transaction back before returning;
- accepts only SQLite or PostgreSQL;
- requires a clean, dedicated database session with no pre-existing
  transaction, loaded identity-map objects or pending mutations;
- selects at most 500 rows per table by default and never accepts more than
  5,000 rows per table in one pass;
- splits every update and deletion into statements containing at most 500 row
  identifiers, including when a larger per-table batch is requested, so SQLite
  parameter limits cannot be exceeded;
- executes all six table mutations in one transaction and rolls all of them
  back if any step fails;
- emits only table names and aggregate counts, never row identifiers, token
  hashes, IP addresses or exception details; and
- is idempotent, so a repeated pass can safely find no remaining eligible rows.

No scheduler calls this runner. Production execution is unconditionally blocked
until a separate reviewed activation change modifies that code boundary.

## Read-only dry-run

Run from `backend/` with an at-head local, test or staging database:

```bash
CALORIEAPP_ENV=test \
DATABASE_URL=sqlite:////absolute/path/to/disposable.db \
python -m app.auth_transient_retention_cli
```

`--dry-run` is optional because it is the default. `--batch-limit` may be set
between 1 and 5,000. The JSON result reports only bounded selected counts. A
zero exit code means the dry-run completed, not that scheduled enforcement or
the overall retention release gate is complete.

## Reviewed non-production execution

Deletion is available only in local, test or staging after explicit enablement
and a reviewed approval reference:

```bash
CALORIEAPP_ENV=test \
CALORIEAPP_AUTH_TRANSIENT_CLEANUP_ENABLED=true \
DATABASE_URL=sqlite:////absolute/path/to/disposable.db \
python -m app.auth_transient_retention_cli \
  --execute \
  --approval-reference REVIEWED-CHANGE-REFERENCE
```

The approval reference is validated but not printed. Operators must inspect a
dry-run first, use a reviewed bounded batch size, preserve the aggregate result
in the approved operational record and repeat only while
`more_rows_pending=true`.

This repository work does not run either command against real data, configure a
scheduler, migrate a database, deploy the application or complete the broader
retention release gate.
