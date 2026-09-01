# Zero-additional-cost provider evaluation

Status: Neon Free was selected on 2026-09-01 for preparation of one isolated,
synthetic staging experiment only. Account configuration, every live provider
proof and any public-release decision remain blocked. Revalidate official terms
by 2026-11-30.

## Outcome

The operator approved Neon Free as the candidate for preparing one isolated,
synthetic staging experiment connected to the existing Render Free web runtime.
This is not a production-provider selection or permission to create an account,
apply an external migration, add a payment method, deploy, or use real user
data. None of those actions occurred during this decision.

Render Free PostgreSQL is rejected as the durable primary history store. Its
official documentation says that Free databases expire after 30 days, become
inaccessible unless upgraded and are deleted after a further 14-day grace
period. Free databases also have no managed backups. Those terms directly
conflict with CalorieApp's rule that provider expiry may not define user-history
retention.

## Official-source snapshot

| Candidate | Snapshot | Evaluation |
|---|---|---|
| Neon Free | $0; 0.5 GB storage per project; finite compute and egress; scale-to-zero; six-hour restore window | Best candidate for a synthetic staging experiment; quota behavior, EU region, DPA and independent backup remain unproven |
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

## Recorded decision and remaining gate before any account action

Completed on 2026-09-01:

- current official plan evidence was rechecked;
- Neon Free was selected for preparation of synthetic staging only.

An official-source preconfiguration review was recorded on 2026-09-01. Neon
documents an EU project region (`aws-eu-central-1`), with the region fixed when
the project is created. Its published DPA describes Neon as processor and the
customer as controller for European data, allows global processing subject to
the stated transfer mechanisms, and leaves lawful use, secure operation and
export before account deletion with the customer. This records facts, not legal
approval or confirmation that the DPA has been executed for a Free account.

The Free plan is listed at $0/month with finite allowances. Neon documents
machine-readable consumption metrics and configurable hard quotas: a configured
quota suspends project compute until the next billing period. Metrics are
updated every 15 minutes and may take up to one hour to become reportable, so
CalorieApp's earlier 70/85/95-percent guard must retain enough headroom for that
delay. Live-console proof is still required that the Free account has no payment
method, cannot automatically upgrade or incur paid usage, and exposes the
needed metrics and hard-limit controls.

Neon also documents portable `pg_dump` export and PostgreSQL restore. CalorieApp
will encrypt a dump on the client side before it leaves the controlled runner;
no dump, plaintext data, database credential or encryption key may enter Git.
On 2026-09-01, the operator selected a GitHub-only synthetic lane: a client-side
encrypted Actions artifact retained for at most 30 days, with restoration into
a disposable PostgreSQL 16 service on a GitHub-hosted runner outside Neon. This
uses the existing repository automation and creates no second database account.
The selection applies only to isolated synthetic staging. It does not select a
production backup destination or a durable alternate production provider.

No artifact or key was created by this selection. Before the first provider
experiment, the encryption recipient and private-key custody must be approved.
Plaintext upload is forbidden and no credential, private key or dump may enter
Git. The exact procedure is recorded in
`docs/NEON_SYNTHETIC_BACKUP_EXIT_RUNBOOK.md`.

Still required:

1. Recheck the official terms again if the evidence date has expired or the
   account screen differs from the recorded snapshot.
2. Confirm `aws-eu-central-1` in the live account before project creation;
   confirm DPA execution or account acceptance and subscribe to subprocessor
   changes.
3. Confirm in the live account that no payment method is present, no automatic
   paid upgrade is possible, and the documented quota metrics and hard limits
   are available on Free.
4. Configure the client-side encryption recipient and approve private-key
   custody without committing any key material.

Only then may a provider account or project be configured. The first live tests
remain synthetic: migration/readiness, restart, actual provider redeploy,
encrypted restore, provider-exit restore and capacity/onboarding-pause. A fresh
human review is still required before any real user or production data.

Additional primary sources reviewed for this preconfiguration boundary:

- [Neon Data Processing Agreement](https://neon.com/pdf/DPA.pdf)
- [Neon consumption limits](https://neon.com/docs/guides/consumption-limits)
- [Neon consumption metrics](https://neon.com/docs/guides/consumption-metrics)
- [Neon `pg_dump` backups](https://neon.com/docs/manage/backup-pg-dump)
- [Neon subprocessor updates](https://neon.com/subscribe-to-subprocessors)
