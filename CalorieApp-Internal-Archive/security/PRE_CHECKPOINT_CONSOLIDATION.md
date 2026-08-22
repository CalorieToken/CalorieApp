# CALORIEAPP PRE-CHECKPOINT CONSOLIDATION

Status: Consolidation-only checkpoint review. No cleanup, no file movement, no source edits, no git history changes, no deployment actions.

## Evidence discipline

This document uses explicit labels:

- REPO-EVIDENCE: verified from repository files, code, docs, or git state.
- INFERENCE: reasoned conclusion from the evidence.
- RECOMMENDATION: future action, not a current fact.
- UNKNOWN: not yet verified.
- FACT: currently evidenced from repo or direct implementation.
- TECHNICAL DESIGN: architecture direction, not a runtime fact.
- LEGAL UNKNOWN: not yet resolved by legal review.
- LEGAL REVIEW REQUIRED: legal interpretation remains necessary.

---

## Executive summary

- REPO-EVIDENCE: The working codebase remains a centralized V1 app: Next.js frontend + FastAPI backend + SQLite persistence.
- REPO-EVIDENCE: The identity flow and login-state design are implemented and tested in the backend service layer and backend tests.
- REPO-EVIDENCE: The architecture research docs capture a broader future ecosystem vision, including CalorieDB, IPFS/Helia, XRPL anchoring, provenance graphs, and F&B traceability.
- INFERENCE: The repository is currently in a healthy intermediate state: implemented app + staged auth work + future architecture research. It is not yet a final checkpoint-ready repo because some docs are overlapping, some staging details are still operationally exposed, and the roadmap/future-state boundary is not yet textually unified.
- RECOMMENDATION: The correct checkpoint status is not “cleanup complete,” but “consolidation complete before final cleanup and security hardening.”

---

## Current Project State

| Subsystem | Status | Evidence |
|---|---|---|
| backend | IMPLEMENTED, TESTED | FastAPI app, identity routes, food log routes, and tests in backend/app and backend/tests |
| frontend | IMPLEMENTED, TESTED | Next.js app router UI, Xaman login panel, callback page, and lint/build validation |
| database | IMPLEMENTED, TESTED | SQLite/SQLModel tables for food logs, users, identities, authorization codes, pending login state |
| authentication | IMPLEMENTED, TESTED, STAGING ONLY | Cookie session flow, bridge exchange, replay protection, logout, staging test docs |
| identity bridge | IMPLEMENTED, DOCUMENTED, UNKNOWN PRODUCTION | WordPress/XUMM bridge flow exists in code and docs, live host behavior not verified here |
| staging preparation | DOCUMENTED, STAGING ONLY | Separate staging WordPress/backend/frontend patterns described, not deployed in repo |
| testing | TESTED | backend tests passed; frontend lint and build succeeded in the verified workspace |
| deployment preparation | DOCUMENTED, PARTIALLY IMPLEMENTED | local start scripts and staging plans exist; no repo-native deployment automation |

INFERENCE: the repository is currently an operational V1 app with a hardened identity flow and a substantial future-architecture research layer, not a finalized V2 ecosystem release.

---

## 1. RECENT DEVELOPMENT CONSOLIDATION

### A. Persistent pending login state

- FACT: implemented in backend/app/services/identity.py.
- FACT: PendingLoginStateDB persists state, expiry, status, and consumed state.
- FACT: It is used in backend/app/main.py for identity flow initiation and validation.
- IMPLEMENTED: Yes
- TESTED: Yes, in backend/tests/test_identity.py and backend/tests/test_identity_endpoints.py
- DOCUMENTED: Yes, in docs/IDENTITY_FOUNDATION.md and staging docs
- PARTIALLY DOCUMENTED: Some implementation details are visible in source and docs but not fully unified
- MISSING: No critical omission found for this feature itself
- UNKNOWN: Whether the exact production session model has been fully hardened across all deployment variants remains unknown

### B. Hashed login state

- FACT: hash_login_state() exists in backend/app/services/identity.py.
- FACT: state is hashed before storage and validated against hash values.
- IMPLEMENTED: Yes
- TESTED: Yes, in backend tests for mismatch and replay protection
- DOCUMENTED: Yes, in the identity design doc and code comments
- PARTIALLY DOCUMENTED: Partly documented, but not yet consolidated in the public-facing master docs
- MISSING: No direct omission detected
- UNKNOWN: None significant

### C. Atomic single-use consumption

- FACT: consume_pending_login_state() performs conditional update with status="consumed" and consumed_at timestamps.
- FACT: This is designed to prevent double callback processing.
- IMPLEMENTED: Yes
- TESTED: Yes, replay protection tests exist
- DOCUMENTED: Yes, in identity docs and service-level code comments
- PARTIALLY DOCUMENTED: It is described, but the “atomic semantics” are not yet emphasized as a security boundary in the main docs
- MISSING: Not missing, but could be more clearly explained at the project level
- UNKNOWN: None

