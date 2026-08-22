# CalorieApp Staging Deployment Plan

Purpose: design a safe staging environment for the first real Xaman authentication test.

This is a planning document only.

## Scope Guardrails

- No production changes
- No deployment actions
- No DNS changes
- No plugin source changes
- No XUMM Login 1.3.0 source changes
- No secrets in git

## Current Runtime Architecture (Observed)

### Backend

- Framework: FastAPI + SQLModel
- Local start: backend/start-backend.ps1
- Test gate: release-check.ps1
- Identity bridge contract implemented in backend/app/main.py

### Frontend

- Framework: Next.js 14
- Scripts: dev, build, start, lint (frontend/package.json)
- Callback route exists at /auth/callback
- Frontend finalizes auth through backend callback API

### Database

- SQLite by default
- Pending login state persisted in table pendingloginstate
- Local DB file path in practice: backend/calorieapp.db

### Current Hosting Signals

- Documentation references Vercel frontend + Railway backend as deployment pattern.
- Documentation references production app domain app.calorietoken.net.
- Documentation references WordPress host calorietoken.net for XUMM Login flow.

### Existing Deployment Mechanism

- Manual platform deployment workflow described in docs.
- No repository-native deployment automation (no CI workflow files, no Docker files, no Render config files).

## Existing vs Verified vs Proposed Domains

### EXISTING

- app.calorietoken.net (documented production frontend)
- calorietoken.net (documented WordPress/XUMM host)

### VERIFIED

- localhost:3000 (local frontend)
- 127.0.0.1:8000 (local backend)

### PROPOSED (Not Created)

- staging-app.calorietoken.net (staging frontend)
- staging-api.calorietoken.net (staging backend)
- staging-wp.calorietoken.net (staging WordPress + staging bridge)

## Candidate Staging Architectures (Only Referenced/Available Patterns)

### Option 1: Vercel + Railway + Separate Staging WordPress

- Frontend URL: https://staging-app.calorietoken.net (or Vercel staging domain)
- Backend URL: https://staging-api.calorietoken.net (or Railway staging service domain)
- WordPress URL: https://staging-wp.calorietoken.net
- Database isolation: separate Railway DB volume/path for staging backend
- Environment-variable isolation: separate Vercel/Railway staging env groups
- Bridge-secret isolation: separate secret for staging bridge and staging backend
- DNS requirements: add 3 staging DNS records
- SSL requirements: TLS certificates for all three staging hosts
- Difficulty: medium
- Production risk: low if fully isolated

### Option 2: Local HTTPS Staging Simulation + Separate Staging WordPress

- Frontend URL: https://local-staging-app (local TLS via reverse proxy/hosts)
- Backend URL: https://local-staging-api (local TLS via reverse proxy/hosts)
- WordPress URL: https://staging-wp.calorietoken.net
- Database isolation: local dedicated SQLite file for staging simulation
- Environment-variable isolation: local env files only
- Bridge-secret isolation: local-only staging secret
- DNS requirements: none for local app/api; staging DNS needed for WordPress if remote
- SSL requirements: local certificates plus valid TLS for staging WordPress
- Difficulty: medium-high
- Production risk: low

### Option 3: Render-style Backend Staging + Vercel Frontend Staging + Separate Staging WordPress

- Frontend URL: Vercel staging/custom staging domain
- Backend URL: Render/Railway staging URL
- WordPress URL: https://staging-wp.calorietoken.net
- Database isolation: separate backend service storage path for staging
- Environment-variable isolation: separate staging env set
- Bridge-secret isolation: separate staging secret
- DNS requirements: staging subdomain records as needed
- SSL requirements: platform-managed TLS + WordPress TLS
- Difficulty: medium
- Production risk: low if isolated
- Note: Render is referenced in docs as a typical platform, but no Render config is present.

### Option 4: Separate Plesk Staging Stack (Unverified)

- Frontend URL: staging subdomain on same zone
- Backend URL: separate staging subdomain/service
- WordPress URL: separate staging WordPress subdomain
- Database isolation: separate DB instance/schema per component
- Environment-variable isolation: per-site env or config files
- Bridge-secret isolation: separate staging secret
- DNS requirements: staging records
- SSL requirements: staging certs
- Difficulty: unknown
- Production risk: unknown
- Note: no Plesk configuration evidence was found in this repository.

## Recommended Architecture

Choose Option 1: Vercel + Railway + Separate Staging WordPress.

Reasoning:

- Matches existing deployment documentation patterns.
- Cleanly isolates frontend/backend/WordPress and all secrets.
- Low production risk with separate services and domains.
- Simplest path to HTTPS-everywhere and repeatable testing.

## WordPress Staging Plan

1. Provision a separate staging WordPress installation (new site, not production clone-in-place).
2. Use a separate WordPress database.
3. Use separate WordPress users/roles for staging.
4. Install the same XUMM Login plugin version (1.3.0) in staging WordPress.
5. Install the standalone Identity Bridge plugin in staging WordPress only.
6. Configure a separate staging bridge secret.
7. Configure callback allowlist to staging frontend callback URL only.
8. Configure bridge backend URL to staging backend URL only.
9. Do not activate or modify bridge on production WordPress.

