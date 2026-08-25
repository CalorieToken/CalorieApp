# CalorieApp Cloud Deployment Guide

This guide covers deploying CalorieApp to a cloud showcase environment while maintaining V1 scope and local Windows development capability.

For Render, `render.yaml` is the repository-owned deployment blueprint. It
defines both services but deliberately leaves `DATABASE_URL`, `CORS_ORIGINS`,
`WORDPRESS_BRIDGE_SECRET`, and `NEXT_PUBLIC_BACKEND_URL` for Render's secret and
environment configuration. Never put their production values in Git.

## Architecture
- **Frontend**: Next.js 14 (React 18, TypeScript, Tailwind) — typically Vercel or similar
- **Backend**: FastAPI with SQLite — typically Render, Railway, or similar
- **External API**: Open Food Facts (read-only, no auth required)
- **Scope**: Non-financial food and nutrition tracking only

## Backend Deployment Setup

### 1. Environment Variables

The backend reads configuration from environment variables. Create or set these on your cloud platform:

#### Required for Cloud
```
CORS_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
DATABASE_URL=sqlite:////tmp/calorieapp.db
```

#### Optional (Platform Usually Sets)
```
PORT=8000                    # Cloud platform typically sets this
HOST=0.0.0.0               # Cloud platform typically sets this
```

**Details**:
- `CORS_ORIGINS`: Comma-separated list of frontend URLs. **Cloud deployment MUST include the deployed frontend domain.**
- `DATABASE_URL`: SQLite database path. Use a persistent path if your platform supports it.
- `PORT`: Exposed by cloud platform environment variable. Backend is started with `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- `HOST`: Bind to `0.0.0.0` on cloud to accept all interfaces.

### 2. Startup Command

Use this startup command on your cloud platform:

```bash
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For dynamic PORT from environment (Render, Railway, etc.):
```bash
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 3. Requirements

Ensure Python 3.10+ is available. Pin Python version in your deployment:

```
python -3.10
```

Install dependencies:
```bash
pip install -r backend/requirements.txt
```

### 4. Database Persistence

**Current state**: SQLite in `/tmp/calorieapp.db` (ephemeral on most platforms).

**Recommendation for MVP**: 
- Use a platform-managed persistent disk or volume.
- Or use SQLite with regular scheduled backups.

**Post-MVP migration path**: Switch to managed PostgreSQL for better durability and scaling.

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

Or let Vercel/your platform handle the build automatically from the `frontend/` folder.

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
- [ ] Database persistence path configured (or backup plan in place)
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

### Database Not Persisting
**Symptom**: Logged foods disappear after container restart

**Cause**: SQLite database file on ephemeral filesystem; container restart discards it.

**Fix**:
1. Configure persistent volume/disk on your platform.
2. Set `DATABASE_URL` to the persistent path.
3. Or switch to managed PostgreSQL (post-MVP).

## Reference

- `backend/.env.example` — Environment variable templates
- `backend/requirements.txt` — Python dependencies
- `frontend/package.json` — Node.js dependencies
- `docs/deployment-readiness-checklist.md` — Full pre-deployment validation