### D. Replay protection

- FACT: validate_pending_login_state() and consume_pending_login_state() reject expired and already-consumed states.
- FACT: authorize code validation also checks one-time use and mismatched state/session.
- IMPLEMENTED: Yes
- TESTED: Yes
- DOCUMENTED: Yes
- PARTIALLY DOCUMENTED: Some documentation exists but not consolidated into a single security view
- MISSING: Not missing
- UNKNOWN: None

### E. Restart persistence

- FACT: pending login state is stored in database table PendingLoginStateDB and persisted via SQLite.
- FACT: database init creates tables at startup, and existing schema handling is in backend/app/database.py.
- IMPLEMENTED: Yes
- TESTED: Yes, indirectly via identity tests and the database model behavior
- DOCUMENTED: Yes, but only in service and identity documentation
- PARTIALLY DOCUMENTED: It is described in the staging docs and identity foundation doc, but not in a clean master summary
- MISSING: No critical omission
- UNKNOWN: None

### F. Cleanup

- FACT: cleanup_pending_login_states() removes expired states opportunistically.
- IMPLEMENTED: Yes
- TESTED: Yes, implied by state tests and service design
- DOCUMENTED: Partially
- MISSING: A stronger project-level statement on cleanup policy is still missing
- UNKNOWN: Whether cleanup is sufficient in all production and staging patterns is not yet known

### G. Concurrency testing

- FACT: identity tests cover single-use flow and replay semantics.
- FACT: No broad concurrency stress test was identified in current repo materials.
- IMPLEMENTED: Some concurrency logic is present in the code path, but full stress validation is not clearly evidenced.
- TESTED: Partially
- DOCUMENTED: Partially
- MISSING: Concurrency and lock-step race conditions are not yet clearly documented as a formal test category
- UNKNOWN: Production concurrency behavior remains unproven

### H. Bridge interaction

- FACT: backend/app/main.py performs WordPress bridge validation and exchange.
- FACT: It uses WordPress bridge authorize/exchange endpoints and validates client bridge headers.
- IMPLEMENTED: Yes
- TESTED: Yes, endpoint and service-level tests exist
- DOCUMENTED: Yes, in docs/IDENTITY_FOUNDATION.md and staging docs
- PARTIALLY DOCUMENTED: The bridge relationship is documented but not cleaned up into one canonical narrative
- MISSING: No critical missing element, though the operational trust model still needs explicit separation between staging and production
- UNKNOWN: Real bridge deployment configuration remains outside repo and unverified

### I. Xaman login

- FACT: WordPress/Xaman identity flow is central to the design and frontend UI.
- FACT: Xaman login is referenced in docs and the frontend panel.
- IMPLEMENTED: Yes, at the integration flow level
- TESTED: Staging test checklist exists, but not a live end-to-end verified production deployment in this repo
- DOCUMENTED: Yes
- PARTIALLY DOCUMENTED: The docs are present, but the distinction between conceptual plan and live implementation is still fuzzy in some files
- MISSING: A single authoritative “current implementation vs staged reality” statement is still missing
- UNKNOWN: Real hosted Xaman behavior in production/staging remains unverified

### J. Frontend callback

- FACT: frontend/app/auth/callback/page.tsx posts code+state to the backend callback endpoint.
- FACT: The state is validated server-side.
- IMPLEMENTED: Yes
- TESTED: Yes, endpoint flow and user-session tests support it
- DOCUMENTED: yes
- PARTIALLY DOCUMENTED: It is described but not consistently summarized across docs
- MISSING: No obvious omission
- UNKNOWN: None

### K. Session handling

- FACT: get_current_user() reads the calorieapp_user_id cookie and validates it.
- FACT: backend session cookie is set on successful callback.
- IMPLEMENTED: Yes
- TESTED: Yes, app and identity tests cover session flows, though not all edge cases were fully enumerated
- DOCUMENTED: Yes
- PARTIALLY DOCUMENTED: More explicit Cookie/SameSite/Secure boundary guidance would help
- MISSING: Not missing for the app, but more explicit production host guidance is still needed
- UNKNOWN: Real production cookie deployment assumptions remain unverified

### L. Staging authentication

- FACT: docs/STAGING_DEPLOYMENT_PLAN.md and docs/STAGING_XAMAN_TEST.md clearly describe staging WordPress, backend, frontend, database isolation, and env separation.
- IMPLEMENTED: Staging design is documented, not executed in repo.
- TESTED: The documents outline a test sequence, but no actual staging deployment is present in repo state.
- DOCUMENTED: Yes
- PARTIALLY DOCUMENTED: The design is strong, but operational detail is not yet separated from public docs in a clean way
- MISSING: A clearer “verified existing vs proposed staging architecture” statement is still missing
- UNKNOWN: Real staging deployment details remain external to repo

### Consolidated result

The recent development work is largely present across the repo, but it is fragmented across:

- backend source
- tests
- identity docs
- staging docs
- architecture docs

