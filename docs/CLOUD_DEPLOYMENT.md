# CalorieApp Cloud Deployment Guide

This guide covers deploying CalorieApp to a cloud showcase environment while maintaining V1 scope and local Windows development capability.

For Render, `render.yaml` is the repository-owned deployment blueprint. It
declares both services and a PostgreSQL resource and is configured to link
`DATABASE_URL` from that resource when the blueprint is applied. It leaves
`CORS_ORIGINS`, `WORDPRESS_BRIDGE_SECRET`, and `NEXT_PUBLIC_BACKEND_URL` for
Render's secret and environment configuration. The blueprint records intended
configuration; it does not prove that resources are live or synchronized.
Never put production secret values in Git.

## Architecture
- **Frontend**: Next.js 14 (React 18, TypeScript, Tailwind) — the current repository blueprint configures Render
- **Backend**: FastAPI with SQLModel — local development defaults to SQLite, while the current Render blueprint configures PostgreSQL through `DATABASE_URL`
- **External API**: Open Food Facts (read-only, no auth required)
- **Scope**: Non-financial food and nutrition tracking only

## Backend Deployment Setup

### 1. Environment Variables

The backend reads configuration from environment variables. Create or set these on your cloud platform:

#### Required for Cloud

When applied, the Render blueprint is configured to supply `DATABASE_URL` from
its declared PostgreSQL resource. On another project-authorized provider, set
an equivalent PostgreSQL connection URL. A SQLite URL is suitable only where
the chosen platform provides the required durability.

```
CORS_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
DATABASE_URL=postgresql://user:password@host:5432/calorieapp
```

#### Optional (Platform Usually Sets)
```
PORT=8000                    # Cloud platform typically sets this
HOST=0.0.0.0               # Cloud platform typically sets this
```

**Details**:
- `CORS_ORIGINS`: Comma-separated list of frontend URLs. **Cloud deployment MUST include the deployed frontend domain.**
- `DATABASE_URL`: PostgreSQL connection URL for the repository reference
  configuration, or a SQLite database path for suitable local/persistent
  environments. Keep credentials in the deployment secret store.
- `PORT`: Exposed by cloud platform environment variable. Backend is started with `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- `HOST`: Bind to `0.0.0.0` on cloud to accept all interfaces.

### 2. Startup Command

Use this startup command on your cloud platform:

```bash
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For dynamic `PORT` from Render or another project-authorized provider:
```bash
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 3. Requirements

Use Python 3.11 or later. The current Render reference configuration pins
Python 3.12.10 in `render.yaml`; verify the active runtime matches the intended
tested version:

```bash
python --version
```

Install dependencies:
```bash
pip install -r backend/requirements.txt
```

### 4. Database Persistence

**Current repository configuration**:

- Local development defaults to `backend/calorieapp.db` using SQLite.
- Hosted environments use the configured `DATABASE_URL`.
- The repository-owned Render blueprint declares PostgreSQL and is configured
  to link it to the backend when the blueprint is applied. This declaration is
  not live-state or durability evidence.

If a different host uses SQLite, its database path must be backed by a
persistent disk or volume and an appropriate backup plan.

A Render free database expires after 30 days, so it is temporary and must be
upgraded or migrated before expiry. The application uses a standard
`DATABASE_URL` and remains portable to other PostgreSQL providers; this
relational store is separate from future IPFS and BigchainDB research
directions.

### Portable PostgreSQL backup

Free Render PostgreSQL does not include provider-managed exports or point-in-time
recovery. Before the database expires, install matching PostgreSQL client tools and
create a custom-format backup in an access-controlled, encrypted destination outside
the repository:

```bash
export DATABASE_URL='postgresql://...'
python tools/postgres_backup.py create --output-directory /secure/calorieapp-backups
```

The tool keeps credentials out of command-line arguments and manifests, creates files
with owner-only permissions, verifies the archive with `pg_restore --list`, and writes
a SHA-256 manifest. Backup files contain private user data: never commit them, upload
them as public CI artifacts, or place them on IPFS/BigchainDB.

Verify a copied backup without connecting to the source database:

```bash
python tools/postgres_backup.py verify \
  /secure/calorieapp-backups/calorieapp-YYYYMMDDTHHMMSSZ.dump \
  --manifest /secure/calorieapp-backups/calorieapp-YYYYMMDDTHHMMSSZ.dump.manifest.json
