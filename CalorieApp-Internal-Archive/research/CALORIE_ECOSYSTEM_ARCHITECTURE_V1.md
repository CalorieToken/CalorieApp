# CALORIE ECOSYSTEM ARCHITECTURE V1

Status: Research-only architecture document. No runtime implementation changes.

## Evidence & Scope Labels

This document uses explicit evidence labels throughout:

- REPO-EVIDENCE: verified from the current repository.
- EXTERNAL-EVIDENCE: verified from official or authoritative external documentation.
- INDUSTRY-STANDARD: established standards or accepted industry terminology.
- INFERENCE: reasoned design conclusion from the evidence.
- UNKNOWN: unresolved or not yet validated.
- LEGAL-REVIEW REQUIRED: legal or regulatory interpretation not resolved.

Scope guard:
- This document is architectural research only.
- No implementation, deployment, database changes, runtime code changes, or infrastructure creation are included.
- The current codebase remains V1-only and does not implement blockchain, wallet custody, IPFS, Helia, XRPL runtime logic, NFT minting, $CAL economics, or validator infrastructure.

---

## 1. Existing CalorieApp (As Implemented Today)

### 1.1 Current Product Reality

CalorieApp today is a centralized web application focused on food and nutrition tracking.

- REPO-EVIDENCE: README.md identifies the project as a strict-scope, non-financial, non-custodial food and nutrition tracking system.
- REPO-EVIDENCE: README.md states the monorepo includes a Next.js frontend and a FastAPI backend.
- REPO-EVIDENCE: README.md lists the MVP scope as food search via frontend -> backend -> Open Food Facts, nutrition display, food logging, and SQLite persistence.
- REPO-EVIDENCE: backend/README.md confirms the backend is the V1 data layer only and is limited to food and nutrition API endpoints.

### 1.2 Current Technical Components

- Web application: Next.js + TypeScript + Tailwind UI layer.
- Backend: FastAPI API/data layer.
- Persistence: SQLite via SQLModel.
- Authentication: centralized session-based login and identity handling.
- Identity Bridge: WordPress + XUMM/Xaman bridge pattern in the backend auth flow.
- Food search: Open Food Facts query integration through backend service layer.
- Food logging: authenticated food logs persisted to SQLite tables, including food_log and user/identity tables.
- Current deployment assumptions: local backend on 127.0.0.1:8000, frontend on localhost:3000, no production deployment automation in this repository.

- REPO-EVIDENCE: backend/app/main.py defines the FastAPI app, identity routes, and authenticated food log endpoints.
- REPO-EVIDENCE: backend/app/models.py defines food_log, calorieappuser, externalidentity, authorizationcode, and pendingloginstate.
- REPO-EVIDENCE: backend/app/database.py configures SQLite initialization.
- REPO-EVIDENCE: README.md and backend/README.md explicitly forbid blockchain, wallet, token, or financial logic in V1.

### 1.3 What Exists Today

Current implemented behaviors are clearly limited to:

- user login session and identity bridge exchange
- food query against Open Food Facts
- user-specific food logging
- reading and deleting personal food logs
- local persistence in SQLite

What does not exist as implemented runtime:

- no decentralized database runtime
- no IPFS implementation
- no Helia implementation
- no CalorieDB runtime
- no XRPL wallet logic or ledger integration in the app
- no $CAL functionality
- no NFT minting or transfer logic
- no validator software
- no reward system
- no F&B traceability runtime

- REPO-EVIDENCE: current repository references to XRPL, IPFS, and BigchainDB are research-only or future-phase references, not active runtime code.
- INFERENCE: the codebase is a centralized consumer app with a future architecture layer on top, not a decentralized ecosystem implementation.

---

## 2. Master Product Family

The Calorie ecosystem should be understood as a broader product family, not just one consumer app.

### 2.1 Core Product Family

- CalorieApp Web
  - Current web consumer experience.
  - A browser app for food logging, nutrition tracking, and personal dashboards.

- CalorieApp Android
  - Native mobile app for consumers.
  - Focused on personal food logging, record capture, local privacy, offline patterns.

- CalorieApp iOS
  - Native iOS consumer experience with secure local storage and app-store constraints-aware architecture.

- CalorieApp Windows
  - Desktop consumer experience and optional lightweight operator role.

- CalorieApp macOS
  - Desktop/advanced-user environment and optional community/runtime operator host.

- CalorieApp Linux
  - Infrastructure-oriented role: operator, relay, testing, research, and eventual advanced services.

### 2.2 Role Segregation

#### Normal User
- consumer experience
- personal food tracking
- nutrition logging
- local/offline records
- minimal operational burden

#### Optional Community Participant: Calorie Node
- opt-in community role
- data replication, relay, pinning, or availability support
- not a default consumer requirement
- explicit operational transparency

#### Advanced Operator: CalorieDB / Infrastructure Operator
- manages metadata, service APIs, retention, indexing, governance
- operates decentralized-aware services while keeping consumer UX simple

#### Future: XRPL Validator Operator
- separate advanced infrastructure role
- not a consumer app feature
- requires dedicated ops discipline, hardware, uptime, monitoring, and security

- INFERENCE: role separation is essential to keep CalorieApp simple and avoid forcing operator burdens onto the end-user experience.

---

## 3. Three-Layer Data Architecture

This is the master logical architecture. The ecosystem separates personal data from public verifiability and economic rails.

### Layer A — User / Device

Purpose:
- private data
- local application state
- encryption keys
- temporary offline queues
- user preferences
- personal nutrition history
- records not yet published externally

Contents:
- app-local sessions
- encrypted payloads pending sync
- device-level keys and recovery metadata
- local caches and drafts
- user-owned records before publication

Why it exists:
- minimizes exposure of sensitive health-adjacent data
- supports offline-first behavior
- keeps the app usable without constant network connectivity

Required design characteristics:
- client-side encryption by default
- secure local storage on each platform
- user recovery path and explicit key-management decision
- no assumption that all user data is public

### Layer B — CalorieDB / Decentralized Data

