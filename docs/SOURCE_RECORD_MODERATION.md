# Source-record moderation

Status: implemented and PostgreSQL multi-process verified for internal terminal
moderation of quarantined source records. There is no public moderation route,
no public contribution route and no newly enabled food-data source.

## Bounded decision

Every ingested `food_source_record` begins with verification status
`quarantined` and verification version `1`. The internal moderation service
permits exactly two transitions:

- `quarantined` to `validated`;
- `quarantined` to `rejected`.

A terminal record cannot be reset or rewritten through the service. Each call
must supply the exact internal scope `catalog:source-record:moderate`, a
purpose-scoped pseudonymous moderator reference, a positive expected version,
a unique idempotency key and a controlled reason code. Free-text notes and raw
payloads are not accepted.

## Concurrency and idempotency

The record update and audit insert occur in one transaction. PostgreSQL takes
transaction advisory locks derived separately from the source-record id and
the idempotency key, in deterministic order. This serializes competing
decisions for one record and also prevents one idempotency key from being used
concurrently for different records.

A stale expected version returns persistent `409` and changes nothing. Reusing
an idempotency key with exactly the same decision returns the original audit
and consumes no new version. Reusing it with different input returns `409`.
Unknown records return `404`; scope denial returns `403`. Database or lock
failure rolls back and returns bounded `503` semantics with a five-second
retry value.

SQLite uses one process-local lock for development and unit-test equivalence.
It is not live or multi-process evidence. CI uses four independent PostgreSQL
worker processes to execute twelve competing decisions and proves that exactly
one decision at expected version `1` commits, producing record version `2` and
exactly one audit event.

## Minimal audit evidence

Migration `20260831_0007` adds `verification_version` and the
`food_source_moderation_audit` table. An audit event contains only:

- source-record id and idempotency key;
- expected and resulting versions;
- previous and terminal status;
- purpose-scoped moderator reference and authorization scope;
- controlled reason code and creation time.

The service can only append an audit while applying its matching decision. It
has no audit update or delete operation. The schema contains no raw payload,
free-text note, email address, session, wallet address or IP address.

## Deliberate non-claims

The later `20260831_0008` migration supplies product, link and assertion tables,
but this moderation service still does not implement their write, moderation or
public contribution paths. It also does not implement a public moderator
authentication endpoint or prove production database privileges that
independently forbid audit updates. The combined contribution-mutation release
gate therefore remains open until those paths exist and are tested.

Open Food Facts catalog persistence remains off. This change adds no provider,
paid service, separate CI job, production migration or deployment.