This is enough to preserve the work, but not yet enough for a single canonical source-of-truth checkpoint.

---

## 2. STAGING / HOSTING CONSOLIDATION

### Verified existing vs proposed

| Item | Status |
|---|---|
| localhost:3000 frontend | VERIFIED EXISTING |
| 127.0.0.1:8000 backend | VERIFIED EXISTING |
| Vercel frontend pattern | PROPOSED |
| Railway backend pattern | PROPOSED |
| Render backend pattern | PROPOSED / REFERENCES ONLY |
| production app.calorietoken.net domain | PROPOSED / DOCUMENTED ONLY |
| calorietoken.net WordPress/XUMM host | DOCUMENTED / PROPOSED / EXTERNAL IN DOCS |
| staging-app.calorietoken.net | PROPOSED |
| staging-api.calorietoken.net | PROPOSED |
| staging-wp.calorietoken.net | PROPOSED |
| WordPress staging site | PROPOSED |
| staging bridge secret | PROPOSED |
| staging database isolation | PROPOSED |
| HTTPS requirement | FACT / TECHNICAL DESIGN |
| CORS separation | FACT / TECHNICAL DESIGN |
| cookies and secure session handling | FACT / TECHNICAL DESIGN |
| callback allowlists | PROPOSED / REQUIRED |
| domain/subdomain considerations | FACT AS DOCS TOPIC, UNKNOWN AS LIVE CONFIG |

### Key finding

The stage docs are good at describing the architecture, but they should not be automatically treated as a verified deployment reality. The repo does not contain a real hosted deployment, and no actual production/staging platform configuration is present here.

### Important distinction

- Verified existing: local development and code paths in repo.
- Proposed: deployment patterns described in docs.
- Unknown: actual hostnames, credentials, DNS state, and live platform assignments outside repo.

---

## 3. DECENTRALIZED ARCHITECTURE CONSOLIDATION

### Components captured

| Topic | Status |
|---|---|
| CalorieDB | RESEARCH |
| IPFS | RESEARCH |
| Helia | RESEARCH |
| encrypted data | RESEARCH / TECHNICAL DESIGN |
| decentralized storage | RESEARCH |
| central indexing | TECHNICAL DESIGN |
| privacy | RESEARCH / FACT |
| GDPR | LEGAL UNKNOWN / LEGAL REVIEW REQUIRED |
| data deletion | TECHNICAL DESIGN |
| physical-to-digital trust | FACT / ESSENTIAL DESIGN BOUNDARY |

### Evidence from repo

- DECENTRALIZED_ARCHITECTURE_V1.md clearly frames CalorieDB as a future design concept rather than existing implementation.
- CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md defines a layered model: user/device, CalorieDB, XRPL.
- The docs properly say that the present codebase remains a centralized app and that blockchain/IPFS/BigchainDB are future-phase references only.

### Important point

The physical-to-digital trust boundary is preserved as a crucial concept: the architecture does not claim that blockchain or ledger data itself proves physical truth. That is an important and correct principle.

---

## 4. NATIVE APPLICATION CONSOLIDATION

### Captured OS coverage

| OS | Status |
|---|---|
| Android | RESEARCH / FUTURE |
| iOS | RESEARCH / FUTURE |
| Windows | RESEARCH / FUTURE |
| macOS | RESEARCH / FUTURE |
| Linux | RESEARCH / FUTURE |

### Core conceptual roles captured

| Concept | Status |
|---|---|
| consumer app | FACT / IMPLEMENTED NOW |
| optional Calorie Node | RESEARCH / OPTIONAL |
| advanced infrastructure operator | RESEARCH / FUTURE |
| separate XRPL validator | RESEARCH / FUTURE |

### Important clarification captured

- Consumer app and validator are deliberately separated.
- Mobile node functionality is clearly documented as constrained by OS lifecycle/battery rules.
- Validator operation is treated as a dedicated infrastructure role, not a consumer default.

This is an important conceptual improvement and is consistent with the product guardrails.

---

## 5. XRPL / $CAL CONSOLIDATION

### Required architecture direction

This must be captured explicitly: $CAL on XRPL is a core long-term ecosystem element.

### Present in docs

- CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md includes layered ecosystem logic: Calorie ecosystem ↕ XRPL ↕ transaction hashes ↕ CalorieDB.
- It describes potential future use of $CAL transactions, NFT transactions, ownership, payments, provenance anchors, transaction hashes, ledger references.
- This is not implemented and is correctly marked as future design.

### Important status statement

This is clearly research-only and not a current implementation. That distinction is important to preserve.

### Missing or weak area

The repo docs are generally good on the concept, but a clearer explicit statement that “$CAL is a future ecosystem layer, not a V1 product feature” would help further reduce confusion.

---

## 6. NFT CONSOLIDATION

### Current captured direction

- NFTs are covered in future architecture documents as a possible utility layer beyond recipes and menu items.
- The architecture research does include more general future utility: recipes, menus, products, production, distribution, wholesale, retail, provenance, certificates, digital product identities.

