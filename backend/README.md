# Backend (FastAPI)

This service contains the CalorieApp V2 proven baseline and its active durable-
data and Identity Bridge completion work.

## Scope

- Food and nutrition API endpoints
- Non-financial logging of food entries
- No blockchain, wallet, token, or financial logic

## Endpoints

- GET /health
- GET /ready
- GET /search-food?q=
- POST /log-food
- GET /logs
- GET /api/identity/export
- DELETE /api/identity/account (disabled by default pending human release approval)

## Local Run

1. python -m venv .venv
2. Activate your environment
3. pip install -r requirements.txt
4. python -m app.schema_cli upgrade
5. python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

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
4. Confirm http://127.0.0.1:8000/ready reports the expected database revision.
5. Retry requests from frontend on localhost:3000.

## Schema migrations

Schema changes are forward-only, versioned and provider-neutral:

```bash
python -m app.schema_cli current
python -m app.schema_cli upgrade
python -m app.schema_cli check
```

Local and test startup may apply known migrations automatically. Staging and
production never migrate on application startup. Their approved pipeline must
run `upgrade --approval-reference <change-id>` before starting the new app
version. Downgrades are deliberately unsupported; use a tested corrective
migration or verified restore.

## Notes

- Data storage uses local SQLite via SQLModel for development and tests only.
- Public user onboarding remains blocked until the durable PostgreSQL,
  migration, persistence, export, erasure and recovery gates pass.
- The core ecosystem remains free to users. Database and Web3 schema functions
  rely on open application code and standard PostgreSQL capabilities, not paid
  add-ons. Separately reviewed value-added developer services may be offered
  later without paywalling identity or personal-data rights.
- Open Food Facts is consumed only by backend service endpoints and is the
  current adapter, not the canonical or exclusive food-data model.


### Public product search

Name searches use Open Food Facts' indexed Search-a-licious API. The request is
read-only, sends only literal product-name text and requested nutrition/display
fields, and supports the application's eleven display languages. One bounded
legacy CGI transport fallback is allowed after a transport or invalid-response
failure, never after a provider HTTP rejection (including 429/503). Barcode
lookup continues to use the exact v3 product endpoint and GTIN verification.

Successful results are cached for one hour in a 256-entry process-local cache.
Case and repeated whitespace share one name-search key. A cached answer remains
available during a provider cooldown, without another source request. Empty or
failed responses are not cached. The cache is lost on restart; it is not a local
copy of the complete OFF database. Existing shared PostgreSQL egress quotas,
queue limits, duplicate coalescing and Retry-After pauses remain in force.

Source documentation: https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/
