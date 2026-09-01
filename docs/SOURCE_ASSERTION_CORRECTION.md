# Retained source-assertion correction

Status: implemented for an internal service and schema migration only. No
public correction route, authenticated caller integration, source activation,
production migration execution or deployment is enabled.

## Correction boundary

Migration `20260901_0011` adds
`food_attribute_assertion_correction_audit`. The internal service admits one
correction only when:

- the fixed authorization scope is `catalog:source-assertion:correct`;
- the predecessor exists at the supplied positive verification version;
- the predecessor is terminal: `validated` or `rejected`;
- no correction already supersedes that predecessor;
- the source is enabled, source record validated, product active and exact
  product/source-record link validated;
- the idempotency key, pseudonymous corrector reference and controlled reason
  code use bounded formats; and
- the replacement attribute, value, unit and observation time satisfy the
  current source-assertion content policy.

The service derives the product and source record from the predecessor. It
cannot move a correction to a different lineage. The predecessor is never
updated or deleted. The result is a new version-1 assertion in `quarantined`
state with `supersedes_assertion_id` pointing to the retained predecessor. It
must pass the existing terminal moderation service before validation.

Private `food_log` snapshots are independent point-in-time records and are not
rewritten by catalog correction.

## Idempotency, capacity and concurrency

Repeating an identical admitted request returns the same correction and audit
receipt, including after the correction is later moderated. Reusing the
idempotency key for another request, correcting the same predecessor twice or
submitting duplicate evidence returns `409` without `Retry-After`.

Corrections share the existing positive retained-assertion budget for their
source; they do not create a separate unbounded write path. PostgreSQL uses
bounded transaction advisory locks for predecessor, idempotency key and source
budget. Multi-process CI proves that concurrent requests create exactly one
correction. SQLite locking is local-development evidence only.

Invalid scope returns `403`, missing predecessor returns `404`, and stale state,
lineage or capacity returns `409`. Database, unsupported-backend or lock failure
rolls back and returns bounded `503` with `Retry-After: 5`.

## Minimal audit and privacy boundary

The correction and one `food_attribute_assertion_correction_audit` row commit
in the same transaction. The audit stores only predecessor and correction
identifiers, idempotency key, expected and resulting versions, pseudonymous
corrector reference, fixed scope, controlled reason code and timestamp. Unique
constraints preserve one child per predecessor and one receipt per correction
or idempotency key.

The service does not update or delete audit rows. The audit contains no raw
source payload, free text, email, IP address, session, wallet or private user
identifier.

## Deliberate non-claims

The scope string is a service-level purpose check, not proof of a real
authenticated caller. Authentication and authorization at an actual calling
boundary remain release-blocking. Production database privileges that make
audit rows insert-only also remain unproven.

This slice does not expose an HTTP endpoint, enable a provider or public
contribution, approve a licence, run a production migration, deploy code or
complete the contribution mutation flow. Those gates stay closed.
