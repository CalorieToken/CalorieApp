# Source-assertion moderation

Status: the internal terminal moderation service and migration
`20260901_0010` are implemented. Retained correction is a separate internal
service documented in `SOURCE_ASSERTION_CORRECTION.md`. No public moderation,
contribution, source activation, migration execution or deployment is enabled.

## Admitted decision

The service accepts one decision only when:

- the assertion exists and is still `quarantined`;
- the caller supplies the assertion's exact positive verification version;
- the target is exactly `validated` or `rejected`;
- the authorization scope is exactly `catalog:source-assertion:moderate`;
- the idempotency key and pseudonymous moderator reference use controlled
  bounded formats; and
- the reason is a controlled reason code, not free text.

Before a `validated` decision, the service re-applies the current assertion
content policy and requires the stored value to be canonical. It also rechecks
that the source is enabled, source record validated, product active and exact
product/source link validated. Invalid or stale evidence can still be moved to
`rejected`; it cannot be activated.

A successful decision changes only the assertion's verification status and
increments its verification version. The product, source record, attribute,
value, unit, observation time and correction lineage remain unchanged.

## Idempotency, concurrency and failure

The assertion and idempotency key are protected by bounded PostgreSQL
transaction advisory locks. Exactly one concurrent decision can move a
version-1 quarantined assertion to version 2. Repeating the identical request
returns the original result; reusing the key for another decision or submitting
a stale version returns `409` without `Retry-After`.

Database or lock failure rolls back and returns bounded `503` with
`Retry-After: 5`. The SQLite lock is only local-development evidence;
multi-process PostgreSQL CI is the shared-state proof.

## Audit and privacy boundary

The assertion update and one `food_attribute_assertion_moderation_audit` row
commit atomically. The audit stores the assertion identifier, idempotency key,
versions, statuses, pseudonymous moderator reference, fixed scope, controlled
reason code and timestamp. It contains no raw payload, free text, email, IP,
session, wallet or private user identifier.

The service never updates or deletes an audit row. Production insert-only audit
privileges and real caller authentication remain separate release proofs.

## Deliberate non-claims

This service does not decide truth automatically, approve a source licence or
create a public route. The separate correction service creates a new
quarantined assertion while retaining its predecessor; this moderation service
remains the only path that may later validate that correction.
