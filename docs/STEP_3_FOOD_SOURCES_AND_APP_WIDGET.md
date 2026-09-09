# Food sources, origin information and the CalorieApp website widget

Recorded: 2026-09-08. Status: minimal bundled USDA reference prepared on the app
branch; shared informational widget prepared in local plugin candidate 0.3.31.
Live USDA search/diary integration remains deferred.
No live provider adapter, catalog write, credential, migration or widget has
been enabled by this record. This supplements the existing project Step 3; completed
Steps 1 and 2 are not reopened.

## Operator request and recommendation

The operator wants useful complementary data alongside Open Food Facts (OFF)
and CalorieDB, particularly origin information, and a CalorieApp information
widget throughout the WordPress website before showcases in project Step 4.
The food-source expansion is explicitly conditional: little work and credit
use, no additional service spending, and preservation of the accepted app and
joint same-tab login/logout. The project can proceed without an extra source.

Dependency order, clarified after the operator's sequencing question:

1. Resolve the optional extra-source scope against the accepted app before
   finalizing source-dependent website copy and integration. The bounded USDA
   check below is complete. A later operator request selects the minimal bundled
   reference described below; full live integration remains deferred.
2. Assess the optional OFF origin/source display and finish only selected small
   app changes. Check their existing WordPress embed and joint login/logout
   compatibility. This is an additive check of completed Steps 1/2, not a restart.
3. Finish the shared website presentation, including the lightweight CalorieApp
   widget, against the actual app behavior. The widget can describe existing
   search/logging and does not need USDA or a new authenticated data endpoint.
4. Run the integrated acceptance once on the assembled candidate, alongside
   the remaining five-point Step 3 repair plan and controlled release process.

A second adapter is technically plausible, but inspection does not establish
that a complete integration is trivial. Zero regression risk cannot be
promised. Isolation, focused acceptance and rollback must establish whether the
small scope is acceptable before activation. No precise time or credit estimate
has been established.

## Source assessment

The decisions below are project recommendations, based on official material
checked on the recorded date; they are not general legal clearance.

