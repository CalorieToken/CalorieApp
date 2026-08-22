# CALORIEAPP V2.0 CHECKPOINT / REPOSITORY FORENSIC AUDIT

Status: Read-only audit for checkpoint and baseline definition. No code, config, data, or deployment changes.

## Evidence discipline

This audit uses explicit labels:

- REPO-EVIDENCE: verified from repository state, git output, code or tracked files.
- INFERENCE: reasoned conclusion from the evidence.
- RECOMMENDATION: suggested future action, not a current fact.
- UNKNOWN: not yet verified.

---

## Executive Summary

- REPO-EVIDENCE: The repository is currently on branch main and tracks a fast-moving but still V1-era codebase focused on food/nutrition and identity bridging.
- REPO-EVIDENCE: The latest commit is 1d16ace, titled "CalorieApp V1.2 - portion logging and nutrition summary".
- REPO-EVIDENCE: The repo contains a working central backend and frontend, with backend tests passing and frontend lint/build succeeding in the current workspace environment.
- REPO-EVIDENCE: The repository also contains substantial architecture and staging research documents that indicate a future decentralized and ecosystem direction, but they are not equivalent to implemented functionality.
- INFERENCE: The project is not a single uniform product state. It is a mixed repository containing: (1) working current app code, (2) staged identity/auth work, (3) research docs for ecosystem evolution, and (4) experimental or future-phase concepts that must be separated clearly.
- RECOMMENDATION: The V2.0 baseline should be defined as the current working centralized app plus its validated identity flow and tested security assumptions, while future decentralized work stays in a separate research track until it has a proven POC and governance model.

---

## Current Git State

### Git branch and recent history

- REPO-EVIDENCE: Current branch: main
- REPO-EVIDENCE: Remote tracking branch: origin/main
- REPO-EVIDENCE: Latest commit: 1d16ace (HEAD -> main, origin/main) — "CalorieApp V1.2 - portion logging and nutrition summary"
- REPO-EVIDENCE: Recent history:
  - 1d16ace — CalorieApp V1.2 - portion logging and nutrition summary
  - 5c259c1 — Improve Open Food Facts integration and product cards
  - 941559c — Initial CalorieApp MVP

### Working tree state

- REPO-EVIDENCE: Current tracked modified files:
  - backend/.env.example
  - backend/.gitignore
  - backend/app/database.py
  - backend/app/main.py
  - backend/app/models.py
  - backend/app/schemas.py
  - backend/dev_health_check.py
  - backend/start-backend.ps1
  - backend/tests/conftest.py
  - backend/tests/test_endpoints.py
  - frontend/.env.example
  - frontend/app/page.tsx
  - frontend/components/FoodSearchPlaceholder.tsx
- REPO-EVIDENCE: Untracked files:
  - CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
  - DECENTRALIZED_ARCHITECTURE_V1.md
  - NATIVE_PLATFORM_ARCHITECTURE_V1.md
  - backend/.env.staging.example
  - backend/app/services/identity.py
  - backend/tests/test_identity.py
  - backend/tests/test_identity_endpoints.py
  - docs/IDENTITY_FOUNDATION.md
  - docs/STAGING_DEPLOYMENT_PLAN.md
  - docs/STAGING_XAMAN_TEST.md
  - frontend/.env.staging.example
  - frontend/app/auth/
  - frontend/components/XamanLoginPanel.tsx
- REPO-EVIDENCE: Ignored/generated artifacts currently present:
  - .pytest_cache/
  - .venv/
  - backend/.env
  - backend/.pytest_cache/
  - backend/__pycache__/
  - backend/app/__pycache__/
  - backend/app/services/__pycache__/
  - backend/calorieapp.db
  - backend/tests/__pycache__/
  - calorieapp.db
  - frontend/.env.local
  - frontend/.next/
  - frontend/node_modules/

### Git and repo risk observations

- REPO-EVIDENCE: The working tree is not clean; this is a live development state, not a release checkpoint.
- REPO-EVIDENCE: The repo contains multiple new experimental files and a substantial number of modified tracked files, so it is not yet a stable V2 baseline.
- REPO-EVIDENCE: There are ignored local secrets/config candidates (.env, .env.local, .db files, .next outputs, node_modules) that must be treated as sensitive and not published.
- INFERENCE: This repository is useful as an active dev workspace but not yet as a clean public-release or audit checkpoint.

