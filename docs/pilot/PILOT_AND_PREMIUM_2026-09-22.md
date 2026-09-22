# Voluntary merchant and consumer pilot — implementation candidate

Status, 22 September 2026: **not live, no pilot registration, no billing, no live
schema migration, no signing endpoint**. The food app's already released features
remain separate. This candidate is reviewable code, not an operational payment
service or a claim that legal or security acceptance is complete.

## Implemented and tested in isolation

- Separate Mainnet and Testnet participation, explicit merchant/consumer consent,
  exact network/currency/issuer allowlist and a separate CalorieApp rail interface.
- Merchant catalogue with price, optional cost price, available stock and a
  per-sale-unit nutrition/source snapshot. Missing nutrition blocks diary entry;
  it is not converted to zero.
- Transactional opening stock, restocking, waste, corrections, reservations and
  release of unaccepted drafts. Idempotency keys reject conflicting retries.
- An invoice freezes its product quantities, reference currency, token amount,
  buyer, merchant, random invoice identifier and free-policy version. Unpaid
  orders do not count as revenue. A new purchase needs both parties to opt in.
- A Payment verifier requires a validated successful transaction, exact network,
  buyer, merchant, asset issuer/currency, invoice and actual delivered amount.
  Partial payments, extra routing fields, wrong destination tags and memos fail.
- Consumer purchases and merchant records are scoped separately; merchant costs
  do not appear in the buyer receipt. A public transaction hash grants no access.
- Explicit fractional consumption records: buying two biscuits and logging half
  of one is distinct from logging the whole purchase. Repeated saves do not
  duplicate diary entries. The Testnet practice diary is a separate table.
- Reference-currency choices cover the eleven display languages, with multiple
  suggestions where appropriate. Language is not a jurisdiction or currency
  decision. All currencies remain a user choice. A pure conversion helper
  supports supplied rates; no market/FX feed has been added or represented as live.
- Free-launch policy and premium candidates. No fee accumulation, subscription,
  paywall, automatic renewal, payment recipient for fees or deferred billing.

The candidate uses `backend/app/pilot/`; its schema is intentionally **not** in
the active migration runner, and the module is not registered in FastAPI. Tests
create isolated temporary tables. The public app keeps its existing schema,
authentication and diary path. The frontend pricing notice is a separate small
candidate change; publishing that notice would not activate this module.

## Interface arrangement for the eventual connected pilot

Entry from Account, explicitly marked Pilot. First choose Practice/Testnet or
Real payments/Mainnet; retain a persistent network label. Switching never copies
stock, revenue, purchases or diary records between networks.

| View | Default content | Next action |
|---|---|---|
| Merchant · Sales | Recent invoices, awaiting confirmation, settled totals per currency | Review one invoice; show recipient, asset, network, quote and fees before payment |
| Merchant · Inventory | Search, stock level and low-stock filter; 10–25 rows | Restock, waste or correct with a reason; no long expanded forms |
| Consumer · Purchases | Recent food/drink purchases, totals per currency | Open receipt; separately choose a consumed portion and review diary entry |

Use a named Back button and location trail. Recipe ideas and OFF/USDA searches
remain separate screens reached through explicit actions. A merchant-supplied
nutrition value must identify its basis; it is not certified by payment or by
association with OFF/USDA. Payment never establishes food safety or dietary fit.

## Correct rail and assets

The inspected DEX worktree's candidate `calorietoken-crypto/includes/service.php`
still reads `xummlogin_api_key` and `xummlogin_api_secret` from WordPress. The
existing CalorieApp identity bridge also reads those options for authentication.
Neither establishes the **separate CalorieApp payment rail** requested by the
user. This module consequently has **no fallback to those credentials**, does
not copy that plugin, and uses a fail-closed `UnconfiguredAppRail` seam.

The known Mainnet CAL identity matches the screenshot context and existing
project references; RLUSD matches Ripple's official issuer documentation.
XRP is native. CALT remains unlisted until its exact Testnet currency and issuer
are supplied and verified. No token is identified from its ticker alone. The
remaining AMM pairs in the screenshot do not imply that issued EUR/USD/BTC are
fiat currencies, accepted payment assets or safe FX benchmarks.

## Work still required before a release

The machine-readable checklist is `contracts/pilot/v1/release.json`. In
particular this candidate does not yet provide a public authenticated pilot
API/UI, completed signing lifecycle, CALT support, PostgreSQL migration/locking
proof, operational refunds/returns/reconciliation, complete pilot exports and
erasure, or a current legal acceptance. These must not be reported as finished.

Connect the reviewed app rail with network-bound wallet ownership proof and
pinned ledger reads, explicit transaction review, bounded network fee and
issuer transfer-fee handling, recipient/trustline/reserve checks and signature
expiry. Do not enable Mainnet merely because unit tests or wallet login succeed.
The adapter must normalize official ledger responses and must never trust raw
browser-provided receipt JSON. Real payment is not simulated settlement.

Pending signed invoices retain reservations. Automatically releasing an expired
request without checking whether a payment was validated would permit
overselling. A reconciliation and refund process is required before pilots use
real money. Database uniqueness and SQLite tests do not replace PostgreSQL
cross-process, full authenticated integration and real-device Testnet proof.

## Premium preparation

Current charge: **0**. Potential later paid items are advanced reports, team
permissions and merchant integrations; an explicitly disclosed transaction fee
is a candidate revenue model, not an announced rate or entitlement. Existing
recipe, alternative, source, diary and inventory functions are not paywalled.
No free phase end date or subscription trial clock has been invented.

Any paid release needs a new reviewed price version, full price/tax/fee display,
explicit fresh acceptance, cancellation/refund handling and reconciliation.
Network fees and any external provider fee are separate from platform revenue.
Previously free use must not create a retroactive debt. Privacy rights, data
export and requests to delete an account must not depend on premium access.
Neither food history nor purchase history is sold as a revenue model.

## Verification

Run `python -m pytest backend/tests/test_pilot_candidate.py` in the backend's
existing test environment. Tests use fabricated participants and temporary
SQLite storage, and perform no signatures, transfers or live database writes.
Final results and remaining limitations belong in the release record, not in a
claim of regulatory approval.
