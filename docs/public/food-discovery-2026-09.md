# Food discovery — live update, 15 September 2026

The food discovery update is live. App commit
`40ed5f4fe6d7326158787d7c71004f02cd889979` was deployed to the existing
frontend on 15 September and checked in both the standalone app and the
WordPress embedding. The barcode-repair baseline is
`1cfdd99bf7b1ffdd82a4964f797e03dfae096afa`.

The catalogue contains 8,156 records: 363 Foundation records from April 2026
and 7,793 SR Legacy records from April 2018. It is a dated selection, not a
live search of every FoodData Central dataset.

The updated food screen offers two distinct sources. Open Food Facts retains its
existing search and barcode flow. USDA search uses a dated, first-party catalogue
of Foundation and SR Legacy foods. The visitor can search a food name or exact
FDC number, inspect the source description, enter edible grams and choose a food
for the ordinary portion-confirmation step. Source descriptions remain in English;
the interface and notices use the existing eleven languages.

Similar-food options compare names and available results. They do not rank foods
as healthier or suitable for a person's medical condition, allergies or diet.
Mixed ingredients, preparation and packaging still need a human check. Opening
the comparison or choosing a record does not create a diary entry.

USDA arithmetic scales the selected source values from 100 g of edible food.
One available energy method is selected; methods are not added together. Missing,
invalid or below-quantification values remain unavailable. A record lacking any
required nutrient may be read but cannot be submitted as a complete diary item.
Editing a USDA selection or gram amount clears its pending confirmation so an
older portion cannot be saved by mistake.

The catalogue request carries no USDA API key or account credential. The search
phrase stays in the page. A deliberate diary save uses the existing backend,
session checks and duplicate-submit guard. Choosing a similar OFF record reuses
the normal result's portion panel. Authentication, wallet signing, the backend
and database schema are unchanged by this update.

CalorieToken's wider food and beverage project uses the XRP Ledger. Earlier
wallet and NFT experiments and future ecosystem ambitions remain distinct from
the food functions described here. This update does not enable custody, trading,
retailer settlement, on-chain publication of food diaries or a DAO.

Validation includes actual component event tests for explicit selection and save,
language changes, invalid amounts, stale confirmations and duplicate clicks;
numeric/source tests; and existing barcode, portion and diary regressions.
All 69 focused tests and the production build passed. Live FDC search 168878
returned the expected cooked white rice record: 75 g gives 97.5 kcal, 2.02 g
protein, 0.21 g fat and 21.15 g carbohydrate. Three comparable records appeared.
Zero grams disabled selection. The selected record and amount survived all
eleven interface-language changes; Arabic and Urdu used right-to-left layout.
The existing barcode 3017620422003 also returned the expected result after
deployment. No physical-camera, native-speaker, new authenticated live-save
or complete mobile WordPress-site acceptance is claimed.

CalorieHelp on WordPress now includes USDA and comparable-food guides in the
eleven interface languages. Its existing avatar is retained. Site Style 1.4.46
was applied as four targeted file updates from the actual live 1.4.43 baseline;
this does not establish acceptance of every other page or mobile layout.
See [CalorieHelp and the new food steps](caloriehelp-2026-09.md).

The corresponding WordPress terms/privacy snippets remain source drafts. The
complete live legal-copy and eleven-language alignment is still open. Do not
install an older complete Site Style package to deliver those snippets.

Sources: [USDA downloads](https://fdc.nal.usda.gov/download-datasets/),
[USDA documentation](https://fdc.nal.usda.gov/data-documentation/),
[existing project website](https://calorietoken.net/).
