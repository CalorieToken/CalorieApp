# CalorieToken Storage & Evidence Policy

## 1. Purpose

This policy defines the storage, backup, evidence, confidentiality, and synchronization boundaries for the CalorieToken project.

This document is a governance document only. It does not implement synchronization, backup automation, or any external system integration.

## 2. Storage Layers

The project uses four conceptual storage layers.

### LOCAL

The local layer is the active development and working environment.

Examples:
- source workspace
- virtual environments
- node_modules
- build/cache artifacts
- local development databases
- local configuration
- temporary working files

Local storage is not automatically considered a reliable backup.

### GITHUB

GitHub is the version-controlled technical and project record.

Examples:
- source code
- tests
- approved technical documentation
- architecture
- project decisions
- governance documentation
- appropriate sanitized research

GitHub must not be used to store:
- passwords
- private keys
- credentials
- KYC/identity documents
- private agreements
- confidential correspondence
- secret-bearing configuration

### GOOGLE DRIVE

Google Drive is the documentary and evidence archive layer.

Examples:
- signed agreements
- KVK records
- legal evidence
- historical project records
- research source documents
- audit material
- confidential project documentation
- KYC/identity material where appropriate and securely controlled

Google Drive is an archive layer, not an automatic mirror of GitHub.

### AI INDEX

The AI index is a future read-only cross-reference layer.

Preferred model:

READ
→ INDEX
→ ANALYSE
→ SUGGEST
→ HUMAN DECISION

AI must not silently modify authoritative evidence.

## 3. Restricted Material

Restricted material includes:

- KYC/identity documents
- ID scans
- private agreements
- confidential correspondence
- credentials
- passwords
- API keys
- private keys
- wallet secrets
- sensitive personal information
- confidential business information

Restricted material must not be placed into public GitHub repositories.

This policy does not include actual secrets, IDs, addresses, or sensitive values.

## 4. Evidence Hierarchy

Evidence should be classified using the following hierarchy:

- VERIFIED PRIMARY
- VERIFIED SECONDARY
- PUBLIC CLAIM
- INFERENCE
- UNKNOWN
- CONTRADICTED

Original authoritative records take precedence over summaries and AI-generated analysis.

## 5. Evidence Immutability

The following principles apply:

- original evidence should remain unchanged
- working copies must be clearly identified
- derived summaries must never replace originals
- important transformations should preserve provenance
- hashes/checksums may be introduced later as an additional integrity mechanism
- no automatic system should overwrite original evidence

Hashing is not implemented in this policy.

## 6. Synchronization Principles

The following principles apply:

- no automatic synchronization is currently implemented
- no bidirectional synchronization should be introduced without human approval
- GitHub must not automatically mirror Google Drive
- Google Drive must not automatically write into GitHub
- local files must not automatically be uploaded merely because they exist
- restricted material requires explicit handling rules
- synchronization rules should be allowlist-based rather than "sync everything"

## 7. Backup Principles

The following backup principles apply:

- GitHub provides version history for appropriate project files
- Google Drive provides documentary/archive redundancy
- local working storage is not sufficient as the only backup
- backups must preserve provenance
- backups must not weaken confidentiality
- restoration procedures should be tested periodically once implemented

Backup automation is not implemented by this policy.

## 8. Naming and Evidence IDs

The project uses the existing evidence naming convention:

EVIDENCE-KVK-84216352
EVIDENCE-KVK-73774693
EVIDENCE-AGREEMENT-2022-11-21
EVIDENCE-AMENDMENT-2024-03-18

These identifiers are references, not legal conclusions.

No additional evidence IDs are invented in this policy.

## 9. Human Approval Gates

Human approval is required before:

- publishing evidence
- changing evidence classification
- synchronizing new categories
- moving confidential material
- deleting evidence
- modifying legal/ownership records
- allowing AI write access
- enabling automated synchronization

## 10. AI Governance

The preferred AI workflow is:

READ
↓
ANALYSE
↓
IDENTIFY CONTRADICTIONS
↓
SUGGEST
↓
HUMAN REVIEW
↓
APPROVE
↓
RECORD

AI must not:
- silently alter originals
- decide legal ownership
- decide confidentiality classification without human approval
- publish material
- synchronize unrestrictedly
- delete evidence

## 11. Retention and Deletion

The following principles apply:

- original legal/evidence records should not be deleted casually
- deletion of evidence requires explicit human approval
- temporary/generated artifacts may follow separate cleanup rules
- retention requirements may differ depending on legal, regulatory, or business context
- final retention periods should be determined with appropriate professional advice where necessary

This policy does not invent legal retention periods.

## 12. Current Known Sensitive Areas

The project already identifies the following sensitive categories:

- .env
- .env.local
- local databases
- KYC/ID material
- signed agreements
- private business records
- credentials/secrets
- XRPL wallet secrets

These categories are referenced only as categories; their contents are not reproduced here.

## 13. Current Status

The current storage architecture is designed but not yet automated.

This task did not connect Google Drive to the development environment.
No synchronization has been implemented.
The policy requires human review before implementation.

## 14. Change Log

| Date | Change | Reason | Human approval |
|---|---|---|---|
| 2026-08-21 | Initial Storage & Evidence Policy created. | Define safe storage and evidence boundaries before implementing backup or synchronization. | Pending human review |

No historical entries are fabricated here.