---

## Repository Inventory

### Top-level inventory

- README.md
- .github/copilot-instructions.md
- .gitignore
- release-check.ps1
- test_api.py
- CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- DECENTRALIZED_ARCHITECTURE_V1.md
- NATIVE_PLATFORM_ARCHITECTURE_V1.md
- backend/
- frontend/
- docs/
- checkpoints/

### Backend inventory

- backend/README.md
- backend/requirements.txt
- backend/start-backend.ps1
- backend/dev_health_check.py
- backend/test_post.py
- backend/.env.example
- backend/.gitignore
- backend/app/
  - __init__.py
  - database.py
  - main.py
  - models.py
  - schemas.py
  - services/
    - open_food_facts.py
    - identity.py
- backend/tests/
  - __init__.py
  - conftest.py
  - test_endpoints.py
  - test_identity.py
  - test_identity_endpoints.py
- backend/calorieapp.db (ignored local DB)

### Frontend inventory

- frontend/package.json
- frontend/package-lock.json
- frontend/next.config.js
- frontend/tsconfig.json
- frontend/tailwind.config.ts
- frontend/postcss.config.js
- frontend/.eslintrc.json
- frontend/.env.example
- frontend/app/
  - globals.css
  - layout.tsx
  - page.tsx
  - auth/callback/page.tsx
- frontend/components/
  - EmptyState.tsx
  - ErrorBanner.tsx
  - FoodCard.tsx
  - FoodLogList.tsx
  - FoodSearchPlaceholder.tsx
  - LoadingState.tsx
  - SearchBar.tsx
  - XamanLoginPanel.tsx
  - foodTypes.ts
- frontend/public/
  - background.png
  - logo.png
  - logo.svg
  - openfoodfactslogo.png

### Docs and architecture inventory

- docs/architecture.md
- docs/CLOUD_DEPLOYMENT.md
- docs/deployment-readiness-checklist.md
- docs/roadmap.md
- docs/IDENTITY_FOUNDATION.md
- docs/STAGING_DEPLOYMENT_PLAN.md
- docs/STAGING_XAMAN_TEST.md

### Checkpoints and historical artifacts

- checkpoints/INDEX.md
- checkpoints/LATEST.txt
- checkpoints/new-checkpoint.ps1
- checkpoints/2026-07-23-project-checkpoint/
- checkpoints/2026-07-23-120229-project-checkpoint/

### Observations

- REPO-EVIDENCE: The repo includes both product code and architecture/planning documents.
- INFERENCE: There are multiple layers of history and stage planning, which is a sign of an evolving design process but also a risk for drift between docs and implementation.

---

## File Classification

### KEEP
- README.md
- backend/app/main.py
- backend/app/models.py
- backend/app/database.py
- backend/app/schemas.py
- backend/services/open_food_facts.py
- backend/tests/
- frontend/app/page.tsx
- frontend/components/FoodSearchPlaceholder.tsx
- docs/architecture.md
- docs/roadmap.md

Why:
- these are the core application and product-doc scaffolding.

### IMPORTANT
- backend/start-backend.ps1
- release-check.ps1
- frontend/package.json
- docs/IDENTITY_FOUNDATION.md
- docs/STAGING_DEPLOYMENT_PLAN.md
- docs/STAGING_XAMAN_TEST.md

Why:
- these capture operational setup and legal/identity boundary planning, even if not production-ready.

### EXPERIMENTAL
- CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- DECENTRALIZED_ARCHITECTURE_V1.md
- NATIVE_PLATFORM_ARCHITECTURE_V1.md
- backend/app/services/identity.py
- backend/tests/test_identity.py
- backend/tests/test_identity_endpoints.py
- frontend/app/auth/callback/page.tsx
- frontend/components/XamanLoginPanel.tsx

Why:
- they represent future or staged evolution, not confirmed production baseline.

### LEGACY
- test_api.py
- backend/test_post.py
- older checkpoint folders under checkpoints/
- some historical migration assumptions in docs

Why:
- they may retain historical development evidence but are not current declarative baseline.

### DUPLICATE / OVERLAPPING
- architecture and staging docs overlap with each other and with README references.
- there are multiple identity-related docs and multiple future-phase architecture docs that may describe overlapping states.
- there are both staged env examples and root-level docs that may duplicate assumptions about deployment.

