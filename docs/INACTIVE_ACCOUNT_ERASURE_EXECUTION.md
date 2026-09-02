# Inactive-account erasure execution boundary

Status: internal non-production staging prepared; production execution,
scheduling, provider integration, migration and deployment remain blocked.

`backend/app/inactive_account_erasure_execution.py` prepares one deliberately
narrow mutation boundary after the transaction-locked eligibility guard and
bounded dependent-data preflight have both succeeded. It can stage deletion of
the exact preflighted primary-store rows only when a caller explicitly supplies
`execute=True`, an allowed non-production environment and a bounded reviewed
approval reference.

The approval reference is returned only as a SHA-256 digest. Result evidence is
aggregate-only and contains no account, notice, food, contact, external-subject,
wallet, receipt, session-secret or network identifier.

## Transaction and fail-closed behavior

- the caller owns the outer transaction and must explicitly commit or roll back;
- the helper never commits or rolls back the caller's outer transaction;
- SQLite starts a real outer database transaction before the inner savepoint,
  avoiding legacy sqlite3 savepoint-release commit behavior;
- one inner savepoint protects the mutation sequence;
- exact affected-row counts must still match the locked preflight;
- a changed count or database failure rolls the inner mutation sequence back;
- inbound authentication-session replacement references are cleared before
  the selected account's sessions are deleted; and
- a missing or no-longer-eligible notice is an idempotent no-op.

The prepared deletion shape covers only `calorieappuser`, `food_log`,
`account_data_import_receipt`, `externalidentity`, `originloginhandoff`,
`authsession` and `inactive_account_notice`. The preflight continues to reject
shared external subjects, unowned legacy authorization history and excessive
row counts.

## Deliberately absent

This helper has no endpoint, CLI, batch selector, contact channel, provider,
queue, scheduler or production mode. It does not select candidates, send a
warning, approve an erasure, commit a transaction, alter backups or activate a
deployment. The production retention gate remains blocked until the complete
warning, provider, audit, backup-replay, translated-disclosure and deployment
proof is reviewed together.
