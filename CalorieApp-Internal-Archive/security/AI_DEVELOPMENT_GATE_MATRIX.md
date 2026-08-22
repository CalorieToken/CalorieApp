# AI Development Gate Matrix

> Controlled workflow test marker (2026-08-21): documentation-only change, no policy change.

## 1. Purpose

This document is the canonical quick-reference for safe AI-assisted development in the CalorieToken repository.

It consolidates workflow and hand-off controls that already exist across repository governance documents. It does not replace those documents.

Authoritative policy remains in its original sources, including:

- `.github/copilot-instructions.md`
- `.github/project-context/CURRENT_STATE.md`
- `.github/project-context/DECISIONS.md`
- `.github/project-context/DEFERRED_TASKS.md`
- `.github/project-context/ai/CURRENT_TASK.md`
- `.github/project-context/ai/HANDOFF.md`
- `.github/project-context/ai/REPORT.md`
- `docs/tickets/README.md`
- `docs/evidence/README.md`
- `docs/STORAGE_AND_EVIDENCE_POLICY.md`
- `docs/evidence/HISTORICAL_CHAT_IMPORT_SPEC.md`

This matrix is a navigation and control layer, not a new governance system.

## 2. Core Workflow

RESEARCH
↓
REVIEW
↓
HUMAN DECISION
↓
IMPLEMENTATION
↓
VERIFICATION
↓
CANONICAL RECORD / EVIDENCE
↓
CLOSE OR DEFER

Not every item must pass through every stage. Some items stop at research, review, or defer.

## 3. Agent Authority Matrix

| Role | May read | May write | May execute | May create canonical records directly | May commit/push | Mandatory return point |
|---|---|---|---|---|---|---|
| Researcher | Yes | No | Read-only research actions | No | No | Return findings to human decision layer before implementation |
| Security Reviewer | Yes | No | Read-only review actions | No | No | Return review outcome to human decision layer |
| Implementer | Yes | Yes, within approved scope only | Yes, within approved scope only | No automatic canonical authority | No (unless separately and explicitly authorized by human) | Return implementation result for verification and human review |
| Human / Project Owner | Yes | Yes | Yes | Yes, after review and approval process | Yes, by explicit human action | Final decision authority |
| Verification function (implemented through reviewer and test evidence) | Yes | No direct policy-authoring requirement | Read-only verification and validation actions | No automatic canonical authority | No | Return verification evidence to human review before closure |

Notes:

- The repository defines separate Researcher, Implementer, and Security Reviewer roles in `.github/agents/`.
- Canonical ticket/evidence outcomes require human-controlled review and approval.

## 4. Traffic-Light Hand-Off Rules

### 🟢 SAFE TO HAND OFF

Use when the current task is clearly within the selected agent's authority and scope.

Examples:

- research question to Researcher
- independent security/governance review to Security Reviewer
- explicitly approved implementation scope to Implementer
- verification review after implementation

### 🟡 RETURN TO THIS CHAT

Use when an agent result must return to the human/ChatGPT control layer before the next hand-off.

Examples:

- research completed; decide whether it becomes a task
- reviewer findings completed; decide approve/defer/block
- implementation completed; decide closure/evidence update

### 🔴 STOP - DO NOT HAND OFF

Use when explicit human approval/decision is required before further action.

Examples:

- unclear scope
- conflicting governance
- legal/ownership/compliance interpretation needed
- cross-domain boundary uncertainty
- request to cross CalorieToken and ICTHENDRIKSE boundaries without explicit rationale
- request involving Verity One

Operational rule: the traffic-light status shown in the ChatGPT control layer is the immediate instruction for hand-off behavior.

## 5. Mandatory Human Gates

Required gates:

- Researcher output -> Human review
- Reviewer output -> Human decision
- Approved scope -> Implementer
- Implementation result -> Verification
- Verification result -> Human review before canonical record updates or closure

AI output does not automatically become:

- an approved task
- a canonical ticket
- evidence
- a decision / decision record
- a legal conclusion
- an ownership conclusion
- a compliance conclusion

## 6. Implementer Start Preconditions

Before implementation begins, all of the following must be established:

1. The task has been reviewed.
2. Scope is explicitly defined.
3. Human approval exists.
4. Files allowed to change are known.
5. Restrictions are known.
6. Existing dirty worktree state must be preserved.
7. No unrelated cleanup is permitted.

If these are not established:

🔴 STOP - DO NOT IMPLEMENT.

## 7. Dirty Worktree Protection

Apply existing repository policy:

- preserve unrelated modified files
- preserve unrelated untracked files
- do not reset/revert unrelated work
- do not stage unrelated files
- no commit unless separately and explicitly authorized
- no push unless separately and explicitly authorized

This matrix does not add new Git policy; it consolidates existing rules.

## 8. Ticket Gate

Research finding
-> candidate task
-> human review
-> approved ticket
-> implementation

AI-generated candidates are not automatically canonical tickets.

Ticket provenance and status must remain explicit.

## 9. Evidence Gate

Source
-> extraction
-> interpretation
-> human review
-> canonical evidence record

Source material and AI interpretation must remain distinct.

Evidence classification, verification status, access classification, and provenance must follow the existing evidence framework.

## 10. Historical ChatGPT Import Gate

Historical ChatGPT material is source material until reviewed.

It must not automatically become:

- tickets
- evidence
- decisions
- legal conclusions
- canonical project facts

No import functionality is authorized by this matrix.

## 11. Scope Separation

Maintain explicit scope boundaries:

- CALORIETOKEN: this repository workflow and records
- ICTHENDRIKSE: separate business/domain and records
- CROSS-SCOPE: explicit, justified relationship only
- VERITY ONE: outside this repository workflow and isolated unless a separate explicit governance decision establishes otherwise

Do not modify or investigate Verity One in this repository workflow.

## 12. Stop Conditions

Return to the human immediately when any of the following occurs:

- unclear scope
- conflicting instructions
- legal/IP question
- ownership question
- security/privacy concern
- regulatory/compliance question
- sensitive evidence exposure risk
- uncertain business-domain ownership
- request to modify unrelated files
- request to commit/push without explicit authorization
- request to cross CalorieToken / ICTHENDRIKSE boundaries without explicit governance basis
- request involving Verity One
- dirty-worktree ambiguity

## 13. Quick Decision Matrix

| Situation | Action |
|---|---|
| Research needed | 🟢 Researcher |
| Research completed | 🟡 RETURN TO THIS CHAT |
| Need independent security/governance review | 🟢 Security Reviewer |
| Need decision whether finding becomes a task | 🟡 Human review |
| Approved implementation scope exists | 🟢 Implementer |
| Implementation completed | 🟢 Verification / Reviewer |
| Need legal interpretation | 🟡 Human review / appropriate external professional |
| Need to import historical ChatGPT archive | 🔴 Stop until import governance is explicitly approved |
| Need to touch Verity One | 🔴 Stop; separate workspace |

## 14. Authority and Precedence

This matrix is a quick-reference control document.

Detailed repository policies remain authoritative.

Explicit human decisions override AI suggestions.

Agents must not infer approval.

Absence of explicit approval is not approval.

## 15. Final One-Screen Rule

🟢 RESEARCH / VERIFY -> HAND OFF

🟡 DECIDE / APPROVE -> RETURN TO HUMAN

🟢 APPROVED IMPLEMENTATION -> HAND OFF

🟢 VERIFY -> HAND OFF

🟡 REVIEW RESULT -> RETURN TO HUMAN

🔴 UNCLEAR / SENSITIVE / CROSS-BOUNDARY -> STOP
