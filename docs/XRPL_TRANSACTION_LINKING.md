# Voluntary XRPL transaction linking architecture

Status: prepared architecture only. Disabled by default and not a dependency of
the current CalorieApp release.

This is intentionally a future-ready database seam, not an initial user feature.
The first users do not need CalorieToken settlement, a memo workflow or a trace
screen. Core durable storage, migrations, export, erasure and recovery remain
the priority. Only after those gates pass may the empty anchor/provenance tables
be introduced behind a disabled feature flag.

## Purpose and boundary

A user may eventually choose to associate an already public XRPL transaction
with a private CalorieDB record. CalorieApp remains non-custodial: it does not
hold keys, sign transactions, execute transfers, route orders or scan a user's
complete wallet history.

The architecture begins with this strict one-to-one pair:

```text
(XRPL network, validated transaction hash) <-> unique CalorieDB anchor hash
```

The network is part of the identifier because a hash alone does not document
which ledger environment was checked. Only a signed transaction in a validated
ledger is accepted; proposed or failed submissions do not establish a link.

The CalorieDB anchor hash is a separate 256-bit value, derived with
HMAC-SHA-256 from a domain separator, network and validated XRPL transaction
hash using a versioned server-side key. Database uniqueness constraints enforce
exactly one CalorieDB anchor per XRPL network/hash pair and exactly one pair per
CalorieDB anchor. The two hashes are linked but are not equal.

Before creating the pair, CalorieDB must prove that the validated transaction is
actually CalorieToken-related. Matching only the text `CAL`, a display name or a
memo is forbidden. A versioned asset registry supplies the exact network,
issuer and currency-code combination. Direct token payments can be checked from
the transaction fields; later DEX, AMM and trust-line cases require separate
allowlisted rules over validated transaction metadata. The first pilot should
support only a direct `Payment`, then expand one reviewed transaction type at a
time.

## Proposed private data model

| Entity | Essential fields | Purpose |
|---|---|---|
| `calorie_transaction_anchor` | network, transaction hash, unique CalorieDB anchor hash, key version, asset-registry entry/rule version, validated ledger index, verification time | Strict one-to-one top-level pair; no replicated raw transaction JSON |
| `calorie_record_fingerprint` | record type/key, canonicalization version, private HMAC fingerprint, key version | Detects the exact private record/version without exposing its contents |
| `ledger_record_link` | user, transaction reference, record fingerprint, purpose, consent version, verification method, status | Private typed relation between the user-authorized items |
| `calorie_link_group` | internal random id, purpose, owner/organisation scope, status | Privately groups several explicitly approved transaction-record edges into one chain or case |
| `ledger_link_challenge` | hashed random token, user, intended record/purpose, expiry, used time | Short-lived one-time proof for a new memo-assisted link |

The link graph remains private. A transaction hash must not become a public API
for discovering a CalorieApp account, food history, donation, profile or other
private record.

Below the one-to-one top pair, the private `ledger_record_link` joins a
`calorie_transaction_anchor` to one `calorie_record_fingerprint`. This lower
layer supports many-to-many relations: several XRPL transactions may support one
CalorieDB record, and one transaction may be related to several records, but
every edge requires its own purpose and explicit authorization. A
`calorie_link_group` can collect those edges without exposing a stable public
case, user or supply-chain identifier.

Cross-purpose linking is forbidden by default. For example, a donation link,
merchant traceability event and consumer food log must not be combined merely
because the same public wallet or transaction appears in more than one context.

## Top-down traceability below the hash pair

The full food path is modelled below the anchor in this order:

1. validated XRPL transaction hash;
2. unique CalorieDB anchor hash;
3. one or more hashed provenance events;
4. product, lot and batch input/output relations;
5. a visibility-filtered trace view for the permitted audience.

Food supply is a directed acyclic graph rather than a forced linear chain. One
harvest can be split into multiple batches; several ingredients can be merged
into one product; processing can create several outputs. Explicit event edges
model production, harvest, processing, transfer, shipment, receipt, retail and
optional consumption. A missing edge is shown as a gap and is never inferred.

A validated CalorieToken transaction proves the existence, contents and ledger
result of that transaction. By itself it does not prove that a physical food
item existed, moved, was safe or matched a claim. Those facts need separately
authorized event data, documents and, where appropriate, independent audit.

