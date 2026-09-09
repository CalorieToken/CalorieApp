# CalorieApp Identity Bridge (WordPress Companion Plugin)

Standalone companion plugin for CalorieApp identity bridging.

This plugin does not replace or modify XUMM Login. It reuses the API credentials
already configured by XUMM Login and adds a WordPress-owned sign-in flow for an
embedded CalorieApp. The originating WordPress page verifies the Xaman payload,
creates the WordPress session, and mints a short-lived one-time authorization
code for CalorieApp backend exchange.

## Scope

- Uses authenticated WordPress user identity only
- Reads XRPL address from user meta key: xrpl-r-address
- Issues one-time high-entropy authorization code
- Stores only a hash of that code
- Enforces expiration (default 60 seconds)
- Enforces single-use redemption
- Provides minimal identity claims on successful server-to-server exchange
- Omits Xaman return URLs so mobile sign-in stays with the launching browser
- Uses the payload WebSocket as a completion trigger and verifies the full
  payload server-side
- Authenticates WordPress and CalorieApp when the user returns to the
  originating WordPress page
- Renders a WordPress-page logout button that clears CalorieApp and WordPress
  sessions together
- Provides the `[calorieapp_embed]` shortcode for the WordPress page
- Binds the resolved locale to each short-lived integrated login flow and
  rejects state/locale mixing before issuing a CalorieApp code

## Endpoints

- Browser authorize: `/?calorieapp_authorize=1&state=...` in the normal WordPress request lifecycle
- Server exchange: POST `/calorieapp/v1/exchange` under the site's canonical WordPress REST root
- Legacy/debug REST authorize: GET `/calorieapp/v1/authorize` remains registered, but normal browser login must use the browser authorize URL because WordPress REST cookie authentication requires a REST nonce.
- Embedded start: POST `/calorieapp/v1/integrated-login/start`
- Embedded WordPress finish: POST `/calorieapp/v1/integrated-login/finish`
- Embedded CalorieApp authorization: POST `/calorieapp/v1/integrated-login/authorize`

The browser endpoint is intentionally not REST. XUMM Login establishes a normal WordPress browser session, and that session is available to the standard WordPress request lifecycle without weakening WordPress REST authentication.

Details are in SECURITY.md and CONFIGURATION.md.

## Current review candidate: 0.3.41

This follow-up addresses the three Copilot comments on the combined website
review: the standalone asset-cache version follows the plugin version, the
server-rendered language label uses the existing eleven-locale catalogue with
a WordPress translation fallback, and market URLs share the fixed CAL identity.
The optional display control still starts hidden and is off by default.
Authentication/session methods, browser assets and provider destinations are
unchanged. Current-head checks and review results are recorded on PR #133;
source/service-term clearance and native acceptance remain open.

## Previous combined candidate: 0.3.40

The full owned How to Buy/sell guide now follows the same optional display
choice in eleven prepared languages. Its updated public copy includes the full
CAL currency code, reserves/fees, Xaman regional-provider guidance, selling and
separate bank withdrawals, exact-issuer checks, RLUSD trustline guidance and
liquidity conflicts. It presents external trading as the current route. Site
fonts, modest corners, wrapping, 44px links and RTL direction replace the earlier
inconsistent guide styles. The public-page/source guards retain edited CMS,
identity values, links and form/account state. No signing or quote call is added.
130 Node/Python tests, PHP lint and all six PHP fixtures passed in hosted run
34326418843 after correcting fixture order. Native/mobile and linguistic
acceptance remain open. Source/release clearance is unchanged.

## Previous Tokenomics cycle: 0.3.39

Tokenomics receives an additive consolidation-wallet panel, dated CAL/XRP LP
interest disclosure, and operator-confirmed completion of all airdrops beside
the unchanged published chart. Eleven prepared helper translations use the same
optional display preference. Only public page 1209 receives the helper; original
wallet controls, session code and financial handlers are retained. Exact giveaway
figures remain a separate reconciliation task. 125 local tests pass; PHP, hosted
CI, native/mobile and linguistic acceptance remain open. This is not installed.

