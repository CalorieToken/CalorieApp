# CalorieApp project decisions

This file records major architecture decisions that have already been made. These decisions are considered protected unless direct evidence requires a change.

## Decision 1: migration away from the previous custodial-wallet approach

- Decision: move from a custodial wallet model toward the current non-custodial webapp identity architecture.
- Rationale: the project scope and security boundary are non-financial and non-custodial.
- Status: DECIDED / IMPLEMENTED / PROTECTED
- Protected from casual redesign: YES

## Decision 2: Xaman as the external wallet/identity boundary

- Decision: Xaman/XUMM remains outside the app’s own wallet/custody logic.
- Rationale: CalorieApp should not store private keys or sign XRPL transactions.
- Status: DECIDED / IMPLEMENTED AT ARCHITECTURE LEVEL / PROTECTED
- Protected from casual redesign: YES

## Decision 3: WordPress bridge as the external identity integration boundary

- Decision: WordPress is the external identity bridge boundary between the browser/user flow and the CalorieApp backend.
- Rationale: WordPress hosts the external verification flow and provides the bridge endpoint contract used by the backend.
- Status: DECIDED / IMPLEMENTED AT ARCHITECTURE LEVEL / PROTECTED
- Protected from casual redesign: YES

## Decision 4: opaque server-side session architecture

- Decision: the application uses opaque server-side auth sessions rather than client-readable token state.
- Rationale: keeps auth state server-side, protects against client tampering, and preserves session integrity.
- Status: DECIDED / IMPLEMENTED / TESTED / PROTECTED
- Protected from casual redesign: YES

## Decision 5: HttpOnly session cookie

- Decision: the authenticated session is stored in an HttpOnly cookie.
- Rationale: prevents client-side script access to the session token.
- Status: DECIDED / IMPLEMENTED / PROTECTED
- Protected from casual redesign: YES

## Decision 6: server-side session storage

- Decision: session records are stored server-side in `AuthSessionDB` and associated logic.
- Rationale: keeps the real session material off the browser and supports expiration/revocation.
- Status: DECIDED / IMPLEMENTED / PROTECTED
- Protected from casual redesign: YES

## Decision 7: food-log owner authorization

- Decision: food logs are owned and scoped to the authenticated user.
- Rationale: prevent cross-user access to logs and enforce privacy boundaries.
- Status: DECIDED / IMPLEMENTED / TESTED / PROTECTED
- Protected from casual redesign: YES

## Decision 8: replay protection

- Decision: pending login state and bridge nonce validation mitigate replays and callback misuse.
- Rationale: external identity flows require short-lived validation and single-use semantics.
- Status: DECIDED / IMPLEMENTED / TESTED / PROTECTED
- Protected from casual redesign: YES

## Decision 9: separate application implementation from staging/deployment work

- Decision: runtime security architecture and deployment topology are separate concerns.
- Rationale: the repo should not mix app security decisions with external infrastructure hoisting.
- Status: DECIDED / PROTECTED
- Protected from casual redesign: YES

## Decision 10: preserve Render/Plesk history as historical context

- Decision: historical Render/Plesk/WordPress discussion should remain documented rather than being silently discarded.
- Rationale: external infrastructure may have been real even when not proven live in the current repo.
- Status: DECIDED / HISTORICAL / REQUIRES EXTERNAL VERIFICATION
- Protected from casual redesign: YES

## Decision 11: whitepaper canonical-source migration remains a future governance decision

- Decision: the whitepaper canonical-source migration is future work and not current implementation work.
- Rationale: it is publication/governance work, not app runtime work.
- Status: DECIDED / DEFERRED
- Protected from casual redesign: YES

## Decision 12: do not treat docs as live deployment proof

- Decision: documentation, checklists, and staging templates do not prove live deployment.
- Rationale: external infra must be independently verified.
- Status: DECIDED / PROTECTED
- Protected from casual redesign: YES
