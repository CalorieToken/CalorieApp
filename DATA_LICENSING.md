# Data licensing and attribution

## Source-independent food data

Open Food Facts is the current search adapter, not CalorieApp's canonical or
exclusive food database. The planned catalog accepts additional reviewed
sources through versioned adapters, including public datasets, producers,
farmers, suppliers, retailers, laboratories, public authorities and explicit
community submissions.

Every imported assertion must keep its source identifier, external record
identifier, source version or content digest, retrieval time, applicable
licence, attribution and verification state. Conflicting assertions remain
separate; one source may not silently overwrite another. CalorieApp may choose
a clearly documented value for display, but that choice does not erase the
underlying provenance.

Licences are evaluated per source before ingestion, combination, publication
or export. Records with incompatible reuse conditions must stay separable and
must not be flattened into an undifferentiated database. Private food history
is never promoted to a public catalog source automatically. A community
contribution requires a separate, explicit submission and moderation flow.

The machine-readable boundary is defined in
`contracts/food-data/v1/source-registry.json`; the staged data model is
described in `docs/FOOD_DATA_SOURCE_ARCHITECTURE.md`.

## Open Food Facts

CalorieApp currently queries the Open Food Facts database. Open Food Facts states that
its database is available under the Open Database License (ODbL) and that
individual database contents are available under the Database Contents
License. Open Food Facts states that product images are available under
CC BY-SA, while packaging may also contain third-party protected elements.

- Licence: <https://opendatacommons.org/licenses/odbl/1-0/>
- Reuse guidance: <https://wiki.openfoodfacts.org/Reusing_Open_Food_Facts_Data>
- Source: <https://world.openfoodfacts.org/>

The UI must visibly attribute Open Food Facts and link to the ODbL. The backend
must send an identifying User-Agent. CalorieApp does not claim ownership of
Open Food Facts records or images.

Current food logs store a user's selected, normalized facts alongside private
log data. That limited application use must not be expanded into a substantial
proprietary copy, bulk export, or combined database without a fresh ODbL
share-alike and attribution review. Product facts can also be inaccurate;
CalorieApp must not present them as medical or dietary advice.

## USDA FoodData Central reference selection

The current frontend bundles three dated reference-food records from USDA FoodData Central. The source file `frontend/data/usda-reference-foods.json` retains the source identifiers, retrieval date, nutrient units and record links. The interface states the edible 100 g basis and links to the provider and its CC0 data information. This is a small reference selection, not a second live search adapter or a claim that every USDA record is included.

- [FoodData Central](https://fdc.nal.usda.gov/)
- [Data documentation and public-domain/CC0 information](https://fdc.nal.usda.gov/data-documentation.html)

The interface does not silently combine alternative energy methods, treat missing data as measured zero, or import these examples into a private diary. USDA reference provenance remains separate from Open Food Facts licensing and private user records. External names and marks retain their own rights.

## USDA search catalogue — live since 15 September 2026

The food-discovery continuation adds a separate, dated snapshot in
`frontend/public/data/usda-search-foods.json`: 363 Foundation records from April
2026 and 7,793 SR Legacy records from April 2018. It does not claim to cover all
FoodData Central collections. The original three-food reference remains intact.

The catalogue preserves FDC identifiers, English source descriptions, collection,
edition, nutrient units and original numeric precision. Its source manifest records
the original download URLs and archive SHA-256 values. The builder is
`tools/build_usda_search_catalog.py`; the catalogue is kept separate from OFF data.
FoodData Central's official [download page](https://fdc.nal.usda.gov/download-datasets/)
and [documentation](https://fdc.nal.usda.gov/data-documentation/) describe these
collections and reuse conditions.

The browser requests one fixed first-party catalogue file only after a USDA
search is submitted. Search matching then runs locally; no search phrase or
account identifier is sent to USDA. Opening a source link visits USDA separately.
Saving requires the existing explicit portion confirmation and authenticated
backend route. The diary entry retains the USDA source, FDC identifier and chosen
gram basis; it has no fabricated barcode or Nutri-Score.

Name-based alternatives help visitors inspect other records. They are not
personalised nutrition recommendations, allergen checks or claims of healthier
equivalence. The visitor must check the actual label, preparation and portion.

## User and identity data

Authentication identifiers and food logs are application data, not assets
licensed for public reuse. Their processing is governed by applicable privacy
law, the public privacy notice, retention rules, and security controls—not by
the repository licence.
