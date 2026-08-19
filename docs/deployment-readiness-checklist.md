# CalorieApp Deployment Readiness Checklist (V1)

This checklist is tailored to the current CalorieApp MVP architecture:
- Frontend: Next.js 14 on Vercel
- Backend: FastAPI on Railway
- External API: Open Food Facts only
- Scope constraints: non-financial, non-custodial food tracking

## 1. Scope and Governance Gates

- [ ] Verify no blockchain, wallet, token, payment, or financial logic exists in frontend or backend.
- [ ] Verify backend integrations are limited to Open Food Facts.
- [ ] Verify architecture boundaries remain intact: UI state in frontend, data/API logic in backend.

## 2. Backend Readiness (Railway)

- [ ] Health endpoint is stable: `GET /health` returns 200.
- [ ] Search endpoint is stable against transient upstream failures: `GET /search-food?q=banana` returns data or controlled 502.
- [ ] Log endpoints are stable: `POST /log-food` and `GET /logs` work consistently.
- [ ] Backend startup is deterministic using `backend/start-backend.ps1` locally.
- [ ] SQLModel migrations are not required for current schema baseline.
- [ ] Runtime Python version is pinned and matches local tested version.
- [ ] `backend/requirements.txt` is complete and reproducible.
- [ ] CORS origin list includes deployed frontend domain and localhost for dev.

## 3. Frontend Readiness (Vercel)

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Frontend reads backend URL from `NEXT_PUBLIC_BACKEND_URL`.
- [ ] Vercel environment variable `NEXT_PUBLIC_BACKEND_URL` points to Railway backend URL.
- [ ] UI handles backend failures and empty states without crashing.

## 4. Data and Storage Risks

- [ ] Confirm SQLite persistence requirement for MVP is acceptable for target traffic and uptime.
- [ ] Confirm backup plan for SQLite data file (scheduled copy/export).
- [ ] Confirm Railway filesystem behavior is understood (ephemeral vs persistent volume selection).
- [ ] If durable shared persistence is required, plan migration path to managed Postgres for post-MVP phase.

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
- Frontend lint
- Frontend production build
- Developer health check (including restart/persistence/UTF-8 validation)

## 8. Domain and Routing Validation

- [ ] Vercel frontend domain resolves and serves app.
- [ ] Frontend-to-backend requests hit Railway over HTTPS.
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
- [ ] Data durability expectation exceeds SQLite hosting guarantees.
