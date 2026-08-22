# CALORIEAPP PHASE 2 PRESERVATION & PUBLIC / PRIVATE PLAN

Status: Read-only planning pass. No cleanup executed. No files moved, deleted, renamed, or edited.

This plan is based on the current repository state, the pre-checkpoint consolidation, and the security / git forensic audit.

---

## Executive Summary

- CONFIRMED: The repository is currently a mixed workspace containing public-facing product code, internal/staging documentation, research architecture, ignored local runtime artifacts, and private development state.
- CONFIRMED: The current live working tree is not safe to publish as-is.
- CONFIRMED: The repository contains valuable implementation history that must be preserved before any cleanup.
- CONFIRMED: The future ecosystem research is not disposable; it is part of the project record and should be preserved in a private archive, even if only some of it later becomes public-facing.
- INFERENCE: The safest path is a two-tier preservation model: a private checkpoint archive that captures the complete current development state, and a public repository that is intentionally curated from that archive.
- INFERENCE: Cleanup should happen only after the private archive exists and the public/private boundary is agreed by humans.

---

## Preservation Principles

1. Preserve the current development state first, before any cleanup.
2. Separate public product material from private operational material.
3. Treat ignored local artifacts as real state until they are safely archived.
4. Preserve research architecture as history, not as implementation.
5. Do not delete architecture ideas simply because they are future-facing.
6. Keep private operational information out of the public repository until verified and redacted.
7. Keep public docs high-level and non-operational.
8. Prefer redaction and separation over erasure.
9. Preserve the ability to reproduce the current workspace privately.
10. Do not assume ignored files are harmless; classify them explicitly.

---

## Complete Classification Matrix

