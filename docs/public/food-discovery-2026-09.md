# Food discovery: the current review candidate

Updated 15 September 2026. This guide describes application source
`ac724aabf1534e51e819ef5d84df04f246eeea23`, on
`repair/food-ux-integration-20260915` (PR #146). It is not a statement that this
candidate has been deployed. Earlier deployment notes are retained below as
history, not as proof of the present production version.

## Find a food, check the source, then decide

The three section controls lead to packaged-product search, basic foods with
USDA, and the diary. Navigation itself does not save food. Open Food Facts keeps
its name/barcode search and existing portion confirmation. The USDA catalogue
remains a separate source, not an unlabelled extension of the product results.

USDA offers a dated selection of 8,156 records: 363 Foundation records from
April 2026 and 7,793 SR Legacy records from April 2018. It is not a live search
of every FoodData Central dataset. Search by a food description or an exact
FDC number. Original source descriptions remain English; the controls and
notices support en, nl, zh-Hans, hi, es, ar, fr, bn, pt, id and ur.

Choose the exact record, check whether it describes raw, cooked or otherwise
prepared food, and enter the edible amount in grams. Review the calculated
values in the same USDA section. Explicitly confirm saving while signed in.
There is no second percentage step: the displayed nutrient quantities have
already been scaled for the entered grams. Changing the food or amount clears
the old confirmation. Cancelling or simply reviewing does not create an entry.

The saved USDA diary card displays the actual gram amount instead of an
unexplained 100 percent. Existing percentage-based USDA entries are displayed
without rewriting their stored values or nutrient totals. The existing OFF
portion controls remain separate and refer to their stated reference amount.

## Understand the diary's source letters

The selected-period overview counts diary entries with source-provided grades
A-E and shows entries without a grade separately. It does not average letters,
invent a grade for USDA, assess a person's health, or calculate a portion-weighted
diet score. Changing a portion changes nutrient quantities, not the source
product's grade. Missing grades are unavailable information, not adverse grades.

## Compare and calculate without implying advice

Comparable-food suggestions are options to inspect. They are not a ranking of
healthfulness or a determination of suitability for allergies or a medical
condition. Ingredients, preparation, labels and quantities still need checking.
Choosing another result requires checking that result's own source and amount.

USDA arithmetic starts from source values per 100 g of edible food. One available
energy method is used; methods are not added together. Missing, invalid or
below-quantification values remain unavailable. A record lacking a required
nutrient cannot be submitted as a complete diary item. The source selection and
numeric amount survive interface-language changes.

## Data and integration boundaries

The catalogue request contains no USDA API key or account credential. The local
USDA search phrase stays in the page. A deliberate diary save uses the existing
backend, session checks and duplicate-submit guard. The changes here do not
replace authentication, wallet signing, barcode scanning, backend APIs or the
database schema.

The project's wider XRP Ledger, food-and-beverage and Web3 ambitions remain
separate from these food functions. This candidate does not make custody,
trading, retailer settlement, on-chain publication of food diaries or a DAO live.

## Evidence tied to this exact source

GitHub Actions run `35006320526` produced artifact `10411468462`,
`food-ux-browser-evidence`, for commit `ac724aabf1534e51e819ef5d84df04f246eeea23`.
The archive SHA-256 was checked after retrieval:
`3f56ed370f3c851afda626b1dd064993473169f9819449de10eed0146f2919ca`.

The artifact contains a completed production-build log, source snapshot and
browser report with 56 passing assertions and no recorded JavaScript errors.
Its browser mode is a local production build with a synthetic API and diary.
It checks all eleven locales at 360, 412 and 1440 pixels for horizontal overflow,
inline confirmation, cancellation, zero grams, stale confirmation invalidation,
one synthetic POST after a double click, correct saved grams and grade coverage.
The local catalogue example FDC 168878 at 75 g gives 97.5 kcal, 2.02 g protein,
0.21 g fat and 21.15 g carbohydrate. These are test results for that source
record, not personalised food guidance.

The artifact's USDA outbound source link was blocked by the test environment.
Do not describe it as successfully tested externally. Screenshots and reports
are not real Xaman sign-in, a physical-camera test, a real diary save, native-
speaker review, or acceptance of every live WordPress page.

## Website alignment and release history

An authenticated WordPress read on 15 September confirmed Site Style 1.4.46 and
Identity Bridge 0.3.29. The served CalorieHelp data still described the earlier
USDA portion flow. The updated eleven-language wording is a content candidate;
it has not been installed in the live Help plugin by this documentation change.
See [CalorieHelp alignment](caloriehelp-2026-09.md).

Earlier notes recorded deployment of food-discovery commit
`40ed5f4fe6d7326158787d7c71004f02cd889979`, following barcode baseline
`1cfdd99bf7b1ffdd82a4964f797e03dfae096afa`. They also recorded 69 focused tests
and targeted Help updates to Site Style 1.4.46. Those historical observations
do not establish deployment or acceptance of the newer candidate above.

Full website/legal-copy alignment, coordinated deployment and release review
remain open. Do not install the repository's older complete WordPress plugin
over the newer site just to deliver an updated text file. Campaign publication
and scheduling require the owner's later explicit overall approval after the
complete review. Expired proposed dates must not trigger catch-up publication.

Sources: [USDA downloads](https://fdc.nal.usda.gov/download-datasets/),
[USDA documentation](https://fdc.nal.usda.gov/data-documentation/),
[application PR #146](https://github.com/CalorieToken/CalorieApp/pull/146),
[exact-source workflow](https://github.com/CalorieToken/CalorieApp/actions/runs/35006320526).