### TEMPORARY
- local .next, node_modules, .pytest_cache, .venv, DB files, generated builds

Why:
- environment-specific, not source-of-truth.

### GENERATED
- frontend/.next/
- frontend/tsconfig.tsbuildinfo
- .pytest_cache/
- __pycache__/
- .db files

### UNKNOWN
- some staging and deployment assumptions are referenced in docs but not actually deployed in the repo.
- the meaning of some future architecture docs relative to actual implementation needs explicit governance before being treated as implementation requirements.

---

## Backend Audit

### Current backend state

- REPO-EVIDENCE: backend is FastAPI-based with a SQLModel SQLite data layer.
- REPO-EVIDENCE: backend/app/main.py exposes identity and food-log endpoints.
- REPO-EVIDENCE: backend/app/models.py defines the current database schema.
- REPO-EVIDENCE: backend/app/database.py initializes the database and adds optional columns if missing.
- REPO-EVIDENCE: backend/README.md scopes the backend to food and nutrition API endpoints, without blockchain, wallet, token, or financial logic.

### Working functionality

- REPO-EVIDENCE: backend health endpoint exists and responds as expected.
- REPO-EVIDENCE: backend food search integrates with Open Food Facts via backend/app/services/open_food_facts.py.
- REPO-EVIDENCE: /log-food, /logs, DELETE /logs/{id}, DELETE /logs are implemented and authenticated.
- REPO-EVIDENCE: backend identity flow includes login start, validation, callback, and logout.
- REPO-EVIDENCE: backend tests pass with 97 passed in the current environment.

### Incomplete or uncertain areas

- REPO-EVIDENCE: Identity flow is implemented but depends on WordPress and external bridge assumptions.
- REPO-EVIDENCE: vendor/service secrets are not in the repo, but environment variables are expected, including WORDPRESS_BRIDGE_SECRET and SESSION_COOKIE_SECURE.
- INFERENCE: the backend is working as a centralized app but still needs clear operational boundaries between local development, staging, and production assumptions.

### Technical debt and risk

- INFERENCE: The backend currently mixes identity logic, user-session logic, and food logging logic in one main module. This is acceptable for a V1 app but may become a growth issue.
- REPO-EVIDENCE: The codebase uses datetime.utcnow() in identity logic; tests warn about deprecation and timezone-awareness improvements.
- REPO-EVIDENCE: There are multiple identity/auth doc files and staged auth flow docs, which could drift from actual endpoint behavior if not carefully curated.
- SECURITY RISK: the code uses a bridge secret environment variable and sets cookie security based on env. This is sensitive and requires careful hosting discipline.

### Recommended classification

- Working baseline: current FastAPI app, models, endpoints, tests.
- Not baseline yet: decentralized or ecosystem extensions described in research docs.

---

## Frontend Audit

### Current frontend state

- REPO-EVIDENCE: frontend uses Next.js 14 with app router.
- REPO-EVIDENCE: frontend/app/page.tsx composes a consumer page with Xaman login + food search UI.
- REPO-EVIDENCE: frontend/components/XamanLoginPanel.tsx implements WordPress/Xaman login UX flow.
- REPO-EVIDENCE: frontend/app/auth/callback/page.tsx finalizes backend callback.
- REPO-EVIDENCE: frontend/components/FoodSearchPlaceholder.tsx handles search, logging, log history, deletion, and summary.

### Working functionality

- REPO-EVIDENCE: frontend lint passes: “No ESLint warnings or errors”.
- REPO-EVIDENCE: frontend build passes: Next.js production build compiled successfully and generated static routes.
- REPO-EVIDENCE: Search and food logging UI is implemented and coordinated against backend API.

### Incomplete or risky areas

- REPO-EVIDENCE: frontend is highly dependent on NEXT_PUBLIC_BACKEND_URL being configured correctly.
- INFERENCE: the app is operationally useful only in a correctly configured environment; this is not yet a fully self-contained product package.
- REPO-EVIDENCE: the frontend UI still carries the Xaman/WordPress identity branding and likely assumes a specific WordPress bridge identity flow, which must be treated as a staging or integration environment dependency.

### Technical debt

- some components appear to be a blend of product UI and auth progress state; they are not obviously separated into domain-specific modules.
- app structure is still relatively compact and monolithic in the current state. This is acceptable for V1 but should be separated before broader ecosystem expansion.

