# Step 3 presentation review — Identity Bridge 0.3.40

The accumulated website changes are submitted for one code-review and CI pass
against the existing maintenance base, not app main. They address shared footers,
market placement, floating navigation, richlist, donation/cookie styling, Trustline,
Tokenomics, and the complete owned How to Buy/sell guide. The website information
widget and optional display-language helpers use the same eleven-locale registry.

The exact reviewed legacy guide is replaced with external buy/sell guidance,
issuer/currency identity, XRP reserves/network fees, RLUSD trustline checks and a
separate bank-withdrawal explanation. Xaman's region/currency selector and the
issuer-specific XPMarket page were checked on 2026-09-09. No quote or signing
request is added. The Tokenomics helper uses an operator-supplied project wallet
and dated ledger validation; all airdrops are operator-confirmed complete, while
exact remaining giveaway figures are still open. Historical images are retained.

130 local tests passed: 114 Node and 16 Python. JS syntax, package/asset checks,
legal-boundary checks and whitespace passed. PHP lint/six fixtures were not run
locally; the strict aggregate is INCOMPLETE. Hosted CI and actual WordPress/app,
mobile/RTL, linguistic, consent and donation acceptance remain to be performed.
Source clearance remains blocked; no new release, installation or mainnet
financial feature is approved by this proposal.

See STEP_3_REPAIR_CHECKPOINT.md for all 27 requested areas and their remaining
closure. Internal recovery archives, attachment handles and later private
checkpoint history are excluded from this proposed public review commit.
