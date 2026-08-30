# Authenticated account erasure

Status: V2 backend implemented and disabled by default. This is still a
release-blocking partial gate, not a production-ready deletion policy.

## Backend contract

`DELETE /api/identity/account` requires the normal opaque CalorieApp session
cookie plus two explicit JSON confirmations:

- the authenticated internal CalorieApp user identifier;
- the fixed machine acknowledgement `delete-my-calorieapp-account`.

When `ACCOUNT_ERASURE_ENABLED=true`, one successful transaction removes the
authenticated user's directly owned primary-store food history, Identity Bridge
links, browser handoffs, all authentication sessions and the internal account.
Before session deletion it clears incoming replacement references, including a
reference from an older session belonging to another account, while preserving
that other account and session. It then clears the browser session cookie. It
does not touch another user's records, external WordPress/Xaman accounts,
public ledgers, third-party source data or unrelated ecosystem data.

Legacy authorization activity is keyed by external subject rather than by the
internal user identifier or provider. A matching subject therefore does not
prove ownership. If a current identity is ambiguous, or if any matching legacy
authorization row exists without direct ownership, the endpoint fails with
`409` before mutation and requires operator review. It never deletes such a row
on subject alone. A separate migration must record direct ownership before a
future erasure flow may include legacy authorization activity.

## Permanent safety boundary

The endpoint is disabled unless explicitly enabled in deployment configuration.
Code completion does not authorize live activation. Before activation, a human
must approve:

- whether deletion is immediate or has a recovery window;
- encrypted-backup retention and when erasure reaches backups;
- privacy-notice wording and support/escalation handling;
- the translated eleven-language confirmation and consequence UI;
- a PostgreSQL staging test and documented restore/erasure drill;
- the exact production deployment and rollback plan.

The current implementation makes no claim that backups are already erased. No
live account, session or personal record was mutated while implementing this
gate.
