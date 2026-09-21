# Small CalorieApp usability refinement — 21 September 2026

## Baseline and scope

Render's read-only deployment record identifies frontend deployment
`dep-dangecijnfac738ibsvg`, commit `e23f9d8896e1f0565be8e006b3e618defd686c87`,
as live. The review branch starts at that exact commit and targets
`release/step3-render-3845de6`. Do not merge unrelated `main`, WordPress or
CalorieVerse draft history into this change.

The owner's request is a small improvement to clarity and appearance, with
particular care to preserve existing behavior.

## Changes

- Keep the product-name/barcode label visible after entering a search. Use a
  16px input on narrow screens, a search keyboard hint and a visible keyboard
  focus ring on the existing submit button.
- Shorten the repeated product-details button to “Details & compare”, translated
  in all eleven existing locales. Preserve the full product-specific accessible
  name and the existing details/comparison controls.
- Display calorie values in the existing green brand color instead of low-contrast
  yellow on white. Keep the numbers and nutrient calculations unchanged.
- Give packaged-food content slightly more usable width on narrow screens.
- Highlight the selected USDA result and show a keyboard focus ring; use a search
  keyboard hint on its existing search field.

Five runtime files change. No hooks, requests, handlers, permissions, stored data,
backend, dependencies, login, wallet, WordPress or CalorieVerse implementation
changes are included.

## Verification

- Next.js production build passed, including type checking and lint. Two existing
  `TestnetEntry.tsx` effect-cleanup warnings remain outside this scope.
- 64 existing targeted tests passed:
  `food_logging_ui`, `food_navigation_consolidation`, `food_experience`,
  and `food_discovery` under `tools/tests/`.
- Before repairing the test harness, the unchanged live baseline and the candidate
  both produced the same 35 passes / 29 failures: the harness did not supply the
  existing `app-entry-copy.json` dependency. Two test-only lines now load that real
  catalogue. The application code was not altered to make those tests pass.
- The targeted suite covers search, portions, explicit saving, expired sessions,
  logout races, alternative-product return paths, USDA amounts and language changes.
- `git diff --check` passed.

The current live search UI was inspected in the existing signed-in WordPress
iframe. No live food log, account, consent or wallet action was submitted.

## Remaining release check

The candidate has NOT been visually verified in a browser. A standalone local
fixture was prepared, but Cloud Browser policy blocked its file URL. Do not
circumvent that restriction or label the fixture as a verified screenshot.

Before deploying, inspect the candidate in an allowed preview at mobile and desktop
widths, including long translated labels and RTL. Verify the visible search label,
submit/clear controls, details/comparison opening, USDA selection highlight, and
preserved navigation/portion state. Native iOS input behavior is not certified.

This is an isolated draft review checkpoint. No merge, live deployment or hosting
configuration change has been performed.
