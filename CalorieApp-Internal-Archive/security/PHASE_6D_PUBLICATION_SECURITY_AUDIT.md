# PHASE 6D PUBLICATION SECURITY AND EXPOSURE AUDIT

Status: READ-ONLY audit of current repository state.

Scope: C:\Users\p\CalorieApp

Authoritative rollback baseline: C:\Users\p\CalorieApp_PRIVATE_CHECKPOINT_6C2_2026-08-20

Database verification baseline: DATABASE CHECK: MATCH (previous phase)

## 1. Executive Summary

- CONFIRMED: The repository is not publication-safe as-is because it contains private runtime artifacts in the working tree, including local env files and SQLite databases.
- CONFIRMED: No committed live secret values were found in the inspected Git history; historical sensitive-path evidence only showed env templates.
- OBSERVED: Public and internal materials are currently mixed (public docs, internal staging docs, private archive/audit files, generated artifacts).
- INFERENCE: Publication should proceed only after a curated separation pass (without deleting private history), not by direct publication of the current workspace.
- RECOMMENDATION: Use a curated public subset, keep private archive material and local runtime artifacts out of public GitHub.

## 2. Baseline Git State

### Initial baseline capture

- Command: git -C C:\Users\p\CalorieApp status --short --branch
- Branch status: ## main...origin/main
- Tracked modified paths observed:
  - README.md
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
  - docs/architecture.md (deleted)
  - docs/roadmap.md (deleted)
  - frontend/.env.example
  - frontend/app/page.tsx
  - frontend/components/FoodSearchPlaceholder.tsx
