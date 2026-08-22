# CalorieApp Repository Cleanup and Restructuring Proposal

Status: planning only. No cleanup executed. No files moved, deleted, renamed, or edited. No git history changes. No deployment actions.

Private rollback point already verified: `C:\Users\p\CalorieApp_PRIVATE_CHECKPOINT_2026-08-20`

---

## Executive Summary

The repository is currently a mixed workspace that combines active product code, identity and staging implementation detail, future ecosystem research, private runtime state, generated artifacts, and checkpoint/audit material. The private checkpoint already preserves the full current state, so cleanup can now be planned safely without erasing history.

The best cleanup outcome is not to flatten everything into a single public tree. It is to preserve the current state privately, then publish a curated public repository with only the code and documentation that are safe and useful for external readers. Sensitive operational artifacts, local databases, staging topology, and checkpoint/audit history should remain in a private archive or separate private mirror.

Recommended publication model: public repository plus private archive. Normal forward cleanup is sufficient; history rewrite is not required unless a later scan finds committed secrets.

---

## Current Repository State

### Observed shape

- Active app code exists in `backend/` and `frontend/`.
- Identity and staging docs exist alongside product docs.
- Future ecosystem research exists as large architecture files.
- Local runtime state exists in `.env` files and SQLite databases.
- Generated artifacts exist in `.venv/`, `frontend/node_modules/`, `frontend/.next/`, `__pycache__/`, and `.pytest_cache/`.
- Checkpoint and forensic material exists in `checkpoints/` and top-level audit/consolidation docs.
- `scripts/` is not present in the current repository scan.

### Repository posture

- The workspace is not a clean release tree.
- The private checkpoint is the correct rollback point.
- The current working tree should be treated as development state, not public release state.

### High-level classification of the current tree

| Group | Classification | Why |
|---|---|---|
| `backend/` active app code | KEEP PUBLIC AFTER REDACTION | Core product implementation should remain visible, but operational defaults and bridge details need review. |
| `frontend/` active app code | KEEP PUBLIC AFTER REDACTION | Core UI should remain visible, but auth flow details need review. |
| `docs/` mixed docs | SPLIT | Contains public product docs, private staging docs, and future research. |
| `.env` and database files | PRIVATE ARCHIVE | Local runtime state and sensitive application data. |
| Generated artifacts | REMOVE AFTER BACKUP | Regenerable and not source of truth. |
| `checkpoints/` | PRIVATE ARCHIVE | Historical checkpoint evidence should be retained privately. |
| forensic and consolidation docs | PRIVATE ARCHIVE | Valuable project history, but not public release material. |

---

## Source Code Classification

### Active source

| Path | Classification | Notes |
|---|---|---|
| `backend/app/main.py` | KEEP PUBLIC AFTER REDACTION | Active API and identity entry point. Review hostnames, bridge defaults, and cookie/session wording before public release. |
| `backend/app/database.py` | KEEP PUBLIC AFTER REDACTION | Active database setup. Review local-path assumptions and backfill behavior. |
| `backend/app/models.py` | KEEP PUBLIC AFTER REDACTION | Active schema. Contains identity/session tables and local persistence assumptions. |
| `backend/app/schemas.py` | KEEP PUBLIC AFTER REDACTION | Active API contracts. Review exposed auth payload shapes. |
| `backend/app/services/identity.py` | KEEP PUBLIC AFTER REDACTION | Active identity logic. Keep the code, but review operational bridge naming and public disclosure. |
| `backend/app/services/open_food_facts.py` | KEEP PUBLIC | V1 external integration is in scope and safe to publish. |
| `frontend/app/page.tsx` | KEEP PUBLIC AFTER REDACTION | Active UI entry page. No secret content, but should be reviewed for copy and product positioning. |
| `frontend/app/auth/callback/page.tsx` | KEEP PUBLIC AFTER REDACTION | Active callback page. Keep the flow, but keep URLs and error handling clean. |
| `frontend/components/XamanLoginPanel.tsx` | KEEP PUBLIC AFTER REDACTION | Active auth UI. Keep behavior, but review external navigation and config exposure. |
| `frontend/components/FoodSearchPlaceholder.tsx` | KEEP PUBLIC | Active user-facing UI. |
| `backend/tests/` | KEEP PUBLIC AFTER REDACTION | Valuable regression coverage. Keep tests, but review for operational assumptions and secret-like examples. |
| `frontend/components/` | KEEP PUBLIC AFTER REDACTION | Mostly user-facing UI, but auth components need review. |
| `frontend/app/` | KEEP PUBLIC AFTER REDACTION | Active app router UI, including auth callback. |
| `backend/app/` | KEEP PUBLIC AFTER REDACTION | Active backend package. |
| `frontend/public/` | KEEP PUBLIC | Static assets belong in the public repo. |