### Status

- DOCUMENTED: Yes
- IMPLEMENTED: No
- TESTED: No
- FUTURE: Yes
- RESEARCH: Yes

### Important clarification

This is preserved as research/future only and is not treated as product implementation. That is consistent with the V1 guardrails.

---

## 7. F&B TRACEABILITY CONSOLIDATION

### Captured chain conceptually

The provenance graph direction is clearly present in the architecture docs and ecosystem design:

- source
- sample
- laboratory
- result
- production batch
- processing
- packaging
- distribution
- wholesale
- retail
- consumer

This is a strong conceptual capture and should remain.

### Important boundary retained

- The docs correctly avoid claiming that blockchain proves physical truth.
- The physical-to-digital trust boundary remains explicit and should be maintained in any final checkpoint documentation.

### Missing details

A more explicit “trust boundary statement” could still be added, but it is already present in substance.

---

## 8. DNA / BIOLOGICAL DATA CONSOLIDATION

### Captured concepts

The architecture massaging includes references to:

- cattle DNA
- fish DNA/barcoding
- crop/plant samples
- laboratory analysis
- contamination testing
- nutritional testing
- certificates

### Required pattern

The architecture correctly distinguishes:

- physical sample
- trusted laboratory
- digital result
- cryptographic hash
- secure storage
- CalorieDB
- optional XRPL anchor

### Important guardrail

- Sensitive biological data is not positioned as a direct XRPL payload.
- This is correctly treated as future design and not a current implementation.

---

## 9. INDUSTRY STANDARDS CONSOLIDATION

### Captured or implied

| Topic | Status |
|---|---|
| GS1 | RESEARCH / PARTIALLY CAPTURED |
| EPCIS | RESEARCH / PARTIALLY CAPTURED |
| food traceability standards | RESEARCH / CAPTURED |
| Digital Product Passport | RESEARCH / CAPTURED |
| EU food / supply-chain frameworks | RESEARCH / CAPTURED |

### Assessment

There is clear contextual awareness of standards, but the repo does not yet present one authoritative crosswalk of “standard -> architecture mapping -> product implications.” That is a documentation gap, not an implementation gap.

---

## 10. NODE / COMMUNITY CONSOLIDATION

### Captured concepts

- Calorie Node Operator is clearly described as a future role.
- Potential contributions include storage, relay, indexing, infrastructure support.
- Potential incentives include reputation, recognition, badges, contribution metrics, and possibly $CAL.

### Important boundary

These incentives are explicitly treated as future/legal-review territory and not as current product logic. This is important and should remain.

---

## 11. VALIDATOR CONSOLIDATION

### Captured distinction

The architecture clearly separates:

- Calorie Node
- XRPL Validator

This is one of the more important pieces of future architecture clarity.

### Status

- DOCUMENTED: Yes
- IMPLEMENTED: No
- GOOD: Yes
- RISK: Low if maintained

This distinction avoids the mistaken idea that every phone or consumer app should become a validator.

---

## 12. COMPLIANCE CONSOLIDATION

### Captured concepts

- MiCA
- GDPR
- privacy
- consumer protection
- app-store policies
- data protection
- biological information
- supply-chain claims
- financial functionality
- non-custodial architecture
- worldwide regulatory uncertainty

### Important classification

The docs consistently maintain:

- FACT
- TECHNICAL DESIGN
- LEGAL UNKNOWN
- LEGAL REVIEW REQUIRED

This is a good boundary. The repo does not claim legal compliance; it explicitly leaves legal interpretation to review.

---

## 13. ROADMAP CONSOLIDATION

### Current roadmap status

The repo roadmap is still narrower than the architecture documents and is missing a bridge between the current app and the future multi-layer ecosystem.

### Missing or contradictory roadmap elements

| Missing / weak area | Status |
|---|---|
| identity hardening phase | MISSING or underdeveloped |
| staging phase | DOCUMENTED but not a dedicated roadmap milestone |
| architecture consolidation phase | PARTIALLY PRESENT in docs but not in roadmap |
| decentralized POC | MISSING from roadmap |
| encrypted records | MISSING from roadmap |
| IPFS phase | PRESENT in architecture but not in a clean roadmap phase |
| XRPL anchoring | PRESENT as future/direction but not cleanly sequenced |
| CalorieDB phase | PRESENT as research but not roadmaped |
| native apps | DOCUMENTED in research but not in roadmap |
| F&B provenance pilot | MISSING or incomplete |
| community nodes | RESEARCH / missing roadmap phase |
| infrastructure operators | RESEARCH / missing roadmap phase |
| validator research | RESEARCH / missing roadmap phase |

### Assessment

The roadmap is currently less comprehensive than the architecture research. This is a documentation gap, not a code gap.

---

## 14. DOCUMENTATION CONSISTENCY MATRIX

