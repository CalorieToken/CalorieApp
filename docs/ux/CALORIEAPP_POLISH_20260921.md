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

The food-search refinement touches six runtime files. The account follow-up below
adds six more presentation files, including its translated guidance. No backend,
dependencies, authentication protocol, wallet operations, WordPress or CalorieVerse
implementation changes are included.

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

## Clarity follow-up

The owner found the original example unclear and could not see the Open Food
Facts improvements. Rename the two existing search tabs to “Products & barcodes”
and “Ingredients by weight”, with matching translations in all eleven locales.
Clarify the product-search introduction: search a branded product, type a barcode
or scan its package; data comes from Open Food Facts. Search behavior is unchanged.

Replace the standalone review HTML with a “Nu” / “Voorstel” comparison using
the actual baseline and candidate search components. Both views start with
Open Food Facts-style product examples and retain four visible navigation tabs.
The fixture uses clearly labelled example product data and a public USDA snapshot;
account and diary panels explain retained functionality without accessing user
data. It does not make network calls or save food entries. It is a review fixture,
not a full application or a claim that account/scanner workflows were exercised.

Both fixture variants passed DOM checks for rendering, four tabs, opening product
details and navigation. The candidate labels and search-keyboard hint were also
checked. Browser visual acceptance is still pending as described above.

## Account guidance follow-up

The owner approved improving the account entry and Xaman setup guidance.

- Offer three clear paths: browse food without signing in, begin guided practice
  setup, or use the existing Xaman login action. The actual login/logout controls,
  handlers, bridge checks and retry conditions are reused unchanged.
- Fold account settings, profile, privacy and migration routes under a native
  keyboard-accessible “More account options” disclosure. The signed-in nickname
  remains in the existing account header. Existing export/import entry events
  still open the requested account tool.
- Start with the official Xaman download link and explain returning to the same
  browser tab. No test account is created by opening this guidance.
- Divide the existing network and import stages into three smaller instructions
  each. Keep the six outer stages and saved navigation schema unchanged. Only
  instruction position is added in memory; it never stores recovery material.
- Use “recovery code” in the save title and explain Xaman's “Family Seed” term.
  Existing save/import confirmations, cancellation warning, hidden secret behavior
  and session cleanup remain enforced.
- Provide the new copy in all eleven locales; keep Xaman's literal menu labels
  recognizable. The guide uses numbered visual cues and the official illustrated
  help link. It does not claim to reproduce Xaman screenshots.

Sources checked on 21 September 2026: https://xaman.app/download and
https://help.xaman.app/app/learning-more-about-xaman/how-to-access-testnet-on-xrp-ledger.
This is presentation guidance, not an automatic Xaman configuration change or a
wallet-free diary implementation. Age restrictions remain unchanged.

Final verification: production build passed with the same two existing lint
warnings; 129 targeted tests passed. Added interaction checks exercise browsing
without account creation, installation before creation, nested instructions/back,
concealed recovery code, and mandatory save/import acknowledgements. A pre-existing
workspace test fixture also lacked three existing dependencies; its two failures
were reproduced on the unmodified baseline before repairing that fixture.

The updated offline comparison opens at Account and renders the real baseline and
candidate guide components. Its account overview is explicitly simplified, and its
test-account service returns conspicuously invalid example credentials. It cannot
create a real account, log in or save food. Both versions passed DOM checks for
the simulated setup, recovery checkpoint, food details and navigation. Candidate
visual/mobile acceptance and real-device Xaman setup remain release checks.
