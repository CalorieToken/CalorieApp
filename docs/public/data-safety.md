# Public data-safety direction

CalorieApp's public-user release is blocked until authenticated food history has
a durable PostgreSQL primary store, formal schema migrations, verified user
isolation, authenticated export and deletion, and a successful backup-restore
exercise.

SQLite is limited to local development and automated tests. A hosting
provider's filesystem lifetime or free-tier expiry must not silently determine
how long a user's history is retained.

Product-search text is sent to Open Food Facts without the CalorieApp account
identifier and is not retained as CalorieApp history unless the user chooses to
log a result.

Personal food history, email addresses, profile details and stable user
identifiers are not intended for public blockchain or public IPFS storage.
Optional encrypted user-controlled exports and non-reversible integrity proofs
are research directions only and are not dependencies of the current release.

A future voluntary XRPL reference would use the network plus a validated
transaction hash as its public anchor and map it one-to-one to a unique
CalorieDB anchor hash. Lower relations to records and events would remain
private or explicitly visibility-controlled and deletable. Memos would permit only one-time opaque values,
never personal details, database identifiers or plain hashes of private records.

The architecture intentionally limits providers: one website/identity
environment, one source/CI platform, one app runtime and one PostgreSQL primary
store. The planned provenance graph does not require a separate graph database,
blockchain database or IPFS/Filecoin service.

Repeatable checks and recovery work are designed for automation. Production
changes, new identity or ledger purposes, financial actions and public
publication retain explicit approval gates. Automated work must be retry-safe,
observable and avoid secrets or unnecessary personal data in logs.

Passing technical checks does not by itself constitute legal, privacy or
security certification.
