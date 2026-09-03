# Neon synthetic staging live evidence

Evidence date: 2026-09-03 (data-processing evidence); live account review 2026-09-02
Scope: one isolated synthetic staging project only

## Verified live state

The operator explicitly approved creating one Neon Free project in Frankfurt
for synthetic staging. The live Neon console then confirmed:

- exactly one project named `calorieapp-synthetic-staging`;
- the Free plan at USD 0 per month;
- no payment method or enabled invoice-payment action;
- paid plans require a separate explicit plan-selection action;
- AWS Europe Central 1 (Frankfurt), region id `aws-eu-central-1`;
- PostgreSQL 16;
- Neon Auth disabled;
- default compute range 0.25 to 2 CU;
- scale to zero after five minutes;
- zero reported compute, storage, history and network-transfer usage at review;
- no personal, organization or project-scoped Neon API key; and
- no second Neon project.

The review did not open or copy a database connection string, password or API
key. It did not run SQL, apply a schema migration, connect an application,
deploy a service or add real or synthetic application records.

## Data-processing evidence

On 2026-09-03, the official Ironclad and DocuSign workflow completed a
Databricks Data Processing Addendum for the customer. The completion status and
certificate were verified, and the original agreement package was archived
privately. Subscription to provider subprocessor-change notifications was also
confirmed.

This evidence record contains only these low-sensitivity completion facts. This
change does not add the signed agreement, certificate, signature, recipient
address, envelope identifier, access code or other private audit metadata to the
public repository.

Completion does not approve real personal data, production use, a database
connection, API key, migration or deployment.

## Capacity finding and synthetic-only decision

The Free console exposes aggregate compute, storage, history and network
transfer usage. Neon's current official Free-plan documentation also defines
native hard limits of 100 CU-hours per project per month, 0.5 GB storage per
project and 5 GB public network transfer per month. Compute or transfer
exhaustion suspends compute; storage exhaustion blocks growth. Free-plan
overages are not billed and limit exhaustion does not delete stored data.

For this isolated, manually dispatched synthetic experiment only, those native
limits are the cost boundary. Each approved run must inspect the console before
and after execution and run CalorieApp's read-only database-size probe with a
500,000,000-byte budget. No provider API key is needed or permitted. Because
Free consumption APIs do not provide continuous metrics, this does not satisfy
the external alert-delivery gate for public onboarding.

No provider key, private provider identifier, database connection, migration or
deployment was created or approved by this review.

## Prepared execution boundary

The offline custody ceremony completed on 2026-09-03. Both encrypted offline
copies independently recovered the same public recipient, and the protected
`neon-synthetic-restore` GitHub environment was verified as main-only with a
required reviewer and administrator bypass disabled. The repository now
contains a manual, synthetic-only workflow, but no temporary credentials have
been stored and the workflow has not run.

The only remaining block before the synthetic operation is its separate,
explicit approval. Immediately before dispatch, the Free-plan console state and
usage must be observed again and the two temporary environment secrets must be
created without exposing their values. They must be deleted after the run.

Real user data, production use, automatic paid upgrades and payment methods
remain prohibited.

The repository's offline `synthetic_provider_use_preflight` now reports that the
documented controls are ready and requests separate operation approval. It
reads only the versioned evidence contract, does not connect to Neon and cannot
authorize a live operation.

## Primary sources

- [Neon plans](https://neon.com/docs/introduction/plans)
- [Neon regions](https://neon.com/docs/introduction/regions)
- [Neon consumption limits](https://neon.com/docs/guides/consumption-limits)
- [Neon consumption metrics](https://neon.com/docs/guides/consumption-metrics)
- [Neon legacy consumption metrics](https://neon.com/docs/guides/consumption-metrics-legacy)
- [Neon API keys](https://neon.com/docs/manage/api-keys)
- [Neon DPA](https://neon.com/pdf/DPA.pdf)
- [Databricks DPA](https://www.databricks.com/legal/databricks-data-processing-addendum)
- [Neon subprocessor updates](https://neon.com/subscribe-to-subprocessors)
