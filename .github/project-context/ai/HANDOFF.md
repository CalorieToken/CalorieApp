# AI HANDOFF

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