## Previous Trustline cycle: 0.3.38 rebuilt

The Trustline follow-up was rebuilt from preserved 0.3.37 after the previous
unreleased 0.3.38 artifact became unavailable. Copy/sign activation rechecks the
current issuer/currency source. Clipboard failures provide manual guidance and
pending actions cannot duplicate a write. Eleven prepared helper translations
use the existing optional display store; full page/legal translations remain
open. The separate public-page marker does not change native signing readiness.
119 local tests pass; PHP, hosted CI and native/browser acceptance remain open.

This is an unreleased Step 3 repair candidate, not a completed website release.
It reconciles the existing presentation work, adds scoped page enhancements,
and retains the accepted authentication/session controllers. The How to Buy
replacement requires an exact match to the captured old markup; later CMS edits
and translations are not overwritten. The optional CAL TrustSet link requires
server confirmation of the existing handler and matching CAL parameters. No
credential is passed to the browser and presentation creates no payload.

The page ending now provides one CalorieApp information component across public
page types, with eleven-locale copy and a verified site app link. The app page
uses an informational label instead of reloading its own embed. No private
account values, app fetches, new cookies or tracking are added to the component.

Reviewed Brizy footer markup is replaced in the rendered page by the shared
social/legal footer. Stored content is retained. Unrecognized copy, links or
controls keep their original footer; later CMS changes restore a formerly
matched footer. A dedicated market card moves to the shared ending instead of
overlapping the team section. Mixed account/payment shortcodes and forms remain
in place. The existing market request is reused; archive/search pages do not
gain a new market card or request. Admin, feed, embed, AJAX and REST responses
receive no public page furniture.

The separate design-only DEX registry has dated validated-ledger identity
evidence and checksum/issuer tests. No first-party trading or mainnet submission
is enabled. The source-clearance contract still blocks public distribution;
ordinary local builds do not clear that gate. New PHP fixture execution, exact
head CI, rendered acceptance and approval remain outstanding.

Version 0.3.37 restores the previously reported Richlist and donation/CMP work
from the recovered 0.3.34 source baseline. Richlist handles late, replaced,
removed or ambiguous own-row markers and rechecks before accessible focus/scroll.
Shared shortcut labels and Richlist helper labels follow the existing optional
display preview in eleven prepared languages. Missing or edited replacement
shortcuts restore native controls; replacement scroll buttons bind once. Original
artwork, destinations and accepted session handlers are retained. Donation/CMP
CSS aligns type, corners, wrapping and focus without changing native behavior.

The shared local/CI check command is
`python3 tools/check_step3_candidate.py --require-php` from the source repository.
This candidate has 113 passing Node/Python tests, but missing PHP is explicitly
INCOMPLETE and fails that gate. Native mobile/session/donation/consent and
linguistic acceptance remain open.

See `docs/STEP_3_REPAIR_CHECKPOINT.md` and `docs/STEP_3_PRESENTATION_RELEASE.md`
in the source repository for the full open-item inventory. Restore the previously
accepted artifact for an approved rollback; do not disable the whole companion
plugin merely to undo presentation, because it also supplies identity features.

The display-language preview introduced in 0.3.32 defaults off. When its explicit development
switch and the matching app switch are enabled, both native selectors share a
display-only preference and the translated app-information component responds.
The preference contains only the locale and timestamp for at most 30 days in
first-party browser storage. No authentication locale, cookie consent, account,
provider endpoint or payment handler is changed. Full page/legal translation
and real PHP/browser acceptance remain open. See the repository's
`contracts/display-language/v1/README.md` for scope and activation details.

Version 0.3.33 connects one FAQ question/answer sample to that same store. The
additional adapter/catalogue load only for public GET requests of the known
published FAQ page, outside previews and unknown query contexts. Both paragraphs
must match their captured text/structure before existing text nodes change.
Edited source stays intact. The eleven draft translations are not approved
full-page translations. Disable the preview flag, clear affected page caches
when used and reload to undo the sample without disabling identity features. No stored CMS text is rewritten. Package
and JavaScript checks pass locally; PHP/browser and source clearance remain open.

