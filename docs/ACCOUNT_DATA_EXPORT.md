# Authenticated account-data export

Status: V2 backend and eleven-language download control implemented and tested.
Privacy-notice approval, provider proof and production activation remain
release-blocking.

The matching v1/v2 import path now includes strict validation, planning, admission
and guarded non-production transaction staging plus an authenticated upload
route and eleven-language UI. The route and UI remain disabled by default and
there is no production activation. See `ACCOUNT_DATA_IMPORT.md`.

## Endpoint

`GET /api/identity/export` requires the normal opaque CalorieApp session cookie.
The response is a downloadable JSON document with the stable version identifier
`calorieapp-account-data-v2`. Identity responses and the export are marked
`Cache-Control: no-store` and `Pragma: no-cache`.

The export contains only records belonging to the authenticated internal user:

- account identifier, status, timestamps and the durable
  `last_authenticated_activity_at` retention anchor;
- linked external identities and optional XRPL address;
- every owned private food-log snapshot;
- session activity timestamps;
- completed or failed browser-login handoff activity; and
- delivered or cancelled inactive-account warning lifecycle timestamps and the
  provider-neutral channel key; and
- account-owned import-history summaries containing only the import timestamp,
  food-log count, source export version and import-plan version.

Cross-user records are excluded. Legacy food logs whose owner is unknown remain
quarantined and are not silently claimed by any account.

The version-one `authorization_events` field is retained as an empty list for
format compatibility. Legacy authorization rows contain an external subject but
no direct internal-user or provider ownership, so their timestamps and stored
request IP cannot be safely attributed and are withheld. They may be included
only after a migration records direct ownership without inferring it from the
subject.

## CalorieApp download control

An authenticated CalorieApp session now shows a **Download private JSON**
control. It wakes the backend through the public health probe, then requests the
export only through the same-origin backend proxy with the existing opaque
session cookie. The proxy allowlist admits exactly the reviewed `GET` route and
preserves private no-store and download response headers.

The browser accepts the response only when it is JSON and contains the reviewed
`calorieapp-account-data-v2` version plus the expected private-data collections.
It creates a `calorieapp-account-data-v2.json` browser download, revokes the
temporary object URL and does not render the payload or place it in local or
session storage. CalorieApp does not send the export to another service; the
browser or operating system controls its configured download location. A `401`,
ownership ambiguity, malformed response or backend failure produces no file.

The interface now provides that consequence copy in all eleven registered
locales. The active Identity Bridge locale is passed to the control; locale
aliases are normalized, unsupported values fail safely to English, and Arabic
and Urdu render right-to-left. Every locale explains the included private-data
categories, excluded security material, withheld unowned authorization
activity, private download-location boundary and that downloading does not
delete server data.

The localized strings are complete product copy, not a complete or approved
privacy notice. Independent linguistic and legal/privacy review remains
recorded as incomplete, and no publication or activation is authorized by this
implementation.

## Deliberately excluded secrets

The export never returns authorization-code hashes, login state, internal login
session identifiers, opaque session-token hashes, browser-handoff state/token
hashes, the keyed notice-delivery evidence digest or the private import replay
digest. Their presence would
weaken authentication or expose internal receipt evidence without improving
data portability. The response names these excluded security fields so the
boundary is transparent.

## Implemented import-receipt disclosure

The current `calorieapp-account-data-v2` response contains an
`account_import_receipts` collection with only the account-owned import
timestamp, imported food-log count, source export version and import-plan
version. The importer continues to accept the legacy
`calorieapp-account-data-v1` format, which has no receipt-summary collection.

The internal receipt ID, repeated target-account ID and private replay digest
must not be exported. Source account identifiers, source food values or IDs and
approval or release commit references must not be derived or joined into the
summary. The private digest remains internal target-bound replay evidence and
must not appear in exports, logs or errors.

When a v2 file is imported, its receipt summaries are informational history
only. They are validated but never restored as live replay receipts or used to
bypass the fresh target-bound import checks. This boundary and the retained v1
compatibility are machine-readable in
`contracts/data-safety/v1/account-data-import-receipt-disclosure.json`.

## Still required before public onboarding

- complete the operator publication review and any later independent linguistic
  or legal/privacy review of the eleven implemented translations;
- align the privacy notice with the exact exported data classes;
- apply the prepared forward migration only after an explicitly approved
  synthetic staging operation, then prove v1/v2 receipt-version constraints on
  the selected provider;
- complete PostgreSQL and restore-path verification;
- implement the selected zero-day erasure and maximum 30-day encrypted-backup
  boundary on a reviewed provider; and
- implement and disclose the selected 24-month inactive-account period with a
  30-day advance notice and the maximum 30-day post-expiry security retention
  for authentication transients.

The export endpoint does not choose a retention period, send an export to a
third party or publish private history. The separately implemented account-
erasure endpoint remains disabled by default and fails closed on matching
legacy authorization rows without direct ownership; see `ACCOUNT_ERASURE.md`.
The selected but not yet enforced lifecycle is defined in
`RETENTION_POLICY.md`. Canonical facts for the future complete privacy notice
and the still-closed legal, provider, language-review and publication fields are
recorded in `PRIVACY_NOTICE_ALIGNMENT.md`.

An export is not authentication. A future import must authenticate its target
account independently and may not restore exported identity, session, handoff
or inactive-notice state as live security state. Receipt summaries imported
from v2 remain informational and never become live replay evidence. Provider-
exit proof, privacy approval and explicit activation still remain required
before user-facing import can be enabled.
