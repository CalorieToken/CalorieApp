# CalorieApp Identity Bridge (WordPress Companion Plugin)

Standalone companion plugin for CalorieApp identity bridging.

This plugin does not replace or modify XUMM Login 1.3.0.
It only consumes an already-authenticated WordPress user session and mints a short-lived one-time authorization code for CalorieApp backend exchange.

## Scope

- Uses authenticated WordPress user identity only
- Reads XRPL address from user meta key: xrpl-r-address
- Issues one-time high-entropy authorization code
- Stores only a hash of that code
- Enforces expiration (default 60 seconds)
- Enforces single-use redemption
- Provides minimal identity claims on successful server-to-server exchange

## Endpoints

- Browser authorize: `/?calorieapp_authorize=1&state=...` in the normal WordPress request lifecycle
- Server exchange: POST `/calorieapp/v1/exchange` under the site's canonical WordPress REST root
- Legacy/debug REST authorize: GET `/calorieapp/v1/authorize` remains registered, but normal browser login must use the browser authorize URL because WordPress REST cookie authentication requires a REST nonce.

The browser endpoint is intentionally not REST. XUMM Login establishes a normal WordPress browser session, and that session is available to the standard WordPress request lifecycle without weakening WordPress REST authentication.

Details are in SECURITY.md and CONFIGURATION.md.

Version 0.1.2 adds a normal WordPress browser authorization handler for XUMM-authenticated sessions while retaining the REST exchange contract. Version 0.1.1 aligned state validation with the backend's signed v1 protocol
(timestamp, nonce, and HMAC-SHA256 signature) and supports an exact allowlisted
external callback without requiring a separate WordPress redirect-host filter.

## Important Integration Boundary

If the existing XUMM Login 1.3.0 flow cannot reliably preserve CalorieApp state through its login redirects, this plugin intentionally does not modify XUMM Login to force integration.

See "Unresolved Integration Item" in SECURITY.md.

## Files

- calorieapp-identity-bridge.php
- includes/class-calorieapp-identity-bridge.php
- includes/class-calorieapp-identity-bridge-storage.php
- includes/class-calorieapp-identity-bridge-rest.php
- includes/class-calorieapp-identity-bridge-browser-authorize.php
- includes/class-calorieapp-identity-bridge-admin.php
- tests/bootstrap.php
- tests/test-identity-bridge-rest.php
- phpunit.xml.dist
- README.md
- SECURITY.md
- CONFIGURATION.md
- TESTING.md
