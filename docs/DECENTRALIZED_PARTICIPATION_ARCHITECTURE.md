# Calorie Participation Network — staged decentralization architecture

Status: architecture baseline plus local synthetic storage simulator; disabled by default
Branch: `feat/showcase-open-world-masterplan`

## Goal

Allow CalorieDB / Calorie ecosystem public data and bounded computation to become progressively more participant-operated as real voluntary participation grows, without putting private food logs, identity data, secrets or deletion-sensitive records onto an immutable public network.

The official CalorieToken website and CalorieApp remain the project-operated product layer. The participation network is an open interoperability/data-compute layer that third parties may implement against published contracts without becoming the official CalorieToken product or receiving brand control.

## What stays centralized/private

The following remain in the protected application data plane unless a user explicitly exports them to a user-controlled encrypted destination:

- CalorieApp identity/session records;
- private food logs and personal nutrition history;
- age-band/account safety state;
- account recovery/security material;
- provider credentials, OAuth tokens and API keys;
- moderation evidence containing private data;
- legal/consent records that require controlled correction or erasure;
- unpublished NFT drafts and private creator files.

PostgreSQL remains the primary store for these classes. Decentralization must never weaken export, correction, erasure, consent withdrawal or purpose limitation.

## What can decentralize first

The best early candidates are public, content-addressable or reproducible data:

- reviewed public food-source records and assertions that their source licence permits redistribution;
- public product/provenance graph events and hashes;
- public NFT/game media CIDs and metadata;
- open ecosystem contracts and schemas;
- public translation/content packs;
- public indexes derived deterministically from open source data;
- non-sensitive world/event content;
- signed catalog snapshots and mirrors.

The network distributes copies/evidence, not authority over private users.

## Voluntary participant node

A participant can opt into one or more bounded roles:

### Storage helper
Stores encrypted or public chunks that the protocol explicitly marks as eligible.

For public content the node stores content-addressed blobs/CIDs. For any future encrypted user-controlled backup, the node receives only ciphertext and cannot decrypt it.

### Verification helper
Recomputes content hashes, validates schemas, checks deterministic transformations, verifies that an IPFS/CID object is retrievable, or confirms source/export integrity.

### Compute helper
Runs small deterministic jobs such as:
- image thumbnail/transcode jobs on public media;
- public catalog normalization;
- public search-index shard building;
- duplicate-candidate detection;
- recipe/menu metadata validation;
- provenance graph integrity checks;
- translation-pack validation;
- game-world content compilation.

No participant receives raw private food history or session credentials for these jobs.

### Mirror/index helper
Hosts a read-only mirror or derived index for public catalog/provenance content.

## Resource consent

Participation is always opt-in and reversible.

A contributor must explicitly choose:
- storage limit;
- monthly bandwidth limit;
- CPU limit / allowed idle periods;
- whether battery-powered devices may participate;
- Wi-Fi-only option;
- which task classes are allowed;
- whether the node starts automatically.

A node has a one-click pause/stop control and clear usage counters. CalorieToken must never silently convert an ordinary CalorieApp browser session into a compute/storage node.

## CALT rewards

Adult Testnet participants may optionally earn bounded CALT credits for verified useful work.

Examples:
- storing an eligible public shard through a challenge window;
- returning a valid storage proof;
- completing a deterministic compute job whose result matches independent verification;
- serving a verified mirror/index response;
- contributing valid reviewed catalog/provenance data.

Reward rules:
- CALT remains Testnet-only and non-redeemable;
- rewards are capped per identity/time window/task class;
- duplicate/circular/self-submitted work does not multiply credit;
- no reward is issued solely for keeping a browser tab open;
- sensitive/private data volume never increases reward;
- participant results require deterministic verification, redundant comparison or server-side recomputation before reward;
- children receive non-financial badges/world progress; teens use simulation/non-value participation; adult Testnet mode may use CALT.

## Trust model

Participant nodes are untrusted by default.

- every task has a versioned task type and bounded input manifest;
- inputs are content-addressed where possible;
- jobs run in a restricted sandbox, preferably WASM or a similarly bounded runtime for future participant execution;
- nodes never receive project secrets;
- results include output digests and task/version identifiers;
- acceptance can require N-of-M matching results, deterministic server verification or both;
- malformed, non-deterministic or abusive nodes are ignored/revoked without corrupting the canonical state;
- reward eligibility is separated from data correctness: a ledger/payment event never makes a result true.

## Scale without losing the original product character

Participation capacity may grow from zero volunteers to a large community
network, but infrastructure scale must not dictate a different user experience.
The hosted-core path, original CalorieApp/Gameverse visual identity and
zero-contribution mode remain stable compatibility targets.

Protocol evolution should therefore be backward-compatible and versioned:

- new node/task capabilities are additive and negotiated by capability/version;
- older supported clients are not forced to enable newly introduced contribution
  classes;
