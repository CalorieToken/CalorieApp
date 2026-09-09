# Step 3 presentation review — Identity Bridge 0.3.41

Version 0.3.41 addresses the three Copilot comments on the combined 0.3.40
review. Asset-cache fallback follows the current version; the server language
label uses the existing locale catalogue with an escaped WordPress translation
fallback; and fixed market links share one token constant. Session/authentication
methods, browser assets, provider destinations and release-clearance flags are
unchanged. Current-head CI and re-review results are recorded on
[PR #133](https://github.com/CalorieToken/CalorieApp/pull/133).

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

The combined 0.3.40 tree passed 130 Node/Python tests, PHP lint and all six PHP
fixture invocations in hosted run 34326418843. The first CI run identified an
irreversible REST_REQUEST fixture placed before later public-page cases; the
fixture order was corrected without changing plugin bytes. Local PHP remains
unavailable; current-head hosted checks must pass before accepting 0.3.41.
Actual WordPress/app, mobile/RTL, linguistic, consent and donation acceptance
remain to be performed.
Source clearance remains blocked; no new release, installation or mainnet
financial feature is approved by this proposal.

See STEP_3_REPAIR_CHECKPOINT.md for all 27 requested areas and their remaining
closure. Internal recovery archives, attachment handles and later private
checkpoint history are excluded from this proposed public review commit.
