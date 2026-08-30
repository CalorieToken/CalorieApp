# Public architecture

CalorieApp V1 consists of a browser frontend, an API backend, an external identity bridge and a food-data integration. Private food logs are scoped to the authenticated CalorieApp user.

SQLite is a local-development and test facility. Public user onboarding remains
blocked until a provider-neutral PostgreSQL deployment and its migration,
persistence, export, erasure and recovery gates have been verified.

The released implementation is non-custodial and non-financial. Proposed ecosystem, provenance, distributed-storage or token-related research is not represented as implemented functionality.

Detailed operational topology, private configuration and unreleased architecture remain outside the public repository.
