# CalorieApp Deployment Readiness Checklist (V1)

This checklist is tailored to the current CalorieApp MVP architecture:
- Frontend: Next.js 14, declared by the repository-owned Render blueprint
- Backend: FastAPI, declared for Render in the repository reference configuration
- Data: SQLite by default for local development; PostgreSQL declared in the
  Render reference configuration when it is applied
- External food data API: Open Food Facts
- Scope constraints: non-financial, non-custodial food tracking

## 1. Scope and Governance Gates

- [ ] Verify no custody or administration of crypto-assets, private-key/seed
      handling, transaction signing, payment, token transfer, crypto-asset
      exchange/trading/order handling, trading-platform operation, monetary
      reward or crypto-asset transfer-service logic, portfolio
      management/advice, or offer, sale, or solicitation of crypto-assets
      exists in frontend or backend.
- [ ] Verify Open Food Facts and the project-authorized external identity bridge
      remain within their documented V1 boundaries.
- [ ] Verify architecture boundaries remain intact: UI state in frontend, data/API logic in backend.

## 2. Backend Readiness (Render reference configuration)

- [ ] Health endpoint is stable: `GET /health` returns 200.
- [ ] Search endpoint is stable against transient upstream failures: `GET /search-food?q=banana` returns data or controlled 502.
- [ ] Log endpoints are stable: `POST /log-food` and `GET /logs` work consistently.
- [ ] Backend startup is deterministic using `backend/start-backend.ps1` locally.
- [ ] Database initialization and any schema changes have been tested against both the intended local SQLite path and hosted PostgreSQL path.
- [ ] Runtime Python is 3.11 or later; the Render reference pin is 3.12.10 and
      the active runtime matches the intended tested version.
- [ ] `backend/requirements.txt` is complete and reproducible.
- [ ] CORS origin list includes deployed frontend domain and localhost for dev.

## 3. Frontend Readiness (Render reference configuration)

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Frontend reads backend URL from `NEXT_PUBLIC_BACKEND_URL`.
- [ ] Render environment variable `NEXT_PUBLIC_BACKEND_URL` points to the intended backend URL.
- [ ] UI handles backend failures and empty states without crashing.

## 4. Data and Storage Risks

- [ ] Confirm local SQLite files remain local/private and are not mistaken for hosted persistence.
- [ ] Confirm hosted `DATABASE_URL` links to the intended PostgreSQL resource.
- [ ] Confirm the PostgreSQL expiry/upgrade/migration deadline is known for the selected plan.
- [ ] Confirm backup verification and a disposable-target restore rehearsal are documented before relying on the database for durable records.

## 5. Security and Secrets

- [ ] No secrets committed in repository files.
- [ ] `.env.local` stays untracked and environment-specific.
- [ ] No credentials are logged by backend request/error paths.
- [ ] Error messages returned to clients remain generic (no stack traces, no secret leakage).

## 6. Observability and Operations

- [ ] Structured backend logs capture upstream failures (status/timeouts/fallback path).
- [ ] Monitor 502 rate for `/search-food` to detect Open Food Facts instability.
- [ ] Define simple runbook: restart backend, verify health, rerun release checks.
- [ ] Define owner and response target for incident triage.

## 7. Release Gate (Required Before Deploy)

Run from repo root:

```powershell
.\release-check.ps1
```

This gate runs:
- Backend pytest suite
- Backend Python compilation
- Frontend lint
- Frontend production build
- Git whitespace validation
- Legal and licensing boundary validation
- Tracked runtime/secret-artifact validation
- Developer health check unless explicitly skipped (including
  restart/persistence/UTF-8 validation)

## 8. Domain and Routing Validation

- [ ] Deployed frontend domain resolves and serves the intended Render frontend service.
- [ ] Frontend-to-backend requests hit the intended Render backend over HTTPS.
- [ ] CORS policy allows only intended origins.
- [ ] If using a custom domain (for example `app.calorietoken.net`), DNS records and TLS certs are valid.

## 9. Go/No-Go Criteria

Go if all are true:
- [ ] Release gate passes with no failures.
- [ ] No unresolved P0/P1 defects.
- [ ] Upstream Open Food Facts transient failures are handled gracefully.
- [ ] Rollback plan is documented (previous frontend deployment + backend restart procedure).

No-Go if any are true:
- [ ] Health-check fails.
- [ ] Backend tests fail.
- [ ] Frontend build fails.
- [ ] Database connection, backup, restore, or durability requirements are not satisfied for the selected hosted PostgreSQL plan.