| Path / Group | Classification | Archive / Public Intent | Notes |
|---|---|---|---|
| `README.md` | PUBLIC | Public repo | Core product summary and V1 scope boundary. |
| `docs/architecture.md` | PUBLIC | Public repo | High-level V1 architecture. |
| `docs/roadmap.md` | PUBLIC | Public repo | Current narrow roadmap. |
| `backend/app/` | PUBLIC WITH REDACTION | Public repo after review | Core backend source, but contains hostname, bridge, and auth assumptions. |
| `backend/tests/` | PUBLIC WITH REDACTION | Public repo after review | Tests encode auth and bridge assumptions; keep but review for operational specificity. |
| `backend/requirements.txt` | PUBLIC | Public repo | Dependency manifest. |
| `backend/README.md` | PUBLIC | Public repo | Backend V1 scope description. |
| `frontend/app/` | PUBLIC WITH REDACTION | Public repo after review | Core UI and callback flow. |
| `frontend/components/` | PUBLIC WITH REDACTION | Public repo after review | UI logic includes auth and redirect handling. |
| `frontend/public/` | PUBLIC | Public repo | Static assets. |
| `frontend/package.json` | PUBLIC | Public repo | Frontend dependency manifest. |
| `frontend/package-lock.json` | PUBLIC | Public repo | Lockfile, but should be reviewed for license and dependency policy. |
| `frontend/tsconfig.json`, `frontend/tailwind.config.ts`, `frontend/postcss.config.js`, `frontend/next.config.js` | PUBLIC | Public repo | Build configuration. |
| `backend/app/services/open_food_facts.py` | PUBLIC | Public repo | External API integration consistent with V1 scope. |
| `backend/app/services/identity.py` | PUBLIC WITH REDACTION | Public repo after review | Auth logic is valid to publish, but operational bridge details should be reviewed carefully. |
| `backend/app/main.py` | PUBLIC WITH REDACTION | Public repo after review | Contains bridge URL defaults, cookie settings, and auth flow. |
| `backend/app/models.py` | PUBLIC WITH REDACTION | Public repo after review | Data model is useful, but identity/session tables and local DB assumptions are sensitive. |
| `backend/app/schemas.py` | PUBLIC WITH REDACTION | Public repo after review | Contains auth payload shapes and bridge response contracts. |
| `backend/app/database.py` | PUBLIC WITH REDACTION | Public repo after review | SQLite initialization and local DB path assumptions. |
| `backend/dev_health_check.py` | INTERNAL | Private/internal archive | Development-only diagnostics. |
| `backend/start-backend.ps1` | INTERNAL | Private/internal archive | Operational helper script. |
| `release-check.ps1` | INTERNAL | Private/internal archive | CI-like local gate helper. |
| `test_api.py` | INTERNAL | Private/internal archive | Legacy/manual smoke test. |
| `backend/test_post.py` | ARCHIVE | Private archive | Legacy/manual test artifact. |
| `checkpoints/` | ARCHIVE | Private archive | Historical checkpoints should be preserved privately. |
| `V2_CHECKPOINT_AUDIT.md` | ARCHIVE | Private archive | Internal forensic checkpoint record. |
| `V2_SECURITY_EXPOSURE_AUDIT.md` | ARCHIVE | Private archive | Internal security history record. |
| `PRE_CHECKPOINT_CONSOLIDATION.md` | ARCHIVE | Private archive | Internal consolidation record and project memory. |
| `SECURITY_GIT_FORENSIC_AUDIT.md` | ARCHIVE | Private archive | Internal security/history audit record. |
| `CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md` | PUBLIC WITH REDACTION | Public research after review | Valuable architecture history, but contains operational and governance details. |
| `DECENTRALIZED_ARCHITECTURE_V1.md` | PUBLIC WITH REDACTION | Public research after review | Valuable architecture history, but contains future infrastructure details. |
| `NATIVE_PLATFORM_ARCHITECTURE_V1.md` | PUBLIC WITH REDACTION | Public research after review | Valuable architecture history, but contains future platform/infrastructure details. |
| `docs/IDENTITY_FOUNDATION.md` | PUBLIC WITH REDACTION | Public after review | Contains hostnames, callback paths, and bridge contract detail. |
| `docs/STAGING_DEPLOYMENT_PLAN.md` | INTERNAL | Private/internal archive | Strongly operational and topology-revealing. |
| `docs/STAGING_XAMAN_TEST.md` | INTERNAL | Private/internal archive | Strongly operational and security-sensitive. |
| `docs/CLOUD_DEPLOYMENT.md` | PUBLIC WITH REDACTION | Public after review | Can be published with operational details generalized. |
| `docs/deployment-readiness-checklist.md` | PUBLIC WITH REDACTION | Public after review | Useful public checklist, but some platform details need redaction. |
| `backend/.env.example` | PUBLIC WITH REDACTION | Public repo after review | Template, but it exposes operational names and example values. |
| `frontend/.env.example` | PUBLIC WITH REDACTION | Public repo after review | Template, but it exposes public frontend config shape. |
| `backend/.env.staging.example` | INTERNAL | Private/internal archive | Staging template with operational topology. |
| `frontend/.env.staging.example` | INTERNAL | Private/internal archive | Staging template with operational topology. |
| `backend/.env` | PRIVATE | Private archive only | Local runtime config. Must not enter public repo. |
| `frontend/.env.local` | PRIVATE | Private archive only | Local runtime config. Must not enter public repo. |
| `backend/calorieapp.db` | SECURITY-SENSITIVE | Private archive only | SQLite file with identity/session/data records. Must preserve before cleanup. |
| `calorieapp.db` | ARCHIVE / SAFE TO REMOVE AFTER BACKUP | Private archive only if needed | Zero-byte file; not SQLite. Preserve only if human wants a forensic copy. |
| `frontend/.next/` | ARCHIVE | Private archive only if exact workspace snapshot is needed | Build output, not source-of-truth. |
| `frontend/node_modules/` | ARCHIVE | Private archive only if exact workspace snapshot is needed | Regenerable dependency tree. |
| `.venv/` | ARCHIVE | Private archive only if exact workspace snapshot is needed | Local Python environment. |
| `backend/__pycache__/`, `backend/app/__pycache__/`, `backend/tests/__pycache__/` | ARCHIVE | Private archive only if exact workspace snapshot is needed | Bytecode caches. |
| `.github/copilot-instructions.md` | INTERNAL | Private/internal archive | Governance/instruction file for the coding environment. |