Version 0.3.34 adds a native cookie-settings button, profile link and explanation
in the observed Blog shortcode even if its X anchor/frame is absent. Three helper
strings follow the public WP locale or shared display preview in eleven prepared
languages. The original coloured heading and native CMP/X subtree are retained;
there is no second provider loader, consent change or paid service. Fifty-seven
local maintenance tests pass; PHP, live timeline/CMP and actual visual/language
acceptance remain open. The Roadmap correction still needs its exact source.

## Earlier maintenance history

Version 0.3.27 bundles the 0.3.26 candidate with the mobile screenshot findings.
The shared header styles now apply to the actual XUMM shortcode before layout
JavaScript runs, and a late-created account card is initialized once. Richlist
tables receive a keyboard-accessible horizontal scroll container; their rows,
addresses and links are preserved. Mobile donation controls, cart tables and
terms use readable widths and spacing. Blog slider dots stay in one horizontally
scrollable row, with every original destination retained.

After WooCommerce successfully accepts the donation product's open-price POST,
the default flow redirects to the same product's ordinary GET page. This avoids
leaving a resubmittable product form response in history. Explicit redirects and
the configured cart redirect remain authoritative. This hook does not calculate
prices, create orders or alter the payment gateway. The existing legal footer
correction also covers full product/cart HTML returned after POST, excluding
AJAX, REST, checkout and non-page response bodies.

The accepted authentication/session controllers are retained. The separate app
PR adds its own search deadline correction, inline food logging and wallpaper;
those changes cannot be installed through this WordPress ZIP. Native mobile
review and the complete donation cancellation/return path are still pending.
See `docs/STEP_3_CYCLE_1.md` in the repository for scope and acceptance checks.

Version 0.3.26 corrects the remaining market and shortcut layout differences
reported after installing 0.3.25. Dedicated market ancestors are normalized up
to the Brizy row, stopping before any shared account or content container. This
removes Home's 28.1% mobile column and large margins without resizing the XUMM
card. Existing CAL data validation, request sharing and fallback links remain.

One compact shortcut stack replaces recognized fixed Home/App/Up/Down controls.
It uses the original transparent app mark, Home's green arrows and purple home
icon, and 48px desktop / 32px mobile artwork. Hidden current-page links take no
space. Pages longer than two viewports also receive a working Down control;
page length is reevaluated after late images and iframe height updates.

The embedded app now has a server-rendered startup cover. It listens passively
for the existing app handshake with matching origin, frame and locale. An iframe
load alone does not dismiss the cover. Slow starts offer manual retry or reveal;
there are no automatic reloads or new login requests. This covers the embedded
frontend only. It cannot cover the separate top-level Render health page used
by the accepted website sign-in route, which is deliberately unchanged.

In 0.3.26, authentication/session JavaScript and header assets are byte-identical to
0.3.25. IntegratedLogin changes only its shortcode presentation and asset-version
fallback; server authentication methods are unchanged. No app-main changes,
WordPress content writes, merge or deployment are included. Native desktop/mobile
review remains necessary; source/behavior tests are not live visual verification.

Version 0.3.25 applies the CAL market renderer to existing LiveCoinWatch slots
throughout the public website, including late-loaded cards. The replacement
stays in its existing position, shares the same cached CAL feed and releases
obsolete market-shortcode height/width rules. Combined shortcodes containing
an account card are excluded from that sizing correction.

Floating navigation now rechecks after page load, restored pages, layout changes
and dynamically inserted Brizy controls. It suppresses duplicate destinations,
omits the current page and fills missing Home/CalorieApp/Top controls using the
original transparent logo, original 48px desktop / 32px mobile icon sizing and
original fixed slots. Existing visible Brizy controls take precedence. Inline
content links and the installed account/header/authentication code are retained.
The footer introduced in 0.3.24 is still rendered only on CalorieApp. This package
does not publish the prepared FAQ, Home or Tokenomics content or the app's food-log
and background changes; those are separate reviewed deliverables.

