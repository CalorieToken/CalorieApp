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

Still required:

1. Recheck the official terms again if the evidence date has expired or the
   account screen differs from the recorded snapshot.
2. Review the available EU data region, data-processing terms, subprocessors and
   operator responsibilities.
3. Confirm that no payment method or automatic paid upgrade is required.
4. Approve an encrypted off-provider backup destination and retention schedule.
5. Confirm a distinct PostgreSQL exit target for the portability drill.

Only then may a provider account or project be configured. The first live tests
remain synthetic: migration/readiness, restart, actual provider redeploy,
encrypted restore, provider-exit restore and capacity/onboarding-pause. A fresh
human review is still required before any real user or production data.
