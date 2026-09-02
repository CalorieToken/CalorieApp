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
2. Verify schema head, database readiness and the source-neutral catalog tables.
3. Run the staging migration command with an explicit approval reference.
4. Read PostgreSQL's database-size signal and prove an exact configured budget
   activates the 95-percent onboarding-pause classification and deterministic
   low-cardinality alert-adapter output.
5. Upgrade a supported legacy `food_log` table without losing its row.
6. Create two synthetic Identity Bridge users and opaque application sessions.
7. Log separate food records through the real FastAPI endpoints.
8. Dispose the application database engine and create a replacement engine.
9. Confirm both histories survive and remain isolated by owner.
10. Confirm one synthetic user cannot delete the other user's record.
11. Create a custom-format logical backup, restore it into a distinct disposable
    database and verify schema head plus identity/history ownership links.
12. Start a separate Uvicorn backend process, write through its authenticated
    HTTP API, stop it fully, start a replacement process against the same
    PostgreSQL database and read the persisted record through HTTP.
13. Start independent processes and prove the shared provider-attempt window
    admits exactly eight of twelve simultaneous attempts.
14. Start independent processes and prove a synthetic shared route window
    admits exactly its configured aggregate limit across all processes.
15. Start independent food-log writers and prove a per-user retained-row budget
    admits exactly eight of twelve simultaneous writes.
16. Start independent source-record writers and prove a per-source retained-row
    budget admits exactly eight of twelve distinct writes while duplicates stay
    idempotent after the budget is full.
17. Start independent source-record moderators and prove exactly one of twelve
    competing decisions at the same expected version commits with one audit.
18. Start independent source-assertion writers and prove a per-source assertion
    budget admits exactly eight of twelve validated-lineage writes, then prove
    an admitted duplicate remains idempotent after the budget is full.
19. Remove each operational rate table in an isolated test and prove provider
    and route admission fail closed before protected work.
20. Hold a real transaction advisory lock and prove a competing acquisition is
    cancelled after the configured one-second wait with PostgreSQL SQLSTATE
    `55P03`.
21. Apply the reviewed runtime-role privilege matrix to a synthetic role and
    prove normal row/audit insertion works while audit rewrite/deletion,
    migration-history mutation, persistent DDL and temporary DDL are rejected.
22. After creating a logical backup, erase one fixed synthetic account, restore
    the older archive, prove that account reappears, then match an in-memory
    HMAC replay proof and reapply the erasure while preserving the other user.

The integration test refuses to reset a database unless the host is loopback
and the database name is exactly `calorieapp_ci_test`. This deliberately makes
the test unusable against a remote, staging or production database.

## What it does not prove

- persistence across a chosen provider's service restart or real redeployment;
- permanence or exact quota of any free tier;
- chosen-provider alert destination/delivery or a live onboarding-pause exercise;
- encrypted provider backup creation or a staging restoration;
- independently persisted erasure evidence and provider restore replay;
- export/import into another provider;
- application of the runtime-role policy to staging or production credentials;
- production security, privacy or operational readiness.

The synthetic logical restore is documented separately in
`POSTGRESQL_BACKUP_RESTORE_DRILL.md`; it is partial evidence and does not select
storage, encryption, retention or recovery policy. Those remain separate
release-blocking tests. The separate-process proof is documented in
`POSTGRESQL_REDEPLOY_PERSISTENCE.md`; it proves application process replacement,
not provider redeployment. Passing this CI gate permits the
project to evaluate zero-additional-subscription PostgreSQL hosting with much
less provider-specific manual testing; it does not select or endorse a host.