Purpose:
- public and semi-public data
- encrypted content objects
- metadata references
- provenance records
- relationships across entities and events
- IPFS/Helia content references
- search/index layer for discoverability

Contents:
- records, batches, lots, product references
- provenance graph edges
- content hashes and CIDs
- encrypted payload containers
- public summary metadata
- certificate references
- organization and product relationships

What belongs here:
- content-addressed objects
- encrypted artifacts that are not meant to live directly in a public ledger
- metadata that supports search, retrieval, and audit while minimizing plaintext data exposure
- provenance evidence that can be linked to real-world events without forcing all evidence onto XRPL

### Layer C — XRPL

Purpose:
- public ledger layer
- transaction hash references
- token and asset accounting where appropriate
- NFT minting, transfer, and ownership references
- selected provenance anchors
- verifiable transaction integrity and cross-reference anchors

Contents:
- $CAL references and ledger metadata
- transaction hashes pointing to CalorieDB records
- NFT identifiers and ownership state
- proof references for selected events
- public verification anchors for tamper evidence

What does not belong there by default:
- raw personal health data
- raw biological samples
- sensitive laboratory details
- full food logs in plaintext
- full chain-of-custody payloads

- INFERENCE: XRPL is a public verification layer, not the entire Calorie data model.

---

## 4. Centralization Boundary

The architecture should not assume decentralization is always better. Every centralized component should have an explicit reason.

### 4.1 Why a Component Is Centralized

#### Identity
Why centralized:
- login/session continuity and user account management are operationally simpler in a controlled backend.
- the current app already uses a WordPress bridge and cookie-authenticated session pattern.

Could it become decentralized:
- eventually, identity may become self-sovereign or loosely coupled to external verifiable identities, but not necessarily a full blockchain login model.

Minimum centralized functionality:
- user session issuance and validation
- account metadata needed for app UX
- abuse detection and login state management

#### Authentication
Why centralized:
- app session validity, logout, and user association need a trusted authority.

Could it become decentralized:
- partially, via external identity providers, key-based authentication, or delegated verification models.

Minimum centralized functionality:
- identity mapping and auth state
- secure session issuance
- recovery and reauthentication flows

#### Metadata Indexing
Why centralized:
- search, filtering, and user-visible lookups are much easier with a predictable index.

Could it become decentralized:
- yes, in a future decentralized index or distributed query layer, but not required for V1.

Minimum centralized functionality:
- searchable product metadata
- provenance pointers
- user referencing
- abuse prevention and policy enforcement

#### Search
Why centralized:
- product discovery and UI search need an efficient API and indexing model.

Could it become decentralized:
- partly, through distributed search or content discovery, but a full decentralized public search system is not a baseline requirement.

Minimum centralized functionality:
- ingest/query layer
- ranking and safety moderation
- failed-request handling

#### APIs
Why centralized:
- API access, versioning, session control, rate limiting, observability, and compatibility are easier to manage centrally.

Could it become decentralized:
- some gateway functions can be decentralized or replaced by peer services, but not all API responsibilities.

Minimum centralized functionality:
- app-facing compatibility layer
- auth enforcement
- policy and abuse controls

#### Moderation & Abuse Prevention
Why centralized:
- moderation policy and enforcement are not naturally solved by trustless systems alone.
- peer networks still need enforcement boundaries.

Could it become decentralized:
- only partially, through reputation, attestation, or delegated moderation, but operational governance remains necessary.

Minimum centralized functionality:
- spam detection
- rate limiting
- content policy enforcement
- take-down and abuse response

#### Application Services
Why centralized:
- user experience, dashboards, notification delivery, and operational service functions often require a controlled backend.

Could it become decentralized:
- eventually, some services may be edge-native or distributed, but the minimal app service layer remains necessary.

Minimum centralized functionality:
- session management
- notification/routing
- data lifecycle coordination
- service uptime and maintenance

- INFERENCE: decentralization is a design tool, not a universal requirement. Centralization remains valid when it solves trust, governance, operations, or user experience problems.

---

## 5. CalorieDB

CalorieDB should be defined as a logical architecture and protocol layer, not automatically as a single database product or database vendor choice.

CalorieDB is the conceptual data fabric that connects user data, provenance, certification, metadata, and content references across the ecosystem.

### 5.1 Core Purpose

CalorieDB should represent:

- Food
- FoodLog
- Recipe
- Menu
- Product
- ProductionBatch
- Sample
- LaboratoryResult
- Certificate
- Shipment
- WholesaleEvent
- RetailEvent
- NFT
- XRPLTransactionReference
- ProvenanceEvent
- Organization
- Participant

### 5.2 Data Classification Inside CalorieDB

#### Private Data
- personal nutrition logs
- private health-adjacent preferences
- user-specific local records
- personal device keys or recovery metadata
- unshared sensitive records

#### Public Data
- public product identity
- organization identity references
- public provenance summaries
- public compliance assertions
- public metadata fingerprints

#### Encrypted Data
- private nutrition payloads
- sensitive lab or compliance documents
- encrypted evidence bundles
- confidential records shared only with selected participants

#### Metadata
- timestamps
- schema version
- ownership references
- citation pointers
- status flags
- content hashes and CIDs
- event types and object references

#### Provenance
- origin relationships
- shipments and transfers
- processing and packaging events
- sample-to-result associations
- product-to-batch-to-lot linkage

#### Indexes
- searchable product catalog references
- organization indexes
- lot and batch references
- certificate lookup
- graph indexing for provenance queries

### 5.3 CalorieDB as a Logical Layer

CalorieDB is not limited to one database technology. It may eventually span:

- relational metadata storage
- document stores for content metadata
- graph storage for provenance relationships
- IPFS or Helia-backed content-addressed objects
- XRPL ledger references for public integrity anchors

- INFERENCE: CalorieDB is best understood as a conceptual data architecture that may be implemented with different technologies over time.

---

## 6. F&B Provenance & Traceability

F&B provenance is a core new direction for the broader Calorie ecosystem beyond consumer food logging.

### 6.1 Conceptual Traceability Flow

