# Food-data source architecture

Status: the source-neutral catalog schema, immutable source records, terminal
record and assertion moderation, and bounded internal assertion ingest are
implemented. Open
Food Facts remains the only enabled read-only search adapter; no public source
onboarding, contribution or catalog-write flow is enabled.

## Decision

CalorieApp does not model food data as an Open Food Facts copy. It uses a
source-neutral product identity and retains every provider's record and factual
assertions separately. Open Food Facts is the current adapter, not the canonical
model or exclusive authority.

This permits later reviewed sources such as public datasets, producers and
farmers, processors, suppliers, retailers, laboratories, public authorities,
community contributions and ecosystem adapters without rebuilding the core
schema for each one.

## Staged relational model

| Entity | Role |
|---|---|
| `food_source` | Operator, category, jurisdiction, trust state, licence and attribution |
| `food_source_record` | Immutable provider identity/content reference plus terminal verification status/version |
| `food_source_moderation_audit` | Minimal append-only evidence for a terminal record decision |
| `food_product` | Internal source-neutral food or product identity |
| `food_product_source_link` | Reviewable match between a provider record and internal product |
| `food_attribute_assertion` | A source-specific value, unit, observation time and verification state |
| `food_attribute_assertion_ingest_audit` | Minimal append-only receipt for bounded assertion admission |
| `food_attribute_assertion_moderation_audit` | Minimal append-only evidence for a terminal assertion decision |
| `food_log_snapshot` | Private point-in-time values selected by the user |

Migration `20260831_0006` currently implements `food_source` and
`food_source_record`. Each registered source has a positive retained-record
limit, and the internal ingest service serializes its idempotency check, count
and insert across PostgreSQL processes. Every new record starts in quarantine.
See `PER_SOURCE_INGEST_BUDGET.md`.

Migration `20260831_0007` adds a positive verification version and minimal
moderation audit. The internal service allows only version-checked,
idempotent transitions from quarantine to validated or rejected and is proven
across PostgreSQL processes. See `SOURCE_RECORD_MODERATION.md`. It does not add
product matching, assertions, corrections or any public mutation route.

Migration `20260831_0008` adds the source-neutral product, reviewable
product/source-record link and separate attribute-assertion tables. A composite
foreign key prevents assertions from bypassing their reviewed link. The
read-only evidence query keeps each assertion with its source licence and
attribution; synthetic tests retain conflicts and corrections without changing
private food-log snapshots. See `SOURCE_ASSERTION_CATALOG.md`. That slice did
not yet enable assertion writes, moderation or public catalog routes.

Migration `20260831_0009` adds a reviewed positive assertion budget per source
and a minimal assertion-ingest audit. The internal service requires an enabled
source, active product, validated record and validated link at the supplied
record version. It creates only quarantined version-1 assertions and is
idempotent and PostgreSQL-process-safe. See `SOURCE_ASSERTION_INGEST.md`.
Migration `20260901_0010` adds terminal source-assertion moderation. The
internal service requires a purpose-limited scope, expected version and
idempotency key, allows only quarantine to validated/rejected, and commits a
minimal audit atomically. See `SOURCE_ASSERTION_MODERATION.md`. Correction and
public mutation routes remain disabled.

An adapter emits normalized source records and assertions. Its idempotency key
is `(source_id, external_record_id, source_version_or_content_digest)`. A new
adapter therefore adds configuration and mapping logic rather than changing the
meaning of existing product or history rows.

## Conflicts and display

Sources can disagree. Both claims remain stored with their provenance. A
documented deterministic presentation policy may select or combine values for
the interface, but it must show the source and verification state and may not
erase the original assertions or label one as universal truth automatically.

## History, Identity Bridge and XRPL

A food log is a private snapshot of what the user chose and saw at that moment.
Later catalog corrections never silently rewrite history. A private log is not
a community contribution; submission requires separate consent and moderation.

Identity Bridge may later attest a contributor role using a pseudonymous public
reference, but names, email addresses, sessions and private identifiers remain
outside the catalog. A future voluntary XRPL reference can attach to a reviewed
source or supply-chain event. It cannot automatically attach to a personal log
or resolve private identity or history from a public transaction hash.

## Licence isolation

Every source registers its licence, terms reference and attribution. Ingestion,
combination, redistribution and export require a source-specific review.
Incompatible reuse conditions stay separable; the system may not flatten them
into a single unrestricted export. Open Food Facts continues to use its own
ODbL, contents and image-licence boundary documented in `DATA_LICENSING.md`.

## Implementation order

1. Complete the DS-3 ephemeral PostgreSQL compatibility proof.
2. Add source registration and immutable source records through a reviewed
   forward migration. Completed by `20260831_0006`.
3. Put any future catalog persistence behind the budgeted internal ingest
   service. Open Food Facts search remains read-only.
4. Add terminal source-record moderation with expected-version and audit
   evidence. Completed by `20260831_0007` for the internal service only.
5. Add product/link/assertion entities, then verify conflict retention,
   licence-aware evidence export and log snapshot immutability with synthetic
   data. Completed by `20260831_0008` for the schema and read-only evidence
   path; contribution and public moderation writes remain blocked.
6. Add bounded assertion admission with validated lineage, expected version,
   idempotency, audit and per-source budget. Completed by `20260831_0009` for
   the internal service only; correction, moderation and public routes remain
   blocked.
7. Add terminal assertion moderation with purpose scope, expected version,
   idempotency and minimal audit. Completed by `20260901_0010` for the internal
   service only; correction and public routes remain blocked.
8. Pilot one additional low-risk source only after privacy, licence and data
   quality review.

The source-independent schema compatibility is a V2 completion requirement;
activating a second source is not. This design adds no database platform. The catalog and provenance graph remain
in provider-neutral PostgreSQL, preserving the platform and free-core limits.
