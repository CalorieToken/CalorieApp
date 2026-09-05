# Security Notes

## Secrets

Never exposed to browser:

- Bridge secret
- WordPress auth cookies
- XUMM credentials
- Xaman private data

The bridge secret is checked from request headers on the server-to-server
exchange endpoint. For outbound state validation, it is used locally to create
an HMAC signature and is not transmitted.

Required headers for exchange:

- X-CalorieApp-Bridge-Secret
- X-CalorieApp-Client-Id

State-validation requests use client ID, timestamp, a fresh random nonce, and an
HMAC-SHA256 signature. The backend rejects stale timestamps and replayed nonces.

## Redirect Safety

No arbitrary redirects are accepted.

Authorize endpoint accepts only callback URLs from explicit allowlist.
Default callback must also be on that allowlist.

The embedded login deliberately omits `return_url.app` and `return_url.web`.
Mobile operating systems cannot reliably reopen the browser tab that launched
a sign request and may otherwise open the device's default browser. The
launching page observes the payload-specific WebSocket and lifecycle events,
then verifies the resolved payload server-side and completes both sessions in
that original browser. No Xaman return token or browser callback is exposed.

On a page containing the integrated bridge, its script leaves the unsigned
legacy XUMM Login card visible but intercepts its `xl-signin` link. Both visible
login controls therefore use the page-owned joint flow. Signed-in account cards
and XUMM Login surfaces on other pages are not changed.

The Xaman deep link, QR URL, and payload WebSocket URL are accepted only on the
exact `xumm.app` host. The browser WebSocket is a completion trigger only; the
full payload is always fetched from Xaman and verified server-side before any
WordPress cookie is set.

## XRPL Address Handling

- XRPL address is read server-side only using WordPress user meta key xrpl-r-address.
- Browser-provided XRPL values are never trusted.
- Address format is validated using a classic address pattern check.

## Authorization Code Controls

- Random 32-byte code generated via random_bytes
- URL-safe code string
- Only HMAC-SHA256 hash stored
- Single-use enforced with atomic used_at update
- TTL enforced (default 60 seconds)
- Expired/used records cleaned up automatically on bridge requests

## Minimal Claims Returned by Exchange

- external_subject
- xrpl_address
- issued_at
- expires_at
- jti

No email or extra WordPress profile data is returned.

## Logging

Plugin does not log plaintext authorization codes or secrets.

## Embedded flow controls

- POST requests must carry the canonical WordPress Origin header.
- Each flow has a random 256-bit proof; only its HMAC hash is stored.
- Payload completion is accepted only once. The flow is deleted before a
  CalorieApp authorization code is returned, so the same verified signature
  cannot be replayed through the bridge.
- Flow proofs expire after ten minutes and are never placed in URLs.
- The Xaman custom identifier is checked with the resolved payload.
- The XRPL address is read only from the verified Xaman API response.
- A completed flow is bound to one CalorieApp backend state.
- Xaman payload creation is rate-limited per source address.
- Cross-frame messages validate both the exact origin and source window.
- Website logout waits for a success response from the trusted iframe before
  following WordPress's nonce-protected logout URL. The same-origin frontend
  clears the HttpOnly CalorieApp cookie even if the backend is temporarily
  asleep; backend revocation is attempted in the background and unrevoked sessions
  remain subject to the 30-minute idle and eight-hour absolute expiry limits.
- The shortcode accepts only the Render production origin and `https://app.calorietoken.net` by default. Deployments may extend this list with the `calorieapp_identity_bridge_allowed_frontend_origins` filter.
