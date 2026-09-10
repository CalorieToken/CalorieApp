# Step 3: small app integration, 10 September 2026

Operator request: finish the prepared Step 3 work, support an easy Testnet guide,
retain Steps 1 and 2 and the future pilot boundary, and handle passing GitHub PRs.

Base **commit**: `ddb75bd9548e4765a6137029b46cb0ac49d22bfc` (PR #135).
This is a commit SHA, not a tree SHA. Preparation reused from commit `80ba6ff`.

## Included

- Enable the prepared eleven-language display controls by default. The website
  companion is Site Style 1.4.0. Both use the same versioned display-only protocol,
  exact origins and iframe identity, with stale-message and replay protections.
  `NEXT_PUBLIC_CALORIEAPP_DISPLAY_LANGUAGE=0` explicitly disables the app control.
  The language notice explains the 30-day browser preference. Some existing login
  messages and external content remain English; this is not a whole-site translation claim.
- Reuse the prepared diary filter and USDA reference sample: three dated foods,
  per 100 g edible portion, visible source and CC0 attribution. No USDA credentials,
  runtime USDA calls, bulk import or new database. See `USDA_REFERENCE.md`.
- Show recorded product Nutri-Score counts instead of inventing an average letter.
  The serving calculation fixed in PR #135 is preserved.
- Provide a translated, optional link from CalorieApp to the website Testnet guide.
  A verified host capability allows scrolling to that guide without reloading the
  page. The messages carry no address, key, authentication or pilot role.

## Preserved boundaries

`XamanLoginPanel.tsx`, authentication callbacks, backend and WordPress Identity
Bridge are unchanged from the base. Account export/import/erasure retain their
existing request locale, session, confirmation and abort behavior; only their
display language is connected. No existing account is reset, copied or migrated.

### Existing dependency issue found by required CI

The first CI run failed its unchanged production dependency audit because the
base used Next.js 14.2.35. The current critical AVIF and Windows advisories list
15.5.24 as the first patched maintenance version. This release pins Next 15.5.25,
keeps React 18.3.1 and the existing rendering design, and awaits the route
parameter promise required by Next 15. The proxy's endpoints, request forwarding,
timeouts, cookies and response headers are preserved. PostCSS is pinned to
8.5.23, including the nested copy, to close the remaining dependency findings.
The security gate is not lowered, skipped or replaced with an exception.

Sources: [Next.js AVIF advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4),
[Next.js upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15),
[PostCSS advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).

Creating or funding a Testnet address is not proof of wallet ownership. Only the
existing explicit Xaman sign-in may establish an app session. The test guide does
not bind the faucet address to a production user, set a retailer role, register a
pilot participant or distribute test CAL. Future pilot access still requires its
own server-verified identity, network and retailer-membership checks. Public food
search remains available without a wallet. Test XRP has no monetary value.

## Review and release

AI-assisted implementation at the operator's explicit request, including safe
GitHub handling. Automated checks and implementation review are not represented
as independent human review. The four existing protected-branch checks remain
required; no protection is changed or bypassed. Old PR stacks are not included.

The companion plugin can be installed separately; a plugin upload alone cannot
deploy this Render frontend. A release checkpoint must record the actual PR,
merge and deployment state, plus the remaining user test in Xaman on a real phone.
