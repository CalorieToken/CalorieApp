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

## Unresolved Integration Item (Explicit)

Missing verified integration point:

- Exact XUMM Login 1.3.0 hook/filter or redirect parameter contract that guarantees CalorieApp state survives through the login round-trip and returns to the bridge authorize endpoint.

Safest minimal integration required if unavoidable:

- A documented post-auth redirect hook in XUMM Login that can forward authenticated users to:
  - /wp-json/calorieapp/v1/authorize?state=<backend_state>
  - with optional callback_url from strict allowlist

No plugin modification is included here because the contract is currently unknown and guessing would be unsafe.
