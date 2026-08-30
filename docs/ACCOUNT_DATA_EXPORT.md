# Authenticated account-data export

Status: V2 backend implemented and tested; user-interface placement and privacy
notice alignment remain release-blocking.

## Endpoint

`GET /api/identity/export` requires the normal opaque CalorieApp session cookie.
The response is a downloadable JSON document with the stable version identifier
`calorieapp-account-data-v1`. Identity responses and the export are marked
`Cache-Control: no-store` and `Pragma: no-cache`.

The export contains only records belonging to the authenticated internal user:

- account identifier, status and timestamps;
- linked external identities and optional XRPL address;
- every owned private food-log snapshot;
- session activity timestamps;
- authorization activity, including a stored request IP when present;
- completed or failed browser-login handoff activity.

Cross-user records are excluded. Legacy food logs whose owner is unknown remain
quarantined and are not silently claimed by any account.

## Deliberately excluded secrets

The export never returns authorization-code hashes, login state, internal login
session identifiers, opaque session-token hashes, or browser-handoff state/token
hashes. Their presence would weaken authentication without improving data
portability. The response names these excluded security fields so the boundary
is transparent.

## Still required before public onboarding

- add the export control and explanation to the eleven-language Identity Bridge
  account/profile experience;
- align the privacy notice with the exact exported data classes;
- complete PostgreSQL and restore-path verification;
- obtain a human decision on account erasure, recovery window, inactive-account
  retention and backup-erasure timing.

The export endpoint does not choose a retention period, send an export to a
third party or publish private history. The separately implemented account-
erasure endpoint remains disabled by default; see `ACCOUNT_ERASURE.md`.
