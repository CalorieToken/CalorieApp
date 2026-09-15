# Food usability review - 15 September 2026

Status: integrated on the isolated review branch, not deployed. This is development documentation, not a public release announcement or acceptance of the wider website/campaign work.

## What changes for users

- The diary shows counts of source-supplied A-E product grades, the number of graded entries, and missing grades for the selected period. It no longer averages letter grades into a daily nutrition rating. The display is not weighted by portion size. It describes the recorded products, not the nutritional adequacy of a person's day.
- A product with no source-supplied grade explicitly displays that the grade is unavailable. A USDA grade is never invented. Changing grams or a portion changes nutrient amounts, not the product's supplied letter.
- USDA selection, gram entry, nutrition review and explicit diary confirmation stay together. Results collapse after selection and remain accessible. Gram-scaled entries do not get a second percentage selector. Editing the selected food or amount clears stale confirmation. Success and failure messages stay by the selection, and changing interface language preserves the numerical meaning of the amount.
- Direct navigation leads to packaged-food search, USDA ingredients and the food diary. Repeated explanatory panels are reduced. New interface text covers the existing eleven locales; original source descriptions remain in their source language.

## Verified source integration

Application base: `873d622930a086591b4d7622f6b541cda0f9f697`, the unchanged head of PR #145 when checked. Review base `682d835236f4d3b3f2e0e59dffa6092f44d41f4e` contains the same application plus a read-only review workflow.

Integrated application commit: `52254d3785f65f5db95c88b5a3f3db22ee4cbb94`.

GitHub Actions run [34962089735](https://github.com/CalorieToken/CalorieApp/actions/runs/34962089735) applied the exact retained candidate only after checking the unchanged application base and patch SHA-256 `42c487d19e0d90f77c0c6d1e61468dad764b1eb69fa05332d4b7f60cec9df96c`. It then verified the SHA-256 of all nine resulting application/test files.

The complete existing Node test suite, standalone TypeScript check and complete Next production build passed on that candidate. The tested commit was fast-forwarded only to `review/usability-20260915`. The temporary transfer files and one-time integration workflow were removed in that commit. Authentication, backend, data schema, provider catalogue, branding assets, WordPress, production branches and hosting configuration are unchanged by this integration.

## Earlier browser evidence and its limits

The retained local candidate evidence contains 33 passing browser scenarios across eleven locales and widths of 360, 412 and 1440 pixels, plus five targeted error/amount/keyboard/portion scenarios. These used actual React components and application modules with a synthetic backend, storage and image adapter. They are not evidence of a signed-in production save, WordPress iframe behavior, a real Xaman session, hardware-camera behavior, a native-speaker language review or cross-browser certification. This integration did not repeat or relabel those earlier screenshots as new live captures.

## Next release checks

Use the existing authorized hosting service without changing its plan or cost ceiling. Before treating this candidate as live, verify its deployed build identity and the real website/app language synchronization, login/logout, iframe sizing/navigation, permitted test-account diary flow, source/network failures and mobile/desktop behavior. Do not overwrite the newer live WordPress installation with older repository plugin files. The separate heading-repair companion plugin is not certified installed by this change.

After actual product and website verification, update dependent help, documentation, legal copies and feature recordings, then finish the complete multilingual showcase/campaign review. Preserve one freely browsable overall review and one explicit overall publication approval; do not add per-item approval forms, schedule campaigns, publish catch-up posts, merge unrelated work or make financial transactions.
