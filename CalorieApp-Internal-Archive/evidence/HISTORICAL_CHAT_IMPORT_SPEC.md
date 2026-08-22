# Historical ChatGPT Import Specification

## 1. Purpose

This document defines the controlled future workflow for extracting useful information from historical ChatGPT conversations related to CalorieToken.

It is a specification only. It does not implement a live import system, does not connect external services, and does not process an actual ChatGPT export as part of this task.

This specification exists to ensure that any future extraction remains:

- traceable to the original source
- explicitly separated from human approval
- limited to the correct domain
- useful as a candidate and evidence reference layer
- safe when dealing with legal, ownership, compliance, or historical contradictions

## 2. Scope and current status

### 2.1 In scope

This specification applies only to future handling of historical ChatGPT conversation material relevant to the CalorieToken knowledge domain.

It may cover:

- ideas
- suggestions
- technical discussions
- architecture conversations
- proposed features
- bugs
- research topics
- legal/compliance discussions
- business discussions
- marketing concepts
- abandoned ideas
- completed work
- unresolved work
- duplicated topics
- contradictory historical statements
- cross-domain discussions involving both CalorieToken and ICTHENDRIKSE

### 2.2 Out of scope

This specification does not authorize:

- importing an actual ChatGPT export now
- connecting Google Drive
- creating automation
- creating a database
- modifying application code
- modifying existing ticket records
- modifying existing evidence records
- merging CalorieToken and ICTHENDRIKSE knowledge by default
- creating legal conclusions from conversation content alone
- treating AI suggestions as approved project decisions

### 2.3 Current operational status

The historical ChatGPT export is not currently being imported as part of this task.

This specification is intentionally future-facing and reusable when an export becomes available.

## 3. Governing principles

### 3.1 Source preservation

The original ChatGPT export is the source material.

Rules:

- never modify the original export
- never overwrite the original source
- never silently transform the original source
- preserve a clear provenance chain back to the source conversation
- keep the original wording where practical
- store extracted items as derived metadata, not replacements

If the source is not available, the system must record UNKNOWN rather than inventing details.

### 3.2 Extraction versus approval

The workflow must clearly distinguish the following states:

- RAW_SOURCE
- EXTRACTED_CANDIDATE
- AI_INTERPRETATION
- HUMAN_REVIEWED
- HUMAN_APPROVED
- REJECTED
- DUPLICATE
- SUPERSEDED
- UNKNOWN

An AI-extracted task is not automatically an approved CalorieToken task.

This distinction is required for all future imported material, including tasks, ideas, research items, and evidence references.

### 3.3 Task and knowledge classifications

The future import system should classify extracted content using a small, explicit taxonomy.

Approved initial classes:

- IDEA
- SUGGESTION
- TASK_CANDIDATE
- DECISION
- REQUIREMENT
- BUG
- QUESTION
- RESEARCH_ITEM
- EVIDENCE_REFERENCE
- OPEN_ISSUE
- COMPLETED_WORK
- ABANDONED_ITEM
- UNKNOWN

Additional categories may be introduced only when they are clearly needed and clearly documented.

Important rule:

- not every statement of an action implies the action was approved
- not every mention of a task implies it is a current or valid task
- not every historical recommendation is current policy

## 4. Provenance model

Each future extracted item should preserve provenance where available.

Required provenance fields:

- source export identifier
- conversation identifier
- conversation title
- message identifier or position
- approximate date
- speaker or role where available
- original wording
- extraction timestamp
- extractor name or version
- confidence
- related ticket
- related evidence
- human review status

If an export field is absent, the system should store UNKNOWN rather than inventing it.

### 4.1 Provenance metadata model

Each extracted item should record:

- Source Export ID
- Conversation ID
- Conversation Title
- Message ID or Position
- Approximate Date
- Speaker / Role
- Original Wording
- Summary Wording
- Extraction Timestamp
- Extractor / Version
- Confidence
- Source Status
- Review Status
- Related Ticket
- Related Evidence
- Scope

