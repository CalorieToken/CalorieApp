# BigchainDB assessment

Assessment date: 2026-08-30. Decision: not selected for CalorieApp's primary or
provenance database.

## Why it was considered

BigchainDB presents an asset-oriented, signed and immutable data model that is
closer to Web3 terminology than a relational database. That makes it an
understandable candidate for food provenance and hash-linked records.

## Why it is not selected

- The official deployment consists of BigchainDB Server, MongoDB and
  Tendermint on every node.
- Meaningful decentralization requires a governed consortium and several
  independently operated nodes; one project-controlled node is still a central
  service.
- The latest official GitHub release is v2.2.2 from 2020 and the latest commit
  on the main repository is from 2022. This is not an acceptable maintenance
  posture for new personal production data.
- Replication multiplies hosting, monitoring, recovery and operator work. Open
  source licensing does not make those operational resources permanently free.
- Immutable personal records complicate purpose limitation, correction and
  erasure. CalorieApp needs private history to remain exportable and deletable.
- XRPL already supplies the project's public consensus and transaction hashes.
  Adding BigchainDB would duplicate a trust layer rather than improve the
  initial user workflow.

## Selected Web3-compatible path

Private and mutable records use provider-neutral PostgreSQL. Provenance events
are append-only and content-addressed in application code, forming a directed
acyclic graph in the same database. A future voluntary link can anchor an event
or record to an existing validated XRPL transaction hash without publishing the
private contents. New fee-bearing transactions remain optional and require
explicit user authorization.

Primary references:

- [BigchainDB node software](https://docs.bigchaindb.com/en/latest/installation/node-setup/set-up-node-software.html)
- [BigchainDB consortium model](https://docs.bigchaindb.com/projects/server/en/latest/networks.html)
- [BigchainDB v2.2.2 release](https://github.com/bigchaindb/bigchaindb/releases/tag/v2.2.2)
- [BigchainDB repository](https://github.com/bigchaindb/bigchaindb)
- [XRPL transaction cost](https://xrpl.org/docs/concepts/transactions/transaction-cost)
