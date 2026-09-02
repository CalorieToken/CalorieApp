# Inactive-account notice evidence

Status: minimal delivery-evidence schema and authenticated-activity
cancellation prepared. Notice delivery, provider selection, scheduling,
automatic erasure, migration and deployment remain disabled and
release-blocking.

## Purpose

The selected retention policy permits no inactive-account erasure unless a
warning was reliably delivered 30 days before the account reaches 24 calendar
months without authenticated CalorieApp activity. A count from the read-only
preview is not delivery proof.

Forward migration `20260901_0013` therefore prepares one evidence row per user
and durable activity anchor. A row represents a successfully delivered notice,
not an attempted or queued message. Database constraints require a delivery
inside the notice window and keep delivered and cancelled states unambiguous.
Forward migration `20260902_0014` additionally requires cancellation at or
after delivery. PostgreSQL enforces that ordering with a check constraint;
SQLite uses equivalent insert and update triggers without rebuilding the table.

## Data minimization

The evidence row contains only:

- the internal account relation and activity anchor;
- the notice-window, retention, delivery and recording timestamps;
- a bounded, provider-neutral channel key;
- a 64-character keyed delivery-evidence digest; and
- cancellation time and the fixed `authenticated-activity` reason when the
  user returns.

It must not contain an email address, wallet address, external subject, message
body, raw provider receipt, session value or network signal. A future delivery
adapter must create the digest with a secret keyed construction and must never
persist or log the key. The private account export includes the lifecycle
timestamps and channel, but deliberately excludes the digest. Account erasure
deletes the evidence row before deleting the account.

## Provider-neutral receipt proof

`backend/app/inactive_account_notice_receipt.py` prepares the pure receipt-
minimization step for a future reviewed delivery adapter. Only after a provider
has confirmed successful delivery may the function derive an `hmac-sha256-v1`
digest. The HMAC binds the opaque provider receipt to the internal account,
activity anchor, notice window, retention boundary, delivery timestamp and a
bounded provider-neutral channel key.

The secret must contain at least 32 bytes and remains caller-owned. The opaque
receipt is limited to 4096 UTF-8 bytes. The function returns only the channel,
delivery timestamp normalized to persistence-compatible naive UTC and a
64-character digest; it has no provider,
network, logging, database, scheduling or erasure capability. The raw receipt
and secret are neither fields of the returned value nor persisted by this
module. Tests use a synthetic receipt and a non-production key only.

The same pure module can recompute and verify evidence when an authorized audit
supplies the original opaque receipt, matching secret and identical timeline
context. It rejects malformed stored digests and uses `hmac.compare_digest` for
the final comparison. Timestamp type failures are explicit, and HMAC input is
fed incrementally to avoid allocating one combined domain-plus-payload buffer.
Key identifiers, generation, custody, rotation and authorized audit access
remain outside this prepared code and must be reviewed before activation.

## Activity cancellation

Every successfully created session and successfully authenticated request
already advances `last_authenticated_activity_at`. The same transaction now
changes an older delivered notice to `cancelled`. A failed transaction rolls
back both changes. An equal or older activity-anchor observation cannot cancel
a notice, and activity observed before delivery cannot cancel a later warning.
Activity at the delivery timestamp can cancel it. Cancellation never creates
an erasure instruction.

## Explicit non-activation boundary

This repository change does not select a contact channel or provider, create a
pending-delivery queue, send a warning, write a real evidence row, configure a
scheduler, authorize erasure, apply a staging or production migration, or
deploy the application. Receipt-proof preparation does not change that
boundary. There is no CLI or public endpoint for notice creation.

Before activation, a separate review must implement idempotent delivery, define
key generation, custody, rotation and verification, align all eleven locale
notices, test the chosen provider and deployed cancellation path, and obtain
explicit migration and deployment approval.
