# CalorieApp Staging Xaman Test

This document prepares the first real staging authentication test.

Scope:

- No production deployment
- No XUMM Login source changes
- No bridge secret in frontend/browser
- No real secrets in source control

## Required Backend Environment Variables

Set these in staging backend runtime:

- WORDPRESS_URL
- WORDPRESS_BRIDGE_AUTHORIZE_URL
- WORDPRESS_BRIDGE_EXCHANGE_URL
- WORDPRESS_BRIDGE_SECRET
- CALORIEAPP_CLIENT_ID
- CALORIEAPP_POST_LOGIN_REDIRECT
- LOGIN_STATE_LIFETIME_SECONDS
- SESSION_COOKIE_SECURE

Staging target values:

- WORDPRESS_URL=https://staging-wp.calorietoken.net
- WORDPRESS_BRIDGE_AUTHORIZE_URL=https://staging-wp.calorietoken.net/wp-json/calorieapp/v1/authorize
- WORDPRESS_BRIDGE_EXCHANGE_URL=https://staging-wp.calorietoken.net/wp-json/calorieapp/v1/exchange
- CALORIEAPP_CLIENT_ID=calorieapp-staging
- CALORIEAPP_POST_LOGIN_REDIRECT=/dashboard
- LOGIN_STATE_LIFETIME_SECONDS=300
- SESSION_COOKIE_SECURE=true
- WORDPRESS_BRIDGE_SECRET=CHANGE_ME_TO_A_RANDOM_SECRET

## Required Frontend Environment Variable

- NEXT_PUBLIC_BACKEND_URL

For local test mode:

- NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

## Bridge Contract Verification

CalorieApp backend integration expects:

- Authorize endpoint: GET /wp-json/calorieapp/v1/authorize
- Exchange endpoint: POST /wp-json/calorieapp/v1/exchange
- Exchange headers:
  - X-CalorieApp-Bridge-Secret
  - X-CalorieApp-Client-Id
- Callback payload to backend:
  - code
  - state

Expected bridge exchange success payload:

- external_subject
- xrpl_address
- issued_at
- expires_at
- jti

## REAL STAGING TEST

1. Open staging CalorieApp.
2. Click "Login with Xaman".
3. Confirm browser opens calorietoken.net XUMM Login.
4. Confirm XUMM Login 1.3.0 displays the login flow.
5. Approve the login in Xaman.
6. Confirm WordPress authenticates the user.
7. Confirm bridge authorize executes.
8. Confirm bridge obtains xrpl-r-address server-side.
9. Confirm state validation succeeds.
10. Confirm bridge creates one-time authorization code.
11. Confirm browser reaches CalorieApp /auth/callback.
12. Confirm backend exchanges the code server-to-server.
13. Confirm ExternalIdentity is created or reused.
14. Confirm CalorieAppUser is created or reused.
15. Confirm CalorieApp session is established.
16. Confirm authenticated food-log request works.
17. Confirm logout works.
18. Repeat the old callback URL.
19. Confirm replay is rejected.
20. Log in again with the same Xaman account.
21. Confirm the same CalorieAppUser is reused.

IMPORTANT:

Do NOT ask the user to paste:

- code
- state
- cookies
- secrets
- wallet credentials

into the chat.

Do not record real authorization codes or secrets in notes/screenshots.

## Failure Diagnostics

A. Login button:
- Inspect CalorieApp backend logs for /api/identity/login/start
- Confirm state creation and generated wordpress_signin_url

B. XUMM login:
- Inspect WordPress + XUMM Login logs
- Confirm xl-signin and xl-payload flow completes

C. Bridge:
- Inspect WordPress bridge logs
- Confirm authenticated WP user, xrpl-r-address lookup, state validation result

D. Callback:
- Inspect CalorieApp backend logs for /api/identity/callback
- Confirm callback state consume result and safe error classification

E. Exchange:
- Inspect bridge exchange endpoint logs and backend exchange logs
- Confirm header auth success and one-time code consumption

Never log or share:

- raw state
- raw authorization code
- bridge secret
- WordPress cookies
- XUMM secrets
- private keys or seeds

## Safe Observability Expectations

Allowed log fields:

- short state prefix
- user_id
- created flag
- HTTP status and timing

Forbidden log fields:

- raw state
- raw bridge code
- bridge secret
- WordPress auth cookie
- XUMM API secret

## Manual Staging Preconditions

1. Bridge plugin installed and activated only in staging WordPress.
2. Staging bridge secret matches staging backend secret.
3. Staging callback allowlist includes:
   - https://staging-app.calorietoken.net/auth/callback
   or the exact staging equivalent.
4. Backend CORS allows the staging frontend origin.
5. SESSION_COOKIE_SECURE is true in HTTPS staging.

## No-Deploy Reminder

This checklist prepares the test only. It does not deploy or alter production.