---

## Identity / Authentication Audit

### Implemented chain

- REPO-EVIDENCE: Frontend login button triggers backend /api/identity/login/start.
- REPO-EVIDENCE: Backend generates pending login state and returns a WordPress signin URL.
- REPO-EVIDENCE: Frontend follows callback route /auth/callback.
- REPO-EVIDENCE: Backend validates pending state and exchanges an authorization code with the WordPress bridge.
- REPO-EVIDENCE: backend/app/services/identity.py manages state, authorization code hashing, replay prevention, and user lookup/creation.
- REPO-EVIDENCE: User and external identity mapping exists in backend/app/models.py.

### Observed security-sensitive design decisions

- REPO-EVIDENCE: state parameter is stored on the server side and consumed once.
- REPO-EVIDENCE: authorization codes are hashed before storage, which is a sound design choice.
- REPO-EVIDENCE: cookie-based session uses calorieapp_user_id and is set as httponly, secure, and samesite=lax.
- REPO-EVIDENCE: the code checks state validity and session mismatches.
- REPO-EVIDENCE: there are explicit tests for expiration, replay, and mismatch behavior.

### Unresolved / staging-only concerns

- REPO-EVIDENCE: the staging docs explicitly discuss production vs staging separation and a WordPress bridge secret.
- INFERENCE: the identity chain is not clearly production-hardened until the specific environment model, secret rotation, and host isolation are documented and verified.
- UNKNOWN: exact production readiness of WordPress bridge integration and callback allowlists under a real hosted environment.
- UNKNOWN: whether all environment settings are properly enclosed and rotated across dev/staging/prod.

### Important classification

- Implemented: backend identity flow and server-side state handling.
- Tested: replay, expiration, mismatch protection in backend tests.
- Staging-only: WordPress/Xaman integration environment assumptions and staging deployment docs.
- Production-ready: not yet proven; the repo includes staging-only references and clear operational caveats.

---

## Database Audit

### Current schema inventory

- REPO-EVIDENCE: food_log table with fields such as product_name, calories, protein, fat, carbohydrates, portion_percentage, barcode, image_url, brand, serving_size, nutri_score, created_at, owner_id.
- REPO-EVIDENCE: calorieappuser table with id, created_at, updated_at, status.
- REPO-EVIDENCE: externalidentity table with provider, external_subject, xrpl_address, created_at, last_verified_at.
- REPO-EVIDENCE: authorizationcode table with code_hash, external_subject, xrpl_address, state, login_session_id, expires_at, used_at, used_by_ip.
- REPO-EVIDENCE: pendingloginstate table with state_hash, status, created_at, expires_at, consumed_at, post_login_redirect.

### Structure assessment

- REPO-EVIDENCE: database initialization is done at startup with SQLModel.metadata.create_all and optional column backfill for legacy compatibility.
- REPO-EVIDENCE: this is a working relational app schema, not a future decentralized schema.
- INFERENCE: it is an acceptable V1 data baseline, but it is not yet a proper V2 ecosystem data model.

### Security implications

- persistent identity and pending login state tables are sensitive.
- SQLite is acceptable for a local MVP but is not a complete production-grade multi-tenant or multi-service data platform.

### Is this a V2 baseline?

- RECOMMENDATION: not as-is.
- REPO-EVIDENCE: it is a working app schema, but it does not yet cover provenance, batches, lots, lab data, certificate references, or public/private separation.

---

## Testing Status

### Backend validation results

- REPO-EVIDENCE: command run successfully: .venv\Scripts\python.exe -m pytest backend/tests -q
- REPO-EVIDENCE: result: 97 passed in 0.91s
- REPO-EVIDENCE: warnings observed: 234 deprecation warnings related to datetime.utcnow() and timezone-awareness in Python code.

### Frontend validation results

- REPO-EVIDENCE: command run successfully: npm run lint
- REPO-EVIDENCE: result: “No ESLint warnings or errors”
- REPO-EVIDENCE: command run successfully: npm run build
- REPO-EVIDENCE: result: Next.js production build compiled successfully and generated static pages.

### What this implies

- REPO-EVIDENCE: the current repo is functionally healthy in the current developer environment.
- INFERENCE: the repo is not failing by default, but it is also not yet a complete V2 baseline for a much broader ecosystem architecture.

---

## Security Audit