### Overall classification summary

- PUBLIC: core product summary and generalized architecture.
- PUBLIC WITH REDACTION: current source code and future ecosystem research that can be shared after removing operational details.
- INTERNAL: staging, deployment, and operational planning material.
- PRIVATE: local env and runtime files.
- SECURITY-SENSITIVE: local databases, bridge secrets, and any wallet/treasury material.
- ARCHIVE: checkpoints, audits, caches, and current workspace-only artifacts that should remain preserved privately.
- UNKNOWN: any live infrastructure or legal decisions not independently verified.

---

## Database Preservation Plan

### Database 1: `backend/calorieapp.db`

- Size: `65536` bytes.
- Modification date: `2026-08-20 07:26:21`.
- SQLite header: yes.
- Tables found:
  - `authorizationcode`
  - `calorieappuser`
  - `externalidentity`
  - `food_log`
  - `pendingloginstate`
- Row counts observed:
  - `authorizationcode`: `0`
  - `calorieappuser`: `16`
  - `externalidentity`: `2`
  - `food_log`: `22`
  - `pendingloginstate`: `2`
- Record characteristics:
  - CONFIRMED: contains identity/authentication tables.
  - CONFIRMED: contains food log data.
  - CONFIRMED: contains development/runtime state, not a blank schema.
  - UNKNOWN: actual personal records were not dumped, but the schema and counts show sensitive application data is present.

Preservation decision: MUST PRESERVE.

Reason:
- This is the current live development database and contains identity-linked and app-state records.
- It is likely needed to preserve the present working state before any cleanup or migration.
- It must be copied into the private checkpoint archive before any deletion or rotation.

### Database 2: `calorieapp.db`

- Size: `0` bytes.
- Modification date: `2026-08-20 02:13:27`.
- SQLite header: no.
- Tables found: none.
- Records found: none.
- Identity/authentication data: none observed.
- Personal data: none observed.

Preservation decision: SAFE TO DELETE AFTER BACKUP.

Reason:
- This file is empty and not a valid SQLite database in the current scan.
- If a forensic copy is desired, it can be archived, but it does not appear necessary for preserving working state.
- It should not be kept in any public repository package.

### Database preservation rule

- Preserve `backend/calorieapp.db` privately before any cleanup.
- Treat `calorieapp.db` as disposable after backup unless a human decides to keep it for symmetry or audit reasons.
- Do not expose or dump record contents in public artifacts.

---

## Environment Preservation Plan

### `backend/.env`

- Observed content: placeholder-only local runtime config.
- Secret status: no live secret value was observed in the current read.
- Unique local configuration: yes, including local WordPress bridge placeholders, client ID, login lifetime, and secure-cookie toggle.
- Needed to reproduce current development environment: yes, at least as a private local config reference.

Classification: PRIVATE ARCHIVE.

Notes:
- This file should be preserved in the private archive because it captures the current local development setup.
- It should not be part of the public repository.

### `frontend/.env.local`

- Observed content: `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`.
- Secret status: no secret observed in the current read.
- Unique local configuration: yes, it records the current local backend target.
- Needed to reproduce current development environment: yes.

Classification: PRIVATE ARCHIVE.

Notes:
- Not secret, but still local runtime state.
- Keep it in the private archive if exact workspace preservation is desired.

### `backend/.env.example`

- Observed content: template with local and cloud-style examples, including WordPress bridge names and example hostnames.
- Secret status: placeholder only.
- Unique local configuration: no, but it encodes operational assumptions.
- Needed to reproduce current development environment: partially, as a template.

Classification: PUBLIC WITH REDACTION.

### `frontend/.env.example`

