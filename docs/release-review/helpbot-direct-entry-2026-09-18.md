# CalorieHelp direct entry — 18 September 2026

The owner requested that the helpbot start the current six-step test setup
immediately, then expanded the scope to food search, scanning, comparisons,
and useful account actions. Entry is navigation only.

## Implementation

- Native app accepts nine fixed destinations: test-account, move-account,
  account, account-export, food-search, food-scan, food-compare, basic-foods,
  and food-diary. Standalone fragments and a strictly checked parent handshake
  use the same destination set. The legacy ctstyle-testnet fragment remains valid.
- Parent origin and window source are checked. Requests have exactly four fields
  and an idempotency ID; delayed readiness must not restart an in-progress guide.
- The existing age selection remains required. Personal destinations wait for
  adult access; camera startup, account creation, authentication and export
  still require their own explicit controls.
- The scanner disclosure opens without camera permission. Comparison opens the
  product search with instructions to choose a product and open its comparison.
- WordPress help answers have localized task buttons. Account topics include
  My account, test setup, the native migration guide and export settings.
- Heading Repair source is synchronized with the owner's already installed
  1.6.15 before the entry changes, preserving contact/showcase/card fixes.
  The old WordPress guide markup is no longer created. No new plugin is needed.

## Verification

Production build and TypeScript validation passed. The focused 36-test suite
passed: native guide state and age waiting, all task tabs, strict host protocol,
repeated-message handling, WordPress links and retired guide removal, existing
camera lifecycle and food navigation checks. Browser checks follow rollout.

## Deployment continuity

Base frontend: 905cba09d389da9069015fba81d398937f74c33f.
Use release/step3-render-3845de6, never the older main branch or unrelated PRs.
Deploy only existing frontend srv-da356k0u01pc73ftva8g; auto deploy is disabled.
No backend, environment, infrastructure, pricing or campaign changes.
WordPress baseline is Heading Repair 1.6.15; the replacement is 1.6.16.
Prefer the connected WPVibe update; owner does not want manual uploads.
After installation remove only the temporary Additional CSS block named
CalorieApp current account guide 2026-09-18 v1 (post 7013).
