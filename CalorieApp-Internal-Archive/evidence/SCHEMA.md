# CalorieToken Evidence Register Schema Specification

## 1. Purpose

This schema defines the conceptual metadata structure for the CalorieToken Evidence Register.

It is a metadata/index/provenance framework beside the ticket system and is not an authoritative evidence store.

## 2. Core model

The register preserves the distinction between:

- TICKET = question / action / investigation
- EVIDENCE = source / record
- DECISION = human-approved conclusion
- AI = read / index / analyse / suggest

The register should not become a ticket manager.

## 3. Authority model

- AUTHORITATIVE_ORIGINAL: original source document or official registry source
- DERIVED_COPY: export or copy derived from the authority source
- ARCHIVAL_COPY: preserved historical or archived snapshot
- REFERENCE: pointer to original or archive location
- SUMMARY: short summary of an item
- AI_ANALYSIS: AI-produced interpretation
- HUMAN_CONCLUSION: human-approved final decision based on evidence

The register stores metadata about these layers; it is not itself authority.

## 4. Evidence classification

Use exactly:

- VERIFIED_PRIMARY
- VERIFIED_SECONDARY
- PUBLIC_CLAIM
- INFERENCE
- UNKNOWN
- CONTRADICTED

Definition summary:

- VERIFIED_PRIMARY: authoritative and sufficiently verified source
- VERIFIED_SECONDARY: traceable and trustworthy secondary material
- PUBLIC_CLAIM: public statement or publication, not authoritative
- INFERENCE: interpretation or analysis, not source evidence
- UNKNOWN: insufficient provenance or verification
- CONTRADICTED: material conflict between records

## 5. Verification status

Verification status is separate from evidence classification.

Use:

- NOT_REVIEWED
- PENDING
- VERIFIED
- PARTIALLY_VERIFIED
- REJECTED
- CONTESTED
- NOT_APPLICABLE

Examples:

- VERIFIED_PRIMARY + VERIFIED
- UNKNOWN + PENDING
- PUBLIC_CLAIM + NOT_APPLICABLE

## 6. Scope model

Use:

- CALORIETOKEN
- ICTHENDRIKSE
- CROSS-SCOPE
- UNKNOWN

Scope is informational and governance-oriented. It does not establish legal ownership.

## 7. Access model

Use:

- PUBLIC
- INTERNAL
- RESTRICTED
- HIGHLY_RESTRICTED

Sensitive originals must not be stored in public GitHub. Public-safe metadata may be stored there.

## 8. Preservation model

Use:

- ORIGINAL
- ARCHIVE
- DERIVED
- SNAPSHOT
- REFERENCE

Rules:

- originals must not be silently modified
- archival copies remain distinguishable from originals
- derived copies retain provenance
- replacements retain historical relationships
- deletion requires human approval
- superseded evidence remains traceable

## 9. Provenance model

Minimum provenance fields:

- Source Name
- Source Type
- Authority
- Source Location
- Acquisition Date
- Acquisition Method
- Verification Date
- Verification Method
- Provenance Completeness

Never invent provenance.

## 10. Date model

Dates are conditional and evidence-specific.

Use fields such as:

- Date of Event
- Date of Document
- Date Obtained
- Date Verified
- Effective Date
- Publication Date
- Capture Date
- Ledger Date

Do not force all evidence into one universal date field.

## 11. Taxonomy

Use the approved taxonomy:

- CORPORATE
- KVK
- LEGAL_AGREEMENT
- AMENDMENT
- TRANSFER
- IP
- TRADEMARK
- DOMAIN
- SOFTWARE
- GITHUB
- XRPL
- BLOCKCHAIN
- TOKEN
- WALLET
- FINANCIAL
- TECHNICAL
- REGULATORY
- PRIVACY
- SECURITY
- PUBLICATION
- SOCIAL
- WEB_ARCHIVE
- CORRESPONDENCE
- RESEARCH
- OTHER

Keep top-level categories manageable and use subtypes when helpful.

## 12. Relationship model

Use:

- SUPERSEDES
- SUPERSEDED_BY
- AMENDS
- AMENDED_BY
- DERIVED_FROM
- COPY_OF
- RELATED_TO
- CONTRADICTS
- CORROBORATES
- Related Ticket
- Related Decision
- Related Evidence

## 13. Ownership and control model

Keep distinct:

- LEGAL_OWNERSHIP
- CONTROL
- CUSTODY
- CONTRACTUAL_RIGHT
- LICENSE
- OPERATIONAL_RESPONSIBILITY
- ASSOCIATION

Keep these separate from other categories such as:

- company
- project
- software
- IP
- domain
- XRPL account
- wallet
- token holding
- personal holding
- project holding
- business asset
- decentralized network status

Do not infer legal conclusions from this structure alone.

## 14. Evidence gaps model

Use:

- NO_EVIDENCE_FOUND
- EVIDENCE_EXISTS_UNVERIFIED
- EVIDENCE_REQUIRED
- EVIDENCE_MISSING_FOR_DATE_OR_SUBJECT

These may be linked to a ticket.

## 15. Contradiction model

Different records may conflict.

The register should preserve both records and mark the relationship with:

- CONTRADICTS
- CORROBORATES
- RELATED_TO

AI may identify contradictions, but must not decide the winner without human review.

## 16. ID model

The approved strategy is:

- IMMUTABLE ID
- HUMAN-READABLE LABEL

Do not encode legal conclusions into IDs.

## 17. Approved ticket integration

Current evidence may relate to:

- CAL-GOV-0001
- CAL-LEGAL-0001
- CAL-IP-0001
- CAL-TECH-0001
- CAL-SEC-0001
- CAL-ARCH-0001
- CAL-GOV-0002

This foundation does not create evidence records for them yet.

## 18. Human approval requirements

Human approval remains required for significant:

- legal
- ownership
- IP
- security
- regulatory

conclusions.

## 19. AI boundary

AI may:

- READ
- INDEX
- ANALYSE
- SUGGEST

AI may not:

- modify authoritative evidence
- invent provenance
- silently change classifications
- delete evidence
- synchronize restricted material automatically
- make legal ownership conclusions

## 20. ChatGPT history boundary

Future ChatGPT exports may be stored and linked as provenance/context, but they are not automatically primary evidence.

If used, provenance should include:

- Source System: ChatGPT
- Source Conversation: if available
- Source Date: if available
- Extraction Method: AI-assisted
- Confidence: HIGH / MEDIUM / LOW
- Human Review: PENDING / APPROVED / REJECTED

## 21. Future implementation direction

The smallest safe implementation after approval is a metadata-first register using Markdown or structured metadata, with GitHub as the public-safe metadata layer and authoritative originals kept elsewhere. This keeps the design auditable, reviewable, and incrementally expandable without creating an evidence repository too early.

## 22. Final design summary

This schema is intentionally conservative:

- evidence is separate from tickets
- the register is not primary evidence storage
- original evidence stays authoritative
- provenance and verification are explicit
- classification and verification are separate dimensions
- scope does not imply ownership
- contradictions and gaps are preserved
- human approval is required for important conclusions
- AI is limited to read/index/analyse/suggest behavior

This keeps the Evidence Register durable and safe for future expansion.
