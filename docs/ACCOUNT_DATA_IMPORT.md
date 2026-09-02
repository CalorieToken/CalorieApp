# Guarded account-data import planning

Status: pure provider-neutral validation, planning and admission implemented;
authenticated upload, database mutation and provider-exit execution remain
blocked.

## Purpose

CalorieApp's private `calorieapp-account-data-v1` export must eventually let an
authorized user move food history to a clean provider-neutral deployment. The
first two import slices deliberately stop before any write. They prove that an
untrusted export can be bounded, validated and converted into an explicit food-
log plan, then admitted under a conservative target and capacity policy without
treating exported authentication history as reusable proof.

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

A later database implementation must obtain the existing row count and exact
private-digest match while holding the same transaction and lock used for the
inserts. Passing those values into this pure function is not database proof.

## Current safety boundary

These slices have no HTTP route, browser upload control, database session,
insert, commit, file output, provider integration, network call, migration,
scheduler or deployment action. They do not prove a provider exit or authorize
import of real user data.

Before import can be enabled, a later reviewed slice must add:

1. an authenticated upload endpoint and eleven-language confirmation UI;
2. private idempotency storage, target count, locking and conflict handling
   inside one caller-owned transaction;
3. atomic food-log insertion with complete rollback on any failure;
4. an isolated synthetic PostgreSQL source-to-successor execution test;
5. privacy-notice and eleven-language consequence copy; and
6. explicit operator approval before any staging mutation, provider action or
   production activation.