### Development-only and operational code

| Path | Classification | Notes |
|---|---|---|
| `backend/dev_health_check.py` | INTERNAL / REMOVE AFTER BACKUP | Useful for local verification, not public-facing product code. |
| `backend/start-backend.ps1` | INTERNAL / REMOVE AFTER BACKUP | Local operational helper, not product code. |
| `release-check.ps1` | INTERNAL / REMOVE AFTER BACKUP | Local gate helper, useful privately but not core product code. |
| `test_api.py` | ARCHIVE / REMOVE AFTER BACKUP | Legacy/manual smoke test artifact. Likely consolidates into real tests. |
| `backend/test_post.py` | ARCHIVE / REMOVE AFTER BACKUP | Legacy/manual test artifact. Likely consolidates into real tests. |
| `scripts/` | UNKNOWN / NOT PRESENT | No `scripts/` directory was found in the current scan. |

### Legacy, duplicate, or consolidate candidates

| Item | Classification | Why |
|---|---|---|
| `test_api.py` vs `backend/tests/` | MERGE / CONSOLIDATE | Manual smoke test logic should probably live in the test suite or be archived. |
| `backend/test_post.py` vs `backend/tests/test_endpoints.py` | MERGE / CONSOLIDATE | Legacy endpoint testing should collapse into the formal suite. |
| `release-check.ps1` vs `backend/dev_health_check.py` | MERGE / CONSOLIDATE | Both are local verification helpers; keep one clear pattern and archive the rest. |
| `backend/calorieapp.db` live state vs schema code | KEEP PRIVATE | Runtime data should not be treated as source code. |

### Public release readiness review

Code that should remain public, but only after review for operational leakage:

- `backend/app/main.py`
- `backend/app/database.py`
- `backend/app/models.py`
- `backend/app/schemas.py`
- `backend/app/services/identity.py`
- `frontend/app/page.tsx`
- `frontend/app/auth/callback/page.tsx`
- `frontend/components/XamanLoginPanel.tsx`
- `backend/tests/`

The reason is not that the code is secret. The reason is that the current versions mix implementation, environment defaults, local assumptions, and staging-specific details in a way that should be reviewed before a public release.

---

## Database Classification

| Path | Classification | Recommended action | Notes |
|---|---|---|---|
| `backend/calorieapp.db` | KEEP PRIVATE / ARCHIVE / REMOVE FROM PUBLIC REPOSITORY | Preserve privately; remove from any public repo package; delete only after verified backup if humans approve | Live SQLite database with identity and food-log data. Must stay private. |
| `calorieapp.db` | REMOVE AFTER BACKUP | Archive only if needed for forensic symmetry; otherwise delete after backup | Zero-byte file in current scan. Not a useful runtime artifact. |

### Database recommendation

- `backend/calorieapp.db` is private archive material, not public repository material.
- `calorieapp.db` is disposable after backup unless a human explicitly wants it retained for symmetry.
- No database file should be published in the public repository.

---

## Environment Classification

