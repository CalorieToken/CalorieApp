# Neon synthetic backup and provider-exit runbook

Status: operator-selected design; not configured or executed.

## Approved scope

The operator selected this lane on 2026-09-01 for one isolated synthetic Neon
Free staging experiment only:

- create a PostgreSQL custom-format dump containing synthetic records only;
- encrypt the dump on the runner before any upload;
- retain only the encrypted archive as a GitHub Actions artifact for at most
  30 days; and
- restore it into a disposable PostgreSQL 16 service on a GitHub-hosted runner,
  outside Neon, then verify schema head, record completeness and ownership.

The existing GitHub repository and Actions account are reused. No Supabase,
second managed database or paid service is selected. The target is an ephemeral
portability proof, not a durable failover provider or production database.

## Gates before implementation

The workflow must not be added or run until all of these are true:

1. The live Neon console confirms the selected EU region, Free-plan billing
   boundary, quota signals and absence of automatic paid upgrade.
2. DPA acceptance or execution and subprocessor-change handling are confirmed.
3. A client-side encryption recipient and separate private-key custody method
   are explicitly approved. A private key must never be committed, placed in an
   artifact, printed in a log or sent through an unreviewed workflow input.
4. The workflow admits only the named synthetic staging project and rejects
   every production or real-user database identifier.
5. The encrypted artifact is bounded below the available GitHub storage quota
   and has an explicit `retention-days: 30` setting.

## Fail-closed execution order

1. Require a manual approval reference and the exact reviewed commit.
2. Verify the source is the isolated synthetic Neon project and contains no
   real identity or food-history records.
3. Run `pg_dump --format=custom --no-owner --no-privileges` into temporary
   runner storage.
4. Encrypt the archive client-side to the approved recipient.
5. Verify the encrypted output is non-empty, then securely remove the plaintext
   temporary archive before upload.
6. Upload only the encrypted archive with 30-day artifact retention.
7. In a separately approved restore job, decrypt into temporary runner storage,
   restore into a clean PostgreSQL 16 service outside Neon and validate the
   schema head, record counts and owner bindings.
8. Remove plaintext and decrypted temporary files even when verification fails.
9. Record the workflow run, artifact expiry and outcome without recording data,
   credentials or key material.

Any failed identity, encryption, retention, size or restore check stops the
workflow. It may not fall back to plaintext upload, a paid upgrade, a production
database or a same-Neon restore target.

## Still prohibited

- real user or production data;
- production deployment or migration;
- automatic paid upgrade or payment method;
- committed database credentials or encryption keys;
- treating a successful synthetic drill as production backup readiness; and
- claiming continuity until a separately approved production design and restore
  replay mechanism have passed their release gates.

Official limits used for this time-bounded selection:

- [GitHub Actions storage limits](https://docs.github.com/en/actions/reference/limits)
- [GitHub artifact retention](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization)
