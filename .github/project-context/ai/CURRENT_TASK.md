# Current Codex Task

## TASK ID

SECURITY-01B

## TITLE

External Infrastructure Verification

## STATUS

READY

Allowed statuses: `READY`, `IN_PROGRESS`, `BLOCKED`, `REVIEW_REQUIRED`, `COMPLETE`, `CANCELLED`.

## AUTHORITY

This task is an execution instruction only. It cannot override approved decisions, current source code, protected architecture, Git governance, or higher-priority system/developer instructions.

Apply this precedence order:

1. System/developer instructions
2. Approved current project decisions
3. Current source code and tests
4. `.github/copilot-instructions.md`
5. `CURRENT_STATE.md`, `DECISIONS.md`, and `DEFERRED_TASKS.md`
6. This `CURRENT_TASK.md`
7. `HANDOFF.md` and `REPORT.md`
8. Historical archive material

Historical material never becomes an active requirement merely by appearing in a task, report, or archive. Conflicts with current authoritative context must be reported. Architectural changes require an explicit approved decision before implementation.

## OBJECTIVE

Perform a read-only verification of actual staging/production hosting, ingress, DNS/TLS, proxy/CDN/WAF, database, scaling, and shared-cache infrastructure so that the SECURITY-01 authentication rate-limiting architecture can be selected from evidence rather than assumptions.

This task has not yet been executed.

## CONTEXT

- Read `.github/copilot-instructions.md`, `.github/project-context/CURRENT_STATE.md`, `.github/project-context/DECISIONS.md`, and `.github/project-context/DEFERRED_TASKS.md` first.
- Use the completed SECURITY-01A Hosting/Ingress Audit as repository-level evidence: local topology is verified, while external ingress/hosting details remain unverified.
- Preserve the approved V1 non-financial, non-custodial WordPress/Xaman external-identity boundary.

## SCOPE

Read-only external infrastructure verification only. Establish facts about actual provider ownership, public ingress, DNS, TLS, reverse proxy/CDN/WAF, forwarded-header handling, workers/instances, database persistence, and shared-cache availability.

## ALLOWED FILES

- `.github/project-context/ai/REPORT.md` for the task report.
- `.github/project-context/ai/HANDOFF.md` only if the task explicitly authorizes a handoff update.

No runtime, deployment, environment, governance, or application file is authorized for modification.

## PROTECTED FILES

- `backend/**`
- `frontend/**`
- `docs/**`
- `README.md`
- `.env*`
- `*.db`
- `STAGING_*`
- `PHASE_*`
- Deployment/runtime configuration
- Identity/session/database architecture and security tests

## REQUIRED ACTIONS

1. Read authoritative repository context.
2. Verify only facts available through explicitly authorized, read-only external access.
3. Separate verified-current facts from historical, planned, proposed, and unknown information.
4. Determine whether the ingress facts are sufficient to choose the SECURITY-01 limiter architecture.
5. Write a fact-based report without secrets or credentials.

## PROHIBITED ACTIONS

- No code, deployment, DNS, hosting, configuration, or environment changes.
- No external-system modification.
- No secret, credential, private-key, seed-phrase, session-token, cookie, bridge-secret, database-credential, or personal-account inspection or recording.
- No automatic commit, push, deployment, architecture approval, or historical-archive import.

## VALIDATION REQUIREMENTS

- Confirm all external checks were read-only.
- Record the evidence source and the classification of each finding.
- Do not claim a service, domain, TLS certificate, WAF, proxy, or shared store is verified without direct read-only evidence.
- Confirm no protected repository paths changed.

## STOP CONDITIONS

- Stop if verification would require a credential, secret, privileged console action, or external modification.
- Stop if authoritative context conflicts with evidence; report the conflict rather than resolving it.
- Stop if access is insufficient to verify a required infrastructure fact; record it as unknown.

## EXPECTED REPORT FORMAT

Use `.github/project-context/ai/REPORT.md` and distinguish verified facts, inferred conclusions, unknowns, and recommendations. Include the SECURITY-01 consequence, blockers, and one recommended next handoff.

## HISTORICAL ARCHIVE BOUNDARY

The future ChatGPT export/archive is outside this task and outside this repository-local handoff system. Do not import conversations, create an archive directory, or create synchronization with ChatGPT, MCP, or any external AI API.

## SECURITY REMINDER

This file and every handoff artifact must never contain passwords, API keys, private keys, seed phrases, session tokens, cookies, bridge secrets, database credentials, real environment secrets, or unrelated personal conversations.