### Sensitive items found or implied

- REPO-EVIDENCE: ignored local secrets/config candidates include:
  - backend/.env
  - backend/.env.staging.example
  - frontend/.env.local
  - frontend/.env.staging.example
  - local SQLite DB files
- REPO-EVIDENCE: the tool output shows .env files and DB files exist in the working tree and are not safe to publish.
- REPO-EVIDENCE: source files and docs mention WORDPRESS_BRIDGE_SECRET, CALORIEAPP_CLIENT_ID, and session cookie handling.
- REPO-EVIDENCE: .env.example files are tracked; they are safe placeholders only if they contain no secrets.

### Risk classifications

- SECRET: actual .env files and local DB files are secret-sensitive and should never be published.
- PRIVATE: staging env values, user session tokens, and database state.
- PUBLIC BUT REVIEW: architecture docs, roadmap docs, and non-secret design documents may be public if they avoid exposing operational details.
- PUBLIC: generic product and architecture summaries that do not include real URLs, credentials, or host details.

### Security risks observed

- local database files likely contain app data and user linkage state
- staging docs and env names reveal the existence of bridge-secret patterns and domain assumptions
- session cookies are enforced as secure, but the deployment model and host configuration must be verified before claiming production safety
- CORS and backend origin assumptions are environment-dependent and must be locked down before public deployment

### Redaction principle

- This report does not print actual secret values.
- If a sensitive file exists, its location is identified but not its live value.

---

## Public Github Exposure Audit

### Safe to publish publicly

- README.md
- docs/architecture.md
- docs/roadmap.md
- high-level architecture docs that do not include real secret-bearing config or runtime details
- general product descriptions and non-sensitive operational guidance

### Public but requires review

- docs/STAGING_DEPLOYMENT_PLAN.md
- docs/STAGING_XAMAN_TEST.md
- docs/IDENTITY_FOUNDATION.md
- any future architecture doc that references hostnames, bridge URLs, or token-specific ecosystem details

Why:
- they can reveal operational patterns or platform assumptions that should not be exposed prematurely.

### Private / secret

- .env files
- .env.local
- database files
- staging-specific secret references
- WordPress bridge secret values
- anything that reveals production or staging host trust boundaries

### Unknown

- whether the project should eventually be split into multiple repositories such as app, identity bridge, POC infrastructure, and node research.

---

## Documentation Audit

### Current docs inventory

- README.md
- backend/README.md
- docs/architecture.md
- docs/CLOUD_DEPLOYMENT.md
- docs/deployment-readiness-checklist.md
- docs/roadmap.md
- docs/IDENTITY_FOUNDATION.md
- docs/STAGING_DEPLOYMENT_PLAN.md
- docs/STAGING_XAMAN_TEST.md
- architecture research files

### Findings

- REPO-EVIDENCE: there are multiple overlapping docs covering architecture, roadmap, deployment, identity, and staging.
- INFERENCE: this is a sign of active product evolution, but it also means the docs need consolidation to avoid contradictory status claims.
- REPO-EVIDENCE: some documents describe future or hypothetical functionality as if it were part of the inherited architecture, especially in the research docs for decentralized and ecosystem evolution.
- INFERENCE: not all docs are equally trustworthy as implementation status docs.

### Contradictions / drift risk

- architecture docs describe future decentralized models and public ecosystem direction.
- current repo code and README still describe a controlled V1-centred product.
- future-phase and implementation-phase status are not clearly separated in all documents.

### Recommendation

- keep working app docs and real product docs public on a clear timeline
- keep future architecture research in a separate section or repo category
- distinguish “implemented”, “planned”, “research-only”, and “future-phase” explicitly

---

## Architecture Audit

### Implemented architecture

- Next.js frontend
- FastAPI backend
- SQLModel + SQLite persistence
- session-based auth
- WordPress/Xaman identity bridge assumptions
- Open Food Facts integration

### Planned / staged architecture

- staging deployment docs
- staging auth environment separation
- future identity bridge and callback environment handling

### Conceptual / future architecture

- DECENTRALIZED_ARCHITECTURE_V1.md
- NATIVE_PLATFORM_ARCHITECTURE_V1.md
- CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- concepts involving IPFS, Helia, CalorieDB, XRPL, $CAL, NFTs, provenance graphs, traceability, and validator roles

### Comparison against actual implementation

