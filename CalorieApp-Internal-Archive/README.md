# CalorieToken Evidence Register Foundation

## 1. Purpose

This directory establishes the foundational metadata and provenance layer for CalorieToken evidence.

The Evidence Register is a metadata/index/provenance system beside the ticket system. It is not a storage vault for sensitive originals, and it is not the authoritative evidence repository.

The Evidence Register answers:

- what evidence exists
- where the authoritative original resides
- what the evidence is about
- how it was obtained and verified
- which tickets and decisions it supports
- whether it is historical, current, contradictory, or missing

## 2. Evidence vs ticket

Ticket:
- question
- investigation
- action
- decision need

Evidence:
- source
- record
- factual material
- provenance chain

The Evidence Register must not become a second ticket manager.

## 3. Evidence vs authoritative original

The Evidence Register does not replace the authoritative source.

Examples:

- signed agreement → signed original is authoritative
- KVK registration → official registry record is authoritative
- XRPL transaction → blockchain ledger is authoritative
- Git commit → Git history is authoritative for the commit
- AI summary → not authoritative evidence

The register should point to the source/location and preserve provenance, but it must not silently duplicate or replace the original.

## 4. Authority model

The Evidence Register should distinguish:

- AUTHORITATIVE_ORIGINAL
- DERIVED_COPY
- ARCHIVAL_COPY
- REFERENCE
- SUMMARY
- AI_ANALYSIS
- HUMAN_CONCLUSION

These represent different layers of evidence handling. The register stores metadata about them; it is not itself automatic authority.

## 5. Evidence classification

Use the approved classification set exactly:

- VERIFIED_PRIMARY
- VERIFIED_SECONDARY
- PUBLIC_CLAIM
- INFERENCE
- UNKNOWN
- CONTRADICTED

Definitions:

- VERIFIED_PRIMARY: authoritative, sufficiently verified source material
- VERIFIED_SECONDARY: traceable copy or validated secondary source
- PUBLIC_CLAIM: public statement or publication that may be relevant but is not authoritative
- INFERENCE: interpretation or analysis, not evidence itself
- UNKNOWN: insufficient provenance or verification
- CONTRADICTED: material conflict exists between records

A document being present does not automatically make it VERIFIED_PRIMARY.

## 6. Verification status

Verification status is separate from evidence classification.

Evidence Classification answers: what kind of evidence is this?
Verification Status answers: how far has it been reviewed?

Approved verification statuses:

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

## 7. Scope model

Every evidence record must carry a scope:

- CALORIETOKEN
- ICTHENDRIKSE
- CROSS-SCOPE
- UNKNOWN

Scope does not establish legal ownership.

It describes which project or business information environment the evidence belongs to.

For CROSS-SCOPE records, document the relationship explicitly.

## 8. Access classification

Use:

- PUBLIC
- INTERNAL
- RESTRICTED
- HIGHLY_RESTRICTED

Sensitive originals must not be stored in public GitHub.

Examples of restricted evidence:

- KYC documents
- ID scans
- private agreements
- personal data
- credentials
- passwords
- API keys
- private keys
- wallet secrets
- private correspondence

## 9. Preservation

Use preservation categories:

- ORIGINAL
- ARCHIVE
- DERIVED
- SNAPSHOT
- REFERENCE

Rules:

- originals must not be silently modified
- archival copies remain distinguishable from originals
- derived copies retain provenance
- replacement evidence retains historical relationships
- deletion requires human approval
- superseded evidence remains traceable

Hashing/checksums are future functionality and are not implemented here.

## 10. Provenance

Every evidence record should capture:

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

If provenance is incomplete, record it as incomplete/unknown.

## 11. Relationships

The register supports relationships such as:

- SUPERSEDES
- SUPERSEDED_BY
- AMENDS
- AMENDED_BY
- DERIVED_FROM
- COPY_OF
- RELATED_TO
- CONTRADICTS
- CORROBORATES

Also supported:

- Related Ticket
- Related Decision
- Related Evidence

## 12. Evidence gaps

Evidence gaps must be explicit.

Use:

- NO_EVIDENCE_FOUND
- EVIDENCE_EXISTS_UNVERIFIED
- EVIDENCE_REQUIRED
- EVIDENCE_MISSING_FOR_DATE_OR_SUBJECT

These gaps can be linked to tickets.

## 13. Contradictions

Contradictory evidence must remain preserved.

