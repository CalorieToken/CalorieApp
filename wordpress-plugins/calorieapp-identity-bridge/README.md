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

Version 0.3.9 keeps the site-wide XUMM account card visible in both Brizy menu
states, overrides Brizy's mobile 11% shortcode width, and moves the complete
Brizy menu column down on every public page to prevent overlap. The layout
hooks load site-wide, while bridge requests still initialize only on pages with
`[calorieapp_embed]`. The established Xaman login, browser return, and joint
logout request flows remain unchanged.
Version 0.3.8 fixes the actual Brizy mobile-header collision: the fixed XUMM
account card is centred and shortened without removing its joint-session
control, and it yields completely while the navigation is open. This change is
limited to mobile layout and leaves the successful Xaman login, browser return,
and joint logout request flows unchanged.
Version 0.3.4 refreshes the originating page once after both sessions are
confirmed, integrates the joint session control into the XUMM account card,
and lets the embedded CalorieApp use that same sign-out-everywhere flow.
Version 0.3.5 keeps that login flow unchanged, makes the added XUMM-widget
session row compact on mobile, and confirms the CalorieApp session state after
an interrupted logout response before continuing to WordPress logout.
Version 0.3.7 keeps Brizy's opened mobile navigation above the XUMM account
card and lets the frontend clear its first-party CalorieApp cookie as soon as
that frontend wakes, even while the backend remains asleep. Backend session
revocation is attempted in the background, and one bounded request retry covers
the free frontend's own cold start. The successful Xaman login and browser-return
flow remains unchanged. Version 0.3.6 woke the idle Render
backend before logout and gave the mobile XUMM card enough bounded horizontal
space for its shorter joint-session labels.
Version 0.3.3 removed the mobile HTTPS return callback that could reopen the
flow in a different default browser. One Xaman signature is completed by the
originating WordPress page through its WebSocket and lifecycle handlers.
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
- assets/calorieapp-embed.css
- config/locales.json
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
