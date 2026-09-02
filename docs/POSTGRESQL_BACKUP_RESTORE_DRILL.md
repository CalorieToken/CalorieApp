# Synthetic PostgreSQL backup and restore drill

Status: automated synthetic CI proof configured. The production backup and
recovery gate remains blocked.

## Proven boundary

Every merge candidate runs a provider-neutral PostgreSQL custom-format logical
backup and restores it into a separate disposable database. The drill:

1. accepts only a loopback PostgreSQL server;
2. requires the exact source database `calorieapp_ci_test` and distinct target
   `calorieapp_ci_restore`;
3. migrates the empty source to the current schema head;
4. creates two synthetic accounts with identity links, opaque sessions and
   separately owned food-history rows;
5. creates a `pg_dump` custom-format archive without owners or privileges;
6. restores it atomically with `pg_restore` into the target database;
7. validates the migration head, record completeness and ownership links; and
8. removes the temporary archive without uploading or retaining it.

The hard-coded host and database-name guards deliberately make the drill
unusable against a remote, staging or production database. Re-running it is
idempotent because both disposable schemas are reset before seeding or restore.

## Still required

The ephemeral archive contains synthetic data only and is not a production
backup design. It is intentionally not persisted, transferred or presented as
encrypted-at-rest evidence. Public onboarding therefore remains blocked until
humans separately approve and verify:

- a zero-additional-subscription PostgreSQL provider and independent encrypted
  backup location;
- restricted backup credentials, key custody and restore authorization;
- automated backup frequency, monitoring and failure alerts;
- the selected zero-day recovery window, maximum 30-day encrypted-backup
  expiry and erasure replay after restore;
- a staging restore/erasure drill using synthetic records; and
- an exact provider-exit, deployment and rollback runbook.

`backend/app/account_erasure_replay_proof.py` now defines a pure, privacy-
minimized proof format for future erasure replay. The CI backup drill does not
create a key, persist that pseudonymous proof independently, scan restored
accounts or execute replay, so it supplies none of the missing provider or
restore-readiness evidence. See `docs/ACCOUNT_ERASURE_REPLAY_PROOF.md`.

No live data, external provider, production deployment or provider-specific
retention configuration is created by this CI proof.

The separately selected, still-unimplemented Neon synthetic staging lane is
documented in `docs/NEON_SYNTHETIC_BACKUP_EXIT_RUNBOOK.md`. It does not weaken
the loopback-only guard in this per-merge CI proof.
