# CalorieApp

CalorieApp is a non-financial, non-custodial food and nutrition tracking project.

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
- Required variable: NEXT_PUBLIC_BACKEND_URL
- Local development value: http://localhost:8000

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

- Development workflow: docs/DEVELOPMENT_WORKFLOW.md
- Public architecture: docs/public/architecture.md
- Public roadmap: docs/public/roadmap.md
- Public deployment guide: docs/public/deployment.md
- Public release readiness checklist: docs/public/release-readiness.md
- Public identity overview: docs/public/identity.md

Research documents are preserved separately under docs/research and should be read as future-direction material, not current implementation claims.

- Research context: docs/research/CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- Research context: docs/research/DECENTRALIZED_ARCHITECTURE_V1.md
- Research context: docs/research/NATIVE_PLATFORM_ARCHITECTURE_V1.md
