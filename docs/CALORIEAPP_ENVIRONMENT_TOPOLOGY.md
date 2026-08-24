# CalorieApp Environment Topology

**Status:** authoritative working checkpoint for current V1 environment reconciliation

**Purpose:** prevent environment drift, duplicate deployments, and accidental mixing of local development, bridge staging, and production services.

This document records only what has been verified from the repository, Render, the Windows development VM, and the current identity design. Unknowns remain explicitly marked as unknown.

## 1. Source-of-truth rules

1. **GitHub `CalorieToken/CalorieApp` is the source of truth for application code.**
2. **Render Production is the source of truth for the live CalorieApp runtime.**
3. **The Windows VM is development/tooling only unless a component is explicitly promoted.**
4. **The VM WordPress bridge staging tree is local staging/reference material, not production.**
5. **The production WordPress/Xaman companion bridge is an external deployment dependency and must be independently verified before claiming end-to-end authentication works.**
6. **Do not create a second backend, second production bridge, or second Xaman identity path while the existing production path remains recoverable.**
7. **Do not copy production secrets into local staging.**

## 2. Verified production topology

```text
Browser
  -> https://calorieapp-frontend.onrender.com
  -> https://calorieapp-backend-rvul.onrender.com
  -> external WordPress identity bridge expected on https://calorietoken.net
  -> Xaman/XUMM identity flow
  -> WordPress bridge authorization code
  -> CalorieApp backend callback
  -> opaque CalorieApp session cookie
  -> authenticated CalorieApp APIs
```

### Render frontend

- Service: `calorieapp-frontend`
- Public URL: `https://calorieapp-frontend.onrender.com`
- Repository: `CalorieToken/CalorieApp`
- Branch: `main`
- Verified frontend environment variable: `NEXT_PUBLIC_BACKEND_URL=https://calorieapp-backend-rvul.onrender.com`
- Status observed: deployed.

### Render backend

- Service: `calorieapp-backend`
- Render service ID: `srv-da34poht0dsc73cpc1kg`
- Public URL: `https://calorieapp-backend-rvul.onrender.com`
- Repository: `CalorieToken/CalorieApp`
- Branch: `main`
- Render location in dashboard: `My project -> Production -> calorieapp-backend`
- `/health` verified live with response identifying `calorieapp-backend`.
- The service was initially hard to find because it is nested under the project's Production environment while the frontend appears as an ungrouped service.

## 3. Canonical local development checkout

Windows VM:

- Machine observed: `DESKTOP-FD57AGL`
- User observed: `desktop-fd57agl\p`
- Canonical working checkout: `C:\Users\p\CalorieApp`
- Remote: `https://github.com/CalorieToken/CalorieApp.git`
- Branch: `main`
- Observed HEAD checkpoint: `f419519` (`Align local, VS Code, and CI release validation`)
- Working tree was clean when inspected.
- Current checkout already contains the committed identity/Xaman implementation, including:
  - `backend/app/services/identity.py`
  - `backend/tests/test_identity.py`
  - `backend/tests/test_identity_endpoints.py`
  - `docs/IDENTITY_FOUNDATION.md`
  - `docs/public/identity.md`
  - `frontend/components/authEvents.ts`
  - `frontend/components/XamanLoginPanel.tsx`

The local VM must not be treated as a second production backend.

## 4. Historical/local copies on the VM

The VM also contains older/checkpoint material:

- `C:\Users\p\CalorieApp-test`
- `C:\Users\p\CalorieApp_PRIVATE_CHECKPOINT_2026-08-20`
- `C:\Users\p\CalorieApp_PRIVATE_CHECKPOINT_6C2_2026-08-20`

Observed checkpoints were older than the canonical checkout. Some contain modified and untracked identity/staging material. These directories are therefore classified as **historical/checkpoint material**, not active development environments.

**Rule:** do not delete them until the Xaman/bridge reconciliation is complete, but do not run or deploy from them.

## 5. Local WordPress identity-bridge staging

Verified staging tree:

`C:\Users\p\Studio\calorieapp-bridge-staging`

This contains a WordPress source tree and the companion plugin at:

`wp-content\plugins\calorieapp-identity-bridge`

A separate bridge source tree also exists at:

`C:\Users\p\calorieapp-identity-bridge`

The staging plugin implements the expected identity contract, including:

- REST `/authorize`
- REST `/exchange`
- state validation against the CalorieApp backend at `/api/identity/login/state/validate`
- short-lived authorization-code storage
- state matching / one-time consumption
- callback allowlist
- configurable CalorieApp backend URL
- configurable backend client ID
- bridge shared secret

