# CalorieApp Phase 6B Documentation Boundary

Status: Conservative documentation boundary definition and curation guidance.

## 1. Public Documentation Set

Current public baseline:

- README.md
- docs/public/architecture.md
- docs/public/roadmap.md

Public-candidate documents requiring redaction review before broad publication:

- docs/CLOUD_DEPLOYMENT.md
- docs/deployment-readiness-checklist.md

Decision in this phase:

- Keep the baseline public set unchanged.
- Keep deployment documents as review candidates, not automatically promoted.

## 2. Public Architecture Boundary

docs/public/architecture.md should describe only current implemented architecture:

- Next.js frontend UI layer
- FastAPI backend API/data layer
- SQLite persistence for current app state
- Open Food Facts integration
- V1 non-financial scope constraints

It must not present the following as implemented:

- CalorieDB
- IPFS
- Helia
- XRPL runtime transaction logic
- Validators
- Community nodes
- Treasury or incentive mechanisms
- Native app operator infrastructure

Permitted mention style for future topics:

- FUTURE
- PROPOSED
- RESEARCH

## 3. Public Roadmap Boundary

docs/public/roadmap.md should remain a public planning surface, not a proof-of-implementation file.

Roadmap boundary rules:

- Clearly separate ACTIVE implementation from FUTURE phases.
- Mark non-implemented phases as PROPOSED.
- Avoid operational staging details.
- Avoid unverified claims about token supply, issuer status, or treasury state.

## 4. README Boundary

README must contain:

- Product identity and strict V1 scope
- Implemented frontend/backend split
- Current local run/test instructions
- Public doc links for architecture and roadmap

README must not claim:

- Implemented CalorieDB, IPFS, Helia, XRPL finance/token runtime
- Implemented validator or node infrastructure
- Verified treasury balance or issuer status
- Production deployment status unless explicitly verified

README may safely mention:

- High-level future ecosystem intent as PROPOSED/RESEARCH only

## 5. Research Documentation Classification

Classification: INTERNAL RESEARCH (preserved, not deleted, not collapsed into public architecture in this phase).

- docs/research/CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- docs/research/DECENTRALIZED_ARCHITECTURE_V1.md
- docs/research/NATIVE_PLATFORM_ARCHITECTURE_V1.md

Rationale:

- They preserve strategic architecture memory and future concepts.
- They are valuable but broader and more operationally sensitive than current public-product documentation.

## 6. Internal Documentation Classification

Classification: INTERNAL.

- docs/IDENTITY_FOUNDATION.md
- docs/STAGING_DEPLOYMENT_PLAN.md
- docs/STAGING_XAMAN_TEST.md

Rationale:

- Identity/staging documents include operational detail, endpoint contracts, and environment assumptions that are useful internally but not ideal as default public-facing docs.

## 7. Private Archive Classification

Classification: PRIVATE ARCHIVE (project history/security/checkpoint memory).

- PRE_CHECKPOINT_CONSOLIDATION.md
- SECURITY_GIT_FORENSIC_AUDIT.md
- PRESERVATION_PUBLIC_PRIVATE_PLAN.md
- SNAPSHOT_VERIFICATION_REPORT.md
- V2_CHECKPOINT_AUDIT.md
- V2_SECURITY_EXPOSURE_AUDIT.md
- REPOSITORY_CLEANUP_PROPOSAL.md
- checkpoints/

Rationale:

- These artifacts are high-value historical records and should be preserved, but they are not part of the clean public product narrative.

## 8. Deployment Documentation Classification

Classification decisions:

- docs/CLOUD_DEPLOYMENT.md: PUBLIC AFTER REDACTION REVIEW
- docs/deployment-readiness-checklist.md: PUBLIC AFTER REDACTION REVIEW
- docs/STAGING_DEPLOYMENT_PLAN.md: INTERNAL
- docs/STAGING_XAMAN_TEST.md: INTERNAL

Boundary logic:

- Public deployment guidance can exist at high level.
- Staging topology, hostnames, and operational runbooks remain internal by default.

## 9. Identity Documentation Classification

Classification decision:

- docs/IDENTITY_FOUNDATION.md: INTERNAL in current form.

Reason:

- The document is rich and useful but currently includes detailed bridge flow and environment-level operational context.
- It can later be split into a public identity overview plus an internal operational supplement.

## 10. Reference Repair Analysis

Searched references to moved paths:

- docs/architecture.md
- docs/roadmap.md
- CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md
- DECENTRALIZED_ARCHITECTURE_V1.md
- NATIVE_PLATFORM_ARCHITECTURE_V1.md

Classification of references found:

- Public/current references: minimal, no runtime-impacting break identified.
- Active research references: present inside docs/research files; these may reference old paths as historical citations.
- Internal/historical references: extensive in audit/checkpoint/planning documents.

