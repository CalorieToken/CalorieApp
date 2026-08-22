# Deferred project backlog

This backlog records work that is intentionally deferred and not to be implemented in the current runtime-security scope.

## PUBLICATION-01 — CANONICAL WHITEPAPER SOURCE

- Status: DEFERRED
- Priority: MEDIUM / HIGH
- Category: PUBLIC DOCUMENTATION / GOVERNANCE / SOURCE OF TRUTH
- Purpose: evaluate GitHub as the canonical source for official CalorieToken whitepaper releases
- Dependencies: external website/publication governance, repository ownership decisions, publication policy
- Protected files: not runtime code; publication and governance material only
- Implementation allowed: NO (not now)
- Notes: The whitepaper is currently published through a WordPress-based model and other external listings. Canonical-source migration is a future governance decision, not a runtime implementation task.

## STAGING-01 — CONTROLLED STAGING ARCHITECTURE / DEPLOYMENT

- Status: DEFERRED
- Priority: MEDIUM / HIGH
- Category: DEPLOYMENT / GOVERNANCE / STAGING
- Purpose: establish a clean external staging topology for the current architecture
- Dependencies: DNS ownership, TLS, secret management, frontend/backend/WordPress host setup, database strategy
- Protected files: runtime app files remain protected; staging config files are allowed but not part of implementation until external verification exists
- Implementation allowed: NO (not now)
- Notes: staging is conceptually planned, but live external deployment state remains unverified.

## SECURITY-01 — AUTHENTICATION RATE LIMITING

- Status: DEFERRED
- Priority: MEDIUM
- Category: SECURITY
- Purpose: add rate limiting and abuse controls around identity/login endpoints
- Dependencies: current app security baseline, external hosting topology
- Protected files: current auth/session implementation remains protected
- Implementation allowed: NO (not now)

## SECURITY-02 — BROWSER / SECURITY HEADERS

- Status: DEFERRED
- Priority: MEDIUM
- Category: SECURITY
- Purpose: harden HTTP headers and browser security posture for frontend/backend deployment
- Dependencies: external hosting and TLS verification
- Protected files: current app logic remains protected
- Implementation allowed: NO (not now)

## SECURITY-03 — DEPENDENCY SECURITY AUDIT

- Status: DEFERRED
- Priority: MEDIUM
- Category: SECURITY
- Purpose: audit package and Python dependency security posture
- Dependencies: dependency inventory and deployment environment
- Protected files: runtime files remain protected
- Implementation allowed: NO (not now)

## SECURITY-04 — GIT SECRET-HISTORY AUDIT

- Status: DEFERRED
- Priority: HIGH
- Category: SECURITY / GOVERNANCE
- Purpose: review repository and historical state for leaked secret material and operational exposure
- Dependencies: external repo and host verification
- Protected files: not runtime code
- Implementation allowed: NO (not now)

## SECURITY-05 — CONSOLIDATED THREAT MODEL

- Status: DEFERRED
- Priority: MEDIUM
- Category: SECURITY / ARCHITECTURE
- Purpose: create a formal threat model covering browser, frontend, backend, bridge, database, and hosting boundaries
- Dependencies: current architecture and external deployment topology
- Protected files: runtime auth security files remain protected
- Implementation allowed: NO (not now)

## PRIVACY-01 — GDPR / PRIVACY / DATA LIFECYCLE REVIEW

- Status: DEFERRED
- Priority: MEDIUM
- Category: PRIVACY / COMPLIANCE
- Purpose: review identity and food-data lifecycle, retention, and user-data handling
- Dependencies: production-hosting data model and legal requirements
- Protected files: runtime implementation remains protected
- Implementation allowed: NO (not now)

## OPS-01 — BACKUP / RESTORE RESILIENCE

- Status: DEFERRED
- Priority: MEDIUM
- Category: OPERATIONS
- Purpose: define backup, restore, operational resilience, and crash-recovery procedures for hosted deployments
- Dependencies: hosting topology and DB strategy
- Protected files: runtime security files remain protected
- Implementation allowed: NO (not now)

## RELEASE-01 — PRODUCTION RELEASE GATE

- Status: DEFERRED
- Priority: HIGH
- Category: RELEASE / OPERATIONS
- Purpose: define pre-release operational gate for hosting, TLS, cookies, DB, auth, and bridge validation
- Dependencies: external deployment verification
- Protected files: runtime and test files remain protected
- Implementation allowed: NO (not now)

## CRYPTO-01 — PQC / CRYPTO-AGILITY RESEARCH

- Status: DEFERRED
- Priority: LOW / MEDIUM
- Category: RESEARCH / SECURITY
- Purpose: evaluate long-term crypto agility and future-proofing for identity and bridge protocols
- Dependencies: current security model and external architecture decisions
- Protected files: runtime/security files remain protected
- Implementation allowed: NO (not now)

## DOCS-01 — PUBLIC DOCUMENTATION / CURATION

- Status: DEFERRED
- Priority: MEDIUM
- Category: DOCUMENTATION / GOVERNANCE
- Purpose: curate a clean public-facing documentation set separate from private operational and audit material
- Dependencies: publication boundary and external review
- Protected files: runtime code remains protected
- Implementation allowed: NO (not now)

## WORKFLOW RULES

- Preserve the working architecture unless evidence requires change.
- Keep application implementation and deployment work separated.
- Keep feature work and publication work separate.
- Keep security work separate from documentation cleanup.
- Treat external infrastructure status as UNKNOWN unless directly verified.
- Do not infer a live deployment from documentation alone.