- Observed content: simple frontend backend URL example.
- Secret status: placeholder only.
- Unique local configuration: no.
- Needed to reproduce current development environment: yes, as a template.

Classification: PUBLIC WITH REDACTION.

### `backend/.env.staging.example`

- Observed content: staging topology and bridge names.
- Secret status: placeholder only.
- Unique local configuration: no.
- Needed to reproduce current development environment: staging reference only.

Classification: INTERNAL.

### `frontend/.env.staging.example`

- Observed content: staging API URL example.
- Secret status: placeholder only.
- Unique local configuration: no.

Classification: INTERNAL.

### Other `.env` files

- No additional root `.env` file was identified in the current scan.
- No evidence of committed secret-bearing env files was found in history during the prior audit.

---

## Source Code Classification

### Public source candidates

- `backend/app/`
- `frontend/app/`
- `frontend/components/`
- `backend/tests/`
- `backend/requirements.txt`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/public/`
- `README.md`
- `backend/README.md`
- `docs/architecture.md`
- `docs/roadmap.md`

### Source that should remain public but redacted or reviewed

- `backend/app/main.py`
- `backend/app/database.py`
- `backend/app/models.py`
- `backend/app/schemas.py`
- `backend/app/services/identity.py`
- `backend/app/services/open_food_facts.py`
- `frontend/app/page.tsx`
- `frontend/app/auth/callback/page.tsx`
- `frontend/components/XamanLoginPanel.tsx`
- `frontend/components/FoodSearchPlaceholder.tsx`
- `backend/tests/test_identity.py`
- `backend/tests/test_identity_endpoints.py`
- `backend/tests/conftest.py`

### Internal development source

- `backend/dev_health_check.py`
- `backend/start-backend.ps1`
- `release-check.ps1`
- `test_api.py`
- `backend/test_post.py`

### Source classification summary

- The core application source can be public, but several files should be reviewed for hostnames, bridge paths, and operational assumptions before publication.
- Internal helper scripts should remain in a private operational archive unless intentionally converted into public dev tooling.

---

## Documentation Classification

| Document | Classification | Why |
|---|---|---|
| `README.md` | PUBLIC | Product overview and V1 scope. |
| `docs/architecture.md` | PUBLIC | High-level current architecture. |
| `docs/roadmap.md` | PUBLIC | Current roadmap boundary. |
| `docs/IDENTITY_FOUNDATION.md` | PUBLIC WITH REDACTION | Hostnames, callback URLs, and bridge contract details. |
| `docs/STAGING_DEPLOYMENT_PLAN.md` | INTERNAL | Strongly operational and topology-revealing. |
| `docs/STAGING_XAMAN_TEST.md` | INTERNAL | Strongly operational and security-sensitive. |
| `docs/CLOUD_DEPLOYMENT.md` | PUBLIC WITH REDACTION | Useful public deployment guidance, but needs hostname/generalization review. |
| `docs/deployment-readiness-checklist.md` | PUBLIC WITH REDACTION | Useful checklist, but contains deployment assumptions. |
| `CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md` | PUBLIC WITH REDACTION | Valuable architecture history, but contains operational and governance detail. |
| `DECENTRALIZED_ARCHITECTURE_V1.md` | PUBLIC WITH REDACTION | Valuable research record, but contains future infrastructure detail. |
| `NATIVE_PLATFORM_ARCHITECTURE_V1.md` | PUBLIC WITH REDACTION | Valuable research record, but contains platform and operator detail. |
| `PRE_CHECKPOINT_CONSOLIDATION.md` | ARCHIVE | Internal checkpoint consolidation record. |
| `V2_CHECKPOINT_AUDIT.md` | ARCHIVE | Internal forensic checkpoint audit. |
| `V2_SECURITY_EXPOSURE_AUDIT.md` | ARCHIVE | Internal security exposure audit. |
| `SECURITY_GIT_FORENSIC_AUDIT.md` | ARCHIVE | Internal security and git forensic audit. |

### Documentation classification summary

- PUBLIC: core product and roadmap docs.
- PUBLIC WITH REDACTION: architecture and deployment docs that can be shared after generalization.
- INTERNAL: staging and operational test docs.
- ARCHIVE: checkpoint and audit records.

---

## Future Ecosystem Information Classification

### High-level concepts that can be publicly communicated after redaction

- `CalorieDB`
- `IPFS`
- `Helia`
- `XRPL transaction correlation`
- `$CAL ecosystem integration`
- `NFTs`
- `F&B provenance`
- `biological/laboratory traceability`
- `native applications`
- `Calorie Nodes`
- `XRPL validators`
- `decentralized infrastructure`

### What should remain high-level in public docs

- The future architecture should be described as an ecosystem direction, not as implemented runtime capability.
- Public language should avoid operational hostnames, secret names, wallet details, and live treasury specifics.
- Physical truth, digital truth, and ledger truth should be described separately and carefully.

### What should remain internal until verified

- Detailed node/operator reward mechanics.
- Exact deployment topology.
- Implementation sequencing that would expose private infrastructure.
- Any real production rollout assumptions not yet verified.

### What should be archived privately

- Detailed research notes that reveal operational models, future governance, or sensitive provenance design choices.
- Treasury and issuer-related drafts.
- Internal debate notes about incentive design.

### Key preservation rule

- Do not delete future ecosystem research just because it is not implemented.
- Preserve it privately even if only a redacted summary is later published.

---

## XRPL / $CAL / Treasury Classification

### Publicly shareable at a high level

- $CAL is part of the long-term ecosystem vision.
- XRPL transaction hashes are intended to correlate future CalorieDB records with ledger events.
- NFT utility may extend to provenance and supply-chain use cases.
- Public docs can explain that XRPL is a verification and correlation layer, not the entire data model.

### Must remain internal or security-sensitive until verified

- The treasury reportedly holding more than 25% of CAL supply.
- The issuer being believed blackholed by the project owner.
- Any wallet addresses, signing material, treasury management details, or internal control assumptions.
- Any unverified claim about token supply, issuer status, or treasury policy.

### Safe public wording

- “The ecosystem may eventually use XRPL references and token-related functionality in future architecture.”
- “Treasury and issuer questions require verification and governance review.”
- “No current XRPL token or treasury operation is implemented in the V1 app.”

### Unsafe public wording

- Exact treasury holdings.
- Any private wallet or control details.
- Any statement that implies verified issuer status without on-ledger confirmation.

### Classification summary

- `XRPL transaction correlation`: PUBLIC WITH REDACTION
- `$CAL ecosystem`: PUBLIC WITH REDACTION at high level
- `treasury balance`: SECURITY-SENSITIVE / UNKNOWN until verified
- `issuer blackholed status`: SECURITY-SENSITIVE / UNKNOWN until verified
- `wallet or control details`: PRIVATE / SECURITY-SENSITIVE

---

## Deployment / Infrastructure Classification

| Item | Classification | Notes |
|---|---|---|
| `backend/app/main.py` bridge URLs | PUBLIC WITH REDACTION | Can be generalized in public docs, but current defaults are operationally revealing. |
| Callback paths such as `/api/identity/callback` | PUBLIC WITH REDACTION | Fine at a high level; keep hostnames generalized. |
| `WORDPRESS_BRIDGE_SECRET` | PRIVATE / SECURITY-SENSITIVE | Secret name can appear in internal docs; value must remain private. |
| `WORDPRESS_URL` | PUBLIC WITH REDACTION | Hostname is operationally revealing. |
| `CORS_ORIGINS` | PUBLIC WITH REDACTION | Can be described generically, not as live infra. |
| `NEXT_PUBLIC_BACKEND_URL` | PUBLIC | Public browser configuration by design. |
| Staging WordPress / backend / frontend pattern | INTERNAL | Exposes deployment topology. |
| Railway / Vercel / Render references | INTERNAL | Provider names can be public in high-level docs, but exact staging mapping should remain internal until finalized. |
| Localhost / 127.0.0.1 dev endpoints | INTERNAL | Development-only. |
| SQLite DB paths | PRIVATE / SECURITY-SENSITIVE | Local data-bearing files. |

### Deployment preservation rule

- Public docs should say what the app needs, not where every live host sits.
- Internal docs may preserve the exact topology for the team.
- The private archive should preserve the full current deployment context before any cleanup.

---

## Git History Considerations

### What was found

- CONFIRMED: No actual secret values were recovered from the reviewed git history scan.
- CONFIRMED: History exposed only placeholder env templates, not committed live secrets.
- CONFIRMED: No committed `.env`, `.env.local`, `.sqlite`, `.sqlite3`, or `.db` files were found in the reviewed history scan.
- CONFIRMED: The repository history is small and simple, which makes preservation easier.

### What this means for preservation

- No history rewriting is required based on the evidence currently available.
- Private files such as local DBs and ignored env files appear to be workspace-only, not historically committed.
- If later human review finds a private file in committed history, then history rewriting would be required before public release.

### History preservation rule

- Preserve the current git history as part of the private checkpoint archive.
- Do not rewrite history during this planning phase.
- Use later human review to decide whether any public release should exclude or redact historical materials.

---

## License Strategy

### Current evidence

- CONFIRMED: No LICENSE file was found in the workspace scan.
- CONFIRMED: Third-party dependencies already carry their own licenses in lockfiles and package metadata.
- UNKNOWN: The intended project license has not yet been selected.

### Recommendations

- Add a license only after the public/private boundary is settled.
- Use a license that covers the source code and public docs intended for the public repository.
- Keep private operational archive material outside the public license scope if the project is split.
- Consider a contributor policy or governance note if the public repository will accept external contributions.
- Do not choose the license yet in this phase; this requires human approval and a final public/private decision.

### Scope guidance

- Source code and public docs should have consistent licensing if they are published together.
- Internal staging docs and private operational archives should not be treated as public-facing license material.

---

## Backup Strategy

### Required private checkpoint archive

The private archive should preserve the complete current development state before cleanup. That includes:

- all tracked source files
- all untracked research and checkpoint documents
- all ignored local env files
- all ignored local databases
- build artifacts and local environments if exact workspace reproduction is desired
- git metadata and current branch state

### Why this archive matters

- It protects against accidental loss during cleanup.
- It preserves the current V1 implementation and the future ecosystem research record.
- It gives the team a safe rollback point before any public/private split.

### Public repository source set

The public repository should be derived from the private archive, not the other way around.

### Archive design principle

- First preserve everything privately.
- Then publish only intentionally selected material.

### Backup model summary

- `CHECKPOINT ARCHIVE`: full private snapshot of the current workspace and git state.
- `PUBLIC REPOSITORY`: curated subset of source and docs intended for public release.

---

## Proposed Public Repository Structure

This is a recommendation, not an execution instruction.

Suggested public structure:

- `README.md`
- `backend/`
  - `app/`
  - `tests/`
  - `requirements.txt`
  - `README.md`
  - public-safe helper code only
- `frontend/`
  - `app/`
  - `components/`
  - `public/`
  - `package.json`
  - `package-lock.json`
  - `tsconfig.json`
  - `tailwind.config.ts`
  - `postcss.config.js`
  - `next.config.js`
- `docs/`
  - `architecture.md`
  - `roadmap.md`
  - optionally `public/` and `research/` if the repo is split by doc audience
- `.github/`
  - public-safe workflow and contribution files only

### Public repo structure principles

- Keep implementation and public docs together only where they are safe to publish.
- Separate internal staging docs from public docs.
- Avoid publishing local config, DBs, caches, and build artifacts.
- Keep future research in a public section only if it has been generalized and redacted.

---

## Proposed Private Archive Structure

This is a recommendation, not an execution instruction.

Suggested private archive structure:

- full current repository snapshot
- git metadata and current branch state
- all ignored local runtime artifacts
- all env files, including private `.env` and `.env.local`
- all SQLite databases and local data files
- all build artifacts and local environments if exact state preservation is needed
- all staging, security, and checkpoint audit docs
- internal operational scripts and helper files
- the future ecosystem research docs in their full, unredacted form

### Private archive principles

- Preserve first, curate later.
- Treat the private archive as the canonical record of the current work-in-progress.
- Do not erase architecture research from the archive.
- Keep sensitive operational details in the private archive even if they are later generalized publicly.

---

## Required Human Decisions

1. Decide whether the project becomes one public repository, a split public/private pair, or a public repo plus private archive.
2. Decide which future ecosystem docs are public-facing after redaction and which remain internal.
3. Decide whether the current auth and staging docs should be rewritten later for public release.
4. Decide whether the current `backend/calorieapp.db` must be retained indefinitely in private storage or only until a migration is completed.
5. Decide whether the empty `calorieapp.db` should be retained as a forensic artifact or removed after backup.
6. Decide whether the public repository should include future architecture summaries at all, or only a minimal product narrative.
7. Decide on a license and contributor policy only after the public/private split is finalized.
8. Decide how much operational deployment detail should remain in repository docs versus external runbooks.
9. Decide whether a separate private operational archive should be maintained as a permanent project memory.

---

## Recommended Cleanup Sequence

This is a planning sequence only. No step has been executed.

1. Create a private checkpoint archive of the current repository state.
2. Confirm that the archive contains the local env files, local databases, untracked docs, and current git state.
3. Decide the public/private split and doc boundaries.
4. Redact or separate operational hostnames and bridge details from public-facing docs and source where needed.
5. Remove build artifacts, local environments, and local databases from the future public repository package only after the archive exists.
6. Split staging and internal notes into private-only storage or a private docs area.
7. Run external secret and dependency scanning before any public publication.
8. Apply the final public repo publication decision.

---

## Checkpoint Preparation Sequence

1. Freeze the current working state privately.
2. Preserve all source, tests, docs, env files, DBs, and git metadata in the private archive.
3. Classify public vs private vs internal material with human approval.
4. Redact public docs and public source where needed.
5. Build the intentional public repository from the archived snapshot.
6. Keep the private archive as the authoritative record of everything that was present before cleanup.
7. Only after that, begin the non-destructive cleanup and public packaging work.

---

## Final Decision

### WHAT MUST BE PRESERVED

- Current source code and tests.
- Current research architecture documents.
- Current checkpoint and audit documents.
- Local env files and local databases.
- Git metadata and visible history.
- Build artifacts and virtual environment if exact workspace reproduction is desired.

### WHAT CAN EVENTUALLY BE PUBLIC

- Core product README and roadmap.
- General V1 architecture.
- Public-safe source code and tests.
- High-level future architecture summaries after redaction.
- Public-safe deployment guidance with generalized host details.

### WHAT SHOULD REMAIN PRIVATE

- Local env files.
- Local databases.
- Build artifacts.
- Private operational staging docs.
- Internal audit records.
- Any live secret or credential material.
- Treasury, wallet, and issuer control details.

### WHAT REQUIRES REDACTION

- Hostnames.
- Bridge URLs and callback details.
- Deployment provider mappings.
- Future ecosystem documents that expose governance or topology detail.
- Auth and staging docs that reveal operational implementation detail.

### WHAT REQUIRES HUMAN DECISION

- Final public/private split.
- License choice.
- Whether to keep a permanent private archive.
- Whether to publish research docs at all, or only summaries.
- Whether to retain the empty root `calorieapp.db` as a forensic artifact.
- Whether to split the repository into separate public and private projects.

### NEXT SAFE ACTION

Create a private, immutable checkpoint archive of the current workspace and git state before any cleanup, redaction, or publication step.

PRESERVATION & PUBLIC / PRIVATE PLAN COMPLETE