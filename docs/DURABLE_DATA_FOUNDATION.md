# Durable Data & Privacy Foundation (DS-1)

Status: pre-release architecture contract. Public onboarding remains blocked.

## Outcome

CalorieApp must retain authenticated food history independently of a web
service's ephemeral filesystem or free-tier expiry. Private application data
uses a provider-neutral PostgreSQL primary store. SQLite remains a local and
test convenience only.

The existing Identity Bridge remains the ownership boundary: every private food
record belongs to the immutable internal CalorieApp user identifier. Identity
expansion, voluntary profile fields and donation-related personal details wait
until the durable-data and privacy gates pass.

## Decisions already fixed

- PostgreSQL is the primary live data architecture.
- `DATABASE_URL` remains the provider-neutral connection boundary.
- A production deployment must fail closed when configured with SQLite.
- Formal, versioned schema migrations replace startup-time ad-hoc alteration.
- A backup is not accepted until a staging restore drill succeeds.
- Production rollback uses a verified database restore or a separately tested
  corrective migration, never an untested destructive automatic downgrade.
- Food history must support authenticated export and erasure.
- Infrastructure expiry must never silently define the user's retention period.
- Food search text is currently forwarded to the Open Food Facts adapter without
  a CalorieApp identity and is not retained as CalorieApp history unless the user
  explicitly logs a result.
- Open Food Facts is one adapter, not the canonical or exclusive food-data model.
  Future sources retain separate assertions, provenance, licence and verification
  state; conflicts may not be resolved by silently overwriting a source.
- A food-history entry is a private point-in-time snapshot. Later source changes
  do not rewrite it, and private history never becomes public catalog data without
  a separate explicit contribution flow.
- Personal data is not written to public blockchain or public IPFS storage.
- Optional encrypted user-controlled exports and non-reversible integrity
  commitments remain separate research and are not launch dependencies.
- A future voluntary XRPL reference starts with a strict one-to-one pair between
  `(network, validated transaction hash)` and a unique CalorieDB anchor hash,
  while every lower user/record/event association remains off-chain.
- XRPL memos may contain only a one-time opaque challenge; comparable private
  CalorieDB records use keyed fingerprints or salted commitments, never a plain
  public hash of personal data.
- The core Calorie ecosystem remains free to users. App/database hosting and
  core database/Web3 capabilities may not require an additional subscription.
- Separately reviewed value-added services may later be paid, but identity,
  personal history access, export, correction and erasure may not be paywalled.
- Free capacity must never be protected by silently deleting existing history.
  New onboarding pauses before a quota or provider change threatens durability.
- Pieter Hendrikse and CalorieToken retain management, release and brand control
  over the official CalorieApp while a parallel open ecosystem can build on
  documented contracts and extension interfaces.
- Emergency continuity keeps the technical foundation preservable if the
  current operator becomes unavailable; it is not an automatic transfer of
  active control or official branding.
- Future ecosystem developers may receive reviewed, revocable and scoped client
  access, never direct Identity Bridge or session-store access. Ecosystem specs
  expressly designated for use stay free to access under their stated rights;
  optional managed developer services may be paid without buying broader
  personal-data access.
- The official website, web applications, Identity Bridge service, databases,
  domains, releases, brands and historical visual identity remain in the
  operator-controlled product layer. The ecosystem is a separate
  interoperability layer; technology crosses that boundary only under an
  explicit component licence or written permission.

## Current assessment

| Area | Current state | DS-1 conclusion |
|---|---|---|
| Identity ownership | Internal user id is bound to food logs | Preserve and test on PostgreSQL |
| Cross-user access | Automated SQLite tests cover reads and deletion | Repeat against PostgreSQL staging |
| PostgreSQL support | Ephemeral PostgreSQL 16 CI gate configured | Require successful migration, identity isolation and restart checks for every merge candidate |
| Schema changes | Versioned forward-only baseline with model-drift tests | Verified locally; prove on PostgreSQL staging next |
| Production SQLite guard | SQLite rejected outside local/test | Verified locally |
| Zero-additional-cost operation | Time-bounded shortlist recorded; no provider selected | Human-approve a synthetic Neon staging experiment, then prove alerts, backup and exit |
| Operator succession | Open technical contracts exist; handover is incomplete | Test restore, import and confidential role transfer |
| Durable-host tests | Engine restart plus separate backend-process replacement are tested on ephemeral PostgreSQL | Still prove chosen-provider restart and real redeploy persistence |
| Backup and restore | Synthetic logical restore is automated in CI | Select encrypted storage and complete a staging drill |
| User export | Authenticated versioned backend export exists | Add the eleven-language UI and aligned notice |
| User erasure | Human-gated backend erasure exists and defaults off | Approve recovery, backup-erasure, UI and notice policy before activation |
| Retention | No infrastructure expiry desired; exact policy unresolved | Explicit decision and notice required |

## DS-2 implementation order

1. Run the complete migration, identity and ownership suite against PostgreSQL.
2. Human-review the zero-additional-subscription shortlist and approve one synthetic staging experiment.
3. Prove the no-additional-cost exit path with a synthetic database copy.
4. Repeat the synthetic restart and process-replacement persistence proofs on the chosen provider.
5. Implement authenticated data export and versioned import.
6. Complete account erasure, including identity links and active sessions.
7. Select an encrypted backup method and perform a documented staging restore.
8. Test the confidential operator-succession runbook without exposing secrets.
9. Approve retention, backup deletion and privacy-notice wording.
10. Only after the core gates pass, implement the disabled XRPL reference tables
    and verification flow described in `XRPL_TRANSACTION_LINKING.md`.