| Path | Classification | Notes |
|---|---|---|
| `backend/.env` | PRIVATE ARCHIVE | Local runtime config. Keep out of the public repository. |
| `frontend/.env.local` | PRIVATE ARCHIVE | Local frontend runtime config. Keep out of the public repository. |
| `backend/.env.example` | PUBLIC AFTER REDACTION | Useful template, but its operational names and example host patterns should be checked before public release. |
| `frontend/.env.example` | PUBLIC | Safe template in principle. |
| `backend/.env.staging.example` | INTERNAL | Staging topology and bridge assumptions belong in private/internal material. |
| `frontend/.env.staging.example` | INTERNAL | Staging API reference belongs in private/internal material. |

### Environment recommendation

- Keep real `.env` and `.env.local` files private.
- Keep example templates in the public repo only after reviewing their hostname and bridge references.
- Keep staging example templates internal unless the staging model itself becomes public policy.

---

## Generated Artifact Classification

| Path or pattern | Classification | Recommended action | Notes |
|---|---|---|---|
| `.venv/` | REMOVE AFTER BACKUP | Do not publish; keep only in a private archive if exact workstation reproduction is needed | Local Python environment. |
| `frontend/node_modules/` | REMOVE AFTER BACKUP | Do not publish | Regenerable dependency tree. |
| `frontend/.next/` | REMOVE AFTER BACKUP | Do not publish | Build output. |
| `backend/__pycache__/` | REMOVE AFTER BACKUP | Do not publish | Bytecode cache. |
| `backend/app/__pycache__/` | REMOVE AFTER BACKUP | Do not publish | Bytecode cache. |
| `backend/tests/__pycache__/` | REMOVE AFTER BACKUP | Do not publish | Bytecode cache. |
| `.pytest_cache/` | REMOVE AFTER BACKUP | Do not publish | Test runner cache. |
| `build/` | REMOVE AFTER BACKUP | If present, do not publish | Generic build output. |
| `dist/` | REMOVE AFTER BACKUP | If present, do not publish | Generic distribution output. |
| `logs/` | REMOVE AFTER BACKUP | If present, archive only if explicitly needed | Operational noise. |
| temporary files | REMOVE AFTER BACKUP | If present, do not publish | Regenerable or transient. |
| editor files | REMOVE AFTER BACKUP | If present, do not publish | Workspace noise. |
| OS files | REMOVE AFTER BACKUP | If present, do not publish | Workspace noise. |

### Generated artifact recommendation

These items are not source of truth. If a private archive needs a perfect workspace reproduction, preserve them privately. Otherwise, remove them from the future public repository.

---

## Documentation Classification

### Public or public after redaction

| Path | Classification | Notes |
|---|---|---|
| `README.md` | PUBLIC AFTER REWRITE | Current README is useful but incomplete for the current state and should be refreshed. |
| `docs/architecture.md` | PUBLIC AFTER REWRITE | High-level architecture is fine to publish, but it should be rewritten as a clean current-state document. |
| `docs/roadmap.md` | PUBLIC AFTER REWRITE | Roadmap should be expanded and marked with proposed phases. |
| `docs/CLOUD_DEPLOYMENT.md` | PUBLIC AFTER REDACTION | Useful public deployment guidance, but operational detail should be generalized. |
| `docs/deployment-readiness-checklist.md` | PUBLIC AFTER REDACTION | Good public checklist after removing host-specific assumptions. |

### Internal or private archive