A general provenance chain may look like this:

SOURCE
  ↓
SAMPLE
  ↓
LAB RESULT
  ↓
PRODUCTION BATCH
  ↓
PROCESSING
  ↓
PACKAGING
  ↓
DISTRIBUTION
  ↓
WHOLESALE
  ↓
RETAIL
  ↓
CONSUMER

This should be modeled as a provenance graph, not a flat record table alone.

### 6.2 Core Actors

- farm
- producer
- animal
- crop
- fish
- batch
- lot
- sample
- laboratory
- processing facility
- packaging plant
- shipper/distributor
- wholesaler
- retailer
- restaurant
- consumer

### 6.3 Provenance Graph Principles

- Every real-world object or product should be traceable to a source or batch.
- Identity and chain-of-custody matter as much as the product description itself.
- Provenance should support recall, certification, and anti-counterfeit use cases.
- Not every event requires an XRPL transaction; many events can be represented as signed or hashed records in CalorieDB, with only selected checkpoint events anchored to XRPL.

### 6.4 Traceability Objectives

- understand source and origin
- link batch to product and lot
- connect lab results to production and supply chain stages
- support recall and contamination isolation
- verify authenticity of packaged goods or restaurant ingredients
- reduce fraud in product identity and product passport concepts

- INFERENCE: the strongest long-term value is not simply recording food logs, but connecting a physical product to digital evidence and organizational accountability.

---

## 7. Biological / Laboratory Data

Laboratory and biological evidence is essential for traceability, but must be handled with strict privacy and trust boundaries.

### 7.1 Representative Research Areas

The architecture should be able to represent references to:

- DNA analysis
- genetic identification
- species identification
- fish DNA / barcoding
- animal samples
- agricultural samples
- microbiological testing
- pesticide and residue testing
- contamination testing
- nutritional laboratory analysis
- certificates and signed test reports

### 7.2 Correct Trust Boundary

The architecture must not place raw DNA, personal biological information, or sensitive laboratory data directly on XRPL.

Recommended flow:

physical sample
  ↓
laboratory
  ↓
digital report
  ↓
cryptographic hash
  ↓
secure or encrypted storage
  ↓
CalorieDB
  ↓
optional XRPL anchor

### 7.3 Why This Boundary Matters

- A blockchain cannot independently prove that a physical sample came from a specific animal or field.
- Physical truth must be established through trusted real-world processes: sample handling, accredited laboratory testing, chain-of-custody, signed records, and regulated organizations.
- XRPL can help protect the integrity of the resulting digital record by anchoring a hash, CID, or reference, but it cannot magically prove the biological reality behind that record.

### 7.4 CalorieDB Role for Lab Data

CalorieDB can preserve:
- content hash of the signed report
- report metadata and schema version
- reference to the sample and batch
- certificate identifiers
- organization identity and accreditation references
- assistance to recall and audit queries

The sensitive details remain protected and access-controlled.

---

## 8. Traceability Data Model

The architecture should borrow established supply-chain and provenance semantics rather than inventing a fully isolated proprietary model.

Conceptual data objects include:

- Entity
- Organization
- Product
- Batch
- Lot
- Sample
- Test
- Certificate
- Shipment
- Location
- ProcessingEvent
- TransferEvent
- RetailEvent
- ProvenanceEvent

### 8.1 Relationship Model

The key pattern is not a single record but a graph of linked objects:

- Organization owns/controls a product or facility
- Product is associated with one or more batches/lots
- Batch/lot is tied to processing and packaging events
- Sample may be attached to a test or lab result
- Test may result in a certificate or qualification
- Shipment and transfer events connect upstream and downstream actors
- ProvenanceEvent captures a time-ordered state transition with evidence attachments

### 8.2 Standards Alignment

The ecosystem should prefer existing standards and terminology where possible, including GS1 and EPCIS concepts around product identity, lot/batch, event semantics, and traceability. This reduces the chance of creating an isolated, incompatible data model.

- INDUSTRY-STANDARD: GS1 and EPCIS are established supply-chain traceability frameworks.
- INFERENCE: CalorieDB should be designed to map to, extend, or interoperate with such standards rather than reinvent a proprietary traceability system silently.

---

## 9. Industry Standards and Interoperability

CalorieDB should align with existing industry standards instead of creating a proprietary silo.

### 9.1 Relevant Standards and Sources

Authoritative domains include:

- GS1
- EPCIS (Event Data standard)
- lot/batch tracking standards and traceability terminology
- chain-of-custody for sample and evidence handling
- food safety and product recall practices
- product identification and GTIN/GLN-like concepts where relevant
- laboratory data and certificate references
- digital product passport and product lifecycle traceability concepts

### 9.2 Architectural Guidance

CalorieDB should:

- adopt common terminology where it strengthens interoperability
- map to standards for product and event semantics
- extend the model only where a food/nutrition specific view is required
- interoperate with emerging product-passport models rather than replace them

### 9.3 Practical Position

A Calorie ecosystem architecture should not claim to be a universal single standard. It should be a standards-conscious interoperability layer that can express:

- source identity
- batch/lot identity
- sample and lab evidence
- product state transitions
- provenance claims and certificate references
- public integrity anchors

- INDUSTRY-STANDARD: GS1 and EPCIS provide relevant terminology and event semantics for product traceability.
- INFERENCE: CalorieDB should not force an isolated custom vocabulary where standard names already exist.

---

## 10. XRPL as Public Ledger Layer

XRPL should be treated as a foundational public ledger component of the ecosystem, but not as the total database layer.

### 10.1 Supported XRPL Concepts

The architecture must explicitly support:

- $CAL
- XRPL transactions
- transaction hashes
- NFT minting
- NFT transfer and ownership tracking
- payments and references
- trustlines where relevant
- ledger references
- selected provenance anchors

### 10.2 Why XRPL Is Not The Whole Database

XRPL should not be used to store every record because:

- public ledger data is not appropriate for private nutrition data
- raw biological/lab records are not appropriate for public ledger storage
- full supply-chain event payloads are too large and too sensitive
- the ledger is optimized for transaction integrity, not document lifecycle management
- not all provenance events need on-ledger settlement or token semantics