Use:

- CONTRADICTS
- CORROBORATES
- RELATED_TO

AI may identify contradictions, but AI must not decide which evidence wins without human review.

## 14. Ticket integration

The ticket system and Evidence Register are intentionally separate.

- TICKET = question / action / investigation
- EVIDENCE = source / record
- DECISION = human-approved conclusion

The Evidence Register must not become a ticket manager.

## 15. Decision integration

The evidence-to-decision path is:

EVIDENCE → ANALYSIS → HUMAN REVIEW → DECISION

Not:

EVIDENCE → AI → AUTOMATIC LEGAL CONCLUSION

Human approval remains mandatory for significant legal, IP, ownership, security, and regulatory conclusions.

## 16. GitHub boundary

GitHub is suitable for public-safe metadata only.

Acceptable metadata may include:

- Evidence ID
- title
- type
- scope
- classification
- verification status
- provenance summary
- relationship references
- archive reference

Sensitive originals remain outside public GitHub.

## 17. Google Drive boundary

The Evidence Register should be able to reference a documentary archive location, but Google Drive is not part of the initial implementation.

Conceptually:

- LOCAL = active work
- GITHUB = public-safe metadata
- GOOGLE DRIVE = documentary/archive layer
- AUTHORITATIVE SOURCE = source of truth
- AI INDEX = read-only analysis layer

Do not connect Google Drive or configure synchronization in this foundation.

## 18. AI boundary

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
- auto-synchronize restricted material
- make legal ownership conclusions

## 19. ChatGPT-history boundary

Future ChatGPT exports may provide historical context, project decisions, ideas, technical evolution, evidence references, contradictions, and task candidates.

However, ChatGPT conversation history is not automatically primary evidence.

Future provenance may include:

- Source System: ChatGPT
- Source Conversation: if available
- Source Date: if available
- Extraction Method: AI-assisted
- Confidence: HIGH / MEDIUM / LOW
- Human Review: PENDING / APPROVED / REJECTED

## 20. Human approval requirement

Human approval remains required for significant:

- legal conclusions
- ownership conclusions
- IP conclusions
- security decisions
- regulatory determinations

The Evidence Register is a governance and provenance framework, not a legal authority layer.

## 21. Approved evidence taxonomy

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

Subtypes should be used where helpful, but the taxonomy should remain manageable.

## 22. Approved classification and status model

Evidence Classification:

- VERIFIED_PRIMARY
- VERIFIED_SECONDARY
- PUBLIC_CLAIM
- INFERENCE
- UNKNOWN
- CONTRADICTED

Verification Status:

- NOT_REVIEWED
- PENDING
- VERIFIED
- PARTIALLY_VERIFIED
- REJECTED
- CONTESTED
- NOT_APPLICABLE

## 23. Approved scope model

- CALORIETOKEN
- ICTHENDRIKSE
- CROSS-SCOPE
- UNKNOWN

Scope is informational and governance-oriented. It does not establish ownership.

## 24. Approved evidence ID strategy

Do not create actual evidence IDs yet.

The strategy is:

- IMMUTABLE ID
- HUMAN-READABLE LABEL

The ID must not encode legal conclusions.

## 25. Approved date model

Dates are conditional, not universally mandatory.

Examples of conditional date fields:

- Date of Event
- Date of Document
- Date Obtained
- Date Verified
- Effective Date
- Publication Date
- Capture Date
- Ledger Date

Different evidence types require different date concepts. Do not force all evidence into one universal date field.

## 26. Approved relationship model

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

## 27. Approved ownership / control model

Separate relationship concepts:

- LEGAL_OWNERSHIP
- CONTROL
- CUSTODY
- CONTRACTUAL_RIGHT
- LICENSE
- OPERATIONAL_RESPONSIBILITY
- ASSOCIATION

Keep these separate from project/company/software/token/wallet/domain distinctions.

## 28. Approved evidence-related tickets

Future evidence may relate to:

- CAL-GOV-0001
- CAL-LEGAL-0001
- CAL-IP-0001
- CAL-TECH-0001
- CAL-SEC-0001
- CAL-ARCH-0001
- CAL-GOV-0002

This foundation does not create evidence records for them yet.

## 29. Final status

This directory is the minimal foundation only.

It is intentionally not a working evidence database, not a live archive, and not a public evidence repository.

It should remain a governance and metadata foundation until a future human review approves more detailed implementation.
