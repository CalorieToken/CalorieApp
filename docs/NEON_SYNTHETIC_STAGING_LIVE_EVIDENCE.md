# Neon synthetic staging live evidence

Evidence date: 2026-09-02
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

## Capacity finding

The Free console exposes aggregate compute, storage, history and network
transfer usage. This is useful operator evidence but does not satisfy the
automated 70/85/95-percent alert gate by itself.

Neon's current documentation describes customer-set project quotas that suspend
compute after a configured threshold. Configuration requires the Neon API. The
current usage-based consumption API documentation lists Launch, Scale, Agent
and Enterprise availability, not Free. A project details API path may still be
usable for selected project counters, but that has not been tested on this Free
account.

The least-privilege available credential is a project-scoped API key. It still
has persistent Editor access to the project, remains valid until revoked and is
shown only once when created. No key was created during this review. Creating,
storing and using one requires a separate approved secret-custody design and
action-time confirmation.

## Remaining blocks

The project must remain unused until all of the following are complete:

1. confirm DPA execution or account acceptance and subprocessor-change handling;
2. approve a least-privilege provider measurement path without exposing a key;
3. configure exact provider limits and prove fail-closed suspension behavior;
4. generate and verify both encrypted offline `age` identity copies, while
   recording only the public recipient in Git; and
5. approve and run the synthetic migration, restart, redeploy, encrypted backup,
   restore and provider-exit drills separately.

Real user data, production use, automatic paid upgrades and payment methods
remain prohibited.

The repository's offline `synthetic_provider_use_preflight` now makes this
blocked state executable in CI. It reads only the versioned evidence contract,
does not connect to Neon and cannot authorize a live operation.

## Primary sources

- [Neon plans](https://neon.com/docs/introduction/plans)
- [Neon regions](https://neon.com/docs/introduction/regions)
- [Neon consumption limits](https://neon.com/docs/guides/consumption-limits)
- [Neon consumption metrics](https://neon.com/docs/guides/consumption-metrics)
- [Neon API keys](https://neon.com/docs/manage/api-keys)
- [Neon DPA](https://neon.com/pdf/DPA.pdf)
- [Neon subprocessor updates](https://neon.com/subscribe-to-subprocessors)
