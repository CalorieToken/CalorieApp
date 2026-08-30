# XRPL-linked provenance contract v1

This contract starts with a strict one-to-one pair between a validated XRPL
transaction reference and a unique CalorieDB anchor hash. All product, batch,
event and evidence relations are modelled below that pair.

The contract is architecture-only and disabled by default. It does not claim
that an XRPL payment proves a physical food event, and it does not enable
custody, signing, transfers, exchange or order routing.

It is intentionally small at the beginning. The first public users do not need
to see or use this feature. After the durable PostgreSQL and formal migration
gates pass, empty foundational tables can be added behind a disabled feature
flag so later adoption does not require redesigning the core database.