### 4.2 Source status categories

Use these categories where appropriate:

- RAW_SOURCE
- EXTRACTED_CANDIDATE
- AI_INTERPRETATION
- HUMAN_REVIEWED
- HUMAN_APPROVED
- REJECTED
- DUPLICATE
- SUPERSEDED
- UNKNOWN

## 5. Original wording and summary handling

Where practical, the future system should preserve the relevant original wording.

Rules:

- do not replace source meaning with a paraphrase alone
- keep the original wording as the primary record
- if a summary is created, mark it explicitly as a summary or interpretation
- do not merge source wording and AI summary into one undifferentiated field
- preserve quoted text where possible

The allowed distinction is:

- Original wording
- AI-generated summary
- Human-reviewed summary
- Human-approved interpretation

The system must never pretend that an AI summary is the original source text.

## 6. CalorieToken and ICTHENDRIKSE separation

This is a hard boundary.

Rules:

- CalorieToken material belongs to the CalorieToken knowledge domain
- ICTHENDRIKSE material belongs to the ICTHENDRIKSE knowledge domain
- a conversation may mention both domains without implying they are the same project or business
- a cross-domain mention must be explicitly labeled as CROSS-SCOPE
- a historical conversation may be preserved as one source while individual extracted items are classified separately
- ICTHENDRIKSE task material must not be imported into CalorieToken tickets
- CalorieToken task material must not be imported into ICTHENDRIKSE records without explicit domain handling

When a conversation mentions both domains, the system should preserve:

- the original source conversation
- the extracted item with its domain label
- the cross-scope relationship if applicable
- the reason it is separate rather than merged

Do not merge businesses merely because they share people, infrastructure, history, or context.

## 7. Historical changes and temporal state

Historical ChatGPT conversations may later become obsolete or contradicted.

The workflow must distinguish at minimum:

- historically stated
- currently believed
- currently verified
- superseded
- contradicted
- unknown

Rules:

- do not rewrite historical statements to match later understanding
- do not silently replace older content with newer conclusions
- preserve the original meaning and the later change context separately
- record contradiction and supersession explicitly
- require human review before treating a historical statement as no longer relevant

## 8. Duplicate detection and relationship management

A single idea may appear repeatedly in different years or conversations.

The future system should support classification of duplicates and relationships:

- exact duplicate
- probable duplicate
- related but distinct item
- superseded version
- contradicted version
- unknown relationship

Rules:

- do not delete original source references because an item is duplicated
- do not merge disparate items simply because they share a similar phrasing
- preserve the original and the deduplicated relationship as separate records
- require human review before a duplicate is accepted as a single canonical item

## 9. Legal, ownership, compliance, and business-risk material

Historical conversations may include legal, ownership, governance, or business discussions.

AI extraction must not turn these into factual legal conclusions.

Examples of sensitive material that must remain candidate or reference material until properly verified:

- ownership claims
- KVK information
- agreements
- amendments
- token allocations
- wallet ownership
- IP ownership
- MiCA status
- GDPR compliance
- contractual relationships
- business governance claims
- revenue, funding, or financing topics

The import workflow must preserve a clear boundary between:

- conversation statement
- evidence reference
- verified legal document
- AI interpretation
- human-reviewed conclusion

A mention in a ChatGPT conversation is not itself proof of legal status.

## 10. Evidence linkage and evidence gaps

When a historical conversation references evidence, the workflow must preserve the distinction between:

- the source conversation
- the referenced document or record
- the fact that a document may be referenced but not actually available

Rules:

- preserve the reference in the extracted item
- distinguish source conversation from actual evidence
- do not create an evidence record unless the underlying evidence is actually available
- if the evidence is missing, record an evidence gap instead of inventing a fact
- treat a ChatGPT statement about a document as different from the document itself

Evidence-gap categories may include:

