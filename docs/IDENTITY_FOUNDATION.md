# CalorieApp Identity Foundation

## Status and scope

This document describes the current identity contract implemented in the CalorieApp repository.

**CURRENT IMPLEMENTATION:** CalorieApp V1 is a non-financial, non-custodial food and nutrition application. It uses Xaman/XUMM only as an external identity system through an external WordPress identity bridge.

**APPROVED V1 BOUNDARY:** CalorieApp may perform server-side identity verification, create opaque application sessions, and retain an XRPL address only as external identity metadata. This is an engineering/governance boundary, not a legal or regulatory determination.

**NOT APPROVED:** private keys, seed phrases, signing credentials, wallet custody, XRPL transaction signing or submission, balances, payments, transfers, exchange/trading, token administration, rewards/value transfer, and other financial functionality. Any such capability requires a separate architecture decision and dedicated legal/compliance, privacy, security, threat-model, and operational review.

This document does not verify or approve any WordPress, Xaman, DNS, TLS, Render, Plesk, staging, or production infrastructure.

## Architecture overview

CalorieApp maintains an internal user model that is distinct from the external identity provider. WordPress is the external bridge for the browser's Xaman/XUMM identity flow; CalorieApp validates the bridge interaction server-side and establishes its own application session.

```
Browser
  -> CalorieApp login-start API
  -> external WordPress/Xaman identity flow
  -> browser callback with code and state
  -> CalorieApp server-side WordPress bridge exchange
  -> opaque CalorieApp session cookie
  -> authenticated CalorieApp APIs
```

The browser is not given a CalorieApp raw user ID as an authentication credential. CalorieApp does not become a wallet, transaction signer, or financial service through this identity integration.

## Current data model

### CalorieApp user and external identity

`CalorieAppUserDB` is the internal CalorieApp user record. `ExternalIdentityDB` maps an internal user to an external provider and subject. The active provider identifier is `wordpress_xumm`.

`ExternalIdentityDB.xrpl_address` is nullable external identity metadata. It is not a private key, signing credential, wallet-custody record, balance record, transaction authority, or proof of financial ownership.

### Pending login state

`PendingLoginStateDB` persists a hashed login state with creation, expiration, status, and consumption timestamps. The backend generates a high-entropy state when login begins; its stored form is SHA-256 hashed. The current default state lifetime is 300 seconds, configurable through `LOGIN_STATE_LIFETIME_SECONDS`.

The callback consumes pending state using a conditional database update. A state can proceed only once while pending and unexpired, which prevents callback replay and concurrent double consumption.

### Opaque application sessions

`AuthSessionDB` stores the SHA-256 hash of an opaque CalorieApp session token, the internal user ID, creation and last-seen timestamps, expiry, revocation status, and optional replacement-session linkage.

The session token itself is not stored in the database. Current source sets an 8-hour absolute session lifetime and a 30-minute idle lifetime. A valid request updates `last_seen_at`; expired, idle-expired, revoked, unknown, or userless sessions are rejected. Login can revoke a previously supplied valid session when replacing it.

### Bridge replay records

`BridgeAuthNonceDB` stores hashed bridge nonces with a client ID, context, creation time, and expiry. A unique constraint prevents reuse within the same client/context.

## Current authentication flow

### 1. Login start

The browser calls `POST /api/identity/login/start`. The backend creates a pending state and returns:

```json
{
  "state": "high-entropy-state",
  "expires_at": "timestamp",
  "wordpress_signin_url": "backend-generated WordPress sign-in URL"
}
```

The backend-generated URL directs the browser to the external WordPress/Xaman flow and includes the WordPress bridge authorize endpoint with the pending state.

### 2. External identity flow

The browser completes the identity flow outside CalorieApp through WordPress and Xaman/XUMM. The companion WordPress bridge and its Xaman configuration are external dependencies and are not included or verified in this repository.

### 3. Bridge pending-state validation

The bridge may call `POST /api/identity/login/state/validate` to validate a pending state. The current backend verifies these request headers:

- `x-calorieapp-client-id`
- `x-calorieapp-timestamp`
- `x-calorieapp-nonce`
- `x-calorieapp-signature`

The signature is an HMAC-SHA256 over a canonical payload containing the protocol version, client ID, timestamp, nonce, and state. The backend verifies the configured client ID, enforces configured timestamp age/future limits, validates nonce format, compares the HMAC, and atomically reserves the nonce. Replayed nonces are rejected.

### 4. Browser callback and server-side exchange

