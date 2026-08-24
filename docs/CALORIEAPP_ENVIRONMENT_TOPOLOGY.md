# CalorieApp Environment Topology

**Status:** authoritative working checkpoint for current V1 environment reconciliation

**Purpose:** prevent environment drift, duplicate deployments, and accidental mixing of local development, bridge staging, production services, and ChatGPT-assisted project work.

This document records only verified state. Unknowns remain explicitly marked as unknown.

## 1. Operating model: five environments, five roles

| Environment | Role | Authoritative for | Must NOT be used for |
|---|---|---|---|
| GitHub `CalorieToken/CalorieApp` | Source control | Application code, reviewed docs, branches, CI | Runtime secrets or ad-hoc deployment state |
| Windows VM / VS Code | Local development workstation | Local code inspection, development, WP Studio staging | Production hosting or a second live backend |
| WP Studio `CalorieApp Bridge Staging` | Local WordPress bridge staging | Testing the companion WordPress identity bridge before production install | Real-user production identity traffic |
| Render | Production CalorieApp runtime | Live frontend and backend services | Bridge development or duplicate experimental backends |
| ChatGPT workspace/conversation | Orchestration and project control | Planning, audits, GitHub changes, evidence reconciliation, guided checks | Being treated as a deployment/runtime environment |

### Core rule

There is one production application path and one staging bridge path. Do not create additional live equivalents unless a deliberate architecture decision says otherwise.

## 2. Source-of-truth rules

1. **GitHub `CalorieToken/CalorieApp` is the source of truth for application code.**
2. **Render Production is the source of truth for the live CalorieApp application runtime.**
3. **The Windows VM is development/tooling only.**
4. **WP Studio on the VM is the only current WordPress bridge staging environment.**
5. **The production WordPress bridge is not yet installed on `calorietoken.net`; production Xaman login is therefore intentionally incomplete.**
6. **ChatGPT is a coordination layer, not another environment.** Any architecture/runtime claim made in a chat must be reconciled against this document and verified infrastructure before acting on it.
7. **Do not create a second backend, second production bridge, or second Xaman identity path while the existing intended path remains recoverable.**
8. **Do not copy production secrets into GitHub, chat, screenshots, or local staging unless a deliberate secret-management decision requires a staging-specific value.**

## 3. Verified production topology

```text
Browser
  -> https://calorieapp-frontend.onrender.com
  -> https://calorieapp-backend-rvul.onrender.com
  -> [production WordPress bridge NOT YET INSTALLED]
  -> future production bridge on https://calorietoken.net
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
- Dashboard location: `My project -> Production -> calorieapp-backend`
- `/health` verified live with response identifying `calorieapp-backend`.

## 4. Canonical local development checkout

Windows VM:

- Canonical working checkout: `C:\Users\p\CalorieApp`
- Remote: `https://github.com/CalorieToken/CalorieApp.git`
- Branch: `main`
- Observed HEAD checkpoint: `f419519` (`Align local, VS Code, and CI release validation`)
- Working tree was clean when inspected.
- Current checkout contains the committed identity/Xaman implementation, including backend identity services/tests, identity documentation, frontend auth events, and `XamanLoginPanel.tsx`.

**Role:** this checkout is the only normal local CalorieApp development checkout. It must not be treated as another production backend.

## 5. Local WP Studio bridge staging

Verified WP Studio site:

- Site name: `CalorieApp Bridge Staging`
- Local WordPress URL: `http://localhost:8881`
- Site is runnable through WordPress Studio on the VM.
- Plugin: `CalorieApp Identity Bridge`
- Plugin version observed: `0.1.1`
- Plugin status observed: active.
- REST `/calorieapp/v1/authorize` is registered locally; requesting it without `state` returns the expected missing-parameter error, confirming the route is active.

Underlying staging tree:

`C:\Users\p\Studio\calorieapp-bridge-staging`

Bridge plugin tree:

`C:\Users\p\Studio\calorieapp-bridge-staging\wp-content\plugins\calorieapp-identity-bridge`

Separate bridge source tree:

`C:\Users\p\calorieapp-identity-bridge`

The staging plugin implements the expected identity contract:

- REST `/authorize`
- REST `/exchange`
- state validation against `/api/identity/login/state/validate`
- short-lived authorization-code storage
- state matching / one-time consumption
- callback allowlist
- configurable CalorieApp backend URL
- configurable backend client ID
- bridge shared secret

Observed bridge settings screen currently showed:

- callback allowlist: empty
- default callback URL: empty
- CalorieApp backend URL: empty
- backend client ID: `calorieapp-backend`
- bridge secret field: no visible value shown
- code TTL: `60` seconds

