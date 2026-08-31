# CalorieApp

CalorieApp is a non-financial, non-custodial food and nutrition tracking project.

Copyright (c) 2026 ICTHendrikse, for original portions created
by or lawfully assigned to it. All rights reserved except where an explicit
component licence applies.

The Render-hosted food and nutrition application forms the functionally proven
V2 baseline. It was deployed and manually tested during development. V2 remains
the active product version while its durable data, source-independent food-data,
complete Identity Bridge, eleven-language and historically faithful website
integration are finished. That ongoing work is not represented as a production-
readiness, privacy or regulatory certification before its gates pass.

V3 is reserved for a later, genuinely new generation such as a complete Web3
application and ecosystem. Its architecture is not yet selected. BigchainDB is
not a committed V3 dependency and would require a fresh cost, decentralization,
privacy, operations and regulatory assessment after V2.

## Project

CalorieApp currently provides a web experience for food search and nutrition logging.

Current application stack:

- Frontend: Next.js + TypeScript + Tailwind
- Backend: FastAPI + SQLModel
- Data: SQLite for local development and tests; PostgreSQL is required for live user data
- External food data: source-independent adapters; Open Food Facts is the current adapter
- Identity/authentication: server-side identity flow with session cookies

## Current Status

### IMPLEMENTED (V2 proven baseline; completion in progress)

- Food search via backend integration with Open Food Facts
- Nutrition result display in the web UI
- Authenticated food logging and retrieval
- User-scoped log deletion
- Health endpoint and API-driven frontend/backend integration
- Session-based authentication with protected food-log endpoints

### PROPOSED / FUTURE / RESEARCH (not currently implemented)

- CalorieDB architecture
- Decentralized storage concepts (including IPFS and Helia)
- XRPL transaction-hash correlation and ledger-reference integrity patterns
- CAL ecosystem integration concepts
- NFT utility and broader food provenance concepts
- Production, distribution, wholesale, and retail traceability concepts
- Biological and laboratory traceability research
- Native application directions (Android, iOS, Windows, macOS, Linux)
- Community infrastructure concepts (nodes, validator roles, governance, incentives)

### UNKNOWN / REQUIRES INDEPENDENT VERIFICATION

- Treasury and issuer-status claims in broader ecosystem discussions

## Current Architecture

The V2 functional baseline is intentionally non-financial and scope-restricted.
The active V2 completion replaces temporary data foundations without changing
that boundary.

1. Next.js frontend provides UI and user interaction flows.
2. FastAPI backend provides API behavior and business/data logic.
3. SQLite persists local development and test data. Public user onboarding is
   blocked until the PostgreSQL durable-data release gates pass.
4. Open Food Facts is the current external food-data adapter, not the canonical
   or exclusive data model. Additional reviewed sources can be added without
   replacing private food history or silently overwriting source assertions.
5. Identity/authentication is handled through backend-managed session flow.

Public architecture details: docs/public/architecture.md

## Current Scope and Boundaries

CalorieApp V2 is not:

- a custodial wallet
- a financial application
- a payments platform
- a validator runtime
- a node runtime

The implemented scope is food and nutrition tracking only.

Infrastructure follows a one-provider-per-role policy. Optional provenance is
designed for the same PostgreSQL primary store and does not add a graph database,
blockchain database or IPFS dependency to the core release.

The staged multi-source food-data contract keeps source identity, licence,
version, retrieval time and verification status with every imported assertion.
See [docs/FOOD_DATA_SOURCE_ARCHITECTURE.md](docs/FOOD_DATA_SOURCE_ARCHITECTURE.md).

Repeatable tests, schema checks, staging restore drills and future scoped ledger
verification are automation-ready. Production schema changes, privacy-purpose
expansion, XRPL enablement, deployment and publication retain explicit approval
gates.

V2 also treats overload and unwanted ecosystem mutation as release-blocking.
Requests, retries, concurrency, payloads and stored data receive explicit
budgets. External integrations are read-only by default; reviewed contributions
arrive as new source assertions and cannot silently rewrite catalog, identity or
personal-history records.

This protection does not prohibit independent ecosystem evolution. Community
implementations may create their own namespaced adapters, datasets and clients.
They cannot mutate official state or claim official status; adoption into the
official compatibility layer follows a versioned proposal and conformance review.

No wallet custody or financial transaction layer is claimed in V2. See
[REGULATORY.md](REGULATORY.md) for the MiCA and financial-services boundary.

## Long-Term Vision

CalorieApp is intended to evolve toward a broader ecosystem over time. Current research explores how future systems could connect application records, data integrity models, and broader food ecosystem traceability use cases.

Important boundary:

- V2 active completion: proven baseline plus durable data, multi-source readiness,
  complete Identity Bridge, localization and historically faithful integration
- V3 reserved future generation: complete Web3 direction, not yet designed or selected
- Future ecosystem architecture: proposed/research direction only

## Local Development

## Prerequisites

- Node.js 20+
- Python 3.11+

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend environment setup:

- Template file: frontend/.env.example
- Local runtime file: frontend/.env.local
- Preferred variable: BACKEND_URL
- Existing deployments may continue using NEXT_PUBLIC_BACKEND_URL as a fallback
- Local development value: http://localhost:8000
The browser calls the frontend's same-origin `/api/backend` proxy. The proxy
forwards only supported CalorieApp endpoints to the configured backend and
keeps CalorieApp cookies first-party to the frontend origin.

