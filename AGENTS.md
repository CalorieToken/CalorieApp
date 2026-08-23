# CalorieApp Agent Guide

This file applies to the entire repository. More specific `AGENTS.md` files may
add rules for a subdirectory but must not weaken these boundaries.

## Product boundary

- CalorieApp V1 is a non-financial, non-custodial food and nutrition application.
- Do not add wallet custody, private-key or seed handling, transaction signing,
  payments, token transfers, exchange/trading, rewards with monetary value, or
  other financial execution without a separately approved architecture and
  legal/security review.
- Treat XRPL/Xaman/XUMM data only as external identity context in the current V1.
- Do not modify or bundle XUMM Login 1.3.0 from this repository.
- Do not describe proposed CalorieDB, IPFS, NFT, provenance, node, validator, or
  CAL ecosystem research as implemented product functionality.

## Safety and authorization

- Work offline by default. Do not deploy, publish, install plugins, activate
  plugins, change DNS, modify Render, change WordPress, or alter Xaman/XUMM
  configuration unless the user explicitly authorizes that exact action.
- Do not commit, push, force-push, create branches/tags/releases/repositories, or
  open pull requests without explicit authorization for that exact Git action.
- Never reset or overwrite unrelated working-tree changes. The tree may contain
  reviewed but intentionally uncommitted work.
- Never commit, print, paste, or upload real secrets, cookies, login states,
  authorization codes, bridge secrets, private keys, seed phrases, `.env` files,
  databases, caches, dependencies, or build output.
- Keep the WordPress Identity Bridge separate from the main application. Its
  production installation and configuration require their own approval.

## Architecture invariants

- The browser begins login through the backend and receives a backend-generated
  WordPress sign-in URL with a high-entropy, expiring state.
- WordPress/Xaman is authoritative for the external identity. The browser must
  not provide an XRPL address as a trusted identity claim.
- The bridge validates state server-to-server and issues a short-lived,
  single-use code. The backend exchanges it server-to-server.
- CalorieApp creates its own opaque, HttpOnly session cookie and scopes food logs
  to the authenticated internal user.
- Preserve strict CORS origins, safe local redirects, HTTPS production URLs,
  no-store caching for private responses, replay protection, and fail-closed
  secret/configuration behavior.

## Repository map

- `frontend/`: Next.js, TypeScript, React, and Tailwind UI.
- `backend/`: FastAPI, Pydantic, SQLModel, identity/session logic, and food APIs.
- `docs/public/`: statements suitable for public product documentation.
- `docs/research/`: proposals and future-direction research, not current claims.
- `docs/DEVELOPMENT_WORKFLOW.md`: Windows/VS, VM, and Git handoff procedure.
- `.vscode/tasks.json`: shared cross-platform offline validation task.
- `release-check.ps1`: combined Windows validation gate.
- `release-check.sh`: combined Linux/VM validation gate; it does not start servers.

## Required validation

Run the narrowest relevant checks while editing, then run the complete gates
before presenting a release or commit-ready checkpoint.

Backend from repository root on Linux/VM:

```bash
.venv/bin/python -m pytest backend/tests -q
.venv/bin/python -m compileall -q backend/app
```

Backend on Windows after activating the virtual environment:

```powershell
cd backend
python -m pytest tests -q
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Optional combined Windows gate:

```powershell
.\release-check.ps1
```

Combined Linux/VM gate:

```bash
./release-check.sh
```

Also run `git diff --check` and inspect changed/untracked files for secrets,
databases, generated artifacts, accidental scope expansion, and misleading
public claims.

## Change style

- Prefer small, test-backed changes that preserve current contracts.
- Validate all user-controlled URLs, redirects, identity claims, food text, and
  numeric nutrition fields at trust boundaries.
- Keep timestamps UTC and timezone-aware at API boundaries.
- Do not silently catch broad programming errors as normal upstream failures.
- Avoid adding dependencies unless the benefit and maintenance cost are clear;
  keep manifests and lockfiles synchronized when dependencies change.
- Document any validation that could not run instead of claiming it passed.
