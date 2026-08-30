# CalorieApp

CalorieApp is a non-financial, non-custodial food and nutrition tracking project.

Copyright (c) 2026 ICTHendrikse, for original portions created
by or lawfully assigned to it. All rights reserved except where an explicit
component licence applies.

The current implementation is a real V1 web application. The broader Calorie ecosystem direction is also being researched and documented, but those future capabilities are not represented as already implemented.

## Project

CalorieApp currently provides a web experience for food search and nutrition logging.

Current application stack:

- Frontend: Next.js + TypeScript + Tailwind
- Backend: FastAPI + SQLModel
- Data: SQLite for local development and tests; PostgreSQL is the required live-user direction
- External food data: Open Food Facts
- Identity/authentication: server-side identity flow with session cookies

## Current Status

### IMPLEMENTED (V1 web application)

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

CalorieApp V1 is intentionally centralized and scope-restricted.

1. Next.js frontend provides UI and user interaction flows.
2. FastAPI backend provides API behavior and business/data logic.
3. SQLite persists local development and test data. Public user onboarding is
   blocked until the PostgreSQL durable-data release gates pass.
4. Open Food Facts is used as the external food data source.
5. Identity/authentication is handled through backend-managed session flow.

Public architecture details: docs/public/architecture.md

## Current Scope and Boundaries

CalorieApp V1 is not:

- a custodial wallet
- a financial application
- a payments platform
- a validator runtime
- a node runtime

The V1 scope is food and nutrition tracking only.

Infrastructure follows a one-provider-per-role policy. Optional provenance is
designed for the same PostgreSQL primary store and does not add a graph database,
blockchain database or IPFS dependency to the core release.

Repeatable tests, schema checks, staging restore drills and future scoped ledger
verification are automation-ready. Production schema changes, privacy-purpose
expansion, XRPL enablement, deployment and publication retain explicit approval
gates.

No wallet custody or financial transaction layer is claimed in V1. See
[REGULATORY.md](REGULATORY.md) for the MiCA and financial-services boundary.

## Long-Term Vision

CalorieApp is intended to evolve toward a broader ecosystem over time. Current research explores how future systems could connect application records, data integrity models, and broader food ecosystem traceability use cases.

Important boundary:

- Current V1 implementation: active web application features only
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
- Public architecture: docs/public/architecture.md
- Public roadmap: docs/public/roadmap.md
- Public deployment guide: docs/public/deployment.md
- Durable data and privacy foundation: docs/DURABLE_DATA_FOUNDATION.md
- BigchainDB decision record: docs/BIGCHAINDB_ASSESSMENT.md
- Ecosystem continuity foundation: docs/ECOSYSTEM_CONTINUITY.md
- Official product and separate ecosystem boundary: docs/PRODUCT_ECOSYSTEM_BOUNDARY.md
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