Production Xaman sign-in is owned by the WordPress page rendered through the
`[calorieapp_embed]` shortcode. WordPress creates a SignIn payload without an
`app` or `web` return URL, so Xaman cannot redirect the user into the device's
configured default browser. The original page observes the payload-specific
WebSocket and always fetches the full payload server-side before trusting the
result. After signing, the user returns with Xaman's Close or Back action. That
same WordPress page then sets the WordPress cookie and sends a short-lived
authorization code to the embedded CalorieApp, which establishes its own
session. The Render backend wakes in parallel and no longer blocks Xaman from
opening.

This design follows Xaman's warning that mobile platforms cannot guarantee a
return to the originating browser tab and its recommendation to use payload
status updates instead of frequent API polling:
[return URLs](https://docs.xaman.dev/concepts/payloads-sign-requests/payload-return-url),
[WebSocket status](https://docs.xaman.dev/concepts/payloads-sign-requests/status-updates/websocket).

A dedicated Android Xaman acceptance lane is specified in
[docs/MOBILE_XAMAN_TEST_LANE.md](docs/MOBILE_XAMAN_TEST_LANE.md). Its preflight
is read-only and accepts no wallet credentials. Emulator use remains behind a
go/no-go gate, with a dedicated physical Android device as the fallback.

Create frontend/.env.local from the template before running the frontend.

Frontend default local URL: http://localhost:3000

## Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend health endpoint: http://127.0.0.1:8000/health
Backend database readiness endpoint: http://127.0.0.1:8000/ready

Optional backend startup helper (PowerShell):

```powershell
cd backend
.\start-backend.ps1
```

## Validation

Backend tests:

```powershell
cd backend
pytest
```

Frontend checks:

```powershell
cd frontend
npm run lint
npm run build
```

Optional combined gate from repository root:

```powershell
.\release-check.ps1
```

Linux/VM combined gate:

```bash
./release-check.sh
```

Both combined gates run backend tests and compilation, frontend lint and build,
Git whitespace validation, and a tracked-artifact boundary check. The PowerShell
gate can additionally run the local developer health check.

## Documentation

- Versioned Identity Bridge contracts: contracts/identity-bridge/v1/
- XRPL-linked provenance contract: contracts/provenance/v1/
- Historical image localization contract: contracts/localization/v1/
- V2 completion boundary: docs/V2_COMPLETION_BOUNDARY.md
- V2 baseline and live evidence: docs/V2_BASELINE_EVIDENCE.md
- Abuse, capacity and mutation safety: docs/ABUSE_CAPACITY_MUTATION_SAFETY.md
- Mutation request-body limits: docs/REQUEST_BODY_LIMITS.md
- External adapter admission control: docs/ADAPTER_ADMISSION_CONTROL.md
- Shared provider rate governor: docs/SHARED_PROVIDER_RATE_GOVERNOR.md
- Shared public-route rate limiter: docs/SHARED_ROUTE_RATE_LIMITER.md
- Identity-start admission control: docs/IDENTITY_START_ADMISSION_CONTROL.md
- Adaptive Identity Bridge status polling: docs/ADAPTIVE_IDENTITY_STATUS_POLLING.md
- Per-subject private food-log storage budget: docs/PER_SUBJECT_STORAGE_BUDGET.md
- Database capacity onboarding guard: docs/DATABASE_CAPACITY_ONBOARDING_GUARD.md
- Capacity alert incident runbook: docs/CAPACITY_ALERT_INCIDENT_RUNBOOK.md
- Free ecosystem evolution guardrails: docs/ECOSYSTEM_EVOLUTION_GUARDRAILS.md
- Product-version boundary contract: contracts/release/v2/completion-boundary.json
- Food-data source architecture: docs/FOOD_DATA_SOURCE_ARCHITECTURE.md
- Public architecture: docs/public/architecture.md
- Public roadmap: docs/public/roadmap.md
- Public deployment guide: docs/public/deployment.md
- Durable data and privacy foundation: docs/DURABLE_DATA_FOUNDATION.md
- Ephemeral PostgreSQL compatibility proof: docs/POSTGRESQL_CI_PROOF.md
- BigchainDB decision record: docs/BIGCHAINDB_ASSESSMENT.md
- Ecosystem continuity foundation: docs/ECOSYSTEM_CONTINUITY.md
- Official product and separate ecosystem boundary: docs/PRODUCT_ECOSYSTEM_BOUNDARY.md
- Identity Bridge code-provenance review: docs/IDENTITY_BRIDGE_CODE_PROVENANCE.md
- Voluntary XRPL transaction-linking architecture: docs/XRPL_TRANSACTION_LINKING.md
- Public data-safety direction: docs/public/data-safety.md
- Public XRPL reference direction: docs/public/xrpl-linking.md
- Public release readiness checklist: docs/public/release-readiness.md
- Public identity overview: docs/public/identity.md

Internal development procedures and unreleased research are maintained in
private project governance rather than this public release repository.

## Rights, licensing, and trade marks

This repository is publicly viewable source code, not a grant of a general
open-source licence. See [LICENSE](LICENSE), [COPYRIGHT.md](COPYRIGHT.md),
[NOTICE](NOTICE), and [TRADEMARKS.md](TRADEMARKS.md).

The separately packaged CalorieApp Identity Bridge declares
GPL-2.0-or-later and remains governed by that component licence. Third-party
dependencies, data, names, and assets retain their own rights and terms.

CalorieToken is identified by the project owner as a registered trade mark for
specified services. A trade-mark registration is not regulatory authorisation.
No trade-mark licence is granted by this repository.
