# Backend (FastAPI)

This service is the CalorieApp V1 data layer only.

## Scope

- Food and nutrition API endpoints
- Non-financial logging of food entries
- No blockchain, wallet, token, or financial logic

## Endpoints

- GET /health
- GET /search-food?q=
- POST /log-food
- GET /logs

## Local Run

1. python -m venv .venv
2. Activate your environment
3. pip install -r requirements.txt
4. python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Canonical backend command:

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Development ports:

- Backend: 127.0.0.1:8000
- Frontend: localhost:3000

## Windows PowerShell Helper

From the backend folder, run:

.\start-backend.ps1

This prevents stale backend listeners by stopping any existing process on port 8000 before starting a fresh instance.

Optional emergency reset:

.\start-backend.ps1 -KillAllPython

Warning: this kills all python.exe processes on your machine.

## Troubleshooting

If you see inconsistent API responses:

1. Stop old backend processes.
2. Start backend using start-backend.ps1.
3. Confirm http://127.0.0.1:8000/health returns status ok.
4. Retry requests from frontend on localhost:3000.

## Notes

- Data storage uses local SQLite via SQLModel for MVP persistence.
- Open Food Facts is consumed only by backend service endpoints.