Version 0.3.24 restores the missing WordPress footer and a CAL market card below
CalorieApp, only on the `calorieapp` page. It reuses the existing footer colours,
social destinations, and current operator/copyright copy; the privacy and terms
links remain available without JavaScript. The XPMarket public CAL response is
validated and cached for five minutes by WordPress. On an upstream failure the
card keeps its direct XPMarket link and does not invent market figures.

These components have separate PHP, CSS and JavaScript files. The installed
0.3.23 header, navigation, login and logout remain the maintenance baseline.
No stored Brizy content or global theme templates are rewritten. The old
intervening layout releases are not part of this package. Visual verification
on the live CalorieApp page is still required before accepting the appearance.

Version 0.3.23 keeps the desktop account card within its existing Brizy column.
The shortcode uses the available column width and the card is centred with a
maximum width of 220px. This prevents the right edge from being clipped on
narrower desktop windows without adding a height constraint or moving the menu.
Only the horizontal margins are adjusted; vertical spacing stays theme-controlled.
These rules apply only from 769px. The mobile CSS and all JavaScript files stay
unchanged from 0.3.22. Authentication and session logic is unchanged; the fallback
asset-version string also advances to 0.3.23.

Version 0.3.22 moves the embedded page's existing joint-logout button into the
XUMM account card after the embed controller initializes. Both website controls
use the short label “Log out”, with an accessible explanation of the sessions
ended on this device. The existing embed controller and its logout handshake
are unchanged. Floating Brizy shortcuts omit the current page and use the
original CalorieApp phone mark as a transparent SVG. The former floating
Integrated Exchange shortcut now opens CalorieApp. Inline content links and
other floating icons are unchanged. The app's own button wording and Open Food
Facts contribution footer are prepared separately against app main.

Version 0.3.21 starts the website refinement on the accepted 0.3.20 maintenance
line. Separate presentation assets compact and centre the Brizy/XUMM header
card at widths up to 768px. The card moves with the mobile header, so it no
longer floats over scrolled page content. Navigation spacing accounts for the
actual card height, including the existing joint-logout button. Desktop styling
is unchanged. The authentication controllers, app/backend versions, and native
Render startup route are unchanged. See `docs/STEP_3_HEADER_LAYOUT.md` in the
repository for the review fixture and the outstanding live visual check.

Version 0.3.20 completes the missing session controls on the accepted 0.3.19
maintenance line. The embedded app's sign-out request reaches the existing
joint-logout handler. Other authenticated website pages provide the same
joint sign-out through a CalorieApp frame created only on a button press.
The website's legacy sign-in links use the existing backend's native same-tab
startup URL and resume the existing Xaman flow after returning to CalorieApp.
A five-minute, one-use WordPress sessionStorage marker carries navigation intent
only; it never authorizes a user. The visible Render loading page remains part
of the accepted cold-start route. When browser storage is unavailable, the
website link opens the canonical CalorieApp page for its usual sign-in control.
The already-deployed frontend and backend stay at the accepted `f689a4a` version.
The 0.3.19 Xaman verification, code exchange and refresh-after-success remain
the authentication baseline. This maintenance package does not include the
intervening website layout releases.

Version 0.3.19 is a maintenance build from the working 0.3.3 plugin, not a
successor containing the intervening layout releases. It backports the existing
automatic page refresh after verified CalorieApp login completion so the
server-rendered WordPress account widget immediately reflects the new session.
The original page and browser remain the return destination. PHP login logic,
CSS, layout, content and logout behavior are unchanged from 0.3.3.

