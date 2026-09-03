# Zero-additional-cost provider evaluation

Status: one Neon Free project was created on 2026-09-02 in Frankfurt for an
isolated synthetic staging experiment only. Provider use, every live drill and
any public-release decision remain blocked. Revalidate official terms by
2026-12-01.

## Outcome

The operator approved one Neon Free project for isolated synthetic staging. The
project now exists as `calorieapp-synthetic-staging` with PostgreSQL 16 in
`aws-eu-central-1`. No application connected to it and no SQL, migration,
deployment, payment method or application data was added. This is not a
production-provider selection or permission to use real user data.

Render Free PostgreSQL is rejected as the durable primary history store. Its
official documentation says that Free databases expire after 30 days, become
inaccessible unless upgraded and are deleted after a further 14-day grace
period. Free databases also have no managed backups. Those terms directly
conflict with CalorieApp's rule that provider expiry may not define user-history
retention.

## Official-source snapshot

| Candidate | Snapshot | Evaluation |
|---|---|---|
| Neon Free | $0; 0.5 GB storage per project; finite compute and egress; scale-to-zero; six-hour restore window | One Frankfurt synthetic project exists; the zero-cost boundary, region, executed DPA and subprocessor notification subscription are confirmed, while automated quota enforcement and independent backup remain unproven |
| Supabase Free | $0; 500 MB database; 5 GB egress; low-activity projects can pause after seven days; no automatic Free-plan backups | Conditional alternative; a paused project can be resumed within the documented one-year window, but pause behavior adds operational risk |
| Render Free PostgreSQL | $0; 1 GB; fixed 30-day expiry; 14-day paid-upgrade grace; deletion after grace; no backups | Rejected for durable personal history |
| Existing Render Free web service | 750 workspace hours monthly; spins down after 15 idle minutes; ephemeral filesystem | Conditional runtime only; all durable history must live in external PostgreSQL |

Primary sources:

