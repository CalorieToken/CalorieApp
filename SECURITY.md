# Security policy

## Reporting

Do not disclose suspected vulnerabilities, secrets, authentication codes,
cookies, personal data, or production configuration in a public issue.

Use GitHub's private vulnerability-reporting or private security-advisory
channel for this repository when available. If that channel is unavailable,
contact the project owner through an established private CalorieToken contact
channel and share only the minimum information needed to establish a secure
reporting path.

## Scope

Current V2 scope is the non-financial, non-custodial CalorieApp food and
nutrition application, including its backend, frontend, and
separately licensed WordPress identity bridge.

Reports involving wallet custody, private keys, payments, token transfers,
trading, or other financial execution are outside the implemented product
unless they demonstrate that such functionality is unexpectedly present.

## Sensitive material

Never include real secrets, credentials, private keys, seed phrases, database
contents, authorization codes, session cookies, or unnecessary personal data
in a report. Redact logs and screenshots.

Repository checks reject tracked private `age` identities, literal Neon API-key
assignments, credential-bearing Neon database URLs and provider backup
artifacts. Only the approved public `age` recipient may later be committed.
These pattern checks supplement provider-side secret scanning; they do not make
the repository an approved place to generate, decrypt or temporarily store a
private identity.

## Permission boundary

This policy does not grant permission for destructive testing, denial of
service, social engineering, privacy violations, accessing other users' data,
or testing third-party systems such as WordPress, Xaman/XUMM, Open Food Facts,
or Render without their authorization.

No bug-bounty payment or reward is promised unless separately agreed in
writing.

## Unreleased merchant/consumer pilot candidate (22 September 2026)

`backend/app/pilot/` is not registered in the live API or migration runner.
`contracts/pilot/v1/release.json` records blockers; passing isolated tests does
not authorize activation. The adapter must use the separately verified
CalorieApp payment rail, never fall back to website Xaman credentials or accept
wallet secrets. Browsers cannot supply ledger evidence or grant themselves a
merchant/consumer identity. Require authenticated actor binding, network-specific
wallet proof and freshness, explicit purchase review, the correct issuer and
actual delivered amount, transaction idempotency, bounded fees and stock locks.

No food data belongs in public transaction metadata. Public transaction hashes
must not act as receipt-access tokens. Pending signatures and late ledger
confirmations require reconciliation before stock is released. Complete
PostgreSQL concurrency, access control, export/erasure, retention, refunds,
request limits and device tests before enabling the pilot. The free-launch
pricing contract cannot silently activate fees or premium billing.
