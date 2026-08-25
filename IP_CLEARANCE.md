# Intellectual-property clearance boundary

Status: preliminary engineering risk register; not a legal opinion or freedom-
to-operate conclusion.

## What this repository claims

The repository may reserve rights in original code, documentation, and other
protectable expression created by or validly assigned to ICTHendrikse. It does
not claim ownership of underlying ideas such as calorie tracking, food search,
wallet-based authentication, identity bridges, blockchain provenance, IPFS,
BigchainDB, or combining those concepts.

Independent implementation of a similar idea can still create risk if it
copies protected expression, uses confusing branding, violates a contract or
trade secret, fails a software/data licence, or practices an enforceable patent
claim. Public availability is not permission to copy.

## Current review result

| Area | Current status | Required control |
| --- | --- | --- |
| Application source | No copied-code provenance issue identified by this repository-only review | Require contributor provenance and compatible written rights before merge |
| Dependencies | Common third-party packages; exact transitive distribution review incomplete | Generate an SBOM and carry required licence/NOTICE texts for each shipped build |
| Open Food Facts | ODbL/DbCL data and CC BY-SA product-image obligations apply | Preserve attribution; review share-alike before combining or bulk reuse |
| Names and logos | CalorieToken EU trade mark is separate from unresolved logo copyright | Follow `TRADEMARKS.md` and `ASSET_PROVENANCE.md`; avoid implied endorsement |
| Identity bridge | Useful architecture, but broad concept exclusivity is not claimed | Protect secrets; publish only reviewed expression; retain GPL component boundary |
| Patents | Crowded fields include food tracking, digital identity, blockchain provenance, and distributed storage | Obtain claim-by-claim, territory/status-specific freedom-to-operate review before material commercial expansion |

## Mandatory review triggers

A fresh human legal and technical review is required before adding payments,
token transfers or rewards, wallet custody/signing, commercial provenance or
certification claims, bulk third-party datasets, biometric/health profiling,
new logos or generated art, copied snippets, SDKs with restrictive terms,
mobile/store binaries, or a public claim that an idea is patented, exclusive,
official, certified, compliant, or first-of-its-kind.

Research notes, search results, and patent abstracts are triage only. Patent
infringement depends on the claims, applicable territory, legal status, dates,
and the implemented product—not similarity of a title or abstract.
