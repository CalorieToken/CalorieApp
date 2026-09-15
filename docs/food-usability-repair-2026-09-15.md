# Food usability repair - integration candidate

Status: draft on `repair/food-ux-integration-20260915`, based on the food-discovery source at `873d622930a086591b4d7622f6b541cda0f9f697`. This is not evidence of a live deployment or a completed website/campaign release.

## What changes for users

The diary no longer displays an arithmetic mean of product-grade letters as a period meter. Instead it displays counts for source-provided A-E grades and the number of entries with and without a grade. Coverage uses the full server-selected diary period, not only the entries currently loaded in the list. Missing grades do not represent an adverse grade. The distribution is neither a personal nutrition assessment nor a portion-weighted diet score. Individual product cards explicitly identify missing source grades rather than hiding the indicator.

The USDA path is now: search, select the exact source record, enter edible grams, review the inline confirmation, explicitly add. A USDA record is already scaled to those grams; the confirmation does not ask for an additional percentage. Editing the food or amount invalidates any stale confirmation. Search choices and source explanations remain available through disclosures. Language changes retain the selected food and numerical amount. The interface covers the existing eleven locales; official source food names are not automatically translated.

Existing Open Food Facts portion selection remains. Its confirmation clarifies the reference amount rather than implying that 100 percent necessarily means an entire package. No medical or dietary recommendation is introduced.

## Scope and safety

Frontend presentation and focused tests only. The five existing log mutation/selection handlers are retained unchanged. Authentication, Identity Bridge, barcode scanning, backend APIs, database schema, provider catalogue, dependency lockfile and hosting plans are unchanged. No real diary entry was created by these checks. No WordPress installation, merge, Render deployment or campaign scheduling is performed by this branch or its read-only workflow.

## Verification

The integrated source at `3296fd23982d4621eb5abb021ee64652821be016` passed the complete 286-test Node regression suite, full TypeScript check, Next production build and 55 browser assertions in GitHub Actions run `34961390669`. Ten source/test files were compared byte-for-byte with the locally tested files. The retained screenshots come from the full production-built frontend with a synthetic backend and synthetic authentication-state event. They are not live-site screenshots or acceptance of real Xaman authentication.

The browser check covers the actual local USDA catalogue, exact FDC 168878 at 75 g, confirmation/cancellation, zero-gram validation, stale confirmation clearing, no double scaling, one POST after a double click, missing-grade coverage, all eleven language changes and horizontal overflow at 360, 412 and 1440 pixels. It saves eleven USDA screenshots and Dutch diary/full-app views. Other existing behavior is covered by the regression suite, not by an invented claim that every behavior was exercised on a physical device.

The transfer bootstrap and temporary encoded transfer files were removed after verification. The retained workflow has read-only repository permission, does not write commits, and explicitly fails on a failed browser report. Later runs validate the final branch source again.

## Still open before release

Visual/linguistic polish is not exhausted by passing tests; for example singular/plural wording in grade counts can be improved and the retained log list still uses the existing percentage label. A complete WordPress page/subpage review, real authorized sign-in/save acceptance, physical-camera acceptance, coordinated CalorieHelp/legal-copy updates, approved deployment and dependent campaign recordings remain separate work. Preserve the owner's one overall campaign-publication approval gate.
