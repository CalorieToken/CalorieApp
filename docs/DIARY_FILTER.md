# Loaded food-log filter — Step 3 preparation

Prepared on 2026-09-08 from app-main commit
`ddb75bd9548e4765a6137029b46cb0ac49d22bfc` (including the accepted food-serving
basis fix). This is one small addition within website/app Step 3, not a restart
of the completed foundation or identity integration.

## Behavior

Users can find already loaded private food-log entries by food name, brand or
barcode. Matching ignores case and common combining accents, and keeps leading
zeros in barcodes. Clearing the input or pressing Escape restores the list and
keeps keyboard focus in the input. The result count explicitly refers to loaded
entries. Existing summary totals still use all loaded entries.

Individual entry details and deletion retain the selected record and ID.
Delete All is disabled while a nonblank filter is active, with an explanation,
so a filtered view cannot suggest that a bulk deletion affects only visible
entries. Existing loading and deletion guards remain in place.

The new controls use the existing eleven-locale registry and locale precedence,
including right-to-left direction. Translations are prepared product copy;
automated completeness is not independent linguistic approval.

## Privacy, rights and cost

This is a presentation operation on data already loaded by the existing
authenticated diary. The filter does not make requests, write browser storage,
modify food records, calculate new health scores or transmit its query. The
existing parent clears private logs on logout and unmounts the list, discarding
the filter state. No source, provider, runtime dependency, database migration,
authentication change or recurring service cost is introduced.

The user need was informed by publicly documented food-finding patterns, such
as [YAZIO's diary search](https://help.yazio.com/hc/en-us/articles/6478854221713-How-does-the-Diary-search-bar-work).
Implementation and copy were written for CalorieApp; no competitor code, assets,
screenshots or database records were imported. Existing repository, data and
trade-mark notices remain applicable.

The technical change introduces no identified new recipient, retention period
or processing purpose beyond using the user's diary. The existing public
privacy notice still needs its release-stage factual check; this assessment
does not certify it. A feature change must not be used merely to advance a
policy date or imply that unpublished terms are already live.

## Verification and release status

- 17 food-logging, filter and search-deadline checks pass, including mutation
  targeting, clear/keyboard behavior, locales and removal of the list on logout.
- TypeScript checking and linting of both changed TypeScript files pass.
- The existing repository legal-boundary check passes.

The component tests use the existing bounded hook/JSX harness, not a full browser.
Mobile/desktop visual acceptance and current-candidate GitHub CI remain part of
Step 3. No push, merge, installation, live transaction or publication is included.
The feature can be removed as an isolated frontend change; it requires no data
rollback. The existing same-tab Xaman flow remains the regression baseline.