The complete machine-readable graph design is in
`contracts/provenance/v1/traceability.json`.

No separate graph platform is required. The anchor, event and edge tables fit in
the same provider-neutral PostgreSQL database as the rest of CalorieApp. XRPL is
only the optional ledger anchor; IPFS, Filecoin and another blockchain database
are not dependencies of this design.

The hash relation, provenance graph and verification state use open application
code and ordinary PostgreSQL features. Reading and validating an existing XRPL
transaction hash does not create a new ledger transaction. Any future action
that writes a transaction or memo carries the XRPL network fee and therefore
requires separate, explicit user authorization; it can never run automatically.

When this feature is eventually approved, a worker may automatically verify and
ingest the one transaction the user or authorized business has requested. The
network and transaction hash form its idempotency key, so retries cannot create
duplicate anchors. The worker records its rule version and evidence, rejects the
request before processing when its jurisdiction gate is closed, and starts with
the feature flag disabled. It may not scan a complete wallet, infer links across
purposes, publish private data or enable itself. This gives later scaling a safe
automation path without adding another platform.

## Two voluntary link flows

### Future transaction with memo

1. An authenticated user selects one CalorieDB record and a controlled purpose.
2. The backend creates a high-entropy one-time challenge, stores only its hash,
   and binds it to that user, record and purpose with a short expiry.
3. The user's own wallet places only a versioned opaque challenge in the XRPL
   memo. No name, email, food data, database id or stable user identifier is used.
4. The user supplies the transaction hash, or explicitly asks for this one
   transaction to be checked.
5. The backend retrieves the transaction, requires `validated=true`, verifies
   the challenge and the purpose-specific account/currency/issuer conditions,
   consumes the challenge and stores the private link.

### Existing transaction without memo

1. The authenticated user supplies a transaction hash and intended private record.
2. CalorieApp verifies the transaction on the selected network.
3. The user proves the relevant participant role through the already verified
   Xaman identity context or a fresh wallet challenge.
4. After a separate confirmation, CalorieApp stores only the off-chain relation.

An existing transaction cannot receive a memo retroactively. It therefore must
not be linked merely because somebody knows its public hash.

## Comparable CalorieDB hashes

A raw SHA-256 digest of a predictable record is not an adequate privacy barrier.
The database should use two separate mechanisms:

- Private record fingerprint: HMAC-SHA-256 over a versioned canonical
  representation, with domain separation and a rotatable server-side key.
- Optional public commitment: SHA-256 over a domain separator,
  canonicalization version, private record digest and a new 256-bit random salt.
  The salt remains encrypted off-chain and is never included in the memo.

The fingerprint supports internal equality/version checks. A one-time commitment
can later prove integrity without publishing the private record and without
creating a reusable public user identifier.

## Unlinking and erasure

The private database association, fingerprint and retained salt can be deleted
according to the approved erasure process. The XRPL transaction and its memo
cannot be deleted. Before signing, the user must see a clear warning that the
memo is public and irreversible. After unlinking, its random challenge must not
resolve to anything and becomes an orphaned opaque value.

## Compliance gates

This architecture can reduce risk but cannot guarantee compliance in every
country. Before enabling it, the project requires:

- a documented necessity assessment and DPIA where required;
- an explicit purpose, lawful basis, retention rule and user-facing notice;
- jurisdiction-specific feature gates and an independent legal review;
- a functional assessment of whether later features constitute custody,
  transfer, execution, order routing, exchange, advice or another regulated
  crypto-asset service;
- continued separation from market, exchange and transaction-execution UI.

MiCA is not the only boundary. FATF guidance applies a functional test to
virtual-asset services, while privacy law may treat transaction hashes and
wallet addresses as personal data when they can identify or single out a person.

Primary references:

- [XRPL transactions and validated transaction hashes](https://xrpl.org/docs/concepts/transactions)
- [XRPL transaction common fields and memos](https://xrpl.org/docs/references/protocol/transactions/common-fields)
- [EDPB Guidelines 02/2025, version 2.0, on blockchain and personal data](https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_202502_blockchain_v2_en.pdf)
- [ESMA overview of MiCA](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)
- [FATF risk-based guidance for virtual assets and VASPs](https://www.fatf-gafi.org/content/dam/fatf/documents/recommendations/Updated-Guidance-VA-VASP.pdf)