The plugin default backend client ID is `calorieapp-backend`; backend URL and bridge secret default empty and require configuration.

### Important isolation finding

When inspected, the VM had no running `node`, `php`, `mysqld`, `httpd`, or `nginx` process and none of the checked common development ports were listening. The staging WordPress tree is therefore **not currently a second live service**.

No `php.exe` was found on the inspected `C:` drive. The staging tree should therefore be treated as source/reference/staging material, not as a currently executable WordPress instance.

Test fixtures in the staging plugin contain references to `https://app.calorietoken.net` and related callbacks. These references are not proof of live runtime configuration and must not be interpreted as production settings without separate verification.

## 6. Identity architecture contract

Current V1 identity boundary:

- Xaman/XUMM is used only as an external identity mechanism.
- CalorieApp maintains its own internal user and session model.
- Browser callback contract is `code + state`.
- WordPress companion bridge is responsible for mapping the authenticated WordPress/Xaman session to a short-lived CalorieApp authorization code.
- Backend validates the pending login state and exchanges the authorization code server-side.
- CalorieApp then issues an opaque application session cookie.

Not approved in this V1 identity path:

- private keys / seed phrases
- wallet custody
- XRPL transaction signing/submission
- payments / transfers
- trading / exchange
- token administration
- rewards or value transfer

## 7. Required production identity configuration

The backend currently expects identity-related configuration such as:

- `WORDPRESS_URL`
- `WORDPRESS_BRIDGE_AUTHORIZE_URL`
- `WORDPRESS_BRIDGE_EXCHANGE_URL`
- `WORDPRESS_BRIDGE_SECRET`
- `CALORIEAPP_CLIENT_ID`
- `CALORIEAPP_POST_LOGIN_REDIRECT`
- `LOGIN_STATE_LIFETIME_SECONDS`
- `SESSION_COOKIE_SECURE`
- bridge timestamp/nonce controls

The WordPress bridge plugin expects matching configuration for:

- callback allowlist
- CalorieApp backend URL
- backend client ID
- bridge secret

**Critical requirement:** the bridge shared secret and client ID must match on both sides. Secret values must never be committed to Git or copied into documentation.

## 8. Current Xaman repair branch

Branch: `fix/xaman-callback-retry`

Current branch work includes:

- clearer sanitized callback diagnostics;
- retry-safe callback ordering so a transient WordPress/Xaman bridge failure does not burn the pending login state;
- regression coverage that permits retry after a transient bridge failure and still rejects replay after success;
- updated identity documentation.

CI for the repair branch has passed backend tests, dependency checks, repository-boundary checks, frontend audit/lint, and production build.

The branch remains intentionally unmerged until the external production bridge configuration is verified and a real end-to-end login is tested.

## 9. Known unknowns / next verification gates

The following are still **UNVERIFIED** and must be checked before merging/deploying the Xaman repair:

1. Which exact version of `calorieapp-identity-bridge` is installed on the live `calorietoken.net` WordPress site.
2. Whether the production WordPress plugin is active.
3. Whether the production plugin exposes the expected `/calorieapp/v1/authorize` and `/calorieapp/v1/exchange` routes.
4. Whether the production plugin's CalorieApp backend URL points to `https://calorieapp-backend-rvul.onrender.com`.
5. Whether the production bridge client ID matches the backend's `CALORIEAPP_CLIENT_ID`.
6. Whether the production bridge secret matches the backend's `WORDPRESS_BRIDGE_SECRET` (verify presence/match without exposing the value).
7. Whether the callback allowlist contains the actual deployed CalorieApp callback URL.
8. Whether Render backend CORS includes the deployed frontend origin.
9. End-to-end verification: Xaman -> WordPress bridge -> FastAPI callback -> CalorieApp session -> authenticated food logging/retrieval/deletion.

## 10. Change-control rule until reconciliation completes

Until all gates above are verified:

- no new Render backend;
- no second WordPress bridge;
- no new Xaman integration path;
- no deletion of local checkpoints;
- no production secret copying to VM staging;
- no merge of the Xaman repair PR;
- no showcase claims that authenticated Xaman login is working.

All future environment changes should update this document in the same PR/commit that changes the relevant deployment contract.

---

**Checkpoint date:** 2026-08-24

**Current conclusion:** the project is over-layered historically but recoverable. The verified architecture is one GitHub application codebase, one Render production frontend/backend path, one intended external WordPress/Xaman identity bridge, and one dormant local bridge-staging/reference tree. The immediate task is configuration reconciliation, not creation of additional environments.