- Untracked observed (not exhaustive excerpt):
  - PHASE_6A_STRUCTURE_REPORT.md
  - PHASE_6B_DOCUMENTATION_BOUNDARY.md
  - PHASE_6C1_DOCUMENTATION_REPORT.md
  - PHASE_6C2_PUBLIC_BOUNDARY_REPORT.md
  - PRESERVATION_PUBLIC_PRIVATE_PLAN.md
  - PRE_CHECKPOINT_CONSOLIDATION.md
  - REPOSITORY_CLEANUP_PROPOSAL.md
  - SECURITY_GIT_FORENSIC_AUDIT.md
  - SNAPSHOT_VERIFICATION_REPORT.md
  - V2_CHECKPOINT_AUDIT.md
  - V2_SECURITY_EXPOSURE_AUDIT.md
  - backend/.env.staging.example
  - backend/app/services/identity.py
  - backend/tests/test_identity.py
  - backend/tests/test_identity_endpoints.py
  - docs/IDENTITY_FOUNDATION.md
  - docs/STAGING_DEPLOYMENT_PLAN.md
  - docs/STAGING_XAMAN_TEST.md
  - docs/public/*
  - docs/research/*
  - frontend/.env.staging.example
  - frontend/app/auth/callback/page.tsx
  - frontend/components/XamanLoginPanel.tsx
  - run_search.py
  - scan_results.txt
  - scanner.py

### Additional baseline facts

- Command: git -C C:\Users\p\CalorieApp rev-parse HEAD
  - 1d16aced8b2c49d59f36fbc034856ebb45d539e4
- Command: git -C C:\Users\p\CalorieApp branch --show-current
  - main
- Command: git -C C:\Users\p\CalorieApp remote -v
  - origin https://github.com/CalorieToken/CalorieApp.git (fetch)
  - origin https://github.com/CalorieToken/CalorieApp.git (push)
- Command: git -C C:\Users\p\CalorieApp log --all --oneline --decorate -n 30
  - 1d16ace CalorieApp V1.2 - portion logging and nutrition summary
  - 5c259c1 Improve Open Food Facts integration and product cards
  - 941559c Initial CalorieApp MVP

## 3. Repository Inventory

Classification legend: PUBLIC, PUBLIC AFTER REDACTION, INTERNAL, PRIVATE, SECURITY-SENSITIVE, ARCHIVE, GENERATED, REMOVE BEFORE PUBLICATION, UNKNOWN.

### Root and hidden significant items

- .git/: INTERNAL
- .github/: INTERNAL
- .gitignore: INTERNAL
- .venv/: GENERATED
- .pytest_cache/: GENERATED
- backend/: PUBLIC AFTER REDACTION
- frontend/: PUBLIC AFTER REDACTION
- docs/public/: PUBLIC
- docs/research/: INTERNAL RESEARCH (or PUBLIC RESEARCH with boundary labels)
- docs/STAGING_DEPLOYMENT_PLAN.md: INTERNAL
- docs/STAGING_XAMAN_TEST.md: INTERNAL
- checkpoints/: ARCHIVE
- calorieapp.db: SECURITY-SENSITIVE
- release-check.ps1: INTERNAL
- test_api.py: INTERNAL
- PHASE_6A/6B/6C* reports and V2/security/checkpoint reports: ARCHIVE
- run_search.py: INTERNAL
- scanner.py: INTERNAL
- scan_results.txt: PRIVATE

### Directory-level classification

- backend/: PUBLIC AFTER REDACTION
- frontend/: PUBLIC AFTER REDACTION
- docs/public/: PUBLIC
- docs/research/: INTERNAL RESEARCH
- checkpoints/: PRIVATE ARCHIVE
- .github/: INTERNAL

## 4. Secret Exposure Audit

### Current working tree findings

- CONFIRMED: Secret-bearing keywords are present mostly in docs/code as variable names and architecture context, not as proven committed live credentials.
- OBSERVED: High hit count from scans is dominated by existing audit/report documents and staged identity docs.
- CONFIRMED sensitive runtime artifacts:
  - backend/.env (private runtime config; contains placeholder style values)
  - frontend/.env.local (local runtime config)
  - backend/calorieapp.db (live SQLite data)
  - calorieapp.db (root DB artifact, 0 bytes)

### Possible secret categories found (without values)

- WORDPRESS bridge shared secret variable references
- Session/cookie/auth-flow variable references
- Staging URL/endpoint topology references
- XRPL/Xaman identity integration references

### Redaction policy used in this report

- No secret values are printed.
- If secret-like material appears, category only is reported.

### Recommended action

- RECOMMENDATION: keep runtime env files and DB files private.
- RECOMMENDATION: keep internal staging identity topology out of public docs.

## 5. Environment Audit

### Inventory

- backend/.env -> PRIVATE, SECURITY-SENSITIVE (runtime config)
- backend/.env.example -> PUBLIC AFTER REDACTION (template)
- backend/.env.staging.example -> INTERNAL (staging topology template)
- frontend/.env.local -> PRIVATE (runtime config)
- frontend/.env.example -> PUBLIC (template)
- frontend/.env.staging.example -> INTERNAL (staging topology template)

### Exposure findings

- CONFIRMED: No live secret value was intentionally exposed in this audit output.
- OBSERVED: Hostnames and deployment patterns are present in template/internal docs.
- RECOMMENDATION: keep only sanitized templates in public repo, keep runtime env private.

## 6. Database Audit

### Inventory

- backend/calorieapp.db | 65536 bytes | SQLite | SECURITY-SENSITIVE | PRIVATE
- calorieapp.db | 0 bytes | file artifact | SECURITY-SENSITIVE (by class) | PRIVATE/REMOVE BEFORE PUBLICATION

### Required boundary

- CONFIRMED: backend/calorieapp.db must remain private.
- CONFIRMED: No database records were dumped in this audit.

## 7. Git History Audit

### Commands reviewed

- git log --all --stat
- git log --all --name-only
- git rev-list --objects --all
- targeted history filtering for .env/.db/secret/token/password/wallet/xaman/xumm

### Evidence

- CONFIRMED: History-path matches showed backend/.env.example and frontend/.env.example.
- CONFIRMED: No committed .env, .env.local, .db, .sqlite, or .sqlite3 files were found in the inspected object history output.
- UNKNOWN: Full forensic guarantee across every local ref/stash not explicitly expanded beyond the commands above.

### Assessment

- INFERENCE: No direct evidence currently indicates committed live secrets.

## 8. Infrastructure Exposure

### Observed endpoint/topology references

- localhost:3000, 127.0.0.1:8000 -> PUBLIC DEVELOPMENT
- app.calorietoken.net -> UNKNOWN / possibly PRODUCTION reference
- calorietoken.net -> UNKNOWN / operational external host reference
- staging-app.calorietoken.net -> STAGING
- staging-api.calorietoken.net -> STAGING
- staging-wp.calorietoken.net -> STAGING
- Vercel/Railway/Render mentions -> PUBLIC DOCUMENTATION + INTERNAL TOPOLOGY CONTEXT

### Risk

- CONFIRMED: Internal/staging topology is discoverable from docs and internal reports.
- RECOMMENDATION: generalize hostnames for public publication where they expose operational topology.

## 9. Authentication/Identity Exposure

Reviewed targets:

- backend/app/services/identity.py
- backend/app/main.py
- backend/app/models.py
- backend/app/schemas.py
- backend/tests/* identity tests
- frontend/app/auth/callback/page.tsx
- frontend/components/XamanLoginPanel.tsx
- docs/public/identity.md
- docs/IDENTITY_FOUNDATION.md

### Findings

- CONFIRMED: Callback/state/session architecture is implemented and test-covered.
- OBSERVED: Operational bridge details are documented in internal identity/staging docs.
- CONFIRMED: Session cookie, pending login state, authorization code, and identity mapping models are present.
- CONFIRMED: Identity docs contain callback and bridge-path detail that is more operational than public-overview level.

### Classification

- Public-safe: high-level identity overview (docs/public/identity.md)
- Internal: detailed identity foundation + staging tests and bridge topology docs

## 10. Staging Exposure

Reviewed targets:

- docs/STAGING_DEPLOYMENT_PLAN.md
- docs/STAGING_XAMAN_TEST.md
- backend/.env.staging.example
- frontend/.env.staging.example
- deployment docs references

### Findings

- CONFIRMED: Staging domains, bridge endpoints, and procedural runbooks are explicitly documented.
- INFERENCE: This reveals operational topology and should remain internal until deliberately sanitized.

### Classification

- docs/STAGING_DEPLOYMENT_PLAN.md -> INTERNAL
- docs/STAGING_XAMAN_TEST.md -> INTERNAL
- backend/.env.staging.example -> INTERNAL
- frontend/.env.staging.example -> INTERNAL

## 11. Public Documentation Audit

Reviewed targets:

- README.md
- docs/public/architecture.md
- docs/public/roadmap.md
- docs/public/deployment.md
- docs/public/release-readiness.md
- docs/public/identity.md

### Issue severity by document

- README.md -> LOW
  - OBSERVED: Good implemented-vs-future boundary labeling; includes external host references in development examples only.
- docs/public/architecture.md -> NONE
  - CONFIRMED: Avoids overclaiming implementation; keeps non-financial boundary clear.
- docs/public/roadmap.md -> LOW
  - OBSERVED: Future concepts are labeled; residual risk is reader misinterpretation of broad ecosystem terms.
- docs/public/deployment.md -> LOW
  - OBSERVED: Generally generalized; no secret values exposed.
- docs/public/release-readiness.md -> NONE
  - CONFIRMED: Clear release gate framing and boundaries.
- docs/public/identity.md -> NONE
  - CONFIRMED: High-level summary without sensitive operational detail.

### Overclaim review

- CONFIRMED: No explicit treasury/issuer/runtime financial claims were found in public docs as implemented facts.

## 12. Research Documentation Audit

Reviewed:

- docs/research/CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- docs/research/DECENTRALIZED_ARCHITECTURE_V1.md
- docs/research/NATIVE_PLATFORM_ARCHITECTURE_V1.md

### Findings

- OBSERVED: These files include broad future architecture, governance, and infrastructure concepts.
- OBSERVED: They include external operational references and ecosystem-level claims as research framing.
- INFERENCE: Public release of research docs is possible only with explicit framing and possibly redaction for operational details.

### Classification

- docs/research/CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md -> INTERNAL RESEARCH (or PUBLIC RESEARCH with strict disclaimer)
- docs/research/DECENTRALIZED_ARCHITECTURE_V1.md -> INTERNAL RESEARCH
- docs/research/NATIVE_PLATFORM_ARCHITECTURE_V1.md -> INTERNAL RESEARCH

## 13. XRPL/CAL Audit

### Search coverage

Terms reviewed: XRPL, CAL, issuer, blackhole, treasury, wallet, trustline, NFT, transaction hash, ledger, validator, node, reward, incentive, governance.

### Findings

- CONFIRMED implemented functionality in this repo:
  - Identity-related xrpl_address field usage in auth models and claims
  - No active token, treasury, wallet-custody, validator, or payment runtime
- OBSERVED documented future functionality:
  - extensive research narratives around XRPL/CAL/NFT/governance
- UNKNOWN:
  - issuer status, treasury percentages, supply claims, reward mechanism reality outside current V1 app

### Risk

- INFERENCE: Misinterpretation risk exists if research docs are published without clear non-implementation disclaimers.

## 14. Privacy/Personal Data Audit

### Findings

- CONFIRMED: No obvious personal email/phone data was found in tracked source/docs scans (excluding local data stores).
- OBSERVED: backend/calorieapp.db likely contains user-linked records by schema design.
- CONFIRMED: This report does not print personal records.

### Handling recommendation

- backend/calorieapp.db -> PRIVATE ARCHIVE only
- any local runtime identity artifacts -> PRIVATE

## 15. Dependency/License Audit

### Dependency manifests present

- backend/requirements.txt -> present
- frontend/package.json -> present
- frontend/package-lock.json -> present

### License

- CONFIRMED: No root LICENSE file was found by inventory query.
- OBSERVED: package-lock includes many third-party package licenses in dependency metadata, but no project-level repository license file is present.

### Recommendation

- RECOMMENDATION: add explicit project license before public publication (human/legal decision required).

## 16. Gitignore Audit

Reviewed:

- .gitignore
- backend/.gitignore
- frontend/.gitignore (not present)

### Coverage findings

- CONFIRMED protected patterns in root/backend gitignore:
  - .env (backend/.gitignore)
  - .env.local
  - *.db, *.sqlite, *.sqlite3
  - .venv
  - __pycache__
  - .pytest_cache
  - frontend/node_modules
  - frontend/.next

### Gaps

- OBSERVED: frontend/.gitignore file is absent; coverage currently relies on root .gitignore.
- OBSERVED: root .gitignore does not explicitly include generic logs/temp patterns (e.g., *.log, tmp) though many major generated dirs are covered.

## 17. Generated Artifact Audit

### Detected generated artifacts

- .venv -> GENERATED / REMOVE BEFORE PUBLICATION
- frontend/node_modules -> GENERATED / REMOVE BEFORE PUBLICATION
- frontend/.next -> GENERATED / REMOVE BEFORE PUBLICATION
- .pytest_cache and backend/.pytest_cache -> GENERATED / REMOVE BEFORE PUBLICATION
- __pycache__ trees -> GENERATED / REMOVE BEFORE PUBLICATION

### Classification summary

- KEEP PRIVATE ARCHIVE: optional if exact forensic snapshot needed
- REGENERABLE: yes
- REMOVE BEFORE PUBLICATION: yes

## 18. Checkpoint/Archive Classification

Requested items classification:

- PRE_CHECKPOINT_CONSOLIDATION.md -> PRIVATE ARCHIVE
- SECURITY_GIT_FORENSIC_AUDIT.md -> PRIVATE ARCHIVE
- PRESERVATION_PUBLIC_PRIVATE_PLAN.md -> PRIVATE ARCHIVE
- REPOSITORY_CLEANUP_PROPOSAL.md -> PRIVATE ARCHIVE
- SNAPSHOT_VERIFICATION_REPORT.md -> PRIVATE ARCHIVE
- V2_CHECKPOINT_AUDIT.md -> PRIVATE ARCHIVE
- V2_SECURITY_EXPOSURE_AUDIT.md -> PRIVATE ARCHIVE
- PHASE_6A_STRUCTURE_REPORT.md -> PRIVATE ARCHIVE
- PHASE_6B_DOCUMENTATION_BOUNDARY.md -> PRIVATE ARCHIVE
- PHASE_6C1_DOCUMENTATION_REPORT.md -> PRIVATE ARCHIVE
- PHASE_6C2_PUBLIC_BOUNDARY_REPORT.md -> PRIVATE ARCHIVE
- checkpoints/ -> PRIVATE ARCHIVE

## 19. Publication Blockers

### CRITICAL BLOCKERS

- backend/calorieapp.db
  - Reason: live local database, user-linked data risk
  - Classification: SECURITY-SENSITIVE, PRIVATE
  - Recommended future action: exclude from public repo content set
- backend/.env and frontend/.env.local
  - Reason: runtime environment files
  - Classification: PRIVATE, SECURITY-SENSITIVE
  - Recommended future action: keep private, template-only public strategy

### HIGH PRIORITY

- Internal staging docs and staging env templates (docs/STAGING_*, backend/.env.staging.example, frontend/.env.staging.example)
  - Reason: operational topology exposure
  - Classification: INTERNAL
  - Recommended future action: keep internal or heavily sanitize before publication
- Mixed archive/security reports in root
  - Reason: disclose internal security process and private operational context
  - Classification: PRIVATE ARCHIVE
  - Recommended future action: keep private archive repository only

### MEDIUM PRIORITY

- Research docs with broad XRPL/CAL/governance content
  - Reason: misinterpretation as implemented capability
  - Classification: INTERNAL RESEARCH / PUBLIC AFTER REDACTION
  - Recommended future action: publish only with strict disclaimers or keep internal
- Missing project-level LICENSE
  - Reason: publication/legal ambiguity
  - Classification: UNKNOWN / HUMAN DECISION
  - Recommended future action: choose and add license before publication

### LOW PRIORITY

- Generated artifacts present locally (.venv, .next, node_modules, caches)
  - Reason: repository hygiene and accidental publication risk
  - Classification: GENERATED
  - Recommended future action: exclude from curated public set

### NO BLOCKER

- Public docs under docs/public generally maintain non-overclaim boundary

## 20. Proposed Public Repository Contents

### KEEP PUBLIC

- frontend/app (excluding private/internal variants)
- frontend/components core food UI components
- frontend/public assets
- backend/app core API (food + auth codebase after review)
- backend/tests core tests after review
- backend/requirements.txt
- frontend/package.json
- frontend/package-lock.json
- docs/public/*
- README.md

### KEEP PUBLIC AFTER REDACTION

- backend/app/main.py (operational defaults review)
- backend/app/services/identity.py (bridge details review)
- docs/CLOUD_DEPLOYMENT.md (generalize topology)
- docs/deployment-readiness-checklist.md (reduce provider-specific operational detail)
- docs/research/* (if released, require explicit research-only framing and possible topology redaction)

### KEEP INTERNAL

- docs/STAGING_DEPLOYMENT_PLAN.md
- docs/STAGING_XAMAN_TEST.md
- backend/.env.staging.example
- frontend/.env.staging.example
- .github/copilot-instructions.md
- release-check.ps1
- backend/dev_health_check.py

### KEEP PRIVATE ARCHIVE

- checkpoints/
- all PHASE_* and V2_* audit/checkpoint reports listed above
- PRE_CHECKPOINT_CONSOLIDATION.md
- PRESERVATION_PUBLIC_PRIVATE_PLAN.md
- REPOSITORY_CLEANUP_PROPOSAL.md
- SECURITY_GIT_FORENSIC_AUDIT.md
- SNAPSHOT_VERIFICATION_REPORT.md

### REMOVE BEFORE PUBLICATION

- .venv/
- frontend/node_modules/
- frontend/.next/
- __pycache__/
- .pytest_cache/
- backend/.pytest_cache/
- run_search.py
- scanner.py
- scan_results.txt
- calorieapp.db
- backend/calorieapp.db
- backend/.env
- frontend/.env.local

### UNKNOWN / HUMAN DECISION

- Exact subset of docs/research to publish
- Final scope of identity implementation details for public consumption
- Repository-level license selection

## 21. History Rewrite Decision

NO HISTORY REWRITE CURRENTLY REQUIRED

Basis:

- CONFIRMED: inspected history/object evidence showed env templates but no committed live .env/.db artifacts.
- UNKNOWN caveat: if later deep forensic scanning finds committed secrets, decision must be revisited.

## 22. Security Risk Register

| Risk | Severity | Evidence | Affected path | Recommended future action |
|---|---|---|---|---|
| Local runtime DB exposure | CRITICAL | DB inventory includes backend/calorieapp.db (65536) | backend/calorieapp.db | Keep private, exclude from curated public repo |
| Runtime env exposure | CRITICAL | Env inventory includes backend/.env and frontend/.env.local | backend/.env, frontend/.env.local | Keep private, publish template-only config |
| Staging topology disclosure | HIGH | Staging docs and templates include host/bridge structure | docs/STAGING_DEPLOYMENT_PLAN.md, docs/STAGING_XAMAN_TEST.md, *.env.staging.example | Keep internal or sanitize heavily |
| Mixed private archive docs in root | HIGH | Numerous audit/checkpoint docs present and untracked | PHASE_*, V2_*, PRE_*, SECURITY_*, SNAPSHOT_* | Move to private archive strategy before public publishing |
| Research misinterpretation risk | MEDIUM | Research docs include broad XRPL/CAL/governance futures | docs/research/* | Publish only with explicit research-only framing |
| Missing project license | MEDIUM | No LICENSE file found | repository root | Add explicit license via human/legal choice |
| Generated artifact accidental inclusion | LOW | .venv/.next/node_modules/caches present | generated directories | Exclude from publication package |

## 23. Recommended Next Phase

Safest next phase sequence (do not execute in this phase):

1. Public/private file separation
2. Secret remediation policy enforcement for runtime artifacts
3. Generated-artifact cleanup in publication branch/worktree
4. Documentation-only cleanup (public docs + research disclaimers)
5. License preparation
6. Source-code publication review
7. Optional history re-review only if new evidence appears

## 24. Final Verdict

- CONFIRMED: Current repository state is not safe for direct public publication.
- CONFIRMED: Authoritative private rollback baseline exists and database parity was previously validated.
- INFERENCE: A curated publication workflow is required before public GitHub release.
- RECOMMENDATION: proceed with a controlled publication-prep phase, not direct publication.

PHASE 6D PUBLICATION SECURITY AUDIT COMPLETE