- REPO-EVIDENCE: the repo does not implement the conceptual ecosystem architecture in runtime code.
- REPO-EVIDENCE: there is no actual CalorieDB runtime, no Helia/IPFS runtime, no XRPL node or wallet implementation, and no $CAL or NFT stack in the codebase.
- INFERENCE: the architecture docs are correctly classified as research-only, not operational implementation.

---

## CalorieDB Status

### Implemented

- REPO-EVIDENCE: no runtime CalorieDB service or product implementation exists in the repository.
- REPO-EVIDENCE: there are no actual decentralized data layer code files implementing a CalorieDB runtime.

### Documented

- REPO-EVIDENCE: the decentralized architecture docs describe a conceptual CalorieDB model.
- REPO-EVIDENCE: the docs frame CalorieDB as a logical architecture/protocol and data layer, not a current code implementation.

### Conceptual

- provenance model,
- public/private split,
- encrypted records,
- metadata indexes,
- IPFS references,
- XRPL anchors,
- identity and batch relationships

### Conclusion

- REPO-EVIDENCE: CalorieDB is currently conceptual and research-only.
- INFERENCE: it should not be treated as a software capability until a working prototype and governance model exist.

---

## XRPL / $CAL Status

### Implemented

- REPO-EVIDENCE: no XRPL runtime implementation exists in this repository.
- REPO-EVIDENCE: no $CAL payment logic exists.
- REPO-EVIDENCE: no NFT minting logic exists.
- REPO-EVIDENCE: no XRPL transaction-reference system exists in current app code.

### Integrated externally

- REPO-EVIDENCE: the identity design and docs mention Xaman/XRPL address flows and external XUMM/Xaman login.
- REPO-EVIDENCE: external identity mapping includes xrpl_address fields in models.

### Planned / research-only

- architecture docs discuss XRPL, $CAL, NFTs, provenance anchors, and public-ledger verification.
- these are conceptual future-phase layers, not current app functionality.

### Conclusion

- REPO-EVIDENCE: XRPL and $CAL-related integration is currently at the design and identity-reference boundary, not at production runtime implementation.
- INFERENCE: this should remain explicitly future and separated from the current app baseline.

---

## Deployment Audit

### Current hosting assumptions

- REPO-EVIDENCE: README.md references localhost:3000 frontend and 127.0.0.1:8000 backend in local environments.
- REPO-EVIDENCE: docs/STAGING_DEPLOYMENT_PLAN.md references Vercel, Railway, and separate staging WordPress assumptions.
- REPO-EVIDENCE: docs/architecture.md mentions future phase concepts and says V1 should not include blockchain or wallets.
- REPO-EVIDENCE: there is no repository-native deployment automation in the repo itself (no Docker, no CI workflow, no provider config files such as Render-specific configuration).

### Production assumptions

- unknown or not proven by repository code
- docs refer to app.calorietoken.net and calorietoken.net as domain references, but those are not verified as active deployment config in this repo

### Observed deployment risk

- important deployment assumptions are documented but not enforced or committed in code
- environment-specific values and hostnames are likely handled outside this repo, which means deployment readiness must be validated separately

---

## Dependency Audit

### Python dependencies

From backend/requirements.txt:

- fastapi==0.115.5
- uvicorn[standard]==0.32.1
- pydantic==2.10.2
- httpx==0.28.1
- sqlmodel==0.0.21
- pytest==8.3.4

### Frontend dependencies

From frontend/package.json:

- next 14.2.5
- react 18.3.1
- react-dom 18.3.1
- dev packages for TypeScript, ESLint, Tailwind, PostCSS

### Observations

- REPO-EVIDENCE: dependencies are consistent with a lightweight MVP and not a large-scale decentralized platform stack.
- REPO-EVIDENCE: no XRPL or NFT libraries are in the current runtime dependency list.
- INFERENCE: the environment is presently appropriate for a central app, not for a decentralized ecosystem runtime.

### Potential caution

- some versions may be modern but still need a formal security review before public or production usage.
- no dependency lock or public audit strategy is described in the repo beyond package-lock and local installs.

---

## Technical Debt

### CRITICAL

1. Environment and secret handling is not yet fully governed.
   - Impact: major security risk; could expose staging or production credentials.
   - Suggested future action: strict env split, secret manager, and public/private separation policy.

