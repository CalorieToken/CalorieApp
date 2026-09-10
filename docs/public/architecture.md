# Public architecture

The CalorieApp V2 proven baseline consists of a browser frontend, an API
backend, an external Identity Bridge and a food-data integration. It was
deployed on Render and manually tested during development. Private food logs
are scoped to the authenticated CalorieApp user.

V2 remains the active development version. Its completion keeps the proven
experience while adding durable provider-neutral data, formal migrations, a
multi-source food-data foundation, the complete Identity Bridge, eleven-language
support and historically faithful website integration.

V3 is reserved for a later complete Web3 generation. Its architecture and
database choices are deliberately not selected during V2.

SQLite is a local-development and test facility. Public user onboarding remains
blocked until a provider-neutral PostgreSQL deployment and its migration,
persistence, export, erasure and recovery gates have been verified.

The released implementation is non-custodial and non-financial. Proposed ecosystem, provenance, distributed-storage or token-related research is not represented as implemented functionality.

Detailed operational topology, private configuration and unreleased architecture remain outside the public repository.

## September 2026 interfaces

The food frontend includes a small bundled USDA reference selection alongside the Open Food Facts search adapter. Its display-language contract is shared with the WordPress host while authenticated identity remains separate. The website's external market links, consent-controlled SWFT embed, Testnet guide and local help catalogue are outside the food application's financial boundary. See the [current implementation and acceptance record](website-update-2026-09.md).
