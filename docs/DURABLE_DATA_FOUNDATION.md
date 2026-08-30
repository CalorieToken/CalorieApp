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
- Formal, reversible schema migrations replace startup-time ad-hoc alteration.
- A backup is not accepted until a staging restore drill succeeds.
- Food history must support authenticated export and erasure.
- Infrastructure expiry must never silently define the user's retention period.
- Food search text is forwarded to Open Food Facts without a CalorieApp identity
  and is not retained as CalorieApp history unless the user explicitly logs a result.
- Personal data is not written to public blockchain or public IPFS storage.
- Optional encrypted user-controlled exports and non-reversible integrity
  commitments remain separate research and are not launch dependencies.

## Current assessment

| Area | Current state | DS-1 conclusion |
|---|---|---|
| Identity ownership | Internal user id is bound to food logs | Preserve and test on PostgreSQL |
| Cross-user access | Automated SQLite tests cover reads and deletion | Repeat against PostgreSQL staging |
| PostgreSQL support | Driver and URL normalization exist | Partial, not production-ready |
| Schema changes | `create_all` plus ad-hoc optional-column changes | Replace with formal migrations |
| Production SQLite guard | Missing | Add a startup fail-closed check |
| Durable-host tests | Missing | Automate restart and redeploy probes |
| Back-up and restore | Missing | Select mechanism and prove restoration |
| User export | Missing | Add authenticated portable export |
| User erasure | Food-log deletion exists; complete account erasure does not | Complete scoped erasure workflow |
| Retention | No infrastructure expiry desired; exact policy unresolved | Explicit decision and notice required |

## DS-2 implementation order

1. Introduce a formal migration baseline for the exact current schema.
2. Add environment validation and reject SQLite in staging/production.
3. Add a database readiness probe that performs a safe query.
4. Run the complete identity and ownership suite against PostgreSQL.
5. Add restart and redeploy persistence tests using synthetic records.
6. Implement authenticated data export.
7. Complete account erasure, including identity links and active sessions.
8. Select an encrypted backup method and perform a documented staging restore.
9. Approve retention, backup deletion and privacy-notice wording.

## Automation boundary

The automated release gate must cover schema version, owner isolation, restart
persistence, redeploy persistence, export completeness and erasure scope. Only
the final human review of disclosures, visual presentation and explicit
publication approval should remain manual.

Provider credentials, live connection strings, real user records and private
operational recovery details must not be committed.