2. Identity bridge and staging assumptions are not yet clearly separated from production assumptions.
   - Impact: security and operational drift.
   - Suggested future action: formal environment matrix with dev/staging/prod boundaries.

3. Research docs and implementation status are not fully separated.
   - Impact: confusion about what is implemented versus future architecture.
   - Suggested future action: explicit “implemented / researched / future” labels in docs and repo policy.

### HIGH

4. The backend app is still centralized and monolithic for a broader ecosystem direction.
   - Impact: future product expansion may be harder without a clear domain boundary.
   - Suggested future action: domain split between app auth, food service, identity service, and later provenance modules.

5. The database schema is functional for V1 but not sufficient for broader provenance, lab, or supply-chain models.
   - Impact: future design will require migration and schema evolution.
   - Suggested future action: define an explicit V2 domain model and migration strategy.

6. Staging and architecture docs are numerous and overlapping.
   - Impact: doc drift and review confusion.
   - Suggested future action: consolidate or archive obsolete planning docs.

### MEDIUM

7. Frontend and backend rely on environment configuration discipline.
   - Impact: operational fragility.
   - Suggested future action: documented environment contract and validation checklist.

8. Date/time handling uses utcnow() in several places.
   - Impact: deprecation warnings and timezone correctness issues.
   - Suggested future action: move to timezone-aware UTC handling consistently.

9. The repository contains generated artifacts and local environment state in a live working tree.
   - Impact: noise and accidental publication risk.
   - Suggested future action: define repo hygiene and clean audit gate before public sharing.

### LOW

10. Some historical checkpoint artifacts and documentation may be retained for reference but should not be treated as current active status.
   - Impact: low immediate risk, high confusion potential.
   - Suggested future action: archive or clearly classify historical docs.

---

## Proposed Project Structure

This is a recommendation only; no files are to be moved.

A cleaner future structure would look like:

- app/
  - frontend/
  - backend/
  - shared/
- docs/
  - product/
  - architecture/
  - identity/
  - deployment/
  - security/
- research/
  - decentralized/
  - native-platform/
  - ecosystem/
  - provenance/
- tests/
  - backend/
  - frontend/
  - integration/
- security/
  - secrets-policy.md
  - env-template.md
  - review-checklist.md
- ops/
  - runbooks/
  - staging/
  - backup/
- archives/
  - old-checkpoints/
  - legacy-docs/

### Why this structure is recommended

- it separates implemented app from research and future architecture
- it makes public/private boundaries clearer
- it reduces confusion between current app state and future ecosystem concepts

---

## Backup Strategy

### Recommended backup strategy

- RECOMMENDATION: commit a clean baseline branch or tag only after a final sanity check with a clean working tree and a confirmed secret review.
- RECOMMENDATION: back up the working repository as-is before any major refactor or migration.
- RECOMMENDATION: store a copy of the current database file outside the repo if it contains real user data.
- RECOMMENDATION: keep environment values in a secure secret manager instead of source-controlled files.

### Git checkpoint guidance

- cannot create a tag in this task per instruction
- recommended future action: create a dedicated baseline tag such as v2.0-checkpoint after a repo hygiene pass

### Database snapshot guidance

- do not treat the current SQLite file as a public artifact
- if user data exists, snapshot the database and store it in a private backup location separated from the repo

---

## License Analysis

### Current status

- REPO-EVIDENCE: no obvious license file is present in the root repository listing.
- INFERENCE: the repository appears to be license-absent unless a license file is present outside the inspected files.

### Comparison of common license choices

#### MIT
- pros: simple, permissive, common for open-source projects
- cons: does not strongly address patent or contribution governance
- good for: broad OSS adoption and simple commercial use

#### Apache-2.0
- pros: strong patent grant and contributor clarity
- cons: more verbose and more formalized
- good for: stronger governance and broad commercial use

#### GPL
- pros: strong copyleft obligations
- cons: restrictive, can complicate hosted or commercial use and forks
- good for: open-source principles, but not always ideal for a commercial ecosystem

#### AGPL
- pros: network copyleft
- cons: can be extremely restrictive for hosted services and multi-party infrastructure
- good for: strong open-source commitments, but risky for ecosystem service models

#### Source-available/custom
- pros: can protect business interests and commercial strategy
- cons: may reduce open-source adoption and complicate contributor expectations
- good for: sensitive ecosystem directions but not a default for a broadly open repository

