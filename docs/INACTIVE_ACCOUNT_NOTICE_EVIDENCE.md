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

## Activity cancellation

Every successfully created session and successfully authenticated request
already advances `last_authenticated_activity_at`. The same transaction now
changes an older delivered notice to `cancelled`. A failed transaction rolls
back both changes, and an equal or older observation cannot cancel a notice.
Cancellation never creates an erasure instruction.

## Explicit non-activation boundary

This repository change does not select a contact channel or provider, create a
pending-delivery queue, send a warning, write a real evidence row, configure a
scheduler, authorize erasure, apply a staging or production migration, or
deploy the application. There is no CLI or public endpoint for notice creation.

Before activation, a separate review must implement idempotent delivery, prove
the keyed receipt process, align all eleven locale notices, test the chosen
provider and deployed cancellation path, and obtain explicit migration and
deployment approval.
