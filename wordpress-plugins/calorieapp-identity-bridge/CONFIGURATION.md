# Configuration

Configure the plugin through **WordPress Admin → Settings → CalorieApp Identity Bridge**.

Required values:

- an exact callback URL allowlist;
- one default callback selected from that allowlist;
- the verified HTTPS CalorieApp backend origin;
- a backend client identifier;
- a long random bridge secret stored outside source control;
- a short one-time-code lifetime.

## Security requirements

- Require HTTPS for non-loopback URLs.
- Permit loopback HTTP only for local development.
- Keep the bridge secret identical on the bridge and backend, but never transmit, log or commit it.
- Validate login state server-to-server before issuing a code.
- Make codes short-lived, single-use and atomically consumed.
- Restrict callbacks and redirects to explicit allowlists.
- Re-verify production origins and routes independently before deployment.

## Exchange contract

The backend exchanges a one-time `code` and `state` through the site's canonical CalorieApp REST route. Requests use the configured client identifier and server-held authentication material. Successful responses contain only the identity attributes and timestamps required by the released integration.

Provider-specific production URLs, operational observations and credentials are intentionally not included in this public configuration guide.