| Topic | Documented? | Implemented? | Tested? | Consistent? | Missing information? |
|---|---|---|---|---|---|
| Identity | Yes | Yes | Yes | Mostly | Needs clearer production/staging separation |
| Staging | Yes | No real staging deployment in repo | Planned only | Mostly | Real hostnames and actual deployment details remain external |
| CalorieDB | Yes | No | No | Yes, as research | Need clearer roadmap phase |
| IPFS | Yes | No | No | Yes | Need retention/pinning policy statement |
| XRPL | Yes | No | No | Mostly | Need explicit $CAL future positioning as ecosystem detail |
| $CAL | Yes | No | No | Partially | Need a single explicit future-state statement |
| NFTs | Yes | No | No | Mostly | Need broader provenance and certificate utility summary |
| F&B traceability | Yes | No | No | Yes | Strong conceptual capture, but could use a clearer trust-boundary statement |
| DNA/lab data | Yes | No | No | Yes | Need stronger distinction between physical samples and digital evidence |
| Native apps | Yes | No | No | Yes | Needs explicit OS/runtime limitations |
| Nodes | Yes | No | No | Yes | Need operational/legal caveats |
| Validators | Yes | No | No | Yes | Need more explicit advanced-infra separation |
| GDPR | Yes | No | No | Yes | Legal review required |
| MiCA | Yes | No | No | Partially | Legal review required |
| Roadmap | Yes | Partially | No | Partially | Missing phases and sequencing |

---

## 15. LOST / MISSING IDEAS CHECK

### Items found

- XRPL transaction hash correlation: Found as architecture concept in ecosystem docs.
- $CAL ecosystem integration: Found as future direction.
- NFT utility beyond recipes: Found in research docs as broader provenance and product identity concepts.
- F&B provenance: Found.
- cattle/fish/vegetable traceability: Found.
- DNA/sample data: Found.
- laboratory verification: Found.
- Calorie Nodes: Found.
- native apps: Found.
- community participation: Found.
- validator separation: Found.
- decentralized storage: Found.
- physical-to-digital trust: Found.

### Missing or weakly represented

| Concept | Status |
|---|---|
| single canonical roadmap sequence from current app to future ecosystem | Missing |
| explicit relationship between $CAL and CalorieDB | Partially present but not fully unified |
| crisp separation between public docs and private/internal infra docs | Partially present but not fully enforced |
| strong “documented current app vs future ecosystem” summary | Missing from a single master document |
| legal review mapping for MiCA/GDPR/consumer protection | Present in principle, but not fully integrated |

### Overall assessment

The important architecture ideas are not lost. The main issue is not omission so much as fragmentation and lack of a final consolidated checkpoint narrative.

---

## 16. CURRENT STATE VS FUTURE STATE

| Classification | Status |
|---|---|
| IMPLEMENTED NOW | centralized V1 CalorieApp web app, FastAPI backend, SQLite persistence, food logging, identity auth flow, frontend callback, Open Food Facts search |
| STAGED / BEING PREPARED | staging architecture, bridge environment separation, identity hardening plan, HTTPS/CORS/cookie rules |
| RESEARCH | CalorieDB, Helia/IPFS, community node roles, native apps, provenance graphs, DNA/lab trust architecture |
| FUTURE | XRPL anchoring, $CAL utility, NFT ecosystem, validator operations, broader decentralized platform concepts |
| OPTIONAL | Calorie Node, relay/pinning, local encrypted storage, optional integrity anchors |
| UNKNOWN | exact production host model, real hosted deployment details, legal interpretations for cross-border product evolution |

---

## 17. CHECKPOINT READINESS

### Decision

NOT READY

### Why not

- The repo has strong architecture research but still lacks final consolidation into a single clear checkpoint narrative.
- The roadmap is less comprehensive than the future architecture documents.
- Staging docs are valuable, but they are not yet cleanly separated from public product docs.
- Some operational details remain too exposed in the repository for a clean public-facing checkpoint.
- The current code is functionally good, but the repo is not yet in a final “security cleanup + documentation consolidation + final checkpoint” state.

### What remains before final checkpoint

- Final documentation consolidation across architecture, identity, and roadmap.
- Clear separation of implemented vs future docs.
- Final security review and cleanup pass.
- Review of public/private classification of docs and infrastructure references.
- Decision on roadmap sequencing and milestone split.
- Final repository hygiene before any git checkpoint or public exposure.

---

## Transaction Correlation

- REPO-EVIDENCE: The ecosystem architecture doc defines transaction hashes, XRPL references, and ledger references as a first-class concept.
- REPO-EVIDENCE: CalorieDB is described as the contextual layer that ties rich records to a compact XRPL reference.
- INFERENCE: transaction correlation is meant to bridge digital record, XRPL transaction hash, ledger/network, and interpretation, but it is not implemented in runtime code.

Conceptual categories to preserve:
- PAYMENT
- CAL_TRANSFER
- NFT_MINT
- NFT_TRANSFER
- PROVENANCE_ANCHOR
- OWNERSHIP
- REWARD
- SUPPLY_CHAIN_EVENT

