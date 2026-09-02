# Inactive-account erasure preflight

Status: internal transaction-bound read-only preflight prepared. Account
erasure, scheduling, batch selection and production execution remain disabled.

`backend/app/inactive_account_erasure_preflight.py` reuses the locked
single-candidate eligibility guard and describes only the directly related
primary-store deletion shape. It counts food logs, external identities, login
handoffs, authentication sessions, inactive-account notices and inbound session
replacement references. It returns no food values, contact destinations,
external subjects, wallet data, receipt values, session secrets or network
signals.

Every relation is capped at 10,000 rows and the complete candidate at 20,000
delete rows. Exceeding either boundary fails closed for operator review. The
preflight also rejects an external subject shared by another internal account
and any legacy authorization activity whose direct ownership was never stored.

The helper never deletes, updates, inserts, flushes, commits or rolls back. It
has no endpoint, CLI, provider, network, contact, queue or scheduler capability.
The caller owns the transaction and must roll it back after inspection. CI
exercises this read-only boundary on PostgreSQL as well as SQLite; it is not
provider or production proof. Any future mutation would require a separately
reviewed implementation, PostgreSQL staging and restore-erasure proof,
eleven-language privacy alignment, and an explicit migration and deployment
decision.
