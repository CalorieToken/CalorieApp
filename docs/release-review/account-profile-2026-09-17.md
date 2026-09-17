# Account nickname and navigation — prepared 17 September 2026

Current base: PR #146 / `ae86192699ee15719f06dec4be0707deb985be83`.
Account implementation started at `ccc9983`; all subsequent WordPress work,
including Heading Repair 1.6.10, age button styling and faded logo card backgrounds,
was preserved intact. The owner confirmed installation; authenticated read-only
WordPress inspection also confirms active Heading Repair 1.6.10, Identity Bridge
0.3.29 and Site Style 1.4.46. The account, alignment and sign-in changes are
combined into one unpublished local candidate. The earlier `8774baa` review
bundle predates these additions.
Scope: the owner's request for a nickname that survives returning/signing in,
visible in the CalorieApp and WordPress login widget, and grouped account tools.
The owner explicitly reports concurrent WordPress styling work in another chat.

## Result

- One optional nickname on the internal CalorieApp account; saved by an explicit
  authenticated action and retrieved by `/api/identity/me` on the next sign-in.
  A fresh tab/browser session gets the same value. Each account has its own name.
- A compact identity link stays above the food/account navigation. The account
  card also displays the nickname. My account contains Profile, Settings and
  Data & privacy, each with a Back action; existing account guides sit together
  on its overview. Existing logout and data controls keep their original actions.
- Eleven locales cover the new controls and scope explanation, including RTL.
- The old nickname was unbound tab data. It is discarded, never automatically
  assigned to whichever account happens to sign in. Users save their nickname
  once in the new profile screen.
- Profile data is included in the private export and ordinary account erasure.
  The optional v2 export field is backward compatible with older v2 exports;
  food import does not copy nicknames between accounts. Import/erasure release
  flags are unchanged.

## Separate WordPress integration

`wordpress-plugins/calorieapp-account-profile` is an additive 0.1.1 companion.
No installed Heading Repair, Site Style, Identity Bridge, theme or page file was
modified. Its private AJAX read uses the authenticated WordPress user; the
browser cannot select an account. WordPress signs the exact account/purpose
using the existing configured bridge secret. The backend enforces signed,
time-bounded and nonce-protected reads. Only the nickname is returned.

The app's trusted parent notification contains no nickname, identity or secrets.
The companion verifies the frame origin AND source and refetches its own user's
profile. The existing login widget stays usable on profile-service failure.
No nickname is stored in WordPress metadata, browser storage or shared caches.
The nickname is text, never HTML, and links to the CalorieApp account page.

Coordinate this addition with the other WordPress chat. Compare the current live
widget before installation and include the changed nickname description in its
Help and privacy text. Do not replace its working plugin ZIPs with this branch's
older snapshots.

## Validation and limits

Local tests cover real SQLite persistence across sessions/database reopen,
account separation, cross-account update rejection, Unicode validation, request
intent, HMAC purpose/account binding, replay rejection, private export/import,
account erasure, migration preservation, form errors and late responses, widget
logout/refresh behavior, and existing authentication regressions. The new nullable
column preserves existing account rows. Production migration remains a separate
operation; no production database was touched.

TypeScript and production build pass. Exact final local test counts and commit
are recorded in the accompanying review bundle for the earlier candidate. The
current integrated candidate has 406 passing Node tests and a passing production
build, including TypeScript validation. The 283 previously passing backend tests
apply to unchanged backend source. See `account-layout-login-2026-09-17.md` for
the newer presentation changes and their limits. Native PHP and browser tests are
prepared in the existing isolated Actions workflow. They have NOT run locally:
PHP and Chromium are unavailable, and Chromium download timed out. Browser
fixtures include the eleven locales at 360/412/1440 pixels and screenshots. These
must pass and the screenshots must be reviewed before live rollout. Synthetic
checks do not certify real Xaman sign-in, the production WordPress widget or a
physical device.

## Integration and release

Keep PR #146 draft and unmerged. The owner previously required permission for
each commit upload; this change is prepared locally pending that permission.
Before upload, compare the current PR head and preserve the other chat's work.
The isolated workflow has read-only repository permissions and performs no
publication, installation, wallet action or deployment.

After source review and successful CI, coordinate a single rollout: approved
migration `20260917_0017`, matching backend, frontend, then the additive widget
companion. The old frontend remains compatible with the extended backend. Do not
roll an older schema-checking backend onto revision 0017 without a compatible
rollback build. No hosting, billing, feature-release gate or campaign settings
are changed. The existing free/approved-budget infrastructure is reused.