---

## Native Applications

- REPO-EVIDENCE: the native-platform research doc explicitly covers Android, iOS, Windows, macOS, and Linux as future targets.
- INFERENCE: the native path is optional future work, not current implementation.
- INFERENCE: consumer app, node/operator, and validator roles must remain separate across platform families.

---

## Calorie Nodes

- REPO-EVIDENCE: the ecosystem architecture defines an optional Calorie Node participant role.
- INFERENCE: node operation is opt-in, transparent, and user-controlled, with possible storage, relay, indexing, and availability support.
- INFERENCE: mobile devices must not be treated as always-on infrastructure by default because battery, storage, CPU, and network cost matter.

---

## XRPL Validators

- REPO-EVIDENCE: the architecture separates Calorie Nodes from XRPL validator operation.
- INFERENCE: validator operation is an advanced infrastructure role, not a consumer default and not a mobile-device assumption.
- UNKNOWN: no validator runtime exists in this repository.

---

## CalorieDB

- REPO-EVIDENCE: the repository documents CalorieDB as a logical architecture/protocol layer, not a runtime service in code.
- REPO-EVIDENCE: no CalorieDB implementation files exist in the backend or frontend runtime.
- INFERENCE: CalorieDB currently exists only as a conceptual provenance, metadata, content-reference, and relationship layer.
- INFERENCE: the long-term intent is that CalorieDB can connect F&B data, decentralized content, XRPL references, and CalorieApp.

---

## XRPL / $CAL

- REPO-EVIDENCE: the ecosystem architecture states that $CAL on XRPL is a core long-term ecosystem component.
- REPO-EVIDENCE: the docs explicitly treat $CAL as a public ledger layer element, not the baseline consumer workflow.
- INFERENCE: $CAL is future ecosystem logic, not a V1 product feature.
- INFERENCE: no XRPL transaction, token transfer, or wallet logic is implemented in the current codebase.

---

## NFTs

- REPO-EVIDENCE: the ecosystem architecture covers NFT utility beyond recipes and menus.
- REPO-EVIDENCE: it includes products, production batches, certificates, provenance, supply-chain assets, digital product identities, distribution, wholesale, retail, and access/membership utilities.
- INFERENCE: NFTs are future/research-only unless a working implementation appears later.

---

## F&B Provenance

- REPO-EVIDENCE: the architecture documents a provenance chain from source through sample, laboratory, result, production batch, processing, packaging, distribution, wholesale, retail, and consumer.
- REPO-EVIDENCE: the docs explicitly warn that blockchain alone does not prove physical truth.
- INFERENCE: provenance is a core ecosystem direction for authenticity, recalls, contamination tracing, batch isolation, and supply-chain visibility.

---

## Biological / Laboratory Traceability

- REPO-EVIDENCE: the ecosystem architecture includes cattle DNA, fish DNA/barcoding, crop/plant samples, laboratory analysis, contamination testing, pesticide/residue testing, nutritional testing, and certificates.
- REPO-EVIDENCE: the docs explicitly preserve the distinction between physical truth, digital truth, and ledger truth.
- INFERENCE: raw biological data should not be treated as a direct public-ledger payload.
- INFERENCE: the preserved conceptual chain is physical sample -> trusted laboratory -> digital result -> cryptographic hash -> secure/encrypted storage -> CalorieDB -> optional XRPL anchor.

---

## Treasury & Incentive Framework

- USER-PROVIDED CURRENT STATE: the current Calorie treasury reportedly holds more than 25% of total CAL supply.
- USER-PROVIDED CURRENT STATE: this balance figure requires on-ledger verification and is not independently confirmed by this task.
- REPO-EVIDENCE: the repository does not implement a treasury system, treasury governance system, or incentive program.
- INFERENCE: the future concept should remain named as the CALORIE ECOSYSTEM TREASURY & INCENTIVE FRAMEWORK.
- INFERENCE: future incentives should be framed around useful ecosystem contribution, not merely transaction volume.

Potential contribution categories to preserve conceptually:
- node uptime
- storage
- bandwidth
- indexing
- availability
- verified provenance services
- infrastructure
- development
- community services

Risks to preserve conceptually:
- Sybil attacks
- fake nodes
- reward farming
- artificial activity
- collusion
- manipulation
- treasury drain
- concentration

---

## Blackholed Issuer

- USER-PROVIDED CURRENT STATE: the original CAL issuer is believed to be blackholed.
- USER-PROVIDED CURRENT STATE: this requires on-ledger verification and is not confirmed by repository evidence in this task.
- UNKNOWN: the repository does not prove issuer settings or whether issuer-level configuration can still be changed.
- INFERENCE: if the issuer is truly blackholed, issuer-level fee changes or issuer reconfiguration may be constrained or impossible.

---

## XRPL Fees vs Calorie Fees

