# Inactive-account erasure eligibility guard

Status: internal transaction-bound guard prepared. Automatic erasure,
scheduling, batch selection and production execution remain disabled.

`backend/app/inactive_account_erasure_eligibility.py` revalidates one already
delivered notice and its current account immediately inside a caller-owned
database transaction. It requires an explicit timezone for the evaluation
instant, a reached retention deadline, an active account, an unchanged durable
activity anchor and an uncancelled delivered notice with a valid timeline.

On PostgreSQL the user and notice queries request `FOR UPDATE` locks, in that
order, so authenticated activity and this guard share a consistent lock order.
A future reviewed caller can keep the validation and any separately approved
action in one transaction. SQLite exists only for local/test contract coverage
and does not prove equivalent row-lock behavior. The helper never commits or
rolls back.

The returned object contains only the internal notice and user identifiers,
activity anchor, retention deadline and evaluation time. It excludes contact
destinations, raw receipts, evidence digests, session values and network data.
It is internal only and is not exposed through an endpoint or CLI.

Returning a candidate is necessary but not sufficient authorization for
erasure. This guard does not verify a provider receipt, select a batch, delete
or mark an account, contact a user, schedule work, replay backup erasures or
enable either direct or inactive-account deletion. Those release gates remain
blocked and still require reviewed PostgreSQL staging proof, provider/receipt
proof, aligned eleven-language notices and explicit migration and deployment
approval.
