# Voluntary XRPL reference direction

CalorieApp is preparing a privacy-preserving architecture in which a user could
voluntarily associate a validated XRPL transaction hash with a private CalorieDB
record. This is a planned, disabled feature and is not part of the current app.
The first users would not be expected to use it; the design is reserved now so
the database can grow into it later without changing its core identity model.

The canonical public reference would be the XRPL network plus transaction hash.
Each validated network/hash pair would map one-to-one to a separate unique
CalorieDB anchor hash. The actual relations below that anchor—to events, batches,
products, users or records—would remain off-chain and visibility-controlled. A
memo-assisted flow would permit only a one-time opaque random value;
names, email addresses, food information, database identifiers and plain record
hashes would be forbidden.

A transaction would count as CalorieToken-related only after matching the exact
network, issuer and currency code from a controlled asset registry. A token
symbol, project name or memo alone would not be accepted as evidence.

The transaction hash and private CalorieDB fingerprint would be connected by a
separate private, purpose-bound link record. Multiple approved links could form a
traceability graph from producer through processing, distribution and retail,
but CalorieApp would not expose a public resolver that turns a transaction hash
into a user profile or private record. Missing links would be shown as gaps,
never guessed, and ledger validation alone would not be presented as proof that
a physical food claim is true.

CalorieApp would remain non-custodial and would not hold wallet keys, execute
transactions or automatically profile complete wallet histories. Enabling this
direction requires privacy impact assessment, jurisdiction-specific review and
clear user notice that XRPL transactions and memos are public and irreversible.

After a future approval, verification of one explicitly requested transaction
could run automatically and retry safely without creating a duplicate link.
Complete-wallet scans, cross-purpose matching and self-enablement would remain
forbidden.
