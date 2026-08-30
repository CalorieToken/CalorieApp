# CalorieApp Identity Bridge contract v1

This directory is the repository source of truth for the first Identity Bridge
contract and the shared Gallery Token locale registry. Runtime copies are
generated for the backend, frontend and WordPress plugin because those three
artifacts are deployed and packaged independently.

## Frozen v1 boundaries

- WordPress owns the authenticated WordPress browser session.
- Xaman provides a server-verified proof; browser-supplied identity claims are
  never authoritative.
- The CalorieApp backend owns its opaque application session and private food
  log authorization.
- Login state, browser handoff and authorization codes are short-lived,
  single-use and replay protected.
- Origins and callback URLs are explicit allowlists. HTTPS is mandatory outside
  loopback-only local development.
- The v1 identity payload remains minimal. Optional names, email addresses,
  donation details or public profile fields require a separate consent and
  purpose contract before they may be added.

## Locale contract

English is the source and fallback locale. The registry contains the fixed set
of ten selected world languages plus Dutch. Arabic and Urdu are right-to-left.
All products must resolve unsupported or malformed locale input to English.

Run `python tools/sync_identity_contracts.py` after changing the canonical
registry. CI uses `--check` and rejects drift between the source and the three
runtime copies.

Localized external publishing remains a separate editorial workflow:
preview, review, explicit GO, scheduling and publishing. The locale registry
must not trigger automatic bulk posting.