### Important separation of concerns

- CODE LICENSE: covers source code and software.
- TOKEN RIGHTS: distinct from code licensing; may require separate legal review.
- TRADEMARK RIGHTS: brand and product identity must be separated from source code licensing.
- BRAND RIGHTS: naming, product identity, and ecosystem references are separate legal concerns.

### Recommendation

- RECOMMENDATION: do not choose a license during this checkpoint. The product and ecosystem direction still require a clear governance decision before a license is selected.

---

## Public Repository Strategy

### Recommendations by category

- PUBLIC: core app documentation, product overview, architecture summaries, non-sensitive roadmap notes
- PUBLIC BUT REVIEW: architecture and deployment docs that mention identity/host assumptions but omit secret or environment details
- PRIVATE: actual .env files, DB snapshots, staging endpoints, bridge secrets, token or operating details
- SECRET: any real credentials, bridge secret, session cookies, production domains, wallet or identity material
- UNKNOWN: final split between core app repo and decentralized POC repo

### Potential repo split

- core app repo: current CalorieApp product and tested app functionality
- identity and bridge repo: sensitive host-specific identity integration work
- decentralized POC repo: future prototype work, not part of the core app baseline
- node/infrastructure repo: optional community-node or infrastructure research

This should be determined after a governance review and not forced prematurely.

---

## V2.0 Baseline

### Recommended V2.0 checkpoint definition

The V2.0 baseline should include:

- a stable central CalorieApp app built around the current FastAPI + Next.js model
- validated backend tests and frontend lint/build passes
- clear separation between implemented features and research-only features
- documented identity flow with WordPress/Xaman bridge assumptions clearly labeled
- secure environment and secret handling policy
- documentation status that distinguishes current app from future ecosystem research
- archiving strategy for obsolete, duplicate or exploratory documents
- a clean public/private split for source, config, and infrastructure information

### What should remain outside the baseline

- IPFS/Helia implementation
- XRPL runtime and $CAL economics
- NFT implementation
- full provenance network architecture
- community validator and reward models
- any unproven ecosystem claims masquerading as implementation status

---

## Recommended Next Steps

1. Review this V2 checkpoint audit and classify all files as implemented / planned / future / research-only.
2. Back up the working repo and any local database files in a private location.
3. Separate secret-bearing local config from tracked source.
4. Document the true production/staging environment boundary for identity and session handling.
5. Consolidate overlapping docs and remove ambiguity between app docs and research docs.
6. Decide whether a license is needed and under what governance model.
7. Finalize a clean README and release status for the current app.
8. Create a formal V2.0 baseline branch or checkpoint after a controlled secret review.
9. Write a dedicated decentralized POC spec separate from the app baseline.
10. Research a governance plan for community-node and infrastructure roles without mixing them into the app baseline.

This section is advisory only and is not an execution step for this task.

---

## Risk Register

| Risk | Category | Evidence | Impact | Status |
|---|---|---|---|---|
| Local .env and DB files may be exposed by accident | Security | git status and ignored file output | High | Active |
| Future architecture documents may be mistaken for implemented functionality | Documentation | architecture docs + current repo code mismatch | High | Active |
| Staging identity and production identity may be conflated | Security/Identity | staging docs and docs/IDENTITY_FOUNDATION.md | High | Active |
| Repo is not clean and not release-ready | Operational | modified tracked files and untracked files | Medium | Active |
| Long-term ecosystem features are not yet separated from app baseline | Architecture | research docs vs current code | High | Active |
| Deps and warnings still need modernization hygiene | Technical debt | pytest warnings and datetime.utcnow() | Medium | Active |
| Public repo split is not yet decided | Governance | multiple doc sets and unclear prod/stage boundaries | Medium | Active |

---

## Final Conclusion

- REPO-EVIDENCE: the repository contains a working centralized application baseline and a large set of research and staging documents.
- REPO-EVIDENCE: the tested app is functional in the current developer environment.
- INFERENCE: the current state is better described as a V1 operational app plus active architecture research, not a finished V2 ecosystem implementation.
- RECOMMENDATION: the V2.0 checkpoint should be defined as the current working core app plus its validated identity flow and security boundaries, while future ecosystem capabilities stay explicitly research-only until they have their own governance and prototype validation.

V2 CHECKPOINT AUDIT COMPLETE
