# CALORIEAPP PUBLIC ROADMAP

This roadmap is directional, not a guaranteed delivery schedule.

Labels used throughout:

- ACTIVE: implemented in the current repository
- PROPOSED: planned direction pending prioritization and design decisions
- RESEARCH: concept exploration and architecture investigation
- FUTURE: long-term direction that may evolve significantly

## Current Baseline

### ACTIVE

CalorieApp V1 web application currently delivers:

- Food search through backend integration with Open Food Facts
- Nutrition result display in the web experience
- Authenticated food logging and retrieval
- User-scoped food log management

Scope boundary:

- Non-financial and non-custodial application scope remains active

## Dimension 1: Product

### ACTIVE

- V1 web application for food and nutrition tracking
- Frontend/backend API workflow for search and log behavior
- Session-authenticated user food-log operations

### PROPOSED

- Richer food management workflows
- Expanded nutrition experience and data presentation
- Continued user experience and reliability improvements
- Exploration of business and food-ecosystem use cases in application UX

## Dimension 2: Infrastructure

### PROPOSED / RESEARCH / FUTURE

- CalorieDB architecture concepts
- Decentralized storage research, including IPFS and Helia
- Content-addressed record patterns and encrypted data architecture
- XRPL transaction-hash correlation concepts
- Ledger-reference integrity anchoring concepts
- Community infrastructure research including node and validator models

Critical boundary for infrastructure truth models:

- Application/database records represent application truth.
- Ledger references represent ledger truth.
- Physical-world events represent physical truth.

Future architecture must avoid conflating these truth layers.

## Dimension 3: Ecosystem

### PROPOSED / RESEARCH / FUTURE

- CAL ecosystem integration concepts
- NFT utility exploration
- Food and beverage provenance models
- Production, distribution, wholesale, and retail traceability concepts
- Recipe and menu traceability concepts
- Biological and laboratory traceability research
- Native application research for Android, iOS, Windows, macOS, and Linux
- Community infrastructure participation models
- Validator ecosystem research
- Treasury, incentive, and governance research

Boundary:

- None of the above ecosystem capabilities are represented as currently implemented runtime features in V1.

## XRPL and CAL Narrative Boundary

Future architecture research explores how XRPL transaction hashes and ledger references may serve as correlation or integrity layers for broader Calorie ecosystem records.

This narrative is broader than token payments and includes potential relationships across provenance, digital assets, and ecosystem data-linking models.

Current implementation boundary:

- No implied active XRPL financial runtime behavior in V1.
- No issuer-status or treasury-balance claims are treated as verified facts in this roadmap.

## Responsibility and Compliance Boundary

Any future implementation of token-related, decentralized-storage, governance, incentive, or expanded data-processing capabilities requires dedicated legal, regulatory, privacy, security, and platform-policy review before implementation or deployment.

This roadmap does not make legal guarantees.

## Summary

CalorieApp is a working V1 web application today, while the broader Calorie ecosystem remains an ambitious but clearly bounded PROPOSED/RESEARCH/FUTURE direction.
