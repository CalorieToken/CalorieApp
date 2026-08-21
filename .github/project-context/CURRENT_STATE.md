# CalorieApp current state

## Current application architecture

The current app is a non-financial nutrition tracking system with:
- Next.js frontend
- FastAPI backend
- SQLite-backed persistence in local development
- food-search and food-logging behavior
- server-side identity/session handling

## Current identity/session architecture

The current security implementation is protected.

Verified elements:
- server-side opaque session authentication
- HttpOnly `calorieapp_session` cookie
- server-side `AuthSessionDB` records
- hashed session tokens at rest
- session expiration and revocation logic
- identity pending-state validation
- replay protection
- food-log ownership enforcement
- non-custodial Xaman boundary
- no private-key custody in CalorieApp
- no XRPL transaction signing in CalorieApp

Status: IMPLEMENTED / TESTED / PROTECTED

## Current food authorization state

Food log access and mutation are restricted by user ownership and authenticated session validation.

Status: IMPLEMENTED / TESTED / PROTECTED

## Current testing baseline

The app has a working backend test baseline in the local workspace.

Verified: the local pytest suite passes for the backend tests currently in the repo.

Status: TESTED

## Local development topology

Verified local topology:
- frontend: localhost:3000
- backend: 127.0.0.1:8000
- development DB: local SQLite

Status: VERIFIED / LOCAL

## Staging status

Staging is conceptually planned but not currently proven to be live.

Planned topology:
- staging-app.calorietoken.net
- staging-api.calorietoken.net
- staging-wp.calorietoken.net

Status: PROPOSED / PLANNED / REQUIRES EXTERNAL VERIFICATION

## External infrastructure status

Historical but not proven live from repo evidence:
- Render was part of the project’s real operational/deployment discussion.
- Plesk was part of the project’s real hosting/WordPress discussion.
- WordPress is part of the intended external identity bridge architecture.
- Xaman/XUMM is the external wallet/identity boundary.

These should be classified as:
- UNKNOWN / HISTORICAL / REQUIRES EXTERNAL VERIFICATION

Do not assume Render, Plesk, WordPress, DNS, TLS, or Xaman staging infrastructure is currently live unless direct repository evidence proves it.

## Protected architecture

The following architecture is protected from casual redesign:
- opaque server-side sessions
- HttpOnly session cookie
- server-side session storage
- pending-state validation
- replay protection
- food owner authorization
- non-custodial Xaman boundary
- no wallet custody in CalorieApp

## Current major phase/checkpoint

The current phase is a continuity/governance checkpoint focused on preserving the architecture and deferring external deployment work until actual infrastructure status is proven.

## Dirty-worktree principle

The repo may contain working-tree changes, generated artifacts, and documentation/audit material unrelated to app implementation. Those are not a reason to reopen protected runtime/security files.

Use explicit allowlists and read-only investigation before making any work beyond the current governance scope.

## Historical infrastructure disposition

Render: HISTORICAL / NEEDS EXTERNAL VERIFICATION
Plesk: HISTORICAL / NEEDS EXTERNAL VERIFICATION
WordPress: IMPLEMENTED AT ARCHITECTURE CONTRACT LEVEL / EXTERNAL HOST STATUS UNKNOWN
Xaman/XUMM: IMPLEMENTED AS EXTERNAL IDENTITY BOUNDARY / LIVE STATUS UNKNOWN

## Deployment status summary

- Local app implementation: VERIFIED / IMPLEMENTED / TESTED
- External hosted deployment state: UNKNOWN
- Staging deployment state: PROPOSED / PLANNED / NOT CURRENTLY PROVEN
- Security architecture: PROTECTED / IMPLEMENTED / TESTED
