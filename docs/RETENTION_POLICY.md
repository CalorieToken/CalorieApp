# CalorieApp retention policy decision

Status: policy selected on 2026-09-01; enforcement, notice delivery, provider
proof, translated disclosure and production activation remain release-blocking.

## Selected inactive-account boundary

CalorieApp uses the following privacy-first lifecycle for an account that the
user has not deleted directly:

- inactivity is measured from the last authenticated CalorieApp activity;
- the inactive-account period is 24 calendar months;
- a clear warning is required 30 days before inactive-account erasure;
- authenticated CalorieApp activity during that warning period cancels the
  pending inactive-account erasure; and
- after a completed warning period, the same reviewed account-erasure boundary
  applies: directly owned primary-store data is deleted, with no app recovery
  window and a maximum 30-day encrypted-backup boundary.

No background job, notification channel or automatic deletion is enabled by
this policy record. If a reliable approved warning cannot be delivered, the
automatic inactive-account path must remain disabled rather than silently
delete an account.

A repository implementation of the durable account-level
`last_authenticated_activity_at` anchor is now prepared. It advances
monotonically when a session is created and whenever a request is successfully
authenticated, so cleanup of short-lived session rows cannot erase the
inactivity anchor. Forward migration `20260901_0012` backfills existing
accounts from their latest retained session activity or, when no session is
available, account creation. The field is included in the private account
export. This is prepared code only: no staging or production migration,
warning delivery, scheduling or inactive-account erasure was activated. See
`docs/AUTHENTICATED_ACTIVITY_RETENTION_MARKER.md`.

An aggregate-only inactive-account preview is also prepared. It evaluates the
oldest active accounts in a bounded batch and calculates each account's notice
and retention boundaries using calendar-month arithmetic. Its dedicated read
transaction is rolled back before return and its output contains counts only.
It cannot send a warning, mark or erase an account, and production use remains
blocked. See `docs/INACTIVE_ACCOUNT_PREVIEW.md`.

## Selected authentication-transient boundary

Short operational lifetimes continue to control login state, authorization
codes, browser handoffs, replay-prevention nonces and authentication sessions.
The selected security-retention ceiling does not extend those lifetimes:

- expired authentication-transient data may be kept only for a documented
  security need;
- it must be deleted no later than 30 days after expiry; and
- a raw IP address or equivalent network signal, where lawfully collected,
  follows the same maximum and may be removed earlier.

A provider-neutral cleanup runner now covers all six authentication-transient
tables, including legacy authorization codes. It selects deterministic bounded
batches, defaults to a read-only dry-run, emits aggregate counts without record
identifiers or network signals, and rolls the entire execution back when any
table fails. It also clears inbound session-replacement references before an
expired or revoked session is deleted.

The operator CLI requires an explicit enablement flag and reviewed approval
reference for non-production deletion. Production execution remains blocked in
code. No scheduler is configured and no real data has been deleted, so this
implementation is not proof of complete scheduled enforcement. The detailed
boundary and commands are in `docs/AUTH_TRANSIENT_RETENTION_CLEANUP.md`.

## Required proof before activation

The retention release gate remains partial until all of the following exist and
are reviewed together:

1. deployment and provider proof of the prepared durable, unambiguous
   last-authenticated-activity marker;
2. a reliable warning mechanism that does not create an unnecessary new
   identity or marketing dataset;
3. an idempotent, bounded and auditable inactive-account erasure process;
4. complete scheduled cleanup for every authentication-transient table;
5. provider-specific encrypted-backup expiry and restore-erasure replay proof;
6. aligned privacy notices and consequence text across all eleven locales; and
7. an explicit production migration and deployment approval.

This repository decision is not legal certification and does not execute a
migration, delete data, contact users or enable either deletion flag.

## Decision basis

Article 5(1)(e) GDPR requires personal data to be kept no longer than necessary
for its purpose. Article 13 requires the retention period or the criteria used
to determine it to be disclosed. The CNIL describes deletion after two years of
inactivity, with advance warning, as proportionate for ordinary online
accounts. OWASP recommends defining log retention around documented purpose,
security need and applicable data-protection constraints rather than retaining
security logs indefinitely.

Primary references:

- GDPR: <https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex:32016R0679>
- CNIL inactive accounts (2025-09-18):
  <https://www.cnil.fr/fr/achat-de-contenus-numeriques-quelle-duree-de-conservation-des-comptes-inactifs>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