### 10.3 Correct Use of XRPL

XRPL is most valuable for:

- public integrity anchors
- compact references to content hashes and metadata
- transaction correlation between digital records and ledger events
- ownership or transfer records where public verifiability is useful
- reputational and audit-related evidence validation

- INFERENCE: XRPL is a proof and coordination layer, not a replacement for domain-specific data architecture.

---

## 11. XRPL Transaction Correlation

Transaction correlation should be a first-class architectural concept.

### 11.1 Model

CalorieRecord
  ↓
XRPL reference
  ↓
transaction hash
  ↓
ledger/network information
  ↓
transaction interpretation

### 11.2 Conceptual Categories

The architecture should support conceptual relationships such as:

- PAYMENT
- NFT_MINT
- NFT_TRANSFER
- CAL_TRANSFER
- PROVENANCE_ANCHOR
- OWNERSHIP
- REWARD
- SUPPLY_CHAIN_EVENT

These are categories, not hard-coded implementation constraints.

### 11.3 How XRPL Connects to CalorieDB and CalorieApp

A transaction hash becomes a bridge between layers:

- CalorieApp or a native app creates a digital record or summary.
- CalorieDB stores the rich content and provenance metadata.
- A compact reference or hash is published to XRPL.
- The XRPL transaction provides a public, time-ordered, verifiable anchor.
- Downstream systems can query the ledger for the transaction and correlate it back to the CalorieDB record.

This creates a chain of trust:

- physical reality is captured by trusted actors
- digital evidence is stored in CalorieDB
- selected evidence is anchored to XRPL for integrity and time-stamping

- INFERENCE: the strongest value of transaction correlation is not the token itself but the public integrity link.

---

## 12. $CAL

$CAL on XRPL is a core ecosystem component, but it should be treated as part of the public ledger layer, not as the entire product ambition.

### 12.1 What $CAL Represents in the Architecture

- a public ecosystem asset on XRPL
- a potential coordination or utility surface for public ecosystem participation
- a ledger-level mechanism for transaction references and ecosystem interactions
- a possible future public asset signaling context for ecosystem activity

### 12.2 What It Should Not Be Treated As

- not a required part of the baseline consumer nutrition workflow
- not a primary financial product for this document
- not a mechanism for forced user custody
- not an exchange or wallet product design requirement
- not a replacement for privacy-preserving personal data architecture

### 12.3 Non-Custodial Integration Patterns

Potential non-custodial interactions include:

- balance display in a user-controlled wallet context
- transaction lookup
- payment reference display
- Xaman signing interaction model
- NFT interaction patterns
- public transaction references to ecosystem records

### 12.4 Key Distinction

The architecture must distinguish:

- technical integration of public ledger references and tokenized ecosystem data
- regulated financial service handling and custody/exchange concerns

- LEGAL-REVIEW REQUIRED: the regulatory treatment of token utility, payment interactions, or transfer features may vary by jurisdiction.
- INFERENCE: $CAL is an ecosystem component to support, but not a reason to mix financial services into the consumer app by default.

---

## 13. NFTs

NFTs should be considered beyond recipes and menus. They are a public representation tool for selected digital assets, not a universal requirement for every physical product.

### 13.1 Potential NFT Representations

- recipes
- menus
- product identities
- production batches
- certificates
- provenance attestations
- supply-chain assets
- digital product identity objects
- membership or access utility tokens
- distribution or partnership-related assets

### 13.2 Where NFT Value Is Real

NFTs add value when the representation carries:

- clear verifiable ownership or transfer history
- public identity references
- product lifecycle or provenance anchoring
- rights, claims, or attestations that are better represented as digital certificates than as ordinary database rows

### 13.3 Where NFT Value Is Not Real

Not every physical product needs an NFT. Many records are better represented by:

- metadata linked to a batch
- CalorieDB provenance relationships
- certificate references
- encrypted records with privacy-aware controls

- INFERENCE: NFTs should be treated as an optional representation layer with specific and justified utility, not as a default for all F&B objects.

---

## 14. Supply Chain

The ecosystem should support traceability across many forms of food and beverage supply chains.

### 14.1 Examples

- cattle and animal sourcing
- fish and seafood provenance
- vegetables and crop sourcing
- fruit and orchard traceability
- grains and agricultural commodities
- processed food and ingredients
- packaged products and retail items
- restaurant ingredients and menus

### 14.2 End-to-End Flow

For each supply chain, the relevant progression is:

source
  ↓
production
  ↓
sample
  ↓
laboratory
  ↓
batch
  ↓
processing
  ↓
distribution
  ↓
wholesale
  ↓
retail
  ↓
consumer

### 14.3 Where CalorieDB Helps

CalorieDB can provide:

- context and relationship mapping
- product identity and lot linkage
- processing and transfer provenance
- authorizations/certificates
- recall and audit queries
- searchability across the supply chain

### 14.4 Where XRPL Helps

XRPL provides:

- transaction histories and anchor references
- public verification and integrity proofs
- NFT or ownership attestation where needed
- public evidence that a given digital record or document reference was preserved at a point in time

- INFERENCE: CalorieDB handles contextual and data-heavy traceability logic; XRPL provides public integrity and transaction-level verification.

---

## 15. Recalls & Food Safety

Provenance graphs can significantly strengthen recall and contamination response.

### 15.1 Use Cases

- recalls
- contamination detection
- batch isolation
- affected product identification
- affected shipment tracing
- downstream business analysis
- upstream source discovery

### 15.2 Benefits

- identify all downstream affected batches quickly
- execute more precise isolation than broad shelf-level recalls
- connect physical lots to distribution and retail flows
- support evidence-based action during food safety incidents

### 15.3 Important Limitation

Blockchain alone does not guarantee food safety. It can improve integrity and verification of digital records, but it cannot by itself ensure the real-world process was correct. Real safety depends on trusted practices, testing, chain-of-custody, accredited labs, deployment of quality assurance, and operational accountability.

