# Synthetic PostgreSQL backup and restore drill

Status: automated synthetic CI proof configured. The production backup and
recovery gate remains blocked.

The protected manual Neon synthetic workflow is prepared but has not run. It
will create a custom-format dump containing only fixed synthetic records,
encrypt it client-side to the verified offline-custody recipient, upload only
the encrypted artifact for 30 days, restore into disposable PostgreSQL 16
outside Neon and independently verify schema plus ownership. This staging and
provider-exit proof remains incomplete until the workflow passes and both
temporary environment secrets are deleted.

## Proven boundary

Every merge candidate runs a provider-neutral PostgreSQL custom-format logical
backup and restores it into a separate disposable database. The drill:

1. accepts only a loopback PostgreSQL server;
2. requires the exact source database `calorieapp_ci_test` and distinct target
   `calorieapp_ci_restore`;
3. migrates the empty source to the current schema head;
4. creates two synthetic accounts with identity links, opaque sessions,
   handoffs, inactive-notice history, private import replay receipts and
   separately owned food-history rows;
5. creates a `pg_dump` custom-format archive without owners or privileges;
6. after that archive, deletes one fixed synthetic account from the source and
   builds its replay proof in process memory outside the archive;
7. verifies that source deletion while preserving the other account;
8. restores the older archive atomically with `pg_restore`, verifies that the
   erased account reappeared and reapplies the proof before final validation;
9. verifies the target account and all owned rows are gone, the incoming
   session reference is cleared, the other account remains intact and a second
   replay is an idempotent no-op; and
10. removes the temporary archive without uploading or retaining it.

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
- independently persisted replay evidence, its production key custody, expiry
  and retrieval during a provider restore;
- a staging restore/erasure drill using synthetic records; and
- an exact provider-exit, deployment and rollback runbook.

The CI drill uses a hard-coded non-secret test key and carries the pseudonymous
proof only in process memory. It now proves matching and replay against an
older loopback PostgreSQL backup, but it does not persist or retrieve evidence
independently, exercise production key custody, use an encrypted artifact or
run against a provider. It therefore remains partial evidence rather than a
restore-readiness claim. See `docs/ACCOUNT_ERASURE_REPLAY_PROOF.md`.

No live data, external provider, production deployment or provider-specific
retention configuration is created by this CI proof.

The separately selected, still-unimplemented Neon synthetic staging lane is
documented in `docs/NEON_SYNTHETIC_BACKUP_EXIT_RUNBOOK.md`. It does not weaken
the loopback-only guard in this per-merge CI proof.
