# Food usability repair - integration candidate

Status: draft on `repair/food-ux-integration-20260915`, based on food-discovery source `873d622930a086591b4d7622f6b541cda0f9f697`. This is not a live deployment or a completed website/campaign release.

## Changes for users

The diary replaces the arithmetic mean of product-grade letters with source-provided A-E counts and explicit known/missing coverage for the full selected diary period. Missing grades are not adverse grades. This is neither a personal nutrition assessment nor a portion-weighted diet score. Individual product cards explicitly show unavailable source grades instead of hiding the indicator.

The USDA path is search, select the exact source record, enter edible grams, review the inline confirmation, explicitly add. Grams are already scaled; the confirmation does not ask for a second percentage. Editing invalidates stale confirmation. Search choices and source explanations remain available in disclosures. Language changes retain the food and numerical amount. All eleven existing interface locales are covered; official USDA food names remain in their original language.

The saved USDA diary card now shows actual grams instead of an unexplained 100 percent. For older USDA entries saved as a percentage, displayed grams respect that percentage without changing stored values or nutrient totals. Other products retain the existing percentage display. Existing Open Food Facts portion confirmation clarifies the reference amount rather than implying that 100 percent always means an entire package.

## Safety and verification

Frontend presentation and focused tests only. The five existing log mutation/selection handlers remain unchanged. Authentication, Identity Bridge, barcode scanning, backend APIs, database schema, provider catalogue, dependency lockfile and hosting plans are unchanged.

The first integrated source at `3296fd23982d4621eb5abb021ee64652821be016` passed the complete 286-test Node suite, TypeScript, Next production build and 55 browser assertions in run `34961390669`. Ten files matched the locally tested source byte-for-byte. A subsequent gram-label improvement adds a regression test (287 tests total) and browser assertion (56 total); the final branch workflow is authoritative for its result.

Browser screenshots are from the full production-built frontend with a synthetic backend and synthetic authentication-state event, not the live website or a real Xaman session. The check covers the real local USDA catalogue, exact FDC 168878 at 75 g, confirmation/cancellation, zero-gram validation, stale confirmation clearing, one POST after a double click, no double scaling, diary gram display, grade coverage, all eleven language changes, and horizontal overflow at 360, 412 and 1440 pixels. Other behaviors have regression coverage, not invented physical-device acceptance.

Temporary encoded transfer files and the write-enabled bootstrap were removed. The retained workflow has read-only repository permission, cannot commit or deploy, and fails explicitly on a failed browser report. No real diary write, WordPress installation, merge, Render deployment or campaign scheduling was performed.

## Still open before release

Passing tests is not full visual/linguistic acceptance. Grade-count labels now avoid noun inflection around numerals in all eleven locales, so counts such as 1 no longer produce a plural-label mismatch; native-speaker review of the complete interface remains advisable. Complete WordPress page/subpage checks, real authorized sign-in/save acceptance, physical-camera acceptance, coordinated CalorieHelp/legal-copy updates, controlled deployment and dependent campaign recordings remain separate work. Preserve the owner's one overall campaign-publication approval gate.