- NO_EVIDENCE_FOUND
- EVIDENCE_EXISTS_UNVERIFIED
- EVIDENCE_REQUIRED
- EVIDENCE_MISSING_FOR_DATE_OR_SUBJECT

## 11. Human approval gates

Any future extracted item must remain subordinate to explicit human review before it can be treated as approved project knowledge.

Required approval gates before:

- creating canonical tickets
- changing ticket status to approved
- treating extracted statements as verified facts
- creating legal or ownership conclusions
- assigning evidence classifications stronger than the available source supports
- changing scope labels that affect domain separation

Human review should confirm:

- whether the item belongs in CalorieToken or a different domain
- whether it is a valid extracted candidate or merely a historical mention
- whether the source wording is accurate and preserved
- whether it is duplicate, contradicted, or superseded
- whether it requires a ticket or evidence gap instead of a direct action

## 12. Future conceptual pipeline

The following is a future design only. It is not an implementation and not part of this task.

RAW EXPORT
→ SOURCE PRESERVATION
→ CONVERSATION IDENTIFICATION
→ CANDIDATE EXTRACTION
→ CLASSIFICATION
→ DEDUPLICATION
→ PROVENANCE LINKING
→ HUMAN REVIEW
→ APPROVED TICKET/EVIDENCE LINKING

This pipeline must remain conceptual and intentionally limited.

The pipeline does not imply automatic ticket creation, automatic evidence creation, automatic merging, or automatic approval.

## 13. No automatic actions

The future system must not automatically:

- create legal conclusions
- alter existing tickets
- delete historical information
- modify source exports
- synchronize to Google Drive
- push to GitHub
- create external records
- merge CalorieToken and ICTHENDRIKSE knowledge
- treat AI extraction as approved fact

This requirement is mandatory at all stages.

## 14. Data and domain hygiene

The import process should preserve domain hygiene by using a strict distinction between:

- CalorieToken project material
- ICTHENDRIKSE project material
- CROSS-SCOPE material
- UNKNOWN material

The system must not assume that common infrastructure, people, or historical context establish shared ownership or merged business scope.

## 15. Change log

### 15.1 Initial specification creation

- Date: 2026-08-21
- Status: INITIAL_SPECIFICATION
- Scope: CALORIETOKEN
- Purpose: define a safe, future-facing import workflow for historical ChatGPT conversation material without importing data or creating automation
- Change type: DOCUMENTATION_ONLY
- Human review status: INITIAL_SPECIFICATION_CREATED
- Review gate: not yet implemented beyond repository-level documentation control

This is the initial specification creation record for the future historical import workflow.

## 16. Summary of required operational behavior

The import design should therefore operate as a conservative metadata and review layer:

- preserve source material exactly
- separate raw source from interpretation
- keep extracted results as candidates and references
- classify and scope them carefully
- keep legal and ownership topics provisional
- maintain explicit provenance
- require human review before approval
- never merge domains by default
- never implement automation or external integration in this task

## 17. Decision boundary

This specification is intentionally designed as a safe, future-ready foundation.

It supports later historical import work without enabling it now.

It is a documentation and governance artifact only.

----------

## 18. Appendix: Candidate fields for future extracted items

The following fields are recommended for later use when an actual ChatGPT export becomes available:

- Item ID
- Scope
- Type
- Status
- Title
- Description
- Source Export ID
- Conversation ID
- Conversation Title
- Message ID or Position
- Approximate Date
- Speaker / Role
- Original Wording
- Summary Wording
- Extraction Timestamp
- Extractor / Version
- Confidence
- Related Ticket
- Related Evidence
- Human Review Status
- Human Decision
- Duplicate Status
- Superseded Status
- Contradiction Status
- Notes

Any field not available should be recorded as UNKNOWN rather than invented.

## 19. Final status

This specification is intentionally limited to a future import framework.

It does not trigger import processing, automation, or repository changes beyond the creation of this documentation file.
