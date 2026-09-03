# Neon synthetic backup and provider-exit runbook

Status: offline key custody and the protected manual workflow are prepared. No
temporary secret, provider migration, backup upload or restore has executed.

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

## Approved key custody

The operator selected `age` public-key encryption with separate offline custody
on 2026-09-01. This selection has no subscription cost and applies only to this
synthetic experiment:

- generate the identity locally and never write an unencrypted private-key file
  to the repository workspace;
- keep the identity as a passphrase-encrypted offline primary copy plus a
  separately stored encrypted recovery copy;
- keep the identity passphrase separate from both encrypted copies;
- record only the public `age` recipient in repository configuration;
- never keep the private identity as a permanent GitHub secret; and
- for an explicitly approved restore only, place the decrypted identity in a
  temporary secret of the protected `neon-synthetic-restore` environment, then
  delete that secret after the run whether the restore succeeds or fails.

The `neon-synthetic-restore` environment was created and inspected before the
workflow was added. It allows `main` only, requires a reviewer, disables
administrator bypass and may be used only by a manually dispatched restore.
Pull-request workflows never receive the identity. This prevents GitHub's
implicit creation of an unprotected environment from becoming an accidental
fallback.

On 2026-09-03 the operator completed the local ceremony. Independent recovery
of both passphrase-encrypted offline copies produced the same canonical public
recipient:

`age1s3p3hcasyphsp5ph8emrkxx27yh4s0fpru92t5mncj09uu6ny9ts2y6w0m`

No passphrase, private identity or physical storage location is recorded here.

The public repository must not name the physical or account locations of the
offline copies. Loss of both copies or their separate passphrase makes every
artifact for that recipient unrecoverable. A recovery-copy verification is
therefore mandatory before the recipient is accepted.

The repository release gate also scans every tracked file for private `age`
identity material, literal Neon API-secret assignments, credential-bearing Neon
database URLs and provider backup artifacts. Findings expose only the path and
a stable rule name. This is a final leak-prevention boundary, not permission to
generate or handle the offline identity inside a repository workspace.

### Local custody ceremony helper

`tools/offline_age_custody.py` prepares the approved copies on the operator's
local offline system. It refuses locations inside the repository, nested or
identical locations, existing output files, missing `age` tools, and either
missing custody confirmation. It pipes the private identity directly from
`age-keygen` into passphrase encryption, copies only the encrypted artifact,
and independently decrypts both copies through a pipe to derive the same public
recipient. No plaintext identity file is created.

Before running it, mount two separately stored offline media, install `age`,
and choose how the passphrase will be held apart from both copies. Do not use a
repository checkout, synced folder, shell transcript, CI runner or remote
support session for the ceremony. From a local checkout, run:

```text
python tools/offline_age_custody.py --primary-directory <PRIMARY_OFFLINE_DIRECTORY> --recovery-directory <RECOVERY_OFFLINE_DIRECTORY> --confirm-separate-offline-storage --confirm-passphrase-separated
```

The command prompts locally for the passphrase during creation and once for
each recovery check. A successful result contains only a stable status, the
`copies_match` boolean and the public `age` recipient. Record only that public
recipient in repository configuration. The reviewed helper accepts only the
canonical 62-character classic X25519 recipient form; another key type or
recipient format requires a separate review. Do not record the command's
directory arguments, passphrase, encrypted copies or any terminal transcript
in the repository. A blocked result invalidates the ceremony; investigate
locally and start again with empty target locations.

## Gates before execution

The workflow may run only while all of these remain true:

1. The live Neon console confirms the selected EU region, Free-plan billing
   boundary, quota signals and absence of automatic paid upgrade.
2. DPA acceptance or execution and subprocessor-change handling are confirmed.
3. The offline identity is generated, both encrypted offline copies are
   recoverable, and only the derived public recipient is committed. The
   private identity must never be committed, placed in an artifact, printed in
   a log, kept as a permanent GitHub secret or sent through a workflow input.
4. The workflow admits only the named synthetic staging project and rejects
   every production or real-user database identifier.
5. The encrypted artifact is bounded below the available GitHub storage quota
   and has an explicit `retention-days: 30` setting.

## Fail-closed execution order

1. Require a manual approval reference, the exact reviewed `main` commit, a
   pre-run console observation and the protected-environment reviewer.
2. Verify the source is the isolated empty synthetic Neon database, then apply
   the schema and only the fixed synthetic acceptance records.
3. Write through one CalorieApp process, replace it fully, read through the
   replacement, cross the configured scale-to-zero window and reconnect.
4. Run `pg_dump --format=custom --no-owner --no-privileges` into temporary
   runner storage.
5. Encrypt the archive client-side to the approved recipient.
6. Verify the encrypted output is non-empty, then securely remove the plaintext
   temporary archive before upload.
7. Upload only the encrypted archive with 30-day artifact retention.
8. Before the approved job, an authorized operator retrieves
   and decrypts the offline identity locally, places it only in the temporary
   `CALORIEAPP_SYNTHETIC_AGE_IDENTITY` environment secret, and confirms that the
   required reviewer and no-bypass rules gate access.
9. After approval, decrypt into temporary runner storage, restore into a clean
   PostgreSQL 16 service outside Neon and validate the schema head, record
   counts and owner bindings.
10. Remove plaintext and decrypted temporary files even when verification fails.
11. Delete both temporary environment secrets after every run. The drill
    remains failed and no further run is allowed while deletion is unconfirmed.
12. Observe the Neon console after execution and record the workflow run,
    artifact expiry and outcome without recording data, credentials,
    passphrases, offline locations or key material.

Any failed identity, encryption, retention, size or restore check stops the
workflow. It may not fall back to plaintext upload, a paid upgrade, a production
database or a same-Neon restore target.

## Still prohibited

- real user or production data;
- production deployment or migration;
- automatic paid upgrade or payment method;
- committed database credentials or encryption keys;
- a permanently stored GitHub private-key secret;
- an identity supplied as a workflow input;
- treating a successful synthetic drill as production backup readiness; and
- claiming continuity until a separately approved production design and restore
  replay mechanism have passed their release gates.

Official limits used for this time-bounded selection:

- [GitHub Actions storage limits](https://docs.github.com/en/actions/reference/limits)
- [GitHub artifact retention](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization)
- [GitHub environments and required reviewers](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub Actions secrets](https://docs.github.com/en/actions/concepts/security/secrets)
- [`age` project and usage](https://github.com/FiloSottile/age)