- [Neon plans and pricing](https://neon.com/pricing)
- [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero)
- [Neon regions](https://neon.com/docs/introduction/regions)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- [Render Free limitations](https://render.com/docs/free)

Third-party free tiers can change. The figures above are evidence for a
time-bounded decision, never a promise that a provider remains free forever.

## Capacity and no-surprise-cost gate

The selected provider must expose enough usage evidence to trigger alerts at
70, 85 and 95 percent of every relevant quota. New onboarding pauses at or
before the final threshold. Existing users retain read, export and erasure
access; existing history is neither deleted nor shortened to remain free.

No automatic paid upgrade is allowed. At account setup the operator must verify
quota-exhaustion behavior and whether adding a payment method can enable
overages. If a provider requires automatic billing or cannot prevent it, the
experiment stops.

Provider dashboards alone do not complete the monitoring gate. CalorieApp still
has a provider-neutral, machine-readable database-size signal, tested onboarding
guard and low-cardinality alert-adapter interface. It still needs an approved
external alert destination, a chosen-provider live pause exercise and any
additional compute or egress signal required by that plan.
Exact byte and compute thresholds are set only after the chosen plan's live
account limits match the current official terms.

## Recorded decision and remaining gate before provider use

Completed on 2026-09-01:

- current official plan evidence was rechecked;
- Neon Free was selected for preparation of synthetic staging only.

Completed on 2026-09-02 under explicit operator approval:

- the Free account and one project were created;
- the project region was confirmed as `aws-eu-central-1` before creation;
- PostgreSQL 16 and Neon Auth disabled were confirmed before creation;
- the live billing page showed Free at $0/month, no payment method and no
  enabled invoice-payment action;
- the console showed exactly one project and zero reported usage; and
- personal, organization and project-scoped API-key lists were empty.

The complete live snapshot and its limits are recorded in
`docs/NEON_SYNTHETIC_STAGING_LIVE_EVIDENCE.md`. No provider secret, database
credential, API-key value, Neon account ID or Neon project ID is recorded
there. It does record non-secret operational labels such as the project name
and region ID.

An official-source preconfiguration review was recorded on 2026-09-01. Neon
documents an EU project region (`aws-eu-central-1`), with the region fixed when
the project is created. Its published DPA describes Neon as processor and the
customer as controller for European data, allows global processing subject to
the stated transfer mechanisms, and leaves lawful use, secure operation and
export before account deletion with the customer.

Completed on 2026-09-03:

- the official Ironclad flow produced a Databricks DPA for electronic signing;
- the customer signature and DocuSign completion certificate were confirmed;
- the signed agreement and completion certificate were archived privately;
- subscription to provider subprocessor-change notifications was confirmed;
  and
- no signature, contact address, envelope identifier or private evidence was
  added to the public repository.

This completes only the contractual data-processing and notification control.
It does not approve real personal data, production use, a provider credential,
database access, migration or deployment.

The Free plan is listed at $0/month with finite allowances. The live console
confirmed the plan, cost boundary, absence of a payment method and aggregate
compute, storage, history and network-transfer counters. Paid plans require a
separate plan-selection action. Neon documents configurable hard quotas that
suspend project compute until the next billing period, with metrics updated
every 15 minutes and potentially delayed by one hour.

That does not complete the alert gate. Hard-quota configuration requires an API
key, and neither current consumption API is documented for Free: the usage-based
API starts at Launch and the legacy API starts at Scale. The existing read-only
`pg_database_size(current_database())` signal covers database size, not compute
or network-transfer allowances, so it cannot complete the provider measurement
gate by itself. Console-only checks also do not count as an automated alert
path. No persistent key was created or approved. A project-scoped key is the
least-privilege available option, but remains valid until revoked, grants Editor
access and exposes its secret only once. Free-plan quota-configuration API
availability, credential custody, exact counters and the 70/85/95-percent
delivery path therefore remain blocked pending separate evidence and approval.

Neon also documents portable `pg_dump` export and PostgreSQL restore. CalorieApp
will encrypt a dump on the client side before it leaves the controlled runner;
no dump, plaintext data, database credential or encryption key may enter Git.
On 2026-09-01, the operator selected a GitHub-only synthetic lane: a client-side
encrypted Actions artifact retained for at most 30 days, with restoration into
a disposable PostgreSQL 16 service on a GitHub-hosted runner outside Neon. This
uses the existing repository automation and creates no second database account.
The selection applies only to isolated synthetic staging. It does not select a
production backup destination or a durable alternate production provider.

No artifact or key was created by this selection. On 2026-09-01, the operator
approved `age` encryption with a passphrase-encrypted private identity held in
separate offline primary and recovery copies. Only the public recipient may be
recorded in repository configuration. For an approved synthetic restore, the
decrypted identity may exist only as a temporary, required-reviewer-gated
environment secret and must be deleted after every run. It may not be a
permanent GitHub secret or workflow input. Plaintext upload is forbidden and no
credential, private key or dump may enter Git. The exact procedure is recorded
in `docs/NEON_SYNTHETIC_BACKUP_EXIT_RUNBOOK.md`.

Still required before using the project:

1. Recheck the official terms again if the evidence date has expired or the
   account screen differs from the recorded snapshot.
2. Approve a least-privilege provider measurement path, configure exact hard
   limits and prove the alert and suspension behavior without exposing a key.
3. Generate the offline `age` identity, verify both encrypted offline copies,
   store the passphrase separately and configure only the public recipient.

`python -m app.synthetic_provider_use_preflight` evaluates those three control
groups from the versioned contract without contacting Neon. It exits `40` and
prints only low-cardinality blocker codes while any group is incomplete. Stale,
missing or broadened safety policy exits `50`. Exit `0` means only that the
documented controls are ready; every migration, restart, redeploy, backup or
restore still needs its own explicit approval.

Only then may the project be used. The first live tests remain separately
approved and synthetic: migration/readiness, restart, actual provider redeploy,
encrypted restore, provider-exit restore and capacity/onboarding-pause. Real
user or production data remains blocked.

Additional primary sources reviewed for this preconfiguration boundary:

- [Neon Data Processing Agreement](https://neon.com/pdf/DPA.pdf)
- [Databricks Data Processing Addendum](https://www.databricks.com/legal/databricks-data-processing-addendum)
- [Neon consumption limits](https://neon.com/docs/guides/consumption-limits)
- [Neon consumption metrics](https://neon.com/docs/guides/consumption-metrics)
- [Neon legacy consumption metrics](https://neon.com/docs/guides/consumption-metrics-legacy)
- [Neon API keys](https://neon.com/docs/manage/api-keys)
- [Neon `pg_dump` backups](https://neon.com/docs/manage/backup-pg-dump)
- [Neon subprocessor updates](https://neon.com/subscribe-to-subprocessors)
- [GitHub environments and required reviewers](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub Actions secrets](https://docs.github.com/en/actions/concepts/security/secrets)
- [`age` project and usage](https://github.com/FiloSottile/age)
