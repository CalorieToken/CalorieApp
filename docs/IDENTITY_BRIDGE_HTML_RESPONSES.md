# WordPress returns HTML during login

The WordPress code-exchange endpoint must return identity JSON. A hosting
browser-verification page can instead return HTTP 200 with `Content-Type:
text/html`. WordPress may already have signed the visitor in, while CalorieApp
cannot establish its separate session.

The backend reports this as HTTP 502 with the fixed detail code
`wordpress_bridge_html_response`. It logs only the response category. It does
not log the upstream page, authorization code, state, headers or credentials.
The login state remains pending, and no account session is created from HTML.

The embedded app stops its automatic authorization refresh for this specific
failure, clears its pending browser-resume marker, and explains that the
website-to-app connection is temporarily unavailable. The app and the parent
error message follow the display language. Login protocol locale, normal
transient recovery, one-time-code checks and logout are unchanged.

## Hosting correction

This handling improves the failure message; it does not restore connectivity.
The hosting operator can investigate the false positive for the configured
HTTPS POST exchange endpoint. Supply the affected path, response status/type,
failure timestamps with timezone, and the service's current outbound ranges.
Keep private logs and service configuration outside this public repository.

Request a correction scoped to the affected API request and retain bridge
authentication, state validation, single-use codes and the other hosting
protections. Do not follow challenge scripts or send the exchange credentials
through an alternative browser or proxy.

For Render, obtain the service ranges under **Connect → Outbound**. These
ranges are shared by other services in the region, so they are not proof of
the CalorieApp service's identity. See
[Render's outbound IP documentation](https://render.com/docs/outbound-ip-addresses).

After a hosting correction, first check that an unauthenticated
request receives a JSON rejection. Then complete one normal Xaman login in the
same browser/tab and verify both sessions, followed by joint logout. Never
accept an HTTP 200 alone as evidence that sign-in works.

## Authenticated backend code issuance

An updated bridge can use the already established outbound WordPress-to-backend
connection. After validating the pending state, WordPress sends a separately
signed identity assertion to `POST /api/identity/bridge/code`. The backend
returns an opaque, 32-random-byte code prefixed with `cb1.`. The browser still
submits only `code` and `state` to the existing callback. It receives no identity
assertion or shared secret.

The signed v2 message covers a fixed purpose, client ID, timestamp, nonce,
state, WordPress subject, XRPL address and locale. The backend rejects changed
fields, a wrong issuer/client, stale timestamps, nonce reuse, unknown/expired/
consumed states and mismatched locales. It creates at most three codes for a
pending state, each valid for at most 60 seconds and no longer than that state.
Only code/state hashes are stored in the existing authorization-code table.
Issuance removes at most 200 expired `bridge-code:` records whose pending state
has also expired or disappeared; it leaves legacy records intact and retains
all rows for an unexpired state so the three-code allowance cannot reset.
This does not activate the broader authentication-retention runner. The
callback atomically reserves the state and atomically consumes the code before
issuing a session.
The original browser proof, session cookies and logout behavior remain intact.

The existing authenticated state-validation response advertises
`code_transport: backend_v1`. Updated WordPress uses this transport only when
advertised. Older plugins continue using the original exchange; updated plugins
retain it with older backends. A failed new-transport request does not silently
switch transports or follow HTTP redirects. No hosting control, challenge or
firewall setting is modified.

Deployment order: deploy the backend first, then update the bridge. The frontend
needs no change for this transport. Verify one real joint login and joint logout
after updating WordPress. If reverting the backend, revert WordPress first and
allow in-flight codes to expire. No database migration is required.

The live installation reports Identity Bridge 0.3.29, while this repository's
complete plugin source is 0.3.18. **Do not install that complete older plugin.**
Use the separate [guarded Login Repair installer](../wordpress-plugins/calorieapp-login-repair/README.md),
which verifies the existing REST controller's exact hash before replacing only
that file. Its deactivation restores the original only if the repaired hash
still matches. All other live plugin files are preserved. If the runtime hash
check fails, obtain the actual live source before adapting this repair.
