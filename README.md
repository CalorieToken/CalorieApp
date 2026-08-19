# CalorieApp Monorepo

CalorieApp is a strict-scope, non-financial, non-custodial food and nutrition tracking system.

## Monorepo Architecture

- frontend: Next.js + TypeScript + Tailwind UI layer
- backend: FastAPI API/data layer
- docs: roadmap and architecture documentation
- .github: AI governance and code-generation constraints

## Governance Rules

- Frontend handles UI state and rendering only.
- Backend handles API/data behavior only.
- No blockchain, wallet, token, custodial, or financial logic in V1.
- External integration in V1 is limited to Open Food Facts.

See .github/copilot-instructions.md for hard constraints.

## Phase 1 MVP Scope

- Food search via frontend -> backend -> Open Food Facts flow
- Nutrition display (calories/macros)
- Food logging with SQLite persistence
- Persistent food log retrieval across backend restarts

## Run Frontend Independently

1. Install Node.js 20+.
2. Change directory to frontend.
3. Run npm install.
4. Run npm run dev.
5. Open http://localhost:3000.

Frontend development port is fixed: 3000.

## Run Backend Independently

1. Install Python 3.11+.
2. Change directory to backend.
3. Run python -m venv .venv.
4. Activate the virtual environment.
5. Run pip install -r requirements.txt.
6. Run python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000.
7. Open http://127.0.0.1:8000/health.

Backend development port is fixed: 8000.

## Backend Startup Helper (Windows PowerShell)

Use the helper to avoid stale backend processes on port 8000:

1. Change directory to backend.
2. Run .\start-backend.ps1

This helper will:

- Stop any process already listening on port 8000
- Start one clean backend instance on 127.0.0.1:8000

Optional hard reset:

- .\start-backend.ps1 -KillAllPython

Warning: KillAllPython terminates all python.exe processes on your machine.

## Troubleshooting Inconsistent API Responses

If responses look inconsistent (old fields, old behavior, random failures):

1. Stop backend processes and start one clean instance using backend/start-backend.ps1.
2. Verify health endpoint at http://127.0.0.1:8000/health.
3. Ensure frontend is running on http://localhost:3000 only.

## MVP Backend Endpoints

- GET /health
- GET /search-food?q=
- POST /log-food
- GET /logs

## Running Backend Tests

```powershell
cd backend
pytest
```

All tests use FastAPI TestClient and run without a live backend or network connection.
External API calls are mocked in tests that exercise the search endpoint.

## One-Command Release Gate (Windows PowerShell)

From the repo root:

```powershell
.\release-check.ps1
```

This runs backend tests, frontend lint/build, and the developer health check in a single gate.
