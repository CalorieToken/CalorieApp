# Neon synthetic backup and provider-exit runbook

Status: operator-selected backup, exit and offline key-custody design; no key,
secret, workflow or provider account is configured or executed.

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

The environment must be created and inspected before any workflow exists. It
allows `main` only, requires a reviewer, disables administrator bypass and may
be used only by a manually dispatched restore. Pull-request workflows must
never receive the identity. This prevents GitHub's implicit creation of an
unprotected environment from becoming an accidental fallback.

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
recipient in repository configuration. Do not record the command's directory
arguments, passphrase, encrypted copies or any terminal transcript in the
repository. A blocked result invalidates the ceremony; investigate locally and
start again with empty target locations.

## Gates before implementation

The workflow must not be added or run until all of these are true:

1. The live Neon console confirms the selected EU region, Free-plan billing
   boundary, quota signals and absence of automatic paid upgrade.
2. DPA acceptance or execution and subprocessor-change handling are confirmed.
3. The offline identity is generated, both encrypted offline copies are
   recoverable, and only the derived public recipient is configured. The
   private identity must never be committed, placed in an artifact, printed in
   a log, kept as a permanent GitHub secret or sent through a workflow input.
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
7. Before a separately approved restore job, an authorized operator retrieves
   and decrypts the offline identity locally, places it only in the temporary
   `CALORIEAPP_SYNTHETIC_AGE_IDENTITY` environment secret, and confirms that the
   required reviewer and no-bypass rules gate access.
8. After approval, decrypt into temporary runner storage, restore into a clean
   PostgreSQL 16 service outside Neon and validate the schema head, record
   counts and owner bindings.
9. Remove plaintext and decrypted temporary files even when verification fails.
10. Delete the temporary identity secret after every run. The drill remains
    failed and no further run is allowed while deletion is unconfirmed.
11. Record the workflow run, artifact expiry and outcome without recording data,
    credentials, passphrases, offline locations or key material.

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
