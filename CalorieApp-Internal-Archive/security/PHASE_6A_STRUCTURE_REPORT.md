# CalorieApp Phase 6A Structure Report

Status: Non-destructive public/internal/research structural organization.

## 1. Starting repository state

- Repository branch state at start: main tracking origin/main.
- The working tree was already dirty before Phase 6A and contained:
  - Modified tracked backend/frontend files.
  - Untracked architecture, audit, and identity/staging files.
- Key pre-change status excerpt:
  - M backend/.env.example
  - M backend/.gitignore
  - M backend/app/database.py
  - M backend/app/main.py
  - M backend/app/models.py
  - M backend/app/schemas.py
  - M backend/dev_health_check.py
  - M backend/start-backend.ps1
  - M backend/tests/conftest.py
  - M backend/tests/test_endpoints.py
  - M frontend/.env.example
  - M frontend/app/page.tsx
  - M frontend/components/FoodSearchPlaceholder.tsx
  - ?? CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
  - ?? DECENTRALIZED_ARCHITECTURE_V1.md
  - ?? NATIVE_PLATFORM_ARCHITECTURE_V1.md
  - plus existing untracked audit/planning and identity/staging files.

## 2. Directories created

- docs/public
- docs/research

## 3. Files moved

Moved to public documentation structure:

- docs/architecture.md -> docs/public/architecture.md
- docs/roadmap.md -> docs/public/roadmap.md

Moved to research documentation structure:

- CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md -> docs/research/CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- DECENTRALIZED_ARCHITECTURE_V1.md -> docs/research/DECENTRALIZED_ARCHITECTURE_V1.md
- NATIVE_PLATFORM_ARCHITECTURE_V1.md -> docs/research/NATIVE_PLATFORM_ARCHITECTURE_V1.md

No document content edits were performed during these moves.

## 4. Files intentionally left untouched

Internal/security/checkpoint records intentionally not moved or edited:

- PRE_CHECKPOINT_CONSOLIDATION.md
- SECURITY_GIT_FORENSIC_AUDIT.md
- PRESERVATION_PUBLIC_PRIVATE_PLAN.md
- SNAPSHOT_VERIFICATION_REPORT.md
- V2_CHECKPOINT_AUDIT.md
- V2_SECURITY_EXPOSURE_AUDIT.md
- docs/STAGING_DEPLOYMENT_PLAN.md
- docs/STAGING_XAMAN_TEST.md
- docs/IDENTITY_FOUNDATION.md
- checkpoints/ (all checkpoint material)

Also intentionally untouched in this phase:

- backend and frontend source trees
- package/config dependency files
- .gitignore content
- generated artifacts and caches

## 5. Research preserved

Future architecture research was preserved and explicitly separated from current implementation by relocating research docs into docs/research.

Preserved topics include:

- CalorieDB
- IPFS and Helia
- XRPL correlation concepts
- CAL ecosystem concepts
- NFTs and provenance
- production/distribution/wholesale/retail traceability concepts
- biological/laboratory traceability concepts
- native Android/iOS/Windows/macOS/Linux research
- community node and validator concepts
- treasury/incentive/governance research

No research document was deleted.

## 6. Private/internal material preserved

Internal and operational material remains preserved in place.

- Staging operational documents remained in docs/.
- Security/audit/checkpoint history documents remained at current safe locations.
- No attempt was made to move private/internal material outside the repository in this phase.

## 7. Database preservation

Databases were not touched.

- backend/calorieapp.db: untouched
- calorieapp.db: untouched

No move, rename, delete, content inspection, or modification was performed.

## 8. Environment preservation

Environment files were not touched.

- backend/.env: untouched
- frontend/.env.local: untouched

No values were printed or changed.

## 9. Source-code preservation

No backend or frontend source-code restructuring was performed.

- No route changes
- No model/auth changes
- No UI behavior changes
- No dependency changes

Only documentation-structure moves were executed.

## 10. Git status before

Recorded command:

- git -C C:\Users\p\CalorieApp status --short --branch

Recorded output:

