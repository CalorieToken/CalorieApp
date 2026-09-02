# Guarded account-data import foundation

Status: provider-neutral validation, planning, admission, guarded transaction
staging and an authenticated upload route with eleven-language UI are
implemented but disabled. Production activation and provider-exit execution
remain blocked.

## Purpose

CalorieApp's private `calorieapp-account-data-v1` export must eventually let an
authorized user move food history to a clean provider-neutral deployment. The
first two import slices stop before any write. They prove that an untrusted
export can be bounded, validated and converted into an explicit food-log plan,
then admitted under a conservative target and capacity policy without treating
exported authentication history as reusable proof. A third internal slice can
stage an admitted plan in a caller-owned non-production transaction. The fourth
slice connects this to an authenticated route and hidden UI without enabling it.

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

## Authenticated route and UI boundary

`POST /api/identity/import` accepts the original JSON export bytes only after
normal session authentication. It derives the destination from that server-side
session and requires the user to type both the exact source account identifier
from the export and the exact signed-in destination account identifier. A fixed
acknowledgement confirms that only food-log snapshots are portable.

The route is constrained by all of the following independent gates:

- `ACCOUNT_DATA_IMPORT_ENABLED` defaults to `false`;
- `CALORIEAPP_ENV` must be `local`, `test` or `staging`; production is rejected;
- `ACCOUNT_DATA_IMPORT_APPROVED_COMMIT_SHA` must be one lowercase 40-character
  reviewed commit SHA;
- `CALORIEAPP_RELEASE_COMMIT_SHA` must identify the actually running code and
  match that approved SHA exactly, so later builds do not inherit enablement;
- the same-origin frontend proxy requires an exact import-purpose header;
- request bodies stop at 5 MiB and the route admits at most five attempts per
  minute through the shared database-backed limiter; and
- the complete staged import commits once or rolls back. Validation and
  database failures return bounded messages without private values or digests.

The UI has an independent
`NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED=false` default, uses the original
file bytes without browser persistence, supplies all confirmations and provides
complete product copy in the eleven registered locales. The copy has not been
independently reviewed and is not a complete privacy notice.

## Current safety boundary

The endpoint and browser control now exist but both remain disabled by default.
They have no provider integration, scheduler or production capability. The
uploaded JSON exists only in request/browser memory and is not retained as a
file. A forward schema migration and transaction helper remain prepared and
tested only against disposable local/CI data; no external staging or production
migration was run. This does not prove a provider exit or authorize import of
real user data.

Before import can be enabled, later reviewed work must add:

1. an isolated synthetic PostgreSQL source-to-successor provider-exit test;
2. an export-format decision for private replay-receipt metadata before any
   user-facing import activation;
3. an approved complete privacy notice and operator review of the prepared
   eleven-language consequence copy; and
4. explicit operator approval before any external staging mutation, provider action or
   production activation.
