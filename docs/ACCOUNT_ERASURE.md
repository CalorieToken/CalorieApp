# Authenticated account erasure

Status: V2 backend and English confirmation UI implemented, both disabled by
default. The direct-deletion policy is selected, but this remains a
release-blocking partial gate rather than a production-ready deletion claim.

## Selected V2 policy

The reviewed V2 policy is privacy-first:

- directly owned primary-store data is erased immediately after the
  authenticated double confirmation succeeds;
- there is no app recovery window after success;
- encrypted backups may retain the erased data for no more than 30 days;
- a restore must reapply erasure requests before the restored service resumes;
- separate WordPress or Xaman accounts, public XRPL data and third-party source
  data are outside the CalorieApp erasure boundary.

This selection does not claim that a production backup provider, expiry job or
restore-replay mechanism is already configured or proved. The separate
inactive-account and authentication-transient periods are now selected in
`RETENTION_POLICY.md`, but their notice and cleanup mechanisms remain disabled
and unproved.

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

## Frontend contract

`AccountErasurePanel` is rendered only when
`NEXT_PUBLIC_ACCOUNT_ERASURE_UI_ENABLED=true`. The documented default is
`false`. The backend remains independently disabled unless
`ACCOUNT_ERASURE_ENABLED=true`, so changing only one flag cannot activate the
complete flow.

The English UI:

- explains the immediate primary-store deletion, zero-day recovery window,
  maximum 30-day encrypted-backup boundary and excluded external systems;
- recommends downloading the private export first;
- displays the authenticated internal account identifier and requires the user
  to type it exactly;
- requires a separate irreversible-action acknowledgement;
- sends the fixed backend acknowledgement only through the same-origin proxy;
  and
- clears the local signed-in state only after a reviewed `{ "status":
  "erased" }` response.

The proxy admits only `DELETE /api/identity/account` and requires both the
normal same-origin mutation check and the CalorieApp-only account-erasure intent
header. Cross-site, same-site and top-level-navigation requests fail closed.

## Permanent safety boundary

Both UI and endpoint are disabled unless separately enabled in deployment
configuration. Code completion does not authorize live activation. Before
activation, a human must approve and verify:

- privacy-notice wording and support/escalation handling;
- the translated eleven-language confirmation and consequence UI;
- a provider-specific encrypted-backup schedule of no more than 30 days;
- a restore mechanism that reliably reapplies prior erasure requests;
- a PostgreSQL staging test and documented restore/erasure drill;
- the selected inactive-account notice and retention enforcement;
- the selected authentication-transient cleanup boundary;
- the exact production deployment and rollback plan.

The current implementation makes no claim that backups are already erased. No
live account, session or personal record was mutated while implementing this
gate. `PRIVACY_NOTICE_ALIGNMENT.md` records the canonical consequence facts
without claiming that the current English interface is a complete or published
privacy notice.

## Primary privacy-design references

- European Commission, [principles of personal-data processing under the
  GDPR](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
- European Data Protection Board, [2026 coordinated-enforcement report on the
  implementation of the right to
  erasure](https://www.edpb.europa.eu/documents/coordinated-enforcement-framework/coordinated-enforcement-action-implementation-of-the-0_en)
