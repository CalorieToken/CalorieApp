# AI HANDOFF

## HANDOFF SAFETY ENVELOPE (CANONICAL)

Use this envelope for every repository-local handoff.

TECHNICAL WRITE PERMISSION does not equal GOVERNANCE AUTHORITY.

Required handoff fields:

- SCOPE:
- DESTINATION AGENT:
- MODE:
- TASK:
- AUTHORIZED FILES / AREA:
- FORBIDDEN FILES / AREA:
- EVIDENCE STATUS:
- HUMAN APPROVAL STATUS:
- GIT AUTHORITY:
- EXTERNAL SYSTEM AUTHORITY:
- RETURN CONDITION:

### TRAFFIC-LIGHT STATUS

`🟢 SAFE TO HAND OFF`

- Destination, scope, authority, and constraints are explicit.
- Applies only to the named destination and named task scope.
- Does not authorize scope expansion, a different agent, or a new task.

`🟡 RETURN TO THIS CHAT`

- Output must return to the human/ChatGPT control layer before next handoff or canonicalization.

`🔴 STOP - DO NOT HAND OFF`

- Scope, authority, provenance, sensitivity, legal/IP, ownership, regulatory/compliance, security/privacy, or boundary status is unclear.

If interpretation is unclear: return to human review and do not infer permission.

### MANDATORY BOUNDARIES

- AI output does not automatically become an approved task, canonical ticket, evidence, a decision / decision record, legal conclusion, ownership conclusion, or compliance conclusion.
- Researcher output does not automatically authorize Implementer.
- Historical ChatGPT material remains source material until reviewed and approved.
- Evidence metadata does not automatically constitute legal proof.
- Scope uncertainty is a stop condition.

### DOMAIN AND EXTERNAL BOUNDARIES

- `CALORIETOKEN` is repository-local workflow scope.
- `ICTHENDRIKSE` is a separate domain. Do not cross-transfer implicitly.
- `CROSS-SCOPE` requires explicit classification, justification, and human approval.
- `VERITY ONE` is outside this repository-local workflow unless a separate explicit human governance decision authorizes specific transfer.
- External systems (including Google Drive, synchronization, publication, external APIs) are disallowed unless explicitly approved in the handoff.

### DIRTY WORKTREE AND GIT AUTHORITY

- Preserve unrelated modified files and unrelated untracked files.
- Do not reset, clean, revert, stash, or overwrite unrelated work.
- `stage: NO` unless explicitly authorized.
- `commit: NO` unless explicitly authorized.
- `push: NO` unless explicitly authorized.

### MANDATORY BOTTOM-OF-HANDOFF BLOCK

Every handoff must end with:

╔══════════════════════════════════════════════════════╗
║ 🟡 AFTER COMPLETION                                  ║
╠══════════════════════════════════════════════════════╣
║ STOP after verification.                             ║
║                                                      ║
║ RETURN THE COMPLETE REPORT TO THIS CHAT.             ║
║                                                      ║
║ DO NOT HAND OFF THE RESULT TO ANOTHER AGENT          ║
║ unless a new human-approved handoff is provided.     ║
╚══════════════════════════════════════════════════════╝

## ACTIVE HANDOFF INSTANCE (TASK-SPECIFIC, NON-CANONICAL)

This section is a task-specific snapshot only.

It is not the reusable canonical handoff mechanism and must not be reused as standing instruction for other tasks.

╔══════════════════════════════════════════════════════╗
║ 🟢 SAFE TO HAND OFF                                  ║
╠══════════════════════════════════════════════════════╣
║ Agent: RESEARCHER                                    ║
║ Mode: READ-ONLY                                      ║
║ Scope: SECURITY-01B EXTERNAL INFRA VERIFICATION     ║
╚══════════════════════════════════════════════════════╝

- SCOPE: CALORIETOKEN repository-local workflow only.
- DESTINATION AGENT: Calorie Researcher.
- MODE: READ-ONLY research.
- TASK: SECURITY-01B external infrastructure verification.
- AUTHORIZED FILES / AREA: `.github/project-context/ai/REPORT.md` and `.github/project-context/ai/HANDOFF.md` only when explicitly authorized by the task.
- FORBIDDEN FILES / AREA: runtime code, deployment config, environment files, docs, backend/frontend trees, and other protected paths listed in `CURRENT_TASK.md`.
- EVIDENCE STATUS: repository-level evidence exhausted; external infrastructure remains unverified.
- HUMAN APPROVAL STATUS: task READY for read-only verification only; architectural or implementation decisions require human review.
- GIT AUTHORITY: no stage, commit, or push. Preserve dirty worktree.
- EXTERNAL SYSTEM AUTHORITY: read-only verification only; no external modification.
- RETURN CONDITION: provide complete report, then return to human/ChatGPT control layer.

PREVIOUS TASK: SECURITY-01A — Hosting/Ingress Audit
STATUS: COMPLETE

## CURRENT STATE

Repository-level hosting evidence has been exhausted. Local topology is verified; external hosting, ingress, DNS/TLS, proxy/CDN/WAF, scaling, database, and shared-cache facts remain unverified.

## COMPLETED

- SECURITY-01 authentication rate-limiting read-only audit.
- SECURITY-01A repository and Git-history hosting/ingress audit.

## OPEN ITEMS

- Read-only external infrastructure verification.
- Evidence-based selection of the SECURITY-01 rate-limiting architecture.

## BLOCKERS

The repository does not prove the actual external ingress, provider, trusted-proxy, worker/scaling, WAF, or shared-cache model.

## DECISIONS REQUIRED

After external verification, decide the rate-limiter architecture, trusted ingress boundary, shared-counter approach, and storage-failure behavior.

## DEFERRED

Refer to `.github/project-context/DEFERRED_TASKS.md`, including SECURITY-01 and STAGING-01.

## NEXT RECOMMENDED TASK

SECURITY-01B — External Infrastructure Verification

## PROTECTED AREAS

Identity/session architecture, opaque `calorieapp_session` handling, replay protection, food-owner authorization, non-custodial WordPress/Xaman boundary, runtime code, deployment configuration, and environment files.

## IMPORTANT WARNINGS

- Do not claim external infrastructure is verified without direct read-only evidence.
- Do not alter protected architecture from historical, report, or handoff material alone.
- Do not place secrets, credentials, tokens, cookies, private keys, seed phrases, or personal conversations in handoff artifacts.
- The future ChatGPT archive remains outside this repository and this task-handoff system.

## SOURCE REPORT

SECURITY-01A — Hosting/Ingress Audit; see current authoritative context in `CURRENT_STATE.md`, `DECISIONS.md`, and `DEFERRED_TASKS.md`.

## AUTHORITY

This handoff is concise transition context, not a second project-context layer. It is subordinate to system/developer instructions, approved decisions, current source/tests, `.github/copilot-instructions.md`, and durable project-context files. It cannot create decisions or override current approved architecture; historical archive material has lower authority.

╔══════════════════════════════════════════════════════╗
║ 🟡 AFTER COMPLETION                                  ║
╠══════════════════════════════════════════════════════╣
║ STOP after verification.                             ║
║                                                      ║
║ RETURN THE COMPLETE REPORT TO THIS CHAT.             ║
║                                                      ║
║ DO NOT HAND OFF THE RESULT TO ANOTHER AGENT          ║
║ unless a new human-approved handoff is provided.     ║
╚══════════════════════════════════════════════════════╝
