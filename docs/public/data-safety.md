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

Passing technical checks does not by itself constitute legal, privacy or
security certification.