- INFERENCE: provenance and traceability are operational safety tools, not magic guarantees.

---

## 16. Physical-to-Digital Trust

This boundary must be explicit.

### 16.1 Principle

Blockchain cannot prove physical reality by itself.

Example:
- XRPL cannot independently prove that a DNA sample actually came from a specific animal.
- XRPL cannot prove a field or farm record was truthful without trusted source data.

### 16.2 Trust Chain

Physical truth is created through:

- laboratory operations
- sample handling and chain-of-custody
- secure sample storage and documentation
- accredited organizations
- digital signatures and signed reports
- validated record creation
- provenance evidence assembled over time

### 16.3 What XRPL Contributes

XRPL can help protect the integrity of the resulting digital record by providing:

- cryptographic anchor of a hash or CID
- timestamped public evidence
- tamper-verifiable linking to a trusted digital artifact
- public ledger evidence of record existence and publication timing

This is valuable, but it is not a substitute for real-world trust.

---

## 17. IPFS / Helia

IPFS and Helia can fit as a content-addressed storage layer for non-sensitive or encrypted objects.

### 17.1 Appropriate Content

- reports
- certificates
- recipes
- menus
- public datasets
- encrypted objects
- product metadata

### 17.2 Critical Considerations

- persistence is not automatic
- pinning and retention strategy are required
- replication and availability depend on provider or network conditions
- deletion is limited or not guaranteed in public content-addressed systems
- plaintext sensitive data must not be placed on public IPFS without proper encryption and access controls

### 17.3 Practical Design Position

- public IPFS is suitable for public, non-sensitive content and content-addressed verification artifacts
- encrypted content can live on IPFS if the object itself is encrypted and correctly governed
- the key policy remains separate from the content-addressed storage service

- EXTERNAL-EVIDENCE: IPFS persistence requires explicit pinning and retention strategy; it does not guarantee permanent availability by itself.
- INFERENCE: IPFS is useful as a content layer, but not as a substitute for privacy design or retention policy.

---

## 18. Privacy / GDPR

Privacy and legal design are critical because the ecosystem touches personal nutrition, health-adjacent data, biological samples, laboratory data, and potentially business confidential information.

### 18.1 Data Categories

- personal data
- biological data
- sensitive data
- food logs
- health-adjacent nutrition information
- business confidential data
- laboratory data
- public provenance metadata
- immutable ledgers
- content-addressed storage

### 18.2 Design Principles

- minimize data collection and retention
- encrypt private data before publication
- limit public metadata to what is necessary
- separate public provenance from private operational data
- define access control and recovery policies
- respect data-subject rights and retention periods
- document who controls what data and why

### 18.3 Legal Questions That Require Review

- controller and processor responsibilities across app operator, infrastructure operator, and pinning provider
- data subject rights where content is content-addressed and replicated
- erasure strategy when files are immutable or replicated across providers
- handling biological and lab data under privacy law
- interoperability with sector-specific food safety and health data obligations

- LEGAL-REVIEW REQUIRED: legal interpretation will vary by jurisdiction and by data type.
- INFERENCE: privacy design should be default and legal review should be part of governance, not an afterthought.

---

## 19. Node Architecture

The architecture should define clear roles for node participation and keep participation explicit, opt-in, and user-controlled.

### 19.1 Node Types

#### Normal User
- standard app user
- no special node responsibilities
- no requirement to host network services

#### Lightweight Participant
- uses the app, optionally contributes local data or local cache sync
- participates without always-on infrastructure duty

#### Calorie Node
- optional community-operated node
- may provide replication, pinning, availability, or relay capabilities
- requires explicit user consent and clear operational disclosure

#### CalorieDB Node
- manages a decentralized data service or metadata layer
- may host index, archive, or replication functions
- requires operational discipline and governance

#### Infrastructure Operator
- operates metadata/index, retention, moderation support, or public-facing services
- central but accountable

#### Future Validator
- dedicated advanced infrastructure role
- highly specialized and separate from consumer software

### 19.2 Node Design Expectations

A node must explain:

- storage responsibilities
- bandwidth requirements
- CPU load
- battery impact on mobile devices
- data exposure profile
- uptime expectations

- INFERENCE: users should understand the operational cost and risk before opting into a node role.

---

## 20. Native Platforms

The ecosystem should be designed across multiple native platform families, each suited to different role patterns.

### 20.1 Web
- best for current consumer and product validation
- low friction and fast iteration
- good for browser-based data entry and nutrition flows

### 20.2 Android
- strong consumer app fit
- background restrictions and battery policy make always-on node behavior a poor default
- suitable for local app execution and encrypted record handling

### 20.3 iOS
- strong consumer app fit with secure local storage patterns
- not well suited for always-on operator behavior
- requires product-specific compliance and app review attention

### 20.4 Windows
- stronger for desktop consumption and optional operator roles
- can host non-mobile workloads more realistically than mobile devices

### 20.5 macOS
- suitable for desktop consumer experiences and light operator tooling
- good for development and advanced desktop operator workflows

### 20.6 Linux
- best match for infrastructure roles, server-side operators, and eventual advanced platform services
- natural environment for validator research and infrastructure work

- INFERENCE: native platform planning should be role-aware. Mobile is for consumers; Linux/desktop is more realistic for advanced operator roles.

---

## 21. Validator

Validator operation should remain a separate advanced role.

### 21.1 Validator Research Area

- XRPL validator requirements
- hardware requirements
- uptime and monitoring
- networking and security hardening
- operational responsibility
- incident response

### 21.2 Decision

A Calorie Validator should eventually be a distinct product or operator capability, not a feature embedded in the consumer app.

- INFERENCE: validator participation is not a consumer UX feature. It is a specialized infrastructure function with operational consequences.

---

## 22. Community Participation

Community participation is strongest when framed as a deliberate operator identity rather than a pseudo-crypto incentive layer.

### 22.1 Calorie Node Operator

Community identity may include:

- node operator status
- contribution statistics
- reputation indicators
- network status and uptime badges
- trusted operator recognition

### 22.2 Non-Financial Incentives

