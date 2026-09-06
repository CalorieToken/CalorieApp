# Working joint-login checkpoint — 2026-09-06

Saved at the user's request after the successful Android Brave cold-start
test at 17:20–17:22 CEST (15:20–15:22 UTC). This preserves the observed working
WordPress + CalorieApp combination and its deployment references.

## Exact source and artifact

| Component | Preserved reference | Accepted version |
|---|---|---|
| Frontend and backend | `checkpoint/2026-09-06-working-login` | `f689a4acd9bb34f49c6f06267fb22537b17495b0` |
| Installed WordPress maintenance plugin | `checkpoint/2026-09-06-bridge-0.3.19` | `fdd1c8f4cba606c8807db6b34776c87f19c70646` (0.3.19) |

The application checkpoint branch adds this document to the accepted application
commit. Restore or deploy the full accepted SHA above, rather than the newest
commit on `main`. Keep these checkpoint branches for recovery; make subsequent
changes on separate development branches.

The plugin is the maintenance release based on the working 0.3.3 plugin, not
the plugin source carried by application `main`. Do not merge the older plugin
branch into `main` or rebuild its archive from `main`.

- Application source tree: `ed8f5f9952950cf2998699ac4ee4e39e2bedf4c2`.
- Maintenance plugin source tree: `045682adcfbbc66af61616a50e3735296495278d`.
- Preserved archive: `calorieapp-identity-bridge-0.3.19.zip`, 42,564 bytes.
- Archive SHA-256: `07e388a8475a8a61213597488f3fa97d197c2aa42f056cf6887c2ac374035ddb`.
- Application change and acceptance record: [PR #125](https://github.com/CalorieToken/CalorieApp/pull/125).

## Existing deployment references

| Component | Existing service | Accepted deployment | Became live (UTC) |
|---|---|---|---|
| Backend | `srv-da34poht0dsc73cpc1kg` | `dep-daent1f40ujc73814mgg` | 2026-09-06 14:55:05 |
| Frontend | `srv-da356k0u01pc73ftva8g` | `dep-daenu2fqj5pc73a88cvg` | 2026-09-06 14:57:10 |

Both services were manually deployed to the accepted application SHA. Auto-Deploy
was paused by specific-commit deployment. Saving this checkpoint changes no
running service or deployment setting.

Public integration configuration at acceptance:

- Canonical WordPress page: `https://calorietoken.net/index.php/calorieapp/`.
- Embedded frontend: `https://app.calorietoken.net?embedded=1&locale=en`.
- Backend: `https://calorieapp-backend-rvul.onrender.com`.
- Frontend `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_BACKEND_WAKE_URL` both
  point to that backend.
- Frontend `NODE_VERSION`: `20.18.1`.
- Existing backend schema at deployment: `20260902_0016`.

Private configuration remains in the existing services. This record contains no
credentials, session material, wallet addresses or user data. It is a source and
deployment checkpoint, not a database snapshot.

## What passed

The user screenshots show a sleeping Render service starting, automatic return
to WordPress, Xaman sign-in, the account-control update message, the signed-in
WordPress widget, and the connected CalorieApp with the existing food log.

Corroborating backend records (2026-09-06, CEST):

| Time | Request | Result |
|---|---|---|
| 17:21:45 | `GET /health?resume_login=true` | 303 back to WordPress |
| 17:21:49 | `POST /api/identity/login/start` | 200 |
| 17:22:20 | `POST /api/identity/callback` | 200 |
| 17:22:20 | `GET /api/identity/me`, `GET /logs` | 200 |
| 17:22:25–26 | Session and food-log reads after the page update | 200 |

[GitHub Actions run #415](https://github.com/CalorieToken/CalorieApp/actions/runs/34040046359)
passed all four jobs before deployment. Targeted frontend checks included the
actual control-to-navigation-to-trusted-handshake lifecycle, with one resumed
login request. The production frontend build passed lint and type checks.

This records the successful observed login repair within step 2. It does not
declare the whole V2 completion roadmap, retention or recovery gates complete.

## Known behavior to preserve

When the backend is asleep, the sign-in control navigates the same tab to its
startup URL. The visible Render loading page is part of this accepted version.
Once ready, the backend returns to the canonical WordPress page and the existing
Xaman flow resumes from a short-lived, one-use browser intent. After verified
joint login, plugin 0.3.19 refreshes the page to update the website account widget.

The earlier background-only startup and hidden-iframe attempts did not pass the
user's cold-start test. Do not substitute those implementations without new
evidence. A test immediately after redeployment does not establish cold-start
behavior after inactivity.

## Recovery procedure

1. Compare the current service deployment SHAs and installed plugin with the
   accepted versions above before deciding whether recovery is needed.
2. To restore application code, deploy the accepted application SHA to the
   existing backend first, then the existing frontend. Retain their current
   secrets, domain mappings and persistent database connection.
3. If plugin recovery is necessary, verify the saved 0.3.19 ZIP checksum and
   install that maintenance archive. Do not replace it if it already matches.
4. This checkpoint has no schema change. Do not downgrade or restore the
   database as part of a code-only recovery; later migrations require their
   own compatibility assessment.
5. Check the deployment result, then verify joint login and the website account
   display. If startup behavior changed, include one real test after inactivity.