| Path | Classification | Notes |
|---|---|---|
| `docs/IDENTITY_FOUNDATION.md` | INTERNAL | Valuable, but it exposes bridge and hostname detail. |
| `docs/STAGING_DEPLOYMENT_PLAN.md` | PRIVATE ARCHIVE | Operational staging topology should not be public yet. |
| `docs/STAGING_XAMAN_TEST.md` | PRIVATE ARCHIVE | Operational and security-sensitive staging checklist. |
| `CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md` | PRIVATE ARCHIVE / INTERNAL RESEARCH | Keep the ideas, but do not treat the current file as a public summary. |
| `DECENTRALIZED_ARCHITECTURE_V1.md` | PRIVATE ARCHIVE / INTERNAL RESEARCH | Keep as research history. |
| `NATIVE_PLATFORM_ARCHITECTURE_V1.md` | PRIVATE ARCHIVE / INTERNAL RESEARCH | Keep as research history. |
| `PRE_CHECKPOINT_CONSOLIDATION.md` | PRIVATE ARCHIVE | Project history and internal consolidation record. |
| `V2_CHECKPOINT_AUDIT.md` | PRIVATE ARCHIVE | Internal checkpoint history. |
| `V2_SECURITY_EXPOSURE_AUDIT.md` | PRIVATE ARCHIVE | Internal security history. |
| `SECURITY_GIT_FORENSIC_AUDIT.md` | PRIVATE ARCHIVE | Internal forensic history. |
| `PRESERVATION_PUBLIC_PRIVATE_PLAN.md` | PRIVATE ARCHIVE | Internal planning record. |
| `SNAPSHOT_VERIFICATION_REPORT.md` | PRIVATE ARCHIVE | Private checkpoint verification record. |
| `checkpoints/` | PRIVATE ARCHIVE | Keep checkpoint evidence private and immutable. |

### Documentation consolidation notes

- `README.md`, `docs/architecture.md`, and `docs/roadmap.md` should become the public-facing narrative.
- The future-ecosystem research docs should remain private until a clean public summary is extracted.
- The staging and forensic docs should remain internal or private archive material.
- Do not delete research just because it describes future work.

---

## Future Ecosystem Classification

The future ecosystem concepts should be preserved, but not all of them belong in the public repository in their current form.

| Concept area | Recommended classification | Notes |
|---|---|---|
| CalorieDB | INTERNAL RESEARCH | Keep the concept, but separate it from current V1 implementation. |
| IPFS | INTERNAL RESEARCH | Future storage layer concept. |
| Helia | INTERNAL RESEARCH | Future browser and node implementation concept. |
| XRPL transaction correlation | INTERNAL RESEARCH | Keep as a future integrity layer concept. |
| `CAL` token concept | INTERNAL RESEARCH | Preserve as ecosystem research, not active V1 runtime. |
| NFTs for provenance and traceability | INTERNAL RESEARCH | Preserve as future utility research. |
| F&B provenance | INTERNAL RESEARCH | Keep as a future product direction. |
| biological and laboratory traceability | INTERNAL RESEARCH | Keep as future research, not V1 implementation. |
| native applications | PUBLIC HIGH-LEVEL ROADMAP | Can be a future phase if clearly labeled proposed. |
| community nodes | INTERNAL RESEARCH | Keep as future infrastructure research. |
| XRPL validators | INTERNAL RESEARCH | Keep separate from consumer app scope. |
| treasury and incentives | INTERNAL RESEARCH | Keep in private or internal material until verified and approved. |

### Future ecosystem recommendation

The future ecosystem should be represented as a high-level public vision only after redaction. Detailed operator assumptions, treasury ideas, node roles, and chain-related mechanisms should stay in internal research or private archive material until there is a clear public release policy.

---

## XRPL / $CAL Classification

### What should be preserved

- `XRPL` as a future correlation and integrity layer concept.
- `$CAL` as a core ecosystem component in future research.
- NFT utility for food, recipe, menu, provenance, distribution, production, wholesale, retail, and traceability research.
- Biological and laboratory traceability as a future research area.
- Community nodes and validator/operator concepts as future infrastructure research.

### How to classify it

| Item | Classification | Notes |
|---|---|---|
| XRPL as a correlation layer | INTERNAL RESEARCH | Keep the idea, do not implement in cleanup phase. |
| `$CAL` | INTERNAL RESEARCH | Preserve the concept without overstating any economic facts. |
| issuer blackhole status | UNKNOWN / NOT VERIFIED | Do not strengthen the claim without independent verification. |
| treasury holdings | UNKNOWN / NOT VERIFIED | Do not strengthen the claim without independent verification. |
| NFT use in provenance and traceability | INTERNAL RESEARCH | Keep as future direction only. |
| validator or operator incentives | INTERNAL RESEARCH | Keep as future direction only. |