Repair policy applied in Phase 6B:

- Do not rewrite historical audit/checkpoint records just to normalize paths.
- Defer broad reference normalization to a later controlled docs-refresh phase.
- Preserve historical readability over cosmetic path consistency in private history files.

## 11. XRPL / CAL Disclosure Boundary

Current public-safe statement:

- V1 implementation does not include XRPL financial runtime behavior.

Future research-safe statement:

- XRPL transaction-hash correlation and CAL ecosystem concepts are future research/proposed direction.

Prohibited public claim in current phase:

- Any statement implying implemented XRPL token/payment runtime in current app.

## 12. NFT / Provenance Disclosure Boundary

Current public-safe statement:

- NFT/provenance topics are not implemented in current V1 runtime.

Future research-safe statement:

- NFT utility for provenance and broader food ecosystem traceability is under evaluation.

Prohibited public claim:

- Any claim that NFT provenance infrastructure is currently active in production.

## 13. Biological/Laboratory Traceability Disclosure Boundary

Current public-safe statement:

- Biological/laboratory traceability is not a current implemented feature.

Future research-safe statement:

- It is a research direction for future ecosystem architecture.

Prohibited public claim:

- Any claim of current validated laboratory-chain evidence pipelines in production.

## 14. Native Application Disclosure Boundary

Current public-safe statement:

- Current implementation focus is web application architecture.

Future research-safe statement:

- Native Android, iOS, Windows, macOS, and Linux directions are research/proposed future tracks.

Prohibited public claim:

- Any statement implying deployed native production clients from this repository.

## 15. Node / Validator Disclosure Boundary

Current public-safe statement:

- Node and validator infrastructure is not implemented in current V1 runtime.

Future research-safe statement:

- Community nodes and validator/operator models are future research and governance topics.

Prohibited public claim:

- Any claim that validator or node incentive infrastructure is live.

## 16. Treasury / Incentive Disclosure Boundary

Current public-safe statement:

- Treasury/incentive mechanisms are not implemented in current V1 runtime.

Future research-safe statement:

- Treasury-controlled incentives, node rewards, validator rewards, and governance are future research areas.

Unverified-claim boundary:

- Do not publish exact treasury holdings as fact without independent verification.
- Do not publish issuer-status claims as verified without independent verification.

## 17. Recommended Future Public Documentation Structure

Recommended structure for curated public docs:

- README.md
- docs/public/architecture.md
- docs/public/roadmap.md
- docs/public/deployment.md (future curated version, derived from current deployment docs)
- docs/public/release-readiness.md (future curated version)

Research and internal separation retained:

- docs/research/* remains research memory
- docs/IDENTITY_FOUNDATION.md and staging docs remain internal until split/redaction
- checkpoint and forensic docs remain private archive history

## 18. What Will Be Written in the Next Documentation Phase

Planned next-phase writing tasks:

1. README modernization with strict implemented-vs-future labeling.
2. docs/public/architecture.md refinement to current implementation boundaries.
3. docs/public/roadmap.md restructure with explicit ACTIVE vs PROPOSED phases.
4. Public-safe deployment and readiness docs derived from current internal/public candidates.
5. Controlled reference updates for moved paths in public/current docs only.

## 19. Risks

- Over-disclosure risk if internal/staging documents are treated as public by default.
- Under-disclosure risk if public docs become too vague for contributors.
- Historical-context loss risk if audit/checkpoint docs are rewritten aggressively.
- Misinterpretation risk if future ecosystem concepts are not clearly labeled as PROPOSED/RESEARCH.
- Credibility risk if README/roadmap overstate non-implemented architecture.

## 20. Unresolved Questions

1. Should docs/CLOUD_DEPLOYMENT.md be moved into docs/public now, or only after explicit redaction pass?
2. Should docs/deployment-readiness-checklist.md be split into public and internal versions?
3. Should docs/IDENTITY_FOUNDATION.md become two documents (public overview + internal operations)?
4. Should checkpoint/security history remain in-repo private, or be mirrored outside repo in a dedicated private archive repository?
5. What exact wording policy should govern references to CAL, treasury, and issuer claims in future public docs?

## 21. Final Recommendation

Keep the current Phase 6A structural separation and apply a strict documentation boundary policy:

- Public product docs stay in README.md plus docs/public.
- Future ecosystem material stays preserved in docs/research as research memory.
- Identity/staging and security/checkpoint records remain internal/private archive material.
- Public docs must distinguish IMPLEMENTED from PROPOSED/RESEARCH/UNKNOWN with no over-claims.

No source code, runtime data, environment files, or git history should be changed as part of this boundary phase.