# Ephemeral PostgreSQL compatibility proof

Status: automated gate configured; a successful GitHub Actions check is required
for every merge candidate.
Public onboarding and production deployment remain blocked.

## Purpose

This gate proves that CalorieApp's provider-neutral database code works against
real PostgreSQL rather than only SQLite. It uses the existing GitHub Actions CI
role, a temporary PostgreSQL 16 service and synthetic records. It creates no
provider account, recurring subscription, live database or user data.

## Automated scenarios

1. Start an empty PostgreSQL database and apply the forward-only migration.
2. Verify schema head and database readiness.
3. Run the staging migration command with an explicit approval reference.
4. Upgrade a supported legacy `food_log` table without losing its row.
5. Create two synthetic Identity Bridge users and opaque application sessions.
6. Log separate food records through the real FastAPI endpoints.
7. Dispose the application database engine and create a replacement engine.
8. Confirm both histories survive and remain isolated by owner.
9. Confirm one synthetic user cannot delete the other user's record.

The integration test refuses to reset a database unless the host is loopback
and the database name is exactly `calorieapp_ci_test`. This deliberately makes
the test unusable against a remote, staging or production database.

## What it does not prove

- persistence across a chosen provider's service restart or redeployment;
- permanence or capacity of any free tier;
- quota monitoring and onboarding pause behavior;
- encrypted backup creation or successful restoration;
- export/import into another provider;
- production security, privacy or operational readiness.

Those remain separate release-blocking tests. Passing this CI gate permits the
project to evaluate zero-additional-subscription PostgreSQL hosting with much
less provider-specific manual testing; it does not select or endorse a host.