Potential non-financial incentives include:

- reputation
- badges
- contribution statistics
- recognition
- network-health visibility

### 22.3 Future Economic Incentives

Future $CAL-based rewards may be explored only after separate legal, technical, and governance review. They are not a default requirement and should remain explicitly future and legally unverified.

### 22.4 Risks in Community Incentives

- Sybil attacks
- fake nodes
- reward farming
- uptime manipulation
- storage manipulation
- bandwidth manipulation

- INFERENCE: if incentives are introduced, they must be carefully designed around identity, reputation, and anti-abuse controls.

---

## 23. Ethics

The ecosystem should be ethical by design, especially because it intersects with health, personal data, biological evidence, and supply-chain claims.

### 23.1 Core Ethical Dimensions

- informed consent
- opt-in node operation
- battery and power impact
- bandwidth and storage costs
- transparency in participation
- user control over shared data
- privacy and data minimization
- biological information protections
- supply-chain data accountability
- economic incentive design and fairness

### 23.2 Principle

No participant should be forced into network operation or economic participation. The ecosystem must remain understandable and respectful of user agency.

---

## 24. Security

The security model must account for both technical and organizational threats.

### 24.1 Threats

- malicious nodes
- compromised devices
- malicious peers
- Sybil attacks
- metadata leakage
- key theft
- replay attacks
- phishing
- supply-chain attacks
- malicious operators
- fraudulent laboratory records
- fraudulent provenance claims

### 24.2 Architectural Mitigations

- strict separation of private and public data
- encrypted private payloads before publication
- local key management with recovery policy
- signed or attested provenance records
- metadata minimization and selective disclosure
- ledger anchoring for integrity but not for privacy-sensitive data
- operational governance around identity and moderation
- independent validation of labs, certificates, and organizations where practical

- INFERENCE: security is not solved by a single blockchain. It is a layered model combining cryptographic, operational, and governance controls.

---

## 25. Centralized vs Decentralized Matrix

| Function | Centralized | Decentralized | Hybrid | Reason |
|---|---|---|---|---|
| identity | Yes | Optional | Preferred | login/session continuity and UX require trustable account handling |
| food search | Yes | Optional | Preferred | product discovery benefits from efficient indexing and query APIs |
| CalorieDB | Optional | Yes | Preferred | logical data layer may span metadata, graph, and content storage |
| IPFS | No | Yes | Preferred | content-addressed data layer works well for distributed objects |
| user data | Yes for private state | No by default | Preferred | private nutrition records should stay protected and user-controllable |
| provenance | Optional | Yes | Preferred | graph semantics can be distributed but governed centrally for search and access |
| XRPL | No | Yes | Preferred | public ledger gives integrity and public references |
| $CAL | No | Yes | Preferred | public asset layer for ecosystem interactions |
| NFTs | No | Yes | Preferred | public tokenized representations may be needed for selected assets |
| node operation | Optional | Yes | Preferred | community-operated nodes are opt-in and role-dependent |
| validator | No | Yes | Separate | specialized infrastructure role should not be mixed into consumer app |
| moderation | Yes | Optional | Preferred | policy enforcement and abuse response require governance |
| indexing | Yes | Optional | Preferred | discoverability benefits from efficient metadata indexing |
| authentication | Yes | Optional | Preferred | sessions, account mapping, and recovery need trusted services |

---

## 26. Master Architecture Diagram

```text
                    CALORIE ECOSYSTEM
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   [CURRENT]           [NEXT]           [FUTURE]
   Consumer Apps      Data Layer        XRPL Layer
   Web / Mobile /     CalorieDB        $CAL
   Desktop            IPFS / Helia      NFTs
   User auth +       Metadata +       Ledger refs
   food logs         provenance        hashes
        │                  │                  │
        └──────────────┬───┴──────────────┬────┘
                       │                  │
                [HYBRID]             [OPTIONAL]
                Public/private       Integrity anchors
                split + encrypted    selected provenance
                content + metadata   records
                       │
                PROVENANCE GRAPH
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Production     Distribution    Retail
        │              │              │
        └──────────────┼──────────────┘
                       │
                    Consumer
```

Legend:
- CURRENT = implemented and already present in the repo
- NEXT = near-term research and incremental architecture work
- FUTURE = longer-horizon ecosystem capabilities
- OPTIONAL = use only when justified by value and governance
- CENTRALIZED = operational service or app logic that remains trust-managed
- DECENTRALIZED = public, distributed, or content-addressed elements

---

## 27. Roadmap

### PHASE 0 — Current CalorieApp
- Keep current centralized app stable.
- Maintain V1 scope and constraints.

### PHASE 1 — Master Data / Provenance Protocol Research
- define object model and provenance graph semantics
- identify standards alignment and interoperability points

### PHASE 2 — Encrypted CalorieRecord POC
- prove encryption, storage, retrieval, and decryption flow
- no financial logic or validator dependency

### PHASE 3 — IPFS Integration POC
- demonstrate content-addressed storage of encrypted objects
- pinning/retrieval behavior research

### PHASE 4 — XRPL Transaction-Reference POC
- verify transaction hash correlation to a digital record
- use testnet or non-production ledger data only

### PHASE 5 — CalorieDB Provenance Prototype
- model batches, lots, producer relationships, and events
- research mapping to data and traceability semantics

### PHASE 6 — Native Application Prototype
- native consumer app shells or wrappers built on the same data model

### PHASE 7 — Desktop Calorie Node
- optional local node or relay concept for community use

### PHASE 8 — Community Node Network
- opt-in shared infrastructure with governance and anti-abuse controls

### PHASE 9 — F&B Traceability Pilot
- real pilot with specific supply-chain or chain-of-custody scenario

### PHASE 10 — Advanced Infrastructure
- retention, indexing, operator tooling, audit support

### PHASE 11 — Validator Research
- separate operator research track, not consumer feature

### PHASE 12 — Potential Economic Incentives
- legally reviewed and future-gated incentives work only after governance and compliance assessment