**Interpretation:** staging infrastructure exists and the plugin is active, but staging configuration is not yet complete. This is the correct place to finish bridge validation before any production WordPress install.

## 6. Production WordPress status

Verified current state:

- `calorietoken.net` is the intended production WordPress host for the companion bridge.
- The CalorieApp bridge has **not yet been installed on the production WordPress site**.
- The public WordPress REST index therefore does not currently expose the `calorieapp/v1` namespace.

This is expected given the unfinished deployment sequence and must not be misdiagnosed as a broken production plugin.

## 7. Historical/local copies on the VM

The VM also contains older/checkpoint material:

- `C:\Users\p\CalorieApp-test`
- `C:\Users\p\CalorieApp_PRIVATE_CHECKPOINT_2026-08-20`
- `C:\Users\p\CalorieApp_PRIVATE_CHECKPOINT_6C2_2026-08-20`

These are classified as **historical/checkpoint material**, not active environments.

**Rule:** do not run, deploy from, or modify them during normal development. Do not delete them until the bridge/Xaman reconciliation is complete and their preservation value has been reviewed.

## 8. Identity architecture contract

Current V1 identity boundary:

- Xaman/XUMM is used only as an external identity mechanism.
- CalorieApp maintains its own internal user and session model.
- Browser callback contract is `code + state`.
- WordPress companion bridge maps an authenticated WordPress/Xaman session to a short-lived CalorieApp authorization code.
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

## 9. Environment flow rules

### Development flow

```text
GitHub feature branch
  -> C:\Users\p\CalorieApp (local development/testing)
  -> GitHub PR + CI
```

### Bridge staging flow

```text
Bridge source
  -> WP Studio CalorieApp Bridge Staging (localhost:8881)
  -> validate bridge routes/config/contract
  -> only after passing staging: prepare production WordPress install
```

### Production flow

```text
GitHub main
  -> Render frontend/backend
  -> production WordPress bridge on calorietoken.net (after controlled install)
  -> Xaman
```

### ChatGPT flow

```text
User request/evidence
  -> verify against GitHub/topology/infrastructure
  -> propose or execute only within the correct environment
  -> update this topology document when environment roles change
```

ChatGPT must not infer that a component is deployed merely because source files exist, or infer that a component is absent merely because it is not visible in one dashboard view.

## 10. Xaman repair branch

Branch: `fix/xaman-callback-retry`

Branch work includes:

- clearer sanitized callback diagnostics;
- retry-safe callback ordering so a transient WordPress/Xaman bridge failure does not burn pending login state;
- regression coverage for retry and replay behavior;
- updated identity documentation;
- this environment topology checkpoint.

The branch remains intentionally unmerged until bridge staging is validated, production bridge deployment is prepared, and a real end-to-end login is tested.

## 11. Ordered next gates

Do these in order. Do not skip ahead.

1. **Finish WP Studio staging configuration** using staging-safe values and a defined backend target.
2. **Validate local bridge behavior**: `/authorize`, backend state validation, `/exchange`, callback allowlist, one-time code behavior.
3. **Reconcile Render backend identity configuration** with the bridge contract without exposing secrets.
4. **Package/version the bridge for production** from the validated source; do not edit production ad hoc.
5. **Install/configure the bridge on `calorietoken.net`** in a controlled production step.
6. **Run end-to-end Xaman login**: Xaman -> WordPress bridge -> FastAPI callback -> CalorieApp session.
7. **Verify authenticated food logging/retrieval/deletion.**
8. **Only then merge/deploy the Xaman retry PR** as appropriate.
9. **Only after stable authentication resume the frozen showcase work.**
10. **Review/archive historical VM checkpoints** after the environment is stable.

## 12. Change-control rules

Until the ordered gates above complete:

- no new Render backend;
- no second WordPress staging environment;
- no second production WordPress bridge;
- no new Xaman integration path;
- no running/deploying from historical checkpoint folders;
- no production secret copying into Git, chat, or screenshots;
- no merge of the Xaman repair PR merely because application CI is green;
- no showcase claim that authenticated Xaman login is working.

Any future environment-role change must update this document in the same branch/PR that changes the deployment contract.

---

**Checkpoint date:** 2026-08-25

**Current conclusion:** the project has accumulated multiple copies and tools, but the intended architecture is now clear: GitHub controls code, the VM is development, WP Studio is the single bridge staging environment, Render is the single production application runtime, production WordPress will host one bridge after staging passes, and ChatGPT coordinates work rather than acting as another runtime.