The browser calls `POST /api/identity/callback` with only `code` and `state`.

The backend validates and consumes the pending state before calling the configured WordPress exchange endpoint. The current exchange request uses:

- `WORDPRESS_BRIDGE_EXCHANGE_URL`
- JSON body: `code` and `state`
- `X-CalorieApp-Bridge-Secret`
- `X-CalorieApp-Client-Id`

The backend validates the returned identity claims, resolves or creates the CalorieApp user and external-identity mapping, and creates an opaque CalorieApp session. The browser does not provide an XRPL address as an authoritative callback claim.

### 5. Session creation and use

On successful callback, the backend sets the `calorieapp_session` cookie. It is configured with:

- `HttpOnly=true`
- `Secure` controlled by `SESSION_COOKIE_SECURE` (default `true` in source)
- `SameSite=lax`
- `Path=/`
- `Max-Age` equal to the configured absolute session lifetime

Authenticated APIs resolve the cookie token against the corresponding hashed `AuthSessionDB` record. `GET /api/identity/me` returns the current internal user ID and creation time. `POST /api/identity/logout` revokes the current CalorieApp session and clears `calorieapp_session`; it does not log the user out of WordPress or Xaman/XUMM.

## Food authorization

`POST /log-food`, `GET /logs`, `DELETE /logs/{log_id}`, and `DELETE /logs` require an authenticated CalorieApp session.

New food logs receive the authenticated user's `owner_id`. Queries return only logs owned by that user, and deletion rejects entries owned by another user. Legacy V1.2 records with `owner_id=NULL` remain in the database for migration or administrative review, but are intentionally excluded from normal authenticated user queries because ownership is unknown.

## Configuration terminology

The current backend reads its identity configuration from environment variables, including:

- `WORDPRESS_URL`
- `WORDPRESS_BRIDGE_AUTHORIZE_URL`
- `WORDPRESS_BRIDGE_EXCHANGE_URL`
- `WORDPRESS_BRIDGE_SECRET`
- `CALORIEAPP_CLIENT_ID`
- `CALORIEAPP_POST_LOGIN_REDIRECT`
- `LOGIN_STATE_LIFETIME_SECONDS`
- `SESSION_COOKIE_SECURE`
- `BRIDGE_AUTH_MAX_AGE_SECONDS`
- `BRIDGE_AUTH_MAX_FUTURE_SECONDS`
- `BRIDGE_NONCE_RETENTION_SECONDS`

Secrets belong in the relevant runtime secret store and must not be placed in documentation, client-side configuration, or source control. The values, host ownership, TLS configuration, and live endpoint behavior are external and unverified here.

## Implemented security controls

- High-entropy pending login state stored as a hash.
- Atomic pending-state consumption for single-use callback semantics.
- Opaque, high-entropy session tokens stored only as hashes.
- Server-side session expiry, idle expiry, revocation, and replacement support.
- HMAC-SHA256 bridge validation with client ID, timestamp, and one-time nonce replay protection.
- HttpOnly session cookie with source-configured Secure behavior and `SameSite=lax`.
- Owner-scoped food-log access and mutation.
- External identity boundary: no private-key custody and no XRPL transaction signing or submission by CalorieApp.

## Historical / superseded documentation

Earlier versions of this document described a `calorieapp_user_id` authentication cookie, `SameSite=Strict`, a frontend-managed login-session identifier, ownerless legacy logs being normally readable, and an older WordPress exchange endpoint/header contract. Those descriptions are historical and superseded by the current implementation above.

The repository still contains `AuthorizationCodeDB` and related helper functions from the earlier identity-foundation work. They are retained as historical implementation context, but the active backend callback contract is the pending-state validation and external WordPress bridge exchange described in this document. This repository does not establish the implementation or live status of the external WordPress companion plugin.

## Testing and infrastructure status

Backend identity and endpoint tests cover current session, callback, state, nonce replay, and food-authorization behavior. Test presence does not verify external WordPress/Xaman hosting or a live end-to-end deployment.

Local development uses the repository's backend and frontend configuration. Staging and production infrastructure, including DNS, TLS, hosts, deployment platforms, bridge configuration, secrets, and database operations, remain planned or external and require independent verification.

## Future work

The following are not authorized by this document: financial, token, custody, wallet, payment, transaction, or value-transfer capabilities; expanded Web3 functionality; and changes to the external identity boundary. They require separate approval under Decision 6G-10A.

---

**Last reconciled:** 2026-08-20
**Status:** Current implementation and approved V1 boundary documented; external infrastructure remains unverified.