- INFERENCE: this sequence keeps the architecture modular and avoids forcing a complete ecosystem rewrite.

---

## 28. First POC

The recommended first prototype is the smallest proof that the architecture works as a coherent system without requiring a production-grade ecosystem.

### Recommended POC Flow

CalorieRecord
  ↓
encryption
  ↓
IPFS/CID
  ↓
CalorieDB reference
  ↓
XRPL transaction reference
  ↓
retrieval
  ↓
verification
  ↓
decryption

### POC Constraints

- use testnet or test data only
- no real financial value
- no production data
- no validator
- no rewards
- no production ledger or production identity dependence

### What This Proves

- the record can be created and encrypted client-side
- a content-addressed reference can be produced and retrieved
- CalorieDB metadata can store the reference without exposing sensitive payloads
- XRPL can provide a transaction hash anchor without requiring full public disclosure of private data
- the app can verify integrity by comparing hashes and CIDs
- a user can retrieve and decrypt data with the correct recovery path

### Why This Is the First POC

It establishes the core architecture principle:

- sensitive data stays private and encrypted
- public anchors remain minimal and verifiable
- the system is modular and can evolve without forcing immediate full-chain adoption

---

## 29. Business / F&B Use Cases

### Near-term
- consumer nutrition tracking
- personal food logging
- recipe recording and reference
- menu and meal planning patterns
- product identity lookup
- basic provenance metadata for selected products

### Medium-term
- food provenance and supply-chain transparency
- laboratory verification references
- anti-counterfeit product identity support
- distribution traceability
- wholesale and retail event tracking
- restaurant ingredient provenance
- food recalls and contamination investigation

### Long-term
- digital product passports
- quality certification references
- sustainability claims with evidence
- product authenticity workflows
- packaged goods supply-chain traceability
- cross-organization certification exchange

### Speculative
- NFT utility for selected certificate or asset representations
- broad public ecosystem reward or participation models
- highly automated cross-border traceability exchange
- economic incentives tied to proven network participation

- INFERENCE: the most valuable near-term work is not abstract tokenization; it is trustworthy provenance, evidence handling, and product-supply transparency.

---

## 30. Digital Product Passport / Interoperability

A future Calorie ecosystem could eventually support Digital Product Passport concepts and relevant EU/industry traceability initiatives.

### 30.1 Design Position

CalorieDB should be designed as an interoperability-friendly data layer rather than an isolated proprietary system.

This means:

- current object model should map to standards and common supply-chain concepts
- relevant public metadata should be machine-readable
- provenance events should be structured and queryable
- certificate and test references should be linkable across organizations

### 30.2 Compliance Caution

The architecture should not claim compliance with future product-passport or regulatory regimes without explicit legal review and product-specific assessment.

- INFERENCE: interoperability is a capability to design for, not a claim to meet legal obligations.

---

## 31. Authoritative Standards & Sources

The architecture should rely on authoritative sources wherever possible.

### 31.1 Core Standards & Sources

- XRPL official docs and protocol references
- IPFS official docs and protocol terminology
- Helia official project docs
- GS1 standards and product traceability resources
- EPCIS event-based traceability concepts
- food safety and recall guidance from public authorities
- digital product passport concepts and relevant EU/product-policy discussions
- GDPR and EU data protection materials
- App Store and Play policy documentation for app distribution and security constraints

### 31.2 Best Practice

Use official documentation, standards bodies, public regulator materials, and authoritative platform docs. Avoid treating blog posts or informal references as authoritative when formal sources exist.

- INDUSTRY-STANDARD: GS1/EPCIS, public regulator guidance, and official platform docs are the correct starting points for standards alignment.

---

## 32. Evidence Labeling

Every major conclusion in this document is labeled as one of the following:

- REPO-EVIDENCE
- EXTERNAL-EVIDENCE
- INDUSTRY-STANDARD
- INFERENCE
- UNKNOWN
- LEGAL-REVIEW REQUIRED

This is deliberate. The architecture is intended to be explicit about what is known, what is inferred, and what requires verification.

---

## 33. Master Decision Matrix

Evaluate the following options.

| Option | Technical Feasibility | Privacy | Security | Scalability | Cost | Business Value | F&B Value | Decentralization | Regulatory Complexity | Maintainability | Long-Term Potential |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A. Centralized CalorieApp | 5 | 3 | 3 | 4 | 4 | 3 | 2 | 1 | 2 | 5 | 2 |
| B. Hybrid CalorieApp + decentralized data | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 3 | 4 | 4 |
| C. Hybrid + community nodes | 3 | 4 | 4 | 4 | 2 | 4 | 5 | 5 | 4 | 3 | 5 |
| D. Hybrid + F&B provenance network | 3 | 4 | 4 | 4 | 3 | 5 | 5 | 4 | 5 | 3 | 5 |
| E. Full ecosystem: consumer apps + decentralized data + F&B traceability + XRPL + $CAL + NFTs + nodes + operators | 2 | 3 | 3 | 5 | 1 | 5 | 5 | 5 | 5 | 2 | 5 |

### Interpretation

- Option A is the easiest to deliver but limits long-term ecosystem potential.
- Option B is the strongest practical transition path.
- Option C adds community participation value but raises governance burden.
- Option D adds the greatest F&B value for traceability and recall use cases.
- Option E is the broadest long-term vision, but it is too broad for early implementation and would require substantial governance, compliance, and engineering maturity.

- INFERENCE: the best near-term strategy is not full ecosystem execution, but a disciplined hybrid path that adds traceability and verifiable digital integrity in stages.

---

## 34. Final Architectural Principles

1. $CAL on XRPL is a core ecosystem component, but not the first consumer feature.
2. XRPL is not the entire database.
3. Personal and private user data must not be placed directly on public ledgers.
4. CalorieDB provides contextual relationships, provenance, metadata, and content references.
5. IPFS provides content addressing and replication support, not automatic privacy.
6. Physical truth requires trusted real-world processes and organizations.
7. Blockchain can strengthen digital integrity, but cannot magically prove physical reality.
8. Node operation must be explicit, voluntary, and user-controlled.
9. Consumer applications must remain simple and valuable to ordinary users.
10. Validators must remain a separate advanced role.
11. Financial functionality must remain non-custodial unless future regulatory review explicitly supports a different structure.
12. Existing standards should be reused wherever possible.
13. Every centralized component should have an explicit reason.
14. Every decentralized component should have an explicit security and privacy justification.
15. The architecture must support future evolution without requiring a complete rewrite.

