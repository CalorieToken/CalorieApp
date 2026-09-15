# CalorieHelp: align the guide with the food experience

Updated 15 September 2026. The proposed wording below targets application
commit `ac724aabf1534e51e819ef5d84df04f246eeea23`. This document is a content
review candidate, not an announcement that the new Help data is installed.

## What the guide must explain

CalorieApp food search and food logging do not require buying CAL. Use the
section controls for product search, basic foods with USDA, or the diary.
Check a chosen food's own source, preparation and portion before saving.

For USDA, select the exact record, enter edible grams and review the calculated
values in the same section. Saving still requires sign-in and an explicit
confirmation. There is no second percentage step. Changing the record or gram
amount requires reviewing the updated values again. The original USDA food
descriptions remain English; the surrounding help and application controls use
the same eleven locales: en, nl, zh-Hans, hi, es, ar, fr, bn, pt, id and ur.

The selected-period diary overview counts entries by source-provided A-E grades
and shows missing grades separately. It is not an average grade, a health
assessment of a day, or a portion-weighted nutrition score. Changing a portion
changes nutrient quantities, not the source grade. USDA records must not receive
an invented grade.

Comparable foods can differ in ingredients, allergens and preparation. The
comparison guide must invite inspection of their own data, not describe the
suggestions as medical or dietetic advice. Choosing a result is not a diary save.

## Preserve existing Help behavior

Keep the original CalorieHelp character, source links and other topics. The
prepared change is limited to each locale's app explanation, app steps and USDA
steps: 33 target fields across 11 locales. Use an exact-value guarded patch
against the actual current Help data; stop rather than overwrite changed text.
The repository's old full plugin is not a current installation package.

CalorieHelp uses fixed replies linked to public project sources. Questions are
processed in the page and then cleared; this is not a support-ticket service or
a retained chat history. Device or keyboard dictation is handled separately by
that provider. These descriptions do not imply a new AI support backend.

Project history distinguishes CAL on the XRP Ledger since 2021, earlier Testnet
and mobile experiments, current food functions and future ecosystem ambitions.
A roadmap item is not evidence that the planned service is available.

## Observed WordPress state and draft boundary

Authenticated site reads on 15 September returned Site Style 1.4.46 and Identity
Bridge 0.3.29. The publicly served Help data still used the earlier USDA step
that opened the ordinary portion flow. Do not claim the candidate wording is
already live merely because the source file or this documentation was saved.

A separate WordPress draft, page 8073, now contains the grade-count explanation
and updated USDA confirmation wording in all eleven locales. It is an internal
review addendum, not a replacement of the existing showcase drafts or public
Brizy pages, and not a live plugin-file update. Reading pages and creating a
draft do not establish access to server-side plugin files.

The present WPVibe connection can use the standard WordPress REST API. The
WPVibe companion-plugin route required for plugin-file/CLI operations was not
available. Repeatedly reauthorizing the working site connection does not solve
that separate missing route. Keep server-file installation pending until a
supported, authorized update path is available.

## Evidence and outstanding checks

The application evidence belongs to exact-source workflow run `35006320526`
and its synthetic API/diary browser report, not the live site. The report has
56 passing assertions, including eleven-language switching and overflow checks
at 360, 412 and 1440 pixels. This does not establish native-speaker review,
physical-camera behavior, real-wallet acceptance, or full-site visual acceptance.

The earlier Site Style 1.4.46 release used four targeted file updates from the
live 1.4.43 baseline and retained the character, focus behavior and existing
help topics. That historical check is retained; it does not certify the newer
wording or every page layout. Keep the complete current plugin as the baseline,
not an older repository snapshot.

Before release, coordinate the actual app deployment, Help update, website
explanations and applicable legal/source disclosures. Keep the whole review
freely browsable without item-by-item approval forms. Only the owner's later
explicit overall approval authorizes campaign scheduling or publication.

- [Open CalorieApp](https://calorietoken.net/calorieapp/)
- [Food discovery and source details](food-discovery-2026-09.md)
- [Public project publications](https://github.com/CalorieToken/Publications)