## CalorieApp Staging Plan

### Staging Frontend

- Deploy from current frontend source to staging frontend service/domain.
- Set NEXT_PUBLIC_BACKEND_URL to staging backend URL.
- Do not point staging frontend at production backend.

### Staging Backend

- Deploy from current backend source to separate staging backend service.
- Set all identity env vars in staging backend runtime.
- Ensure CORS_ORIGINS includes staging frontend origin.

### Staging Database

- Use isolated staging database storage.
- Must contain identity and app tables, including pendingloginstate.
- Must not reuse production database path or credentials.

## Environment Variable Plan

| Variable | Purpose | Staging Value Source | Secret? | Where Configured? |
|---|---|---|---|---|
| WORDPRESS_URL | Base URL for staging WordPress login host | Staging WordPress domain | No | Staging backend runtime env |
| WORDPRESS_BRIDGE_AUTHORIZE_URL | Bridge authorize endpoint URL | Staging WordPress bridge route | No | Staging backend runtime env |
| WORDPRESS_BRIDGE_EXCHANGE_URL | Bridge exchange endpoint URL | Staging WordPress bridge route | No | Staging backend runtime env |
| WORDPRESS_BRIDGE_SECRET | Shared S2S secret between staging backend and staging bridge | Secret manager/manual secure generation | Yes | Staging backend env + staging WordPress bridge settings |
| CALORIEAPP_CLIENT_ID | Client identifier for bridge auth header | Staging app identity string (for example calorieapp-staging) | No | Staging backend env + staging WordPress bridge settings |
| CALORIEAPP_POST_LOGIN_REDIRECT | In-app route after successful callback | Staging frontend route (for example /dashboard) | No | Staging backend runtime env |
| LOGIN_STATE_LIFETIME_SECONDS | Pending login state validity window | Security policy (recommended 300) | No | Staging backend runtime env |
| SESSION_COOKIE_SECURE | Force secure cookies for HTTPS | true in HTTPS staging | No | Staging backend runtime env |
| NEXT_PUBLIC_BACKEND_URL | Frontend API target base URL | Staging backend HTTPS URL | No | Staging frontend environment |

## Security Boundary Checklist

Production must remain isolated from staging:

- production database != staging database
- production bridge secret != staging bridge secret
- production WordPress != staging WordPress
- production cookies != staging cookies
- production callback URL != staging callback URL

Staging may use the same XUMM Login plugin version, but it must run with independent WordPress state and independent bridge configuration.

## XUMM Login 1.3.0 in Staging (No Source Changes)

The existing plugin source can remain unchanged if staging WordPress supports configuration-only setup.

After staging WordPress exists, configure only operational settings:

1. XUMM Login 1.3.0 plugin settings for staging app credentials.
2. Identity Bridge settings for callback allowlist and backend URL.
3. Staging bridge secret (same value on staging backend and staging bridge).
4. Verify xrpl-r-address mapping is available on staging users.

No plugin source modifications are required by this plan.

## Step-by-Step Implementation Sequence (For Later Execution)

1. Provision staging frontend service.
2. Provision staging backend service.
3. Provision staging WordPress service.
4. Provision separate staging DB resources (backend and WordPress).
5. Create staging DNS records for app/api/wp subdomains.
6. Enable TLS certificates on all staging domains.
7. Deploy backend to staging service.
8. Configure backend staging env variables (including identity vars).
9. Verify backend /health endpoint over HTTPS.
10. Deploy frontend to staging service.
11. Configure NEXT_PUBLIC_BACKEND_URL to staging backend URL.
12. Verify frontend loads and can call backend health endpoint.
13. Install XUMM Login 1.3.0 on staging WordPress.
14. Install standalone Identity Bridge on staging WordPress.
15. Configure staging bridge settings:
- backend URL
- backend client id
- callback allowlist
- bridge secret
16. Verify bridge endpoints respond correctly in staging.
17. Run CalorieApp release gate against staging-ready branch/workspace.
18. Run REAL STAGING TEST checklist from docs/STAGING_XAMAN_TEST.md.
19. Capture logs with secret-safe policy only.
20. Approve or reject staging readiness.

## Rollback Procedure (If Staging Test Fails)

1. Disable staging bridge plugin first.
2. Disable staging frontend login entry if needed.
3. Rotate staging bridge secret.
4. Revoke staging XUMM app credentials if compromise is suspected.
5. Reset staging-only cookies/sessions.
6. Restore previous staging backend/frontend build.
7. Re-run health checks and release-check.ps1 in workspace.
8. Re-run only staging test path, not production.

## Validation Gates Before First Real Staging Login

- Backend tests pass
- release-check.ps1 passes
- frontend lint/build pass
- staging WordPress exists and is isolated
- staging bridge secret configured securely
- callback allowlist points only to staging callback domain
- SESSION_COOKIE_SECURE=true in HTTPS staging

## Explicit Non-Implementation Statement

No deployment actions are performed by this document. It is a design and execution plan for later manual implementation.
