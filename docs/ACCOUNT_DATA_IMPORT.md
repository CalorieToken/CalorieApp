# Guarded account-data import foundation

Status: provider-neutral validation, planning, admission and guarded internal
transaction staging implemented; authenticated upload, production activation
and provider-exit execution remain blocked.

## Purpose

CalorieApp's private `calorieapp-account-data-v1` export must eventually let an
authorized user move food history to a clean provider-neutral deployment. The
first two import slices stop before any write. They prove that an untrusted
export can be bounded, validated and converted into an explicit food-log plan,
then admitted under a conservative target and capacity policy without treating
exported authentication history as reusable proof. A third internal slice can
stage an admitted plan in a caller-owned non-production transaction.

`backend/app/account_data_import.py` accepts UTF-8 JSON bytes and requires:

- the exact reviewed v1 top-level and nested fields;
- no duplicate JSON keys or non-finite numbers;
- a maximum five-MiB input and at most 10,000 entries per collection;
- explicit timezones and consistent account, export and food-log timestamps;
- the exact v1 list of security fields excluded by the exporter;
- an empty legacy `authorization_events` collection;
- positive, unique source food-log identifiers; and
- explicit confirmation of the source account identifier.

Validation failures return bounded field-level safety messages without retaining
the private Pydantic or JSON parsing exception as a chained cause.

The planner also receives a target account identifier. A future caller must
authenticate and authorize that target independently; an external identity or
session contained in the export is never accepted as authentication.

## Portable and non-portable state

Only private food-log snapshots enter the plan. The plan assigns every snapshot
to the selected target account and deliberately omits the source database row
identifier from future insert values. This prevents source IDs from colliding
with or overwriting records in a successor database.

The following exported collections are validated but never rehydrated as live
state:

- external identity links;
- authentication sessions;
- authorization activity;
- browser login handoffs; and
- inactive-account notice state.

Those records describe security or lifecycle history. Identity must be proven
again, new sessions must be created normally, and retention state needs a
separately reviewed migration policy.

The plan includes a deterministic SHA-256 digest over canonicalized private
input and the selected target account to support future per-target idempotency.
The digest remains private evidence: it is not suitable for public logs, XRPL,
public artifacts or analytics.

## Pure admission policy

`backend/app/account_data_import_admission.py` accepts only a reviewed plan. A
future caller must supply a server-authenticated target identifier and a
separate exact target confirmation; both must match the target already bound
into the private digest. The function does not authenticate a user itself.

The initial duplicate policy is intentionally conservative:

- a new digest is admitted only when the target has no food-log rows;
- a digest already recorded for that target becomes an idempotent no-op;
- food records are never deduplicated merely because their nutrition values,
  labels or timestamps match; distinct source row identifiers remain distinct;
- the planned row count cannot exceed the existing 10,000-row per-user budget,
  and callers may lower but never raise that reviewed ceiling.

The database execution layer must obtain the existing row count and exact
private-digest match while holding the same transaction and lock used for the
inserts. Passing those values into this pure function alone is not database
proof.

## Guarded transaction staging

`backend/app/account_data_import_transaction.py` now implements that database
boundary without exposing it through HTTP. It requires `execute=True`, a
bounded approval reference, a validated `local`, `test` or `staging`
environment, the server-authenticated target identifier and separate exact
target confirmation. Production is rejected.

The caller must provide a clean session with no pending ORM mutations, so an
unrelated autoflush cannot enter the import boundary.

The helper acquires the same per-account lock used by normal food-log capacity
admission, locks and verifies the active target, reads its row count and exact
private replay receipt, applies the pure admission decision, and stages all
food-log inserts plus one `account_data_import_receipt` inside a savepoint. The
receipt stores the target-bound private digest, reviewed format versions, row
count and timestamp; it never stores the source account identifier or food
values. The runtime database role may select, insert and erase the receipt but
may not update it.

The helper never commits. The caller must explicitly commit or roll back the
outer transaction. A database failure rolls the entire staged insert and
receipt sequence back, and an exact recorded digest is a zero-write idempotent
no-op. A matching digest with conflicting stored format or row-count evidence
fails closed. Account erasure, inactive-account erasure and the synthetic backup/
restore replay drill include the private receipt in their owned-data boundary.
SQLite remains a local single-process aid; PostgreSQL supplies the cross-process
transaction lock and is exercised with synthetic data in CI, including
contention against the normal food-log writer.

## Current safety boundary

These slices have no HTTP route, browser upload control, file output, provider
integration, network call, scheduler, production mode or deployment action. A
forward schema migration and internal database staging helper are prepared and
tested only against disposable local/CI data; no staging or production
migration was run. They do not prove a provider exit or authorize import of
real user data.

Before import can be enabled, a later reviewed slice must add:

1. an authenticated upload endpoint and eleven-language confirmation UI;
2. route-level derivation of the target from the authenticated session plus an
   explicitly reviewed feature flag and single commit boundary;
3. an isolated synthetic PostgreSQL source-to-successor provider-exit test;
4. an export-format decision for private replay-receipt metadata before any
   user-facing import activation;
5. privacy-notice and eleven-language consequence copy; and
6. explicit operator approval before any external staging mutation, provider action or
   production activation.
