# CalorieToken Ticket & Knowledge Foundation

## 1. Purpose

This directory is the controlled repository foundation for the AI-assisted CalorieToken ticket and knowledge workflow.

It is not currently an automated task system, and it does not represent a live AI workflow implementation. This directory exists to provide a safe, human-governed foundation for future task records, knowledge records, and evidence references.

## 2. Governance

AI may:

- discover
- extract
- classify
- correlate
- suggest
- identify possible duplicates
- identify possible contradictions

AI may not automatically:

- approve tasks
- make legal conclusions
- make ownership conclusions
- publish material
- modify authoritative evidence
- delete evidence
- synchronize storage
- close important legal/security records

All AI-generated suggestions must remain subordinate to human review.

## 3. Human approval flow

The intended workflow is:

AI-SUGGESTED
→ NEEDS-REVIEW
→ HUMAN APPROVAL
→ APPROVED
→ IN-PROGRESS
→ COMPLETED
→ CLOSED

Additional states may also exist where appropriate:

- REJECTED
- DEFERRED
- MERGED
- BLOCKED

The system must clearly distinguish:

- AI-generated content
- AI-suggested content
- human-reviewed content
- human-approved content
- human-rejected content
- human-deferred content

## 4. Scope separation

ICTHENDRIKSE and CALORIETOKEN are separate organizational/business scopes.

The system must not assume that:

- ICTHENDRIKSE owns CALORIETOKEN
- CALORIETOKEN owns ICTHENDRIKSE

Cross-scope relationships must be explicitly documented. A cross-scope link is not an ownership claim.

The system should support the following scope model:

- CALORIETOKEN
- ICTHENDRIKSE
- CROSS-SCOPE

CROSS-SCOPE is not the default. It requires explicit explanation and relationship documentation.

Design patterns for future identifiers may include:

- CAL-TECH-0001
- CAL-LEGAL-0001
- CAL-SEC-0001
- CAL-EVIDENCE-0001
- ICT-OPS-0001
- ICT-LEGAL-0001
- ICT-TECH-0001

These naming patterns are design examples only and are not active IDs yet.

## 5. Ticket types

The initial ticket taxonomy should remain small and intentional.

- TASK
- RESEARCH
- DECISION
- ISSUE
- WARNING
- IDEA
- LEGAL
- SECURITY
- EVIDENCE
- TECHNICAL
- DOCUMENTATION

This set is intentionally minimal. Additional types should only be introduced when a clear workflow need emerges.

## 6. Provenance

Every future ticket must identify its source.

Possible source types include:

- ChatGPT conversation
- future ChatGPT export
- GitHub file
- Git commit
- Google Drive document
- KVK document
- signed agreement
- blockchain evidence
- research source
- human decision

Provenance must never be invented. If the origin is unclear, it must remain unknown rather than being guessed.

## 7. Evidence

The system will use the existing evidence classification model:

- VERIFIED PRIMARY
- VERIFIED SECONDARY
- PUBLIC CLAIM
- INFERENCE
- UNKNOWN
- CONTRADICTED

Evidence references should point to authoritative material rather than copying sensitive material into the repository.

Tickets should refer to evidence by identifier or pointer, not by reproducing confidential contents in GitHub.

## 8. Historical chat ingestion

Future historical ChatGPT ingestion should be incremental and human-governed.

The current conversation is intended to be the first pilot dataset, but it must not be imported in this task.

A safe future import process should be:

1. current conversation only
2. recent conversations
3. full historical export
4. deduplication
5. contradiction detection
6. human review
7. canonical knowledge record creation

## 9. Storage boundaries

The project storage model is:

- GitHub → version-controlled project record
- Google Drive → documentary/evidence archive
- Local → development environment
- AI index → read-only analysis layer

No automatic synchronization exists in the current design.

## 10. Current status

This directory is the minimal foundation for the ticket and knowledge workflow.

No actual project tickets exist yet.
No AI ingestion system exists yet.
No automated synchronization exists yet.
No project tickets are being created by this directory alone.

This is a foundation only, not an operational system.