The initial CalorieApp UI and first-user workflow do not depend on those tables.
They begin empty and disabled, then scale only when real CalorieToken settlement
or supply-chain adoption justifies a reviewed pilot.

## Automation boundary

Automation is a foundation step before formal migrations, not a later add-on.
The release pipeline must cover contract and schema drift, tests, build,
readiness, owner isolation, restart and redeploy persistence, export
completeness, erasure scope and localization completeness. Backups should run
automatically, while scheduled restore drills use staging and synthetic data.

Every job must be idempotent or retry-safe, observable and auditable without
logging secrets or unnecessary personal data. A production operation may run
through an automated pipeline only after its explicit approval gate passes.
Human approval remains required for production schema changes, retention or
erasure policy changes, new Identity Bridge purposes, XRPL enablement,
production deployment and public publication. Financial execution or routing
must never be started automatically by this architecture.

Full autonomy is permanently outside the design. People retain responsibility
for values and direction, automation/DAO scope, high-impact releases and data
changes, privacy/licence/legal accountability, incident command, emergency
pause and recovery, and appeals or false positives. Automation provides bounded
tests, evidence, advice and pre-approved execution; it cannot make itself more
powerful or rewrite its own approval rules. A future DAO does not remove this
human-managed safety and accountability layer.

This boundary deliberately prepares the continuation: DS-2 supplies the formal
migrations and production database guard; later Identity Bridge and eleven-
language work reuse the same contract checks, feature flags, audit pattern and
approval gate. Showcase preview, review and scheduled publication stay last.

Provider credentials, live connection strings, real user records and private
operational recovery details must not be committed.

## Ephemeral PostgreSQL proof

The existing GitHub Actions role now starts a temporary PostgreSQL 16 service
containing synthetic data only. It verifies the real PostgreSQL dialect, the
approved staging migration command, legacy-row preservation, Identity Bridge
user/session records, cross-user food-history isolation, persistence across
replacement application database engines and persistence after one complete
backend process is stopped and a fresh process starts. A hard guard permits
destructive test reset only for the loopback database named
`calorieapp_ci_test`.

This is a compatibility and application-restart proof, not a hosting decision.
It does not prove that a free provider will remain free, survive a real provider
redeployment, provide adequate capacity, restore encrypted backups or support
the no-additional-cost exit path. Those release gates remain blocked. See
`docs/POSTGRESQL_CI_PROOF.md` and
`docs/POSTGRESQL_REDEPLOY_PERSISTENCE.md`.

## Platform budget

Use one provider per necessary infrastructure role: the existing WordPress
environment for the site and Identity Bridge, GitHub for source/CI, one app
runtime and one provider-neutral PostgreSQL service. Food-data sources are not
infrastructure providers: Open Food Facts is the current adapter and additional
reviewed sources can be connected through the same source-independent contract.
XRPL remains an optional future reference layer already native to the project.

Do not add a second identity service, primary database, graph database,
blockchain database or IPFS/Filecoin dependency to the core release. PostgreSQL
can store the future provenance graph. A new provider requires a short
architecture record explaining why an existing role cannot safely provide the
capability. Independent backup storage is the only expected exception, and only
when a documented recovery design requires it.

## Free core and sustainable optional services

The user-facing core remains free. The app runtime, primary database and core
database/Web3 feature set must not add a recurring subscription beyond the
already accepted WordPress and development-tool costs. The implementation uses
standard PostgreSQL, open application code and provider-neutral exports. It may
not depend on a paid graph, blockchain-database, identity or Web3 add-on.

Value-added work with independent value—such as a business bulk API, custom
integration, advanced business analysis or professional support—may be priced
later after a separate product, privacy and legal review. Such services cannot
paywall identity, basic food logging, personal history access or a user's rights
to export, correct and erase their data.

No external provider can credibly promise an unchanged free tier forever.
Therefore the release gate is operational rather than promotional: monitor
capacity, prohibit automatic paid upgrades, keep a tested export/import and
restore path, and pause new onboarding before a quota can endanger existing
records. Existing history may never be deleted merely to remain under a limit.
The time-bounded official-source shortlist and its human/live gates are recorded
in `contracts/data-safety/v1/provider-evaluation.json` and
`docs/ZERO_COST_PROVIDER_EVALUATION.md`.

BigchainDB is not selected. Its server combines MongoDB and Tendermint and a
meaningfully decentralized deployment requires multiple independently operated
nodes. That adds duplicated infrastructure beside XRPL and makes private-data
erasure harder without removing the underlying hosting cost.

## Source-independent food catalog

The future catalog is normalized around internal food products and separate
source assertions, not around an Open Food Facts response shape. A versioned,
idempotent adapter records each provider's external record identifier, source
version or digest, retrieval time, licence, attribution and verification state.
Conflicting claims coexist and a deterministic display policy selects a value
without destroying provenance.

The catalog, contribution flow and private history remain separate. Identity
Bridge may later attest a consenting contributor's role through a pseudonymous
reference, but its private identity fields do not enter the catalog. Future XRPL
references attach to reviewed provenance events, never automatically to personal
food logs. DS-3 fixes this contract first; the source-independent tables require
a later V2 forward migration after the PostgreSQL compatibility proof. Enabling
a second source is not itself required to complete V2. See
`docs/FOOD_DATA_SOURCE_ARCHITECTURE.md`.
