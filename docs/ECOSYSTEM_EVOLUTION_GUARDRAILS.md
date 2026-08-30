# Ecosystem evolution guardrails

Status: V2 direction contract.

## Direction without owning every branch

CalorieApp begins from the project's current product, privacy and provenance
thinking, but an ecosystem must be able to develop beyond one team. Protection
therefore applies to official state, trust and interoperability—not to every
independent idea.

Anyone may build an independent adapter, dataset, client, analysis, compatible
extension or lawful fork under its own namespace and non-official branding,
subject to applicable licences and law. That work does not require official
service credentials or prior adoption. Refusing official federation does not
delete or technically prohibit the independent work.

## Stable constitutional direction

Official compatibility keeps a small set of invariants: voluntary participation
and purpose-specific consent; privacy and minimization; provenance; no silent
overwrite; source-specific licence and attribution; separation of Identity
Bridge and private history; the non-custodial/non-financial V2 boundary; no
automatic fee-bearing transaction; portable interfaces and preserved correction
history.

These invariants prevent an extension from turning convenience into hidden
identity profiling, replacing one source's facts without a trail, or converting
a read-only ecosystem link into financial execution.

## Official adoption

An independent project becomes an official pilot or supported integration only
through a versioned proposal containing user value and scope, threat/privacy and
abuse analysis, licence/code provenance, migration and correction plan,
conformance tests, compatibility plan and a recorded review window. Explicit
operator approval is required for the official release and cannot waive release,
privacy or security gates.

Conformance means that an implementation follows the interface; it does not make
the implementation an official product or grant brand authority. Official
service credentials remain scoped and revocable, while independent development
rights under applicable licences remain separate.

## Safe evolution of records

Contributions append a namespaced assertion. Corrections link to what they
supersede. Provenance is not destructively rewritten. An immutable external
event can be unlinked locally when lawful and necessary, but the official system
must not pretend it deleted the remote event.

Promotion, deprecation and revocation require evidence and an audit event. An
emergency disable is allowed to protect users or availability, followed by a
review and a false-positive/dispute path.

V2 operator control remains in place for official releases. Token ownership does
not create automatic governance or mutation rights, and no governance process
may vote away consent, privacy or user data rights. A later shared-governance
model requires its own versioned design.

## Future DAO candidate

V2 may prepare part of the project's existing DAO-votingtool, but only as an
optional, non-blocking workstream. That scope is limited to inventorying its
source, version, licence and deployment; reviewing provenance, security,
localization and accessibility; and, if useful, showing an isolated non-binding
preview with synthetic or explicitly designated test data. That preview is not
a holder vote and has no production, governance, database, Identity Bridge,
treasury or XRPL authority.

Full DAO implementation and real voting are reserved for V3. V3 does not
activate either automatically: after V2 is complete and the ecosystem is
operationally mature, the first eligible governance form remains advisory,
using versioned proposals and non-binding signalling while ordinary tested
human release review continues to control official software and services.

The intended governance interface is the project's own DAO-votingtool, with the
long-term goal that Calorie-holders can vote on the ecosystem's direction and
that management can become distributed. Its repository location,
deployed platform or contract address, version, voting model, licence provenance
and audit status are not present in the current CalorieApp repository or
available project record. Those facts must be inventoried; this document does
not invent replacements or silently choose a second voting system.

This remains deliberately unworked. Holder eligibility, balance snapshots,
delegation and vote weighting are undecided; “Calorie-holder” does not yet say
whether voting becomes one-holder-one-vote, token-weighted, capped, quadratic or
hybrid.

The design must compare governance models rather than assuming one-token-one-
vote. It needs explicit protection against concentration, Sybil identities,
vote buying and conflicts of interest, plus privacy-preserving participation,
quorum, delegation, appeals, timelocks, a time-bounded emergency pause and
transparent post-incident review. Smart contracts and governance mechanisms
require independent audit and a testnet or simulation pilot.

A DAO cannot directly mutate the production database, administer Identity
Bridge sessions, expose or repurpose personal data, override consent or prevent
required security and legal response. Treasury or XRPL execution remains off by
default and needs a separate financial, tax, security and jurisdiction review.
Every later increase in DAO authority requires another versioned scope decision.

The V2 inventory and isolated synthetic-data preview may precede a governance
handover because they grant no authority. Real governance can start only in V3
and then grows in stages: read-only proposal/vote observation; non-binding
signalling; allowlisted ecosystem-registry or parameter decisions; and only
then a separately approved broader distributed-management phase. No real
governance stage is skipped.

For binding decisions, the votingtool produces a verifiable decision artifact.
A separate governance executor validates the proposal, vote, eligibility model,
quorum, deadline and finality, rejects replay, waits through a timelock and emits
an audit record. It accepts only versioned allowlisted action types—never
arbitrary code or SQL—and holds neither Identity Bridge nor general database
credentials. Every binding action needs a dry run and a bounded rollback or
append-only correction path.

Besides the bounded tool preparation above, V2 stays architecture-aware:
stable versioned entity identifiers, namespaces, capability boundaries and
formats that can later reference an append-only proposal, decision or
superseding decision. V2 adds no production DAO-specific tables, API endpoints,
smart contracts, balance snapshots, wallet profiling, live holder voting or
governance executor.

## Developer completion before DAO activation

The current developer and designated development team first design, implement
and test the ecosystem foundation to an explicitly completed point. Activation
requires both objective completion evidence and a recorded completion
declaration by the current operator. A DAO vote or follow-on DAO implementation
cannot run before that gate.

Completion is followed by a separately approved, versioned governance-scope
handover manifest. It identifies the exact source version, evidence, included
ecosystem namespaces/capabilities/parameters, exclusions, votingtool version and
audit, vote model, executor/finality rules, timelock and emergency/appeal rules.
An empty or ambiguous manifest grants no DAO authority.

There is no implicit or retroactive handover. The DAO cannot expand its own
authority by vote alone. Official product state, Identity Bridge, private data,
brand and developer component rights remain excluded unless a future manifest
explicitly and lawfully changes a specific boundary through the same approval
process.

## Permanent human governance

Distributed governance is not fully autonomous governance. People permanently
retain responsibility for purpose and values, authority scope, high-impact
production releases and mutations, privacy/licence/legal/developer-rights
accountability, security incidents, emergency pause and recovery, and dispute or
false-positive appeals.

The DAO, executor and automation cannot modify their own code, authority scope,
policy or approval rules without the normal reviewed human process. They cannot
vote away the human safety/accountability layer. Irreversible or high-impact
privacy, financial, publication or production action always needs fresh human
approval. Emergency pause remains human-managed, time-bounded, audited and
followed by review; it cannot be used to bypass law, consent, privacy, security
or recorded developer rights.