Version 0.3.3 removes the mobile HTTPS return callback that could reopen the
flow in a different default browser. One Xaman signature is now completed by
the originating WordPress page through its WebSocket and lifecycle handlers.
Version 0.3.2 routes both visible login controls through one joint flow, added a
website-level joint logout button, and preserved the original-page lifecycle
fallback. Version 0.3.1 removed the competing unsigned XUMM Login card from
pages that render the integrated CalorieApp bridge, kept the standalone Render
entry as an explicit same-tab link to the canonical WordPress page, and blocked
iframe navigation while the trusted parent handshake was still being
established.
Version 0.3.0 adds the deployable copy and pure resolver for the shared,
versioned eleven-locale CalorieApp registry. It does not yet alter public
copy or automatically publish translations. Unsupported input falls back
safely to English. Arabic and Urdu are the right-to-left locales.
Version 0.2.4 only checks a Xaman signature after the user actually opens
Xaman, keeps retrying pending signature checks after the user returns, and
shows CalorieApp startup retry progress without disguising backend errors as a
pending signature.
Version 0.2.3 waits for the CalorieApp backend state before exposing the Xaman
link or QR code. This prevents mobile browsers from being backgrounded during
a Render cold start and makes the joint WordPress/CalorieApp sign-in ready
before the user leaves for Xaman.
Version 0.2.2 keeps the Xaman custom payload identifier within Xaman's
40-character API limit so sign-in requests can be created successfully.
Version 0.2.1 added the WordPress-owned embedded login and shortcode. It avoids
mobile default-browser callbacks by intentionally omitting Xaman return URLs;
the user returns to the original page with Xaman's Close or Back action.
Version 0.1.4 completed the narrowly scoped public-HTML footer compatibility
layer. Version 0.1.3 introduced that compatibility layer. Version 0.1.2 added
a normal WordPress browser authorization handler for XUMM-authenticated
sessions while retaining the REST exchange contract. Version 0.1.1 aligned state validation with the backend's signed v1 protocol
(timestamp, nonce, and HMAC-SHA256 signature) and supports an exact allowlisted
external callback without requiring a separate WordPress redirect-host filter.

## Embed

Add this shortcode to the prepared WordPress page:

```text
[calorieapp_embed]
```

During custom-domain rollout, the iframe source can be overridden explicitly:

```text
[calorieapp_embed src="https://app.calorietoken.net"]
```

The shortcode resolves the current WordPress locale automatically. A canonical
locale or supported alias can also be supplied explicitly for controlled
previews, for example `[calorieapp_embed locale="nl-NL"]`.

The CalorieApp frontend must permit `calorietoken.net` through its
`frame-ancestors` Content Security Policy. A same-site custom domain is strongly
recommended for production browser-cookie reliability.

## Files

- calorieapp-identity-bridge.php
- includes/class-calorieapp-identity-bridge.php
- includes/class-calorieapp-identity-bridge-locale-registry.php
- includes/class-calorieapp-identity-bridge-storage.php
- includes/class-calorieapp-identity-bridge-rest.php
- includes/class-calorieapp-identity-bridge-browser-authorize.php
- includes/class-calorieapp-identity-bridge-integrated-login.php
- includes/class-calorieapp-identity-bridge-admin.php
- assets/calorieapp-embed.js
- assets/calorieapp-site-session.js
- assets/calorieapp-embed.css
- config/locales.json
- config/app-information.json
- tests/bootstrap.php
- tests/test-identity-bridge-rest.php
- phpunit.xml.dist
- README.md
- SECURITY.md
- CONFIGURATION.md
- TESTING.md

## Reproducible releases

From the repository root, build the upload-ready ZIP, SHA-256 checksum, and
machine-readable manifest with:

```bash
python tools/build_wordpress_plugin_release.py
```

The builder uses an explicit runtime-file allowlist, rejects unsafe paths and
symlinks, normalizes ZIP metadata, and verifies the completed archive. It never
packages tests, dependencies, environment files, nested archives, or repository
metadata.

CI runs the same builder and its standard-library unit tests. A tag matching
`calorieapp-identity-bridge-vX.Y.Z` publishes the verified artifacts as a GitHub
release. A manual workflow run produces downloadable workflow artifacts without
creating a release.