### Disclosure rule

These concepts should not be presented as live runtime capabilities. They belong in future architecture research and should not appear as operational promises in the public README until they are independently verified and intentionally approved for publication.

---

## Treasury / Incentive Classification

### Current status

- Treasury-based incentives are an explored future idea, not a verified current system.
- The issuer blackhole claim is not independently verified in this cleanup phase.
- The `25% of CAL supply` treasury belief is not independently verified in this cleanup phase.

### Classification

| Item | Classification | Notes |
|---|---|---|
| Treasury-based incentive mechanism | INTERNAL RESEARCH | Keep the idea, but do not publish it as operational fact. |
| Community incentives | INTERNAL RESEARCH | Future ecosystem direction only. |
| Governance mechanics | INTERNAL RESEARCH | Future work only. |
| Supply distribution claims | UNKNOWN | Require independent verification before any public statement. |

### Treasury recommendation

Keep treasury and incentive discussion in private or internal research until the product has a clear governance policy and the underlying claims have been verified.

---

## GitHub Publication Model

### Recommended model: B. Public repository plus private archive

This is the best fit for CalorieApp right now.

### Why B is the best choice

- It preserves open-source credibility for the public product code.
- It keeps operationally sensitive material out of the public repository.
- It protects local databases, env files, and staging topology.
- It keeps future ecosystem research available without forcing all of it into the public tree.
- It avoids history rewriting unless later evidence forces that step.

### Why not A

A single public repository would expose too much operational detail unless it is heavily curated first.

### Why not C as the primary recommendation

A separate private repository is viable, but it is more management overhead than necessary if the private checkpoint archive is already serving as the authoritative rollback point.

### Why not D

Other models are possible, but B is the simplest and safest path from the current state.

### Practical interpretation

- Public repository: active product code, public templates, public docs, and public roadmap.
- Private archive: env files, databases, staging docs, forensic docs, checkpoint material, generated artifacts, and full snapshot preservation.

---

## README Recommendations

### What is outdated

- The README currently describes the V1 scope well, but it does not clearly distinguish active implementation, private checkpoint state, and future research.
- It should not imply that staging or future architecture material is part of current public product scope.
- It should not overexpose operational hostnames or future infrastructure assumptions.

### What should remain

- The strict non-financial, non-custodial product framing.
- The current V1 focus on food search, nutrition display, and food logging.
- The clear separation between frontend UI and backend data/API behavior.

### What should be rewritten

- The run instructions should reflect the current stable local workflow and the actual repo structure.
- The architecture summary should point to the public architecture doc and not to private research docs.
- The deployment language should be generalized and separated from staging-specific material.

### What future architecture may be mentioned

- Only high-level, explicitly proposed future phases.
- Only if marked as research or proposed, not as active runtime.

### What should not be disclosed

- Local env values.
- Database paths beyond what is necessary for local development.
- Bridge secrets, host-specific staging topology, and sensitive operational detail.
- Detailed future treasury or validator assumptions.

### README recommendation

Rewrite the README into a public-facing product summary that describes current V1 behavior, links to public architecture and roadmap docs, and explicitly states that research and private checkpoint material live outside the public narrative.

---

## Roadmap Recommendations

The roadmap should evolve from a short V1/future split into a phased proposed roadmap.

### Recommended phase framing

1. Phase 1 - Current V1 web application
2. Phase 2 - Hardened/public checkpoint
3. Phase 3 - CalorieDB architecture
4. Phase 4 - Decentralized storage research
5. Phase 5 - XRPL transaction correlation
6. Phase 6 - NFT/provenance research
7. Phase 7 - Native applications
8. Phase 8 - Community nodes
9. Phase 9 - Validator/operator ecosystem
10. Phase 10 - Treasury/incentive/governance research

