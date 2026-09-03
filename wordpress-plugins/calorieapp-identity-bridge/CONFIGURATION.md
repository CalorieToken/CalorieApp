# Configuration

Configure the plugin through **WordPress Admin → Settings → CalorieApp Identity Bridge**.

Required values:

- an exact callback URL allowlist;
- one default callback selected from that allowlist;
- the verified HTTPS CalorieApp backend origin;
- a backend client identifier;
- a long random bridge secret stored outside source control;
- a short one-time-code lifetime.

The embedded login also requires the Xaman API key and secret already stored by
the installed XUMM Login plugin. Those credentials remain server-side.

## WordPress page

Place `[calorieapp_embed]` on the CalorieApp page. The default source is the
current Render frontend. After configuring the Render custom domain, prefer:

```text
[calorieapp_embed src="https://app.calorietoken.net"]
```

The shortcode owns the Xaman modal, QR/deep link, payload WebSocket, and secure
message exchange with the embedded CalorieApp. Do not paste a second iframe or
the old XUMM return URL beside it.

The standalone Render page exposes an explicit same-tab link to this canonical
WordPress page; it does not start Xaman itself. While an iframe is waiting for
the authenticated parent handshake, its sign-in control remains disabled and
cannot navigate the iframe into a nested WordPress page. On the canonical page,
the bridge suppresses only an unsigned legacy XUMM Login `xl-signin` card so
there is one unambiguous Xaman entry point.

Pending status checks begin at five-second intervals, slow to ten seconds after
30 seconds and to twenty seconds after 90 seconds. Transient failures back off
to at most 30 seconds and bounded `Retry-After` guidance is respected. Focus and
page-show events cannot bypass an already scheduled retry.

## Security requirements

- Require HTTPS for non-loopback URLs.
- Permit loopback HTTP only for local development.
- Keep the bridge secret identical on the bridge and backend, but never transmit, log or commit it.
- Validate login state server-to-server before issuing a code.
- Make codes short-lived, single-use and atomically consumed.
- Restrict callbacks and redirects to explicit allowlists.
- Re-verify production origins and routes independently before deployment.
- Use `app.calorietoken.net` in production so the WordPress page and app are
  same-site even though they remain separate origins.

## Exchange contract

The backend exchanges a one-time `code` and `state` through the site's canonical CalorieApp REST route. Requests use the configured client identifier and server-held authentication material. Successful responses contain only the identity attributes and timestamps required by the released integration.

Provider-specific production URLs, operational observations and credentials are intentionally not included in this public configuration guide.