- no phase promotion removes ordinary product access or the original
  zero-participation path;
- UI and world evolution keep the original Calorie ecosystem's recognizable
  character even when the backend becomes more distributed;
- Gameverse identity/progress and the player's starter-character identity are
  application state, not properties of a specific node provider or network phase;
- infrastructure migrations must not reset a player's starter character, nickname,
  progress, unlocked routes or ordinary app access.

This makes "small now, much larger later" a capacity property rather than a
product-identity rewrite.

## Progressive PostgreSQL -> decentralized public-data path

This is a gradual **data-plane migration**, not a one-day database replacement.

### Phase 0 — PostgreSQL primary
Current state. PostgreSQL is canonical for app/private data and public catalog/provenance state.

### Phase 1 — participant replicas
Selected public/licence-compatible catalog and provenance snapshots are exported as signed, content-addressed shards. Participant nodes can mirror them. PostgreSQL remains canonical.

Promotion condition: enough stable volunteers to maintain multiple independent copies for a sustained period, plus successful restore/reconstruction drills.

### Phase 2 — participant verification + compute
Deterministic public-data jobs can be dispatched to volunteers. PostgreSQL records task manifests/results and remains authoritative.

Promotion condition: verified result quality, abuse controls and enough independent participants so a single operator failure does not stop the public task class.

### Phase 3 — federated public catalog mirrors
Read traffic for public catalog/provenance may resolve from participant mirrors through signed manifests and integrity checks. PostgreSQL becomes one origin/index among several for those public classes.

Private/user data remains PostgreSQL.

### Phase 4 — distributed public source-of-record
For carefully selected append-only public datasets, canonicality can move from "row exists in CalorieToken PostgreSQL" to "versioned signed content object exists and passes protocol consensus/validation rules". PostgreSQL becomes a cache/index/materialized view for those datasets.

This phase requires multiple independently operated nodes, reproducible rebuilds from network content, conflict-resolution rules, governance and a documented exit/recovery process.

### Phase 5 — mature participation network
If participant count, reliability and governance are sufficient, most public ecosystem data and deterministic public computation can operate through the distributed network. The official CalorieToken services remain one compatible implementation and official brand/product surface.

Private mutable account data can still remain in PostgreSQL or move only to explicit user-controlled encrypted storage; it is not forced onto the public decentralized layer.

## Promotion metrics

Do not promote phases merely because a raw participant count is high.

Evaluate:
- number of independent operators;
- geographic/provider diversity without using personal-location profiling;
- percentage of required public shards with >=3 healthy independent copies;
- 30/90-day node reliability;
- successful reconstruction from participant-held public data;
- verification disagreement/error rate;
- average task turnaround;
- abuse/Sybil concentration;
- monthly operator cost compared with current PostgreSQL/Render cost;
- ability to pause the network without losing private-user rights.

No automatic paid infrastructure upgrade or phase promotion.

## WordPress / official product boundary

`calorietoken.net` remains the official CalorieToken product/brand portal and may act as:
- bootstrap directory for public participation contracts;
- node/download onboarding;
- network health/status UI;
- documentation and governance notices;
- official game/CalorieApp launch surface;
- registry of official contract versions and signed release manifests.

The participation protocol itself must not depend on WordPress being online. Third parties can build their own compatible clients, nodes, visualizers, F&B applications or games from the open protocol contracts. They do not become official CalorieToken products and may not imply official endorsement or use protected branding without permission.

## BigchainDB boundary

This architecture does **not** select BigchainDB.

The existing assessment rejected BigchainDB as the primary/provenance database because its current operational/maintenance model adds MongoDB + Tendermint nodes, duplicates XRPL's trust layer and complicates privacy/erasure.

A future V3 may reassess technologies if their maintenance, cost, governance and privacy characteristics improve, but the participation-network protocol should stay provider-neutral so its data/content model survives technology replacement.

## First build slice

The local storage/challenge/off-chain accounting slice is now implemented in
`tools/participation_simulator.py`. Its run instructions, tested boundaries and
next step are in `docs/PARTICIPATION_SIMULATOR.md`. This does not activate the
participation network or change the PostgreSQL source of record. Deterministic
compute, real volunteer onboarding and XRPL settlement remain future steps.

1. Publish a versioned participation contract.
2. Add a disabled `participant_node` feature flag.
3. Define public-data shard manifests and content digests.
4. Build a local/synthetic "volunteer node" simulator that stores one public shard and returns a proof.
5. Build one deterministic public compute task (e.g. catalog snapshot checksum/validation).
6. Verify results centrally; issue **simulated/off-chain CALT accounting only** at first.
7. After tests, connect adult XRPL Testnet CALT reward settlement behind a separate disabled flag.
8. Only then invite real volunteers into an opt-in pilot.