### Recommendation

- Mark phases 2 through 10 as `PROPOSED`.
- Keep phase 1 as the current implementation.
- Make it clear that the roadmap is a plan, not a commitment to implementation order.
- Separate public roadmap items from internal research milestones.

### Roadmap outcome

The roadmap should help readers understand the intended evolution without confusing research with current runtime behavior.

---

## License Recommendations

### Current status

- No license file was observed in the current repository scan.

### Recommendation

- Add a license before public publication.
- Choose a standard open-source license for the public repository, such as Apache-2.0 or MIT, depending on the project owner's preference for patent language and simplicity.
- Keep proprietary future components outside the public repository or in a separate private repository.
- If external contributions are expected, consider contributor terms such as a DCO or CLA policy.

### What should be licensed

- Public source code.
- Public docs.
- Public templates.

### What should receive separate treatment

- Private research docs.
- Checkpoint material.
- Databases.
- Local env files.
- Future proprietary components.

### License recommendation summary

Do not publish a public repository without an explicit license. The public code should be licensed clearly, while private research and operational archives remain outside that public grant.

---

## .gitignore Recommendations

### Eventually ignore

| Pattern | Reason |
|---|---|
| `.env` | Local runtime config should never be public. |
| `.env.*` | Catch environment variants, including local and staging files. |
| `*.db` | Protect local database files. |
| `*.sqlite` | Protect SQLite artifacts. |
| `*.sqlite3` | Protect SQLite artifacts. |
| `.venv/` | Local Python environment. |
| `node_modules/` | Regenerable dependency tree. |
| `.next/` | Build output. |
| `__pycache__/` | Bytecode cache. |
| `*.log` | Operational logs. |
| OS/editor files | Workspace noise. |

### Recommendation

- Do not modify `.gitignore` in this planning phase.
- When cleanup is executed later, add ignore rules before removing artifacts from the tracked/public surface.
- Keep the ignore policy aligned with the public/private split so that sensitive runtime files remain private by default.

---

## Git History Recommendations

### Do we need history rewriting?

No, not for the current cleanup plan.

### Why normal forward cleanup is sufficient

- The audit did not find confirmed committed secret values.
- The sensitive material currently appears in working-tree state, private runtime files, checkpoint docs, and local artifacts rather than in a confirmed secret-bearing commit history.
- The repository can be cleaned by forward changes after backup, rather than rewriting history.

### When history rewriting would become necessary

- If a later scan finds committed secrets.
- If a later review finds that a public release must remove sensitive history that is already committed.

### Recommendation

Keep the current branch history intact unless a verified secret leak appears.

---

## Proposed Repository Structure

### Recommended future structure

Public repository:

- `backend/`
- `frontend/`
- `README.md`
- `docs/public/`
- `.github/`
- `LICENSE`
- public examples and templates only

Private archive or private mirror:

- `backend/.env`
- `frontend/.env.local`
- `backend/calorieapp.db`
- `calorieapp.db` if retained for symmetry
- staging docs
- forensic docs
- checkpoint docs
- future ecosystem research docs that are not yet public
- generated artifacts from the exact private checkpoint, if a full reconstruction archive is needed

### Why this structure

- It keeps the public repo readable and credible.
- It lets the project preserve history without exposing local state.
- It separates current implementation from research and operational evidence.
- It makes future contributors see only the code and docs they need.

### Structure decision

Do not assume `docs/` stays monolithic. Split public documentation from internal research and private archives. If a separate private repository is not desired, an external private archive folder is sufficient as the authoritative rollback point.

---

## Cleanup Sequence

No step in this sequence should be executed in this planning phase.

### Step 1 - Freeze the rollback point

Confirm the private checkpoint remains immutable and available as the rollback source.

### Step 2 - Finalize the classification map

