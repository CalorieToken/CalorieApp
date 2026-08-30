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

## User and identity data

Authentication identifiers and food logs are application data, not assets
licensed for public reuse. Their processing is governed by applicable privacy
law, the public privacy notice, retention rules, and security controls—not by
the repository licence.
