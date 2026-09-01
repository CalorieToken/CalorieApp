# Durable authenticated-activity retention marker

Status: repository implementation prepared; migration deployment, warning
delivery and inactive-account erasure remain disabled and release-blocking.

## Purpose

The selected inactive-account policy measures 24 calendar months from the
last successful authenticated CalorieApp activity. Authentication-session rows
cannot be the durable source for that decision because those short-lived rows
are independently eligible for cleanup.

`calorieappuser.last_authenticated_activity_at` is therefore the durable,
indexed account-level anchor. It advances at two reviewed write points:

- successful creation of an authenticated session; and
- successful resolution of an authenticated request.

The database update is conditional, so an older concurrent observation cannot
move the marker backwards. A timezone-aware observation is first converted to
the database convention of naive UTC, including observations carrying a
non-UTC offset. The field is included in the authenticated user's private
account export.

## Existing-account backfill

Forward migration `20260901_0012` adds the non-null marker and index. For each
existing account it copies the latest available `authsession.last_seen_at`; if
the account has no retained session, it uses the account `created_at` value,
which is the earliest durable evidence of the authenticated account creation.
The migration fails validation if the marker is nullable, unindexed or still
contains the temporary backfill sentinel.

This migration is exercised only against disposable SQLite and optional
PostgreSQL test databases by the repository checks. Preparing and merging the
migration does not apply it to staging or production.

## Explicit non-activation boundary

This change does not:

- calculate or persist a future erasure date;
- create a warning, notification or marketing-contact dataset;
- schedule a background job;
- mark an account for erasure;
- delete an account or authentication record;
- apply a staging or production migration; or
- deploy the application.

The release gate remains partial until the marker is separately migrated and
proved, warning delivery is reliable, activity cancels a pending warning, and
the bounded account-erasure process plus backup replay proof are reviewed
together. `docs/INACTIVE_ACCOUNT_PREVIEW.md` describes the read-only,
aggregate-only boundary calculation that is prepared without enabling any of
those actions.
