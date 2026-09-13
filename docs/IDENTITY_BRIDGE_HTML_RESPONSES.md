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
The hosting operator must investigate the false positive for the configured
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

After the operator confirms a correction, first check that an unauthenticated
request receives a JSON rejection. Then complete one normal Xaman login in the
same browser/tab and verify both sessions, followed by joint logout. Never
accept an HTTP 200 alone as evidence that sign-in works.
