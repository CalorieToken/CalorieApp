# Inactive-account lifecycle preview

Status: aggregate-only repository implementation prepared. Warning delivery,
account marking, automatic erasure, scheduling, production execution, migration
and deployment remain disabled and release-blocking.

## Purpose

The selected policy requires a warning 30 days before an account reaches 24
calendar months without authenticated CalorieApp activity. The repository now
contains a bounded read-only preview that makes those calendar boundaries
testable without creating a warning or erasure dataset.

For each evaluated active account, the preview calculates the retention date
from `last_authenticated_activity_at` using calendar-month arithmetic. The
notice window begins 30 days before that account-specific date. Leap days and
shorter month ends are clamped deterministically to the last valid day.

## Bounded aggregate output

The preview evaluates the oldest active accounts first, with a default batch
limit of 500 and a hard maximum of 5,000. It reports only:

- the as-of time and fixed policy dimensions;
- the number of accounts evaluated;
- the number currently within the notice window;
- the number whose activity is already beyond the retention boundary; and
- whether another due account exists beyond the bounded batch.

It never returns account identifiers, external subjects, wallet addresses,
session data, network signals or contact details. The dedicated read
transaction is rolled back before the result is returned.

Run the non-production preview from `backend/` against an at-head database:

```bash
python -m app.inactive_account_preview_cli
```

An optional `--batch-limit` may be between 1 and 5,000. There is deliberately no
execute, notification, marking or erasure option. The CLI fails closed in the
production environment until a separate reviewed activation change.

## Non-activation boundary

An account whose activity is beyond a calculated boundary is not automatically
erasable. The selected policy still requires proof that the warning was
reliably delivered and that later authenticated activity cancels the pending
process. This preview does not persist that proof and therefore cannot authorize
inactive-account erasure.

This change does not configure a scheduler or provider, contact a user, create
a notification destination, write to the database, apply a migration, enable
account erasure or deploy the application.