```

Restore into a replacement PostgreSQL database only after testing the target and
setting its credentials through PostgreSQL environment variables:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname target_database \
  /secure/calorieapp-backups/calorieapp-YYYYMMDDTHHMMSSZ.dump
```

### 5. Health Check

Verify deployment with:
```bash
curl https://your-backend-domain.com/health
# Expected response: {"status":"ok","service":"calorieapp-backend"}
```

## Frontend Deployment Setup

### 1. Environment Variables

Set on your frontend hosting platform:

```
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.com
```

**Important**: This variable is **public** (visible to browser). It must be a valid, CORS-enabled URL pointing to your backend.

### 2. Build and Deploy

Standard Next.js deployment:
```bash
npm install
npm run build
npm run start
```

Or let Render or another project-authorized platform handle the build
automatically from the `frontend/` folder.

### 3. Verify Integration

After deployment:
1. Visit your frontend at `https://your-frontend-domain.com`
2. Try searching for a food item (e.g., "banana")
3. Verify the search request reaches the backend (check backend logs)
4. Verify the backend reaches Open Food Facts

## Local Windows Development (Unchanged)

The changes are backward-compatible. Local development continues to work exactly as before:

```powershell
# Terminal 1: Backend
cd backend
.\start-backend.ps1

# Terminal 2: Frontend
cd frontend
npm run dev
```

No environment variables needed locally — the code defaults to `http://localhost:3000` for frontend and `http://localhost:8000` for backend.

## Deployment Checklist

- [ ] Backend repository cloned or deployed
- [ ] `backend/.env.example` reviewed and `.env` (or platform env vars) configured
- [ ] `CORS_ORIGINS` includes deployed frontend URL
- [ ] Backend startup command set on cloud platform
- [ ] Verify the active hosted `DATABASE_URL` is linked to the intended
      PostgreSQL database, or a project-authorized persistent SQLite path and
      backup plan is configured
- [ ] Frontend repository cloned or deployed
- [ ] `NEXT_PUBLIC_BACKEND_URL` environment variable set to deployed backend URL
- [ ] Frontend build succeeds (`npm run build`)
- [ ] Health check passes: `curl <backend-url>/health`
- [ ] End-to-end test: search → log → retrieve in deployed UI

After both services deploy, run the read-only smoke test locally:

```bash
python tools/deployment_smoke_test.py \
  --backend-url https://your-backend-domain.com \
  --frontend-url https://your-frontend-domain.com
```

The same test can be launched manually from the GitHub Actions workflow named
`Deployment smoke test`. It checks backend health, the exact credentialed CORS
origin, and the frontend page without creating accounts or food-log data.

## Troubleshooting

### CORS Error in Browser Console
**Symptom**: `Access to XMLHttpRequest blocked by CORS policy`

**Cause**: `CORS_ORIGINS` env var not configured correctly on backend.

**Fix**: 
1. Verify backend was restarted after setting `CORS_ORIGINS`.
2. Verify `CORS_ORIGINS` includes your deployed frontend domain.
3. Check backend logs for which origins it received.

### Search Returns 502 from Backend
**Symptom**: Frontend shows "Open Food Facts request failed"

**Cause**: Backend unable to reach Open Food Facts API (upstream failure or network issue).

**Fix**: 
1. Verify backend has internet access.
2. Check backend logs for Open Food Facts request status.
3. Open Food Facts is public API — should work from any cloud region.

### Database Connection or Persistence Failure
**Symptom**: The backend cannot access existing records, or local SQLite records disappear after a container restart.

**Possible causes**:
- The hosted `DATABASE_URL` is missing or linked to the wrong PostgreSQL resource.
- A non-reference deployment uses SQLite on an ephemeral filesystem.

**Fix**:
1. Confirm the deployment secret/configuration links `DATABASE_URL` to the intended database without printing its value.
2. For PostgreSQL, verify connectivity and the documented backup/restore plan.
3. For a project-authorized SQLite deployment, use a persistent volume and a private backup plan.

## Reference

- `backend/.env.example` — Environment variable templates
- `backend/requirements.txt` — Python dependencies
- `frontend/package.json` — Node.js dependencies
- `docs/deployment-readiness-checklist.md` — Full pre-deployment validation
