# Durable data safety contract v1

This directory defines the release-blocking data-safety boundary for CalorieApp.
It separates durable private application data from optional decentralized
research and records which controls are already verified, partial, planned or
still require an explicit decision.

The contract does not contain credentials, provider-specific endpoints or live
user data. Passing its automated checks is necessary but is not by itself a
legal, privacy or security certification.

Files:

- `data-safety.json`: architecture, data classes, retention boundaries and
  prohibited storage patterns.
- `account-data-import-receipt-disclosure.json`: selected future v2 disclosure
  boundary for private import-receipt metadata, without exposing replay evidence.
- `privacy-notice-alignment.json`: canonical product facts, English consequence-
  copy evidence and the still-closed legal, provider, translation and
  publication fields.
- `release-test-matrix.json`: auditable status of every release-blocking gate.

The selected retention periods and their still-closed enforcement boundaries
are documented in `docs/RETENTION_POLICY.md`.
Privacy-notice alignment and its still-closed publication boundary are
documented in `docs/PRIVACY_NOTICE_ALIGNMENT.md`.

Status vocabulary:

- `verified`: implemented and covered by the cited automated evidence.
- `partial`: some foundations exist, but the release gate is not complete.
- `not_started`: required implementation and verification remain outstanding.
- `decision_required`: implementation must wait for an explicit policy choice.
- `research_only`: not part of the current production architecture.