Assign every file or directory to one of: keep public, keep internal, private archive, archive, remove after backup, redact/rewrite, merge/consolidate, or unknown.

### Step 3 - Separate public from private documentation

Split public product docs from internal research, staging plans, and forensic records.

### Step 4 - Redact public-facing docs

Rewrite README, architecture, roadmap, deployment, and readiness docs so they only expose information that is safe for a public repository.

### Step 5 - Define the public source surface

Keep active source code public, but review auth, bridge, and environment assumptions before publication.

### Step 6 - Preserve private runtime state

Archive databases, env files, and any remaining local runtime artifacts before removing them from the public tree.

### Step 7 - Remove generated artifacts from the future public repo

Clean `.venv/`, `node_modules/`, `.next/`, caches, logs, temp files, and OS/editor files after the backup is verified.

### Step 8 - Consolidate tests and helpers

Merge manual or duplicate tests into the formal test suite and archive one-off scripts if they are no longer needed.

### Step 9 - Create a cleanup checkpoint

Take a new checkpoint after the repository has been logically separated but before public publication.

### Step 10 - Create a publication checkpoint

Make the first curated public release tree only after human approval of the redaction and licensing decisions.

### Step 11 - Create the final V2 checkpoint

Treat the next major architecture milestone as the final checkpoint for the new public/private split.

---

## Checkpoint Strategy

### Cleanup checkpoint

Definition: a checkpoint taken after cleanup decisions are prepared and the public/private boundary is applied, but before any public publication.

Purpose:

- prove the cleaned tree is reproducible,
- preserve the state before release packaging,
- allow rollback if redaction or ignore rules are wrong.

### Publication checkpoint

Definition: the first curated release tree intended for external readers or contributors.

Purpose:

- capture the public repository layout,
- lock in the public docs and license state,
- serve as the baseline for public contribution.

### Final V2 checkpoint

Definition: the next major checkpoint after the public/private split is stable and the project enters its next architectural phase.

Purpose:

- preserve the new baseline after cleanup,
- mark the transition from preservation work to the next implementation era,
- give the project a stable reference for future ecosystem work.

---

## Risks

- Local databases may contain identity-linked or user-linked application state, so accidental publication would be high risk.
- Staging docs and bridge-related docs reveal operational topology and should not be treated as public product copy.
- Future ecosystem research can be misread as current product behavior if it is not separated cleanly.
- A public repository without a license is ambiguous and weakens open-source credibility.
- Generated artifacts can bloat the repo or leak local environment details if not ignored before publication.
- If the cleanup is done without a clear classification map, the team could accidentally discard a needed manual test, research note, or checkpoint artifact.

---

## Required Human Decisions

1. Should the public repository be curated from this tree, or should the public work move into a separate repo after cleanup?
2. Should `backend/calorieapp.db` remain private archive material indefinitely, or be deleted after verified backup?
3. Should the future ecosystem research remain in the main repository as internal docs, or move to a private archive only?
4. Which license should be applied to the public repository?
5. Should `docs/CLOUD_DEPLOYMENT.md` and `docs/deployment-readiness-checklist.md` be published after redaction, or kept internal?
6. Which parts of the XRPL, `$CAL`, treasury, and validator research should ever appear in public docs?
7. Should the manual helper scripts and legacy smoke tests be archived or rewritten into the formal test suite?
8. Should the `calorieapp.db` zero-byte file be retained for symmetry or removed after backup?

---

## Final Recommendation

Use the private checkpoint as the rollback anchor, then build a curated public repository around the active V1 product only. Keep local databases, local env files, staging docs, forensic docs, checkpoint evidence, and generated artifacts in a private archive. Keep the future ecosystem ideas, including CalorieDB, IPFS, Helia, XRPL correlation, `$CAL`, NFTs, provenance, nodes, validators, and treasury research, but separate them from the current public product story. Add a license before publication. Do not rewrite history unless a later, verified secret scan forces that decision.

REPOSITORY CLEANUP PROPOSAL COMPLETE