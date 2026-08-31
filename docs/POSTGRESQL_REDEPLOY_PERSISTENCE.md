# Synthetic backend process-replacement persistence proof

Status: automated partial evidence configured. A successful GitHub Actions check
is required for every merge candidate. Public onboarding and production
deployment remain blocked.

## What the drill proves

The CI job uses synthetic data in the existing ephemeral PostgreSQL 16 service.
It migrates the guarded loopback database, seeds an opaque synthetic session and
starts CalorieApp through Uvicorn as a separate operating-system process. That
first backend writes a food-history record through the authenticated HTTP API and
is then stopped completely. A newly launched backend process points to the same
database and must read the same record through the authenticated HTTP API.

The drill also verifies the migration head and the record's internal owner link
directly in PostgreSQL. It refuses to reset any database unless the host is
loopback and its name is exactly `calorieapp_ci_test`. Logs contain no connection
URL, credential, session token or record body.

## Why the release gate remains partial

This proves persistence across two separate CalorieApp process lifecycles. It
does not create or select a hosting account, deploy an application, restart a
managed database service or exercise a provider's filesystem, network, quota or
redeploy behavior. It therefore does not prove persistence across a real chosen
provider redeployment.

Provider evaluation, quota alerts, encrypted staging restore, provider-exit
import and production readiness remain separate release-blocking work. No real
user, staging or production data is allowed in this drill.