- INDUSTRY-STANDARD: XRPL native transaction costs are protocol/network fees on the ledger.
- INFERENCE: XRPL native costs are not Calorie revenue by default.
- INFERENCE: the repository does not show any mechanism that redirects XRPL network fees to a Calorie treasury.
- INFERENCE: Calorie application fees, service fees, ecosystem fees, and treasury-funded incentives must be treated as a separate economic layer from XRPL network costs.

---

## Treasury Governance

- REPO-EVIDENCE: no treasury governance implementation exists in code.
- INFERENCE: governance questions remain open, including who controls the treasury, who proposes spending, who approves spending, how many signatures are required, and how transparency is enforced.
- RECOMMENDATION: treat multisignature, voting, proposals, spending limits, multiple treasury addresses, emergency controls, and transparency as research questions only.

---

## Economic Sustainability

- INFERENCE: sustainability depends on treasury depletion risk, reward emissions, contribution measurement, market impact, liquidity, transparency, and long-term funding stability.
- UNKNOWN: no tokenomics or treasury economics model is implemented or verified in this repository.
- RECOMMENDATION: do not assume that fees are required or that every transaction must carry a fee.

---

## Privacy / GDPR

- REPO-EVIDENCE: the architecture docs preserve data minimization, encryption, access control, retention, and deletion concerns.
- REPO-EVIDENCE: decentralized storage and immutable ledger considerations are explicitly discussed.
- LEGAL REVIEW REQUIRED: GDPR interpretation for encrypted content-addressed records, deletion posture, and controller/processor roles is unresolved.
- LEGAL UNKNOWN: biological information and supply-chain evidence handling may trigger additional privacy obligations depending on jurisdiction and deployment.

---

## MiCA / Financial Compliance

- REPO-EVIDENCE: the docs explicitly treat technical feasibility as distinct from regulatory permission.
- LEGAL REVIEW REQUIRED: any future $CAL-related functionality, incentives, payments, or token utility must be reviewed separately from technical architecture.
- UNKNOWN: the repository does not establish MiCA compliance or crypto-asset service classification.

---

## Documentation Consistency

| Topic | Implemented? | Tested? | Documented? | Consistent? | Missing? |
|---|---|---|---|---|---|
| Identity | Yes | Yes | Yes | Mostly | Production/staging boundary needs sharper wording |
| Authentication | Yes | Yes | Yes | Mostly | Concurrency and production host assumptions need continued clarity |
| Staging | No live staging deployment in repo | Partial | Yes | Mostly | Verified hostnames and runtime assignment remain unknown |
| CalorieDB | No | No | Yes | Mostly | Needs a roadmaped prototype boundary |
| IPFS | No | No | Yes | Mostly | Retention/pinning policy not finalized |
| Helia | No | No | Yes | Mostly | Browser/offline implementation still future-only |
| XRPL | No | No | Yes | Mostly | No runtime integration and no on-ledger verification in repo |
| $CAL | No | No | Yes | Mostly | Future-state statement should remain explicit |
| transaction correlation | No | No | Yes | Mostly | Not implemented, only conceptual |
| NFTs | No | No | Yes | Mostly | Utility boundary should stay research-only |
| F&B traceability | No | No | Yes | Mostly | Trust-boundary statement should stay explicit |
| DNA/lab data | No | No | Yes | Mostly | Sensitive-data handling and legal review remain open |
| native applications | No | No | Yes | Mostly | OS/runtime limitations need continuous clarity |
| Calorie Nodes | No | No | Yes | Mostly | Operational/legal caveats still open |
| validators | No | No | Yes | Mostly | Must remain separate from consumer roles |
| treasury | No | No | Partially | No | Governance and on-ledger verification are missing |
| incentives | No | No | Partially | No | No reward logic exists and legal review is required |
| GDPR | No | No | Yes | Mostly | Legal review required |
| MiCA | No | No | Yes | Mostly | Legal review required |
| roadmap | Partially | No | Yes | Partially | Sequencing gaps remain |

---

## Lost / Missing Ideas

- REPO-EVIDENCE: transaction hash correlation, $CAL, NFT utility, provenance, cattle/fish/vegetable traceability, DNA/lab verification, CalorieDB, IPFS, Helia, native applications, Calorie Nodes, validator separation, community participation, and decentralized storage are all represented in repository docs.
- REPO-EVIDENCE: the biggest gap is not that these ideas vanished, but that they are fragmented across several research and planning documents.
- USER-PROVIDED CURRENT STATE: the blackholed-issuer constraint and the existing treasury balance claim are not independently verified in this task and should remain explicitly flagged.
- INFERENCE: the main loss-risk is consolidation drift, not absence of ideas.

---

## Current / Next / Future Classification

