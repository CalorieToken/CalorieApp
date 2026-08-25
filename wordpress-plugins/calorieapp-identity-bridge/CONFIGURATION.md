# Configuration

## Admin Settings Page

WordPress Admin:

- Settings -> CalorieApp Identity Bridge

Fields:

- Callback URL allowlist (one HTTPS URL per line; loopback HTTP is allowed for local staging)
- Default callback URL
- CalorieApp backend URL
- Backend client ID
- Bridge secret
- Code TTL seconds (10-300, default 60)

## Required Deployment Values

- Callback allowlist: the independently verified CalorieApp callback URL
- Default callback URL: one exact entry from that allowlist
- Backend URL: the independently verified HTTPS backend origin (not merely the frontend origin)
- Backend client ID:
  - calorieapp-backend (or your configured backend ID)
- Bridge secret:
  - Long random secret shared only with CalorieApp backend

## Browser Authorization Contract

Configure the CalorieApp backend authorize URL as the normal WordPress browser handler:

- Production: `https://calorietoken.net/?calorieapp_authorize=1`
- WP Studio local staging: `http://localhost:8881/?calorieapp_authorize=1`

The backend appends `state` to this URL and wraps it in the existing XUMM Login `?xl-signin&redirect=...` flow. After XUMM Login establishes the WordPress session, this handler validates state with the CalorieApp backend, reads `xrpl-r-address`, mints a one-time code, and redirects to the allowlisted CalorieApp callback.

## Local Development

HTTPS remains required for non-loopback callback/backend URLs. For WP Studio local staging, loopback HTTP URLs (`localhost`, `127.0.0.1`, or `::1`) are accepted so the staging bridge can communicate with the local CalorieApp frontend/backend without weakening public URL validation.

## Backend Exchange Contract

CalorieApp backend should call:

- POST the target site's canonical REST exchange route, e.g. `https://calorietoken.net/index.php/wp-json/calorieapp/v1/exchange`

The `/index.php/wp-json/` form matches the WordPress REST root observed on
CalorieToken at review time. Re-verify the canonical REST root before deployment.

Headers:

- X-CalorieApp-Bridge-Secret: <shared secret>
- X-CalorieApp-Client-Id: calorieapp-backend

Body JSON:

- code
- state

Response JSON on success:

- external_subject
- xrpl_address
- issued_at
- expires_at
- jti

## Backend State-Validation Contract

Before issuing a code, the bridge calls:

- POST `<backend-origin>/api/identity/login/state/validate`

It sends a JSON body containing `state` and these headers:

- `X-CalorieApp-Client-Id`
- `X-CalorieApp-Timestamp`
- `X-CalorieApp-Nonce`
- `X-CalorieApp-Signature`

The signature is HMAC-SHA256 using the bridge secret and the backend's canonical
v1 JSON payload. The shared secret itself is not sent on this request.
