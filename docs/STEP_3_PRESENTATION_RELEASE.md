# Step 3 presentation release

Candidate: Identity Bridge 0.3.30.

## Included presentation changes

- Existing Brizy footers remain stored in place. Singular pages missing a CAL
  market card receive one candidate which is deduplicated against an existing
  XPMarket/legacy card and positioned before the existing legal footer.
- The Trustline page reuses the installed XUMM Login plugin's existing Xaman
  TrustSet route. No Xaman credential or signing implementation is duplicated.
- The Richlist highlights only the row already marked for the authenticated
  visitor and adds an accessible jump control. Logged-out visitors receive no
  inferred position.
- Contact, donation and Complianz consent controls receive scoped responsive
  presentation without changing their submission or consent behavior.
- How to buy becomes a wallet, regional XRP funding, CAL trustline, then buy or
  sell path. Unreliable generic DEX links are removed. The issuer-pinned XPMarket
  destination remains, and CAL/XRP plus CAL/RLUSD are identified as validated
  XRPL AMMs. First-party mainnet signing stays labelled release-gated.

The display changes are reversible by disabling the companion plugin. They do
not mutate stored Brizy content, create a DEX transaction, publish personal
wallet ownership, or merge the application branch.

## Third-party mark added in 0.3.28+

`assets/calorieapp-site-polish.js` contains the monochrome X logo path from X's
official brand toolkit solely to identify CalorieToken's X profile. The mark is
not project-owned and is not licensed under the plugin's software licence.

- Source: <https://about.x.com/en/who-we-are/brand-toolkit>
- Asset: <https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-logo.zip>
- Retrieved: 2026-09-08

The original vector geometry is preserved; `currentColor` retains the site's
monochrome icon colour.
