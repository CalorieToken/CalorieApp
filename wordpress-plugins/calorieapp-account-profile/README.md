# CalorieApp Account Profile 0.1.1 — integration candidate

Standalone addition for the existing `.xl-card` login widget. No existing plugin,
WordPress content or theme file is replaced. Requires the profile backend and
migration `20260917_0017`, plus the installed CalorieApp Identity Bridge settings.

The browser fetches only the current WordPress user's nickname through a private,
uncached same-origin AJAX response. The server signs an exact account-scoped
request with the existing bridge credentials. No secret is sent to the browser;
no nickname or user ID is accepted from an iframe message. The app sends only a
refresh notification to its previously validated parent. No nickname is retained
in WordPress user metadata, browser storage or shared caches.

Account changes, logout, hidden pages and late responses clear the displayed name.
Failure leaves the existing login widget available. The name links to the current
CalorieApp account page. Profile fetches never sign a user in or perform logout.

Reconciled with the other chat's live Heading Repair 1.6.10, including its original
faded logo paper on cards. This is not a replacement Heading Repair or Site Style
package and has not been installed. Coordinate installation with the profile
backend and migration; the old 0.1.0 candidate predates this presentation work.

The optional presentation layer moves the existing Xaman sign-in card above the
embedded app as a single inline region. It preserves the original links, QR image,
retry/close handlers and all authentication logic. Routine progress uses one stable
localized sentence; actual errors remain visible. The QR code is an optional
disclosure. Completion matching the active request closes the region and hides
the Xaman/QR/retry controls immediately, before the bridge's existing delayed
reload. Late progress or replay of that completed request cannot reopen it;
a new request can. An expired request offers retry without the stale Xaman link.
Logout does not add a dialog or confirmation. Browser/Xaman prompts and the existing
backend wake navigation remain owned by those services. Fullscreen mode exits via
the existing focus control before showing sign-in. Eleven app languages are covered.