| Classification | Meaning in this repo |
|---|---|
| IMPLEMENTED NOW | Centralized CalorieApp web app, FastAPI backend, SQLite persistence, food logging, identity auth flow, frontend callback, Open Food Facts search |
| STAGING / PREPARATION | staging docs, bridge env separation, HTTPS/CORS/cookie rules, first real Xaman test planning |
| NEXT DEVELOPMENT | finish current hardening work, close documentation gaps, verify public/private boundaries, complete security audit |
| RESEARCH | CalorieDB, IPFS, Helia, provenance graphs, DNA/lab traceability, native applications, nodes, validators, treasury concepts |
| FUTURE | XRPL anchoring, $CAL utility, NFTs, community infrastructure, validator operations, broader ecosystem layers |
| OPTIONAL | Calorie Node, relay/pinning, local encrypted storage, optional integrity anchors |
| SPECULATIVE | final governance mechanics, reward formulas, tokenomics, DAO design, exact treasury structure |
| UNKNOWN | live host deployment, real on-ledger treasury state, issuer blackhole status, legal interpretations |

---

## Roadmap Gap Analysis

- REPO-EVIDENCE: the current roadmap covers MVP, wallet extension, decentralized media, and immutable logging.
- INFERENCE: it does not yet fully sequence the newer architecture material into a detailed path from current app to future ecosystem.
- Missing or weak roadmap elements:
	- identity hardening phase
	- staging phase
	- architecture checkpoint phase
	- decentralized POC
	- encrypted CalorieRecords
	- IPFS/Helia phase
	- XRPL transaction references
	- CalorieDB prototype
	- F&B provenance prototype
	- native applications
	- Calorie Node research phase
	- treasury research
	- incentive research
	- validator research

---

## Final Checkpoint Readiness

Decision: NOT READY

Why:
- the important recent work has been captured, but not yet merged into a final public/private and roadmap-consolidated baseline
- some staging and operational details remain too exposed for a final checkpoint
- treasury, issuer, and incentive questions remain unresolved and unverified
- the roadmap still trails the architecture research in maturity

---

## Recommended Next Steps

1. Review this consolidation and confirm nothing important is missing.
2. Finish any currently important pre-checkpoint development work.
3. Run a focused security and git-history audit.
4. Back up the working tree and local database artifacts privately.
5. Perform approved cleanup only after the security pass.
6. Consolidate overlapping documentation and separate implemented from future-only material.
7. Make the public/private repository decision.
8. Decide whether a license is needed and under what governance model.
9. Update README and roadmap after the governance decision.
10. Create the formal git checkpoint or backup.
11. Write a separate decentralized POC specification.
12. Implement the decentralized POC only after the spec and governance model are settled.

---

## Risk Register

| Risk | Category | Evidence | Impact | Status |
|---|---|---|---|---|
| Local .env and DB files may be exposed by accident | Security | workspace and audit output | High | Active |
| Future architecture documents may be mistaken for implemented functionality | Documentation | docs vs code mismatch | High | Active |
| Staging identity and production identity may be conflated | Security / Identity | staging docs and auth docs | High | Active |
| Repo is not clean and not release-ready | Operational | modified and untracked files | Medium | Active |
| Long-term ecosystem features are not yet separated from the app baseline | Architecture | research docs vs runtime code | High | Active |
| Treasury, issuer, and incentive assumptions remain unverified | Governance / Legal | user-provided state not on-ledger verified | High | Active |
| Roadmap sequencing still lags architecture depth | Planning | roadmap vs research docs | Medium | Active |

---

## Final Status

Important work confirmed:
- persistent pending login state is implemented and tested
- login-state hashing and single-use consumption are implemented and tested
- replay protection is present and documented
- bridge interaction and Xaman login flow are in the repo and staged in docs
- frontend callback and session handling are implemented
- future architecture work on CalorieDB, IPFS/Helia, native applications, nodes, validators, provenance, treasury, and incentives is captured

Missing information:
- final canonical roadmap sequence
- final public/private doc boundary
- final staging-vs-production doc boundary
- on-ledger verification for treasury and issuer claims
- final legal review mapping for GDPR, MiCA, and incentive policy concerns

Documentation gaps:
- current app vs future architecture separation is not yet fully canonicalized
- roadmap is narrower than the research docs
- some staging and identity details are not yet cleanly separated from public-facing content
- public and private architecture narrative could be better standardized

Contradictions:
- the code is centralized and real; the ecosystem docs are future and conceptual
- some docs describe production and staging assumptions without a clean verified-vs-proposed boundary
- roadmap maturity lags behind architecture research depth

Unresolved technical questions:
- what the final CalorieDB implementation boundary should be
- how transaction correlation should be represented in later prototypes
- what the production environment matrix should be for identity and callback flows
- whether any future incentive logic should be separate from token utility or service fees

Unresolved legal questions:
- GDPR handling for encrypted, content-addressed, and possibly distributed records
- MiCA and broader crypto-asset classification for any future $CAL utility or incentives
- consumer protection and app-store interpretation for optional verification and reward features
- governance and taxation implications of treasury or incentive distributions

Remaining work before final checkpoint:
- security cleanup phase
- documentation consolidation phase
- roadmap harmonization
- public/private boundary classification
- final checkpoint and repo hygiene

PRE-CHECKPOINT CONSOLIDATION COMPLETE
