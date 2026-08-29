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
- Data: SQLite
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
3. SQLite persists current application data.
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
forwards only the supported CalorieApp endpoints to the configured backend and
keeps mobile authentication sessions first-party.

Xaman sign-in opens in a separate tab while the original CalorieApp tab waits
for a short-lived, one-time browser handoff. Every CalorieApp-owned Xaman login
surface must clearly warn phone users before and during sign-in that the return
page normally opens in their configured default browser, possibly in a new tab,
and that they should keep the original CalorieApp tab open. The callback browser
receives its normal session and the original tab securely claims a separate
session for the same user. Only hashes of the handoff proof are stored, the
proof is never sent through WordPress/Xaman URLs, and it cannot be claimed by a
third browser after use.

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

- Public architecture: docs/public/architecture.md
- Public roadmap: docs/public/roadmap.md
- Public deployment guide: docs/public/deployment.md
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