- ## main...origin/main
- M backend/.env.example
- M backend/.gitignore
- M backend/app/database.py
- M backend/app/main.py
- M backend/app/models.py
- M backend/app/schemas.py
- M backend/dev_health_check.py
- M backend/start-backend.ps1
- M backend/tests/conftest.py
- M backend/tests/test_endpoints.py
- M frontend/.env.example
- M frontend/app/page.tsx
- M frontend/components/FoodSearchPlaceholder.tsx
- ?? CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- ?? DECENTRALIZED_ARCHITECTURE_V1.md
- ?? NATIVE_PLATFORM_ARCHITECTURE_V1.md
- ?? PRESERVATION_PUBLIC_PRIVATE_PLAN.md
- ?? PRE_CHECKPOINT_CONSOLIDATION.md
- ?? REPOSITORY_CLEANUP_PROPOSAL.md
- ?? SECURITY_GIT_FORENSIC_AUDIT.md
- ?? SNAPSHOT_VERIFICATION_REPORT.md
- ?? V2_CHECKPOINT_AUDIT.md
- ?? V2_SECURITY_EXPOSURE_AUDIT.md
- ?? backend/.env.staging.example
- ?? backend/app/services/identity.py
- ?? backend/tests/test_identity.py
- ?? backend/tests/test_identity_endpoints.py
- ?? docs/IDENTITY_FOUNDATION.md
- ?? docs/STAGING_DEPLOYMENT_PLAN.md
- ?? docs/STAGING_XAMAN_TEST.md
- ?? frontend/.env.staging.example
- ?? frontend/app/auth/
- ?? frontend/components/XamanLoginPanel.tsx

## 11. Git status after

Recorded command:

- git -C C:\Users\p\CalorieApp status --short --branch

Recorded output:

- ## main...origin/main
- M backend/.env.example
- M backend/.gitignore
- M backend/app/database.py
- M backend/app/main.py
- M backend/app/models.py
- M backend/app/schemas.py
- M backend/dev_health_check.py
- M backend/start-backend.ps1
- M backend/tests/conftest.py
- M backend/tests/test_endpoints.py
- D docs/architecture.md
- D docs/roadmap.md
- M frontend/.env.example
- M frontend/app/page.tsx
- M frontend/components/FoodSearchPlaceholder.tsx
- ?? PRESERVATION_PUBLIC_PRIVATE_PLAN.md
- ?? PRE_CHECKPOINT_CONSOLIDATION.md
- ?? REPOSITORY_CLEANUP_PROPOSAL.md
- ?? SECURITY_GIT_FORENSIC_AUDIT.md
- ?? SNAPSHOT_VERIFICATION_REPORT.md
- ?? V2_CHECKPOINT_AUDIT.md
- ?? V2_SECURITY_EXPOSURE_AUDIT.md
- ?? backend/.env.staging.example
- ?? backend/app/services/identity.py
- ?? backend/tests/test_identity.py
- ?? backend/tests/test_identity_endpoints.py
- ?? docs/IDENTITY_FOUNDATION.md
- ?? docs/STAGING_DEPLOYMENT_PLAN.md
- ?? docs/STAGING_XAMAN_TEST.md
- ?? docs/public/
- ?? docs/research/
- ?? frontend/.env.staging.example
- ?? frontend/app/auth/
- ?? frontend/components/XamanLoginPanel.tsx

Interpretation:

- The only intentional structural deltas from this phase are the documentation moves and new directories.
- Existing pre-phase modifications remained as they were.

## 12. Test results

Validation suite executed after structural moves:

- Backend tests: passed
  - Command: .venv\Scripts\pytest backend
  - Result: 97 passed, 234 warnings, no failures.
- Frontend lint: passed
  - Command: npm run lint (in frontend)
  - Result: no ESLint warnings or errors.
- Frontend build: passed
  - Command: npm run build (in frontend)
  - Result: Next.js production build compiled successfully.

No behavioral regressions were observed from this structural phase.

## 13. Any broken references discovered

Potential broken reference class discovered:

- Internal/audit/planning documents still contain references to old paths:
  - docs/architecture.md
  - docs/roadmap.md
  - top-level research file names now moved into docs/research.

Scope note:

- These references are inside internal/private history and audit documents that were intentionally left untouched in this phase.
- No public runtime behavior is affected.

## 14. Any uncertainty

- Uncertainty 1: Whether docs/CLOUD_DEPLOYMENT.md and docs/deployment-readiness-checklist.md should move into docs/public now or in a later phase after redaction.
- Uncertainty 2: Whether docs/IDENTITY_FOUNDATION.md should eventually be internal-only or partially public after operational redaction.
- Uncertainty 3: Whether any internal historical documents should eventually be moved out of the repository into a separate private mirror versus kept in-repo but unshared.

These were intentionally not resolved in Phase 6A to avoid overreaching beyond the approved structural scope.

## 15. Recommended next phase

Recommended next phase: Phase 6B public-surface curation (still conservative).

Suggested scope for Phase 6B:

1. Decide final public doc set under docs/public.
2. Decide internal/private-in-repo vs private-out-of-repo handling for security/audit/checkpoint docs.
3. Perform targeted reference-path updates for moved docs.
4. Keep source code behavior unchanged.
5. Keep databases and env files untouched.
6. Prepare for a dedicated README/ROADMAP modernization pass.