---

## 35. Final Recommendation

### What Calorie should build first

Build the hybrid, standards-aware architecture in stages:

1. keep current centralized CalorieApp stable and simple
2. define provenance and CalorieDB object model
3. prototype encrypted CalorieRecord flow
4. validate IPFS/CID storage and retrieval
5. add XRPL transaction-reference correlation as a lightweight proof layer
6. only then expand into larger F&B traceability pilots

### What Calorie should NOT build yet

- full ecosystem tokenization
- broad reward systems
- validator operations as a default consumer feature
- general NFT adoption across the entire supply chain
- wide deployment of community nodes without governance
- full public data publication of private or sensitive records

### What should remain centralized

- app identity and authentication layer
- session and user account validity
- search/indexing and user-facing query APIs
- moderation and abuse controls
- service orchestration and user-facing operation

### What should become decentralized

- encrypted data storage paths
- content-addressed object references
- provenance and certificate references
- selected public integrity anchors
- optional node/relay replication patterns

### Where XRPL should be used

- transaction hash references
- public proof anchors
- NFT ownership references where justified
- public verification of selected digital artifacts
- selected provenance or integrity checkpoints

### Where $CAL should be used

- as a public ecosystem component only after legal and technical review
- as a non-custodial ledger-level mechanism for ecosystem interactions if justified
- not as a default feature in the consumer app

### Where NFTs should be used

- selected product identity or certificate representations
- provenance attestations or supply-chain asset references
- membership-like utility features only when clearly justified
- not every food product should become an NFT

### What CalorieDB should represent

- food and nutrition records
- provenance graph and batch relationships
- product identities and lots
- lab results and certificates
- supply chain events and transfers
- public/private metadata boundaries
- content-addressed references and cryptographic digests

### What the first F&B traceability pilot should be

A narrow pilot around a specific supply chain with a clear problem statement, for example:

- farm-to-packaging traceability for a single product category
- laboratory verification tied to a production batch
- recall and contamination response testing for a limited supply chain segment

This should be limited, measurable, and not require a full consumer payment or validator network.

### What the first technical POC should prove

The first technical POC should prove:

- encrypted record generation
- content-addressed storage reference
- metadata index lookup without sensitive plaintext disclosure
- XRPL transaction reference correlation
- retrieval and verification flow
- decryption and recovery path

### When native apps should begin

Native apps should begin after the core data architecture proves viable and the platform model is clear. Mobile should follow the technical data model, not precede it.

### When community nodes should begin

Community nodes should begin only after a clear opt-in role definition, reputation or governance model, and data-containment policy are defined.

### When validator research should begin

Validator research should begin as a separate advanced infrastructure topic only after the ecosystem data and integrity architecture are stable.

### When economic incentives should be researched

Economic incentives should be researched only after non-financial core operations are proven and legal analysis is clear.

---

## Final Status

CALORIE ECOSYSTEM ARCHITECTURE RESEARCH COMPLETE

Files inspected:
- README.md
- backend/README.md
- DECENTRALIZED_ARCHITECTURE_V1.md
- NATIVE_PLATFORM_ARCHITECTURE_V1.md
- backend/app/main.py
- backend/app/models.py
- backend/app/database.py

External sources consulted:
- official XRPL documentation and protocol guidance
- official IPFS documentation and persistence guidance
- official Helia project documentation
- official Android, iOS, Windows, and browser/platform documentation relevant to native platform constraints
- GS1 and EPCIS-related traceability terminology and supply-chain standards
- public regulator and EU data protection materials relevant to privacy and compliance discussions

Standards consulted:
- GS1 product and traceability concepts
- EPCIS-style event semantics for traceability
- digital product passport and product lifecycle interoperability concepts
- GDPR and privacy principles
- public ledger and blockchain documentation relevant to XRPL
- platform guidance from Apple, Google, and general web/native development policies

Major findings:
- The repository is currently a centralized consumer food-tracking app, not a decentralized ecosystem implementation.
- The strongest long-term architecture is a hybrid model: centralized consumer UX, encrypted private data, CalorieDB metadata/provenance layer, and selective XRPL integrity anchors.
- F&B provenance and traceability are core strategic opportunities beyond simple food logging.
- The real value lies in connecting physical product reality to digital evidence and audit trails, not in moving all data to public blockchains.
- Community operator and validator roles must remain legally and operationally separate from the consumer app.

Major risks:
- key loss and recovery model failures
- metadata leakage and privacy breaches
- pinning and availability risk in decentralized storage
- fraud in laboratory or provenance claims
- regulatory uncertainty around tokenized or asset-related features
- over-complexity from forcing validator or token roles too early

Major unknowns:
- exact key-recovery UX that users can trust and sustain
- how to structure governance for community node participation
- legal treatment of decentralized storage and erasure under multiple jurisdictions
- app-store interpretation for optional provenance and verification features
- the true cost and operational burden of advanced infrastructure roles

Recommended first POC:
- encrypted CalorieRecord -> IPFS/CID -> CalorieDB metadata -> XRPL reference -> retrieval and verification flow using testnet/test data only

Recommended first F&B pilot:
- narrow provenance and recall pilot for one supply chain segment with a specific batch, lab result, and distribution chain, limited to controlled test data and non-production operations

Recommended development sequence:
1. stabilize current centralized app
2. define data/provenance model and standards mapping
3. prove encrypted record and content-address pattern
4. validate IPFS/CID and metadata flow
5. validate XRPL transaction-reference correlation
6. prototype CalorieDB provenance graph
7. design native platform and operator role separation
8. pilot traceability and recall use cases
9. research validators and optional economic incentives only after governance and legal review

STOP.