| Candidate | Confirmed access and value | Decision for this request |
| --- | --- | --- |
| OFF, existing adapter | The API, source attribution and separate database/content/image licence boundaries already underpin the app. Current official documentation describes evolving API schemas. [API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/). | First inspect the available origin fields on the existing search route. Preserve the current transport and nutrition behavior; do not bundle an API migration. |
| USDA FoodData Central | Public-domain/CC0 data and a documented API requiring a key. Default allowance is 1,000 requests/hour/IP; the demonstration key is limited to 30/hour and 50/day. [API guide](https://fdc.nal.usda.gov/api-guide/). Foundation Foods covers minimally processed foods with analytical data; Branded Foods draws on manufacturers' labels, so the whole database must not be called laboratory-verified. [Data types](https://fdc.nal.usda.gov/data-documentation/). | A three-food bundled reference is prepared following the operator's narrower launch request. Full live search/logging remains deferred. It is not a verified replacement for a missing Dutch branded product. |
| RIVM NEVO | Version 2025/9.0 is free to download. Terms retain RIVM rights, require original data to remain unchanged and source/version attribution, and prohibit charging end users for NEVO use. Additions must be distinguishable. [Download](https://www.rivm.nl/nederlands-voedingsstoffenbestand/gebruik-nevo-online/download-bestand), [terms](https://www.rivm.nl/sites/default/files/2025-11/Voorwaarden-voor-gebruik-NEVO-online-2025-databestand.pdf). | Useful Dutch candidate later. This confirms a dataset download, not a keyless integration API or an unrestricted open licence. Import, updates and combined-output terms add work. |
| OpenNutrition Foods | A downloadable TSV dataset under ODbL plus a modified contents licence, including OFF data with retained attribution. Its provider describes AI-enhanced data. [Download and terms summary](https://www.opennutrition.app/download), [provider description](https://www.opennutrition.app/). | Defer: additional provenance/licence/quality work and overlap with OFF. The reviewed pages do not establish a free hosted production API. Estimates must not become verified facts. |
| DTU Frida / Danish Food Composition Database | DTU lists a newer Danish Food Composition Database 6.1 dataset. The full current record and reuse terms could not be inspected in this assessment. [Official dataset listing](https://data.dtu.dk/articles/dataset/The_Danish_Food_Composition_Database_version_6_1/32312844). | Keep as a reserve candidate. Do not rely on an older Frida licence claim for a newer release or select it before checking current terms and format. |

Yuka, BuyOrNot, Goby AI, Mijn Eetmeter, Nutrola, MyFitnessPal, Yazio and Lifesum
are not admitted as sources based on the pasted consumer-app comparison.
A free app, or its reuse of OFF, does not establish permission or a supported
API for CalorieApp to reuse its database. This is not a claim that none could
ever offer an integration. No suitable integration agreement was established
for them here. OFF Prices and fitness databases also do not directly resolve
the requested origin or complementary basic-food requirement.

## Meaning and limits of origin

Working interpretation of the operator's word "origine": geographical origin
of the food or ingredients. Data provenance is recorded separately.

| Information | Intended presentation |
| --- | --- |
| Origin of ingredients | A provider-reported country/region, only when explicitly supplied; preserve which ingredient or product the claim describes. |
| Manufacturing or packing location | Its own labelled field; never substitute it for ingredient origin. |
| Countries of sale | Availability information, not an origin claim. |
| Source of the information | OFF, USDA or a reviewed CalorieDB record, with the source identifier/link and relevant version or retrieval time. |
| Missing or conflicting information | "Origin not supplied" or separately attributed claims; no inferred country or invented certainty. |

GS1 explicitly says a barcode prefix does not establish manufacturing origin.
Do not infer origin from a barcode prefix, brand headquarters or the country
operating a nutrition database. [GS1 explanation](https://support.gs1.org/support/solutions/articles/43000734188-does-the-gs1-prefix-first-3-or-4-digits-of-the-ean-13-barcode-number-show-the-country-of-origin-).

No reviewed source in this assessment establishes complete product/lot-level
traceability. A future producer-supported origin record would need evidence
for that product or lot, lawful reuse and review. It is outside this small
extension and does not require an XRPL transaction.

## Actual implementation implications

Initial inspection used maintenance-branch commit `54c86d7`. The bounded check
below inspected the app worktree at `4571506`, based on app-main commit
`ddb75bd9548e4765a6137029b46cb0ac49d22bfc`, including the serving-basis fix.
It does not verify the deployed app. Keep implementation based on accepted app
source; do not merge the website maintenance history into app main.

- `backend/app/main.py` sends `/search-food` directly to the OFF service.
  `backend/app/services/open_food_facts.py` selects a small field list that
  does not include origin. It already has request admission and shared rate
  controls; these must retain their existing behavior and limits.
- `FoodSearchResult`, `frontend/components/foodTypes.ts` and the frontend
  normalizer currently carry nutrition/product fields without source identity
  or origin. A useful source display therefore needs mapping and UI changes;
  the source-neutral database alone does not deliver it.
- `backend/app/models.py` defines `FoodLogDB` without a provider or external
  source-record identifier. Keeping a second source attributable after logging
  may therefore require history-schema and portability work. That is a concrete
  reason not to promise a complete second-source integration as a quick change.
- The internal catalog preserves source assertions, but public catalog reads,
  OFF persistence and second-source activation remain disabled. Its current
  assertion policy allows specified numeric nutrition facts, not arbitrary
  geographical text. Do not squeeze origin into nutrition assertions or enable
  catalog ingest to make this small display feature work.
- The WordPress plugin already contains page shortcuts and presentation hooks.
  Reuse a shared presentation location for the widget while avoiding the known
  footer/widget overlap. An XPMarket price card or shortcut alone does not meet
  the request for CalorieApp information.

For OFF, examine candidate origin/manufacturing/sale-country fields against the
actual existing response and current documentation before selecting a mapping.
The official schema change log records changes to tags and nutrition structures;
this assessment has not verified live origin-field coverage for CalorieApp's
queries. [OFF schema changes](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-api-and-product-schema-change-log/).

The small OFF slice must remain optional display data, without additional
upstream calls or changes to existing log records. Preserve unknown values and
render provider text safely. Persistent origin history would be separate work.

For a second source, the smallest honest candidate is an explicitly selected
basic-food search alongside the existing packaged-product search. Keep results
attributed and use one selected record's values. Do not fill a branded product's
missing nutrients from a similarly named generic food or blend conflicting
records. No source needs to be fetched until its search is requested.

Before considering this candidate small enough, prove source/external-ID
handling through selection and logging; existing records must still work.
Check raw versus cooked foods, nutrient definitions as well as units, per-100g
versus portion bases, unknown versus measured zero and deterministic rounding.
Do not add a micronutrient dashboard, automatic food matching, bulk import,
paid translation service or AI estimation to this slice. Apply the existing
eleven-language UI contract and disclose provider-language search limitations.

Any source key belongs server-side. Reuse the existing stack with a reviewed
per-provider request budget, bounded timeout, no retry amplification and a
small bounded cache only if needed. Do not send wallet/session identifiers or
private diary content to a food provider. Provider failure must leave OFF and
CalorieDB usable. Source licences and attribution must remain intact in the
actual display/export design; technical separation is not a licence exemption.

## Bounded USDA check and decision — 2026-09-08

**Decision: technically feasible, deferred for the current small extension.**
The operator already allows proceeding without an extra source when it would
take more work or affect the accepted baseline. This check closes the initial
FS-2 feasibility action; it does not count USDA as delivered or remove it from
the later candidate list. No provider was activated and no application code,
database, credential or public notice was changed in this check.

One read-only GET to the documented FoodData Central `/foods/search` endpoint
used the public `DEMO_KEY`, the generic query `oats`, `dataType=Foundation` and
`pageSize=2`. It began at 2026-09-08 15:14:55 UTC, used a 20-second timeout and
no retry, and returned HTTP 200 with four total matches and two returned foods.
The request contained no user food history, wallet or session data. It proves
sample API reachability from this environment, not production availability,
load capacity, full data coverage or an end-to-end app integration.

Selected observed response fields, retained for reproducible mapping review:

| FDC ID | Returned description | Serving size / unit | Returned energy fields |
| --- | --- | --- | --- |
| `2261421` | Flour, oat, whole grain | Both absent | Nutrient `2047`: 389 KCAL; `2048`: 386 KCAL |
| `2257046` | Oat milk, unsweetened, plain, refrigerated | Both absent | Nutrient `2047`: 48.3 KCAL; `2048` absent |

Both records returned protein (`1003`), fat (`1004`) and carbohydrate by
difference (`1005`) in grams. Neither returned energy under nutrient `1008`.
These are raw search-response observations, not a selected serving or a claim
about a particular packaged product. The two energy definitions are documented
by USDA; a future adapter needs an explicit selection rule and reference basis.
Do not sum the energy fields, treat a missing field as zero, infer a serving
volume from the food name, or silently equate all carbohydrate definitions.
[USDA FAQ](https://fdc.nal.usda.gov/faq/).

The integration cost comes from the actual application contracts:

| Boundary inspected | Finding and implication |
| --- | --- |
| Search and selection | `/search-food` calls OFF directly. `FoodSearchResult`, `foodTypes.ts` and `normalizeFoodItem` have no source/external-record fields; the explicit normalizer would discard them. A source picker alone does not preserve attribution. |
| Private logging | `FoodLogCreate`, `/log-food`, `FoodLogDB` and `FoodLog` retain a fixed set of product/nutrition fields without provider identity. Preserving an FDC reference through save and reload needs a reviewed persistence/API extension; overloading a barcode, brand or product name is not the intended model. |
| Portability | `account_data_import.py` validates an exact field set and constructs `PlannedFoodLogImport` explicitly. Its `source_record_id` is an exported private diary row ID, not an FDC record ID. Export/import compatibility needs explicit version handling if new provenance fields are retained. |
| Existing food behavior | The accepted OFF fix retains one complete serving/reference basis and excludes missing nutrition. Preserve it. USDA requires its own mapping, unknown-value handling and clear reference basis before existing percentage controls can safely operate on a selected record. |
| Request budget | The existing rate governor accepts a provider key and can be reused, but the current route initializes OFF controls. USDA still needs separate configuration, a server-side key, timeouts and failure isolation; it must not consume OFF's allowance or fan out every query. |
| Catalog and identity | The internal source-neutral catalog can represent another provider. It does not supply the missing diary provenance path. No core catalog rewrite or Xaman/Identity Bridge change is justified by adding USDA. |

These findings support deferral without estimating speculative development
hours or creating a partial production adapter. A lookup-only panel would not
fulfil a source that users can select, log and later identify. Existing app and
website improvements can continue without depending on such a panel.

Legal and copy outcome: USDA's API guide confirms public-domain/CC0 data and
asks for source acknowledgement; it does not impose a mandatory CC-BY-style
attribution licence. Persistent provenance here is a project quality and source
architecture requirement. No reuse prohibition was established as the reason
for deferral. Recheck actual provider traffic, attribution, origin wording and
privacy text before a later activation; do not claim USDA is already available
in the widget, source registry, published notices or marketing.
[USDA API guide](https://fdc.nal.usda.gov/api-guide/).

## Follow-up: minimal USDA launch reference — 2026-09-08

The operator subsequently requested the smallest useful USDA addition to show
a second data source at launch, with attribution comparable to OFF. The chosen
scope is three real, dated Foundation Foods bundled with the app: mature raw
carrots, whole-grain oat flour and unsweetened refrigerated oat drink. This is
a narrower addition than the live, loggable integration assessed above.

`UsdaReferenceFoods.tsx` on app branch `feat/step3-diary-filter` adds a native
disclosure beside the existing app search/diary. It displays source-defined
nutrition per 100 g, FDC IDs, USDA search links, retrieval date and CC0 links.
USDA attribution also appears alongside OFF in the app footer. The new copy
covers eleven locales; provider names remain explicitly English. App-branch
`docs/USDA_REFERENCE.md` records the mapping and verification.

Prepared app commit: `d38aff2`, following the isolated diary-filter commit
`4571506`. All three bundled records match their inspected USDA fields;
21 food UI/search-deadline tests, TypeScript, lint, the optimized Next.js build
and the legal/whitespace checks pass locally. This is not browser or live
installation evidence.

The bundled records require no runtime API key, provider traffic, backend
change, database migration, new dependency, account state or automatic update.
They do not enter OFF results, private logs, totals or export/import. The UI
states that this is a small reference selection separate from the diary; launch
copy must keep that limitation. This prepares a working second-source display,
not full USDA search, origin tracking or USDA diary integration.

Source/data, trade-mark and privacy alignment records accompany the app change.
The previous full-integration deferral stands; it does not prohibit the smaller
scope now requested by the operator. This preparation is local and still joins
the normal Step 3 review, browser acceptance and controlled release.

## WordPress widget scope

Implementation checkpoint: the shared `PageEnding` renderer now contains the
informational component in candidate 0.3.31, with the existing CalorieApp SVG,
the verified site app route and public page-locale copy in
`config/app-information.json`. It covers ordinary public page types, including
archive/search and preview HTML, and excludes admin/feed/embed/AJAX/REST output.
The app page shows a contextual label instead of reloading itself. No account
data, extra app/provider call or second iframe is part of this component.
Local behavior/package checks passed; PHP execution and rendered acceptance of
this candidate remain open. See `STEP_3_PRESENTATION_RELEASE.md` for the exact
limitations. This is prepared code, not an installed website feature.

The later shared-language requirement is LANG-1 in
`STEP_3_REPAIR_CHECKPOINT.md`: a selection made in the website account widget
or in CalorieApp must update both products. The static page-locale copy above
did not implement that behavior. The 0.3.32 development preview now connects
this component to the separate display preference; both switches default off.
Complete CMS/app/legal translation and integrated acceptance remain open.

Prepare one reusable component with the CalorieApp identity, a short accurate
description of food search/logging and a working "Open CalorieApp" destination.
Any more specific search or diary shortcut must use an existing verified route
or action. Do not invent deep links. On the app page, avoid a duplicate embed.

Include every public website page type in placement acceptance: home, usecases,
articles, informational/legal pages and donation/shop flows. Also inspect
off-menu pages and draft previews without publishing drafts. Admin screens,
feeds and the app iframe are not website-widget targets. Record any necessary
placement exception for review instead of silently omitting pages.

Use the historical typography, artwork, colors and button shapes. Prefer a
compact block in normal page flow with one shared definition. Avoid another
floating panel that can cover team members, consent controls or checkout.
Support mobile widths, keyboard focus, zoom and the existing language contract.

The first widget adds no app iframe, backend wake-up request, polling,
third-party data call, tracker, cookie or new sign-in process on ordinary page
views. It remains useful to visitors who are signed out. Personal calorie
totals, food logs and wallet details are outside the initial widget scope;
placing them in shared WordPress caches would require additional privacy work.
Existing identity/session behavior remains the accepted baseline.

## Completion before project Step 4

| Item | Present status | Required close-out |
| --- | --- | --- |
| FS-1: OFF origin/source display | Preferred small candidate; not implemented or verified with live product coverage | Bounded mapping proof, safe missing/conflicting-data display, baseline acceptance; otherwise a documented scope decision. |
| FS-2: one additional source | Three-food USDA reference prepared locally under the narrower operator request; full live search/logging deferred | Include the tested reference and source/CC0 attribution in app review and shared browser acceptance. Describe the limited selection accurately before launch; no source or logging activation is implied. |
| WI-1: sitewide CalorieApp widget | Implemented locally in plugin candidate 0.3.31; not installed or visually accepted | Finish PHP/CI and page-inventory/responsive acceptance, verify preserved login/logout and no extra provider traffic from the informational component. |
| ST-3: related integration work | Required for any selected slice | Verify search, portions, add/read/delete log behavior, existing history and same-tab joint login/logout; check languages, consent, page layout and rollback on the exact candidate. |

Recommended small-scope cutoff: defer the optional food-source expansion if it
needs an auth change, database migration, substantial refactor, new hosting,
paid service, unclear reuse rights, broad translation/data-cleaning work or
altered existing nutrition semantics. This is an implementation recommendation
for the operator's effort constraint, not a new global project policy. Start
any later source pilot disabled and make it independently removable. A lookup-
only experiment must be labelled as such; it is not a completed loggable source
integration, and no placeholder is counted as working delivery.

Close these items explicitly before Step 4. If the food expansion fails the
small-scope condition, record the evidence and the operator's stated option to
proceed without it; do not silently count it as delivered or turn it into an
unlimited release blocker. The website widget remains requested work unless its
scope is separately adjusted. Other Step 3 requirements remain on the existing
repair checkpoint. Existing source/release gates are not changed by this note.


## Origin feasibility decision — 2026-09-09

Inspected app candidate `80ba6ffac7991e4e9aa0c1612789c2cadba47566` without edits.
`backend/app/services/open_food_facts.py` requests only product/name/code/images,
brands, serving size, Nutri-Score and nutrients; `_normalize_products` does not
retain origin. `FoodSearchResult` and the frontend search normalization/type do
not carry origin either. A reliable attributed origin display therefore needs
provider-field, normalization, API and UI changes plus regression checks; it is
not a text-only website addition. Origin persistence in diary/history would be
additional work. No source schema, nutritional values, request budget, cache,
diary or authentication behavior was changed in this assessment.

Decision within the operator's explicit conditional request: defer origin
implementation while closing Step 3. Keep the three-food USDA reference already
prepared, accurately labelled as a reference rather than live generic search.
Do not pretend this closes farm/lot traceability; retain that as later work.
This is an engineering scope decision, not a finding that OFF has no origin data
or that future integration is technically impossible.
