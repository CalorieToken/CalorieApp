# Minimal USDA reference — Step 3

Prepared on 2026-09-08 following the operator's request for a very small but
real second food-data source for launch. This supersedes deferral only for the
bounded reference described here. Full USDA search and attributable private
logging remain deferred; accepted Steps 1/2 remain the baseline.

## User-facing scope

One native, initially collapsed disclosure on the app page displays three
Foundation Foods: mature raw carrots, whole-grain oat flour and unsweetened
refrigerated oat drink. Each shows energy, protein, fat and carbohydrates per
100 g of edible food. Food descriptions remain in the provider's English with
appropriate language markup. Controls, basis, limitation and method copy cover
all eleven existing locales, including right-to-left direction.

The records are bundled with the app; opening them needs no API key, request,
service spend, backend wake-up or new dependency. The UI explicitly separates
this small reference selection from the user's diary. OFF search, portions,
logging, totals, import/export and same-tab joint authentication are not edited.
The panel is a sibling of the existing search/diary component with no callbacks
or shared private state. No new database or catalog content is created.

USDA and CC0 links appear beside the dated data and alongside OFF in the app
footer. Each source link searches the exact public food description on USDA;
the FDC ID is visible for identification. The label says "Find at USDA", not
that the destination is a guaranteed direct detail page. Do not advertise full
USDA search, automatic updates, product origin, official endorsement or USDA
diary support. Suitable scope wording: "Open Food Facts product search with a
small USDA reference selection."

## Data evidence and mapping

The dataset is `frontend/data/usda-reference-foods.json`. All three records were
retrieved from the documented USDA `/foods` API in two bounded public reads on
2026-09-08. Development discovery also queried names; no private user data was
sent. No credential appears in the bundled data or runtime code.

| FDC ID | Original description | Source publication date |
| --- | --- | --- |
| 2258586 | Carrots, mature, raw | 2022-04-28 |
| 2261421 | Flour, oat, whole grain | 2022-04-28 |
| 2257046 | Oat milk, unsweetened, plain, refrigerated | 2022-04-28 |

Each retained SHA-256 identifies the full API record serialized with Python
`json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`
and UTF-8. The bundled evidence keeps the inspected nutrient subset, not every
source field. This is a dated provider snapshot, not independent laboratory
verification. Changes require source review and an ordinary tested release;
there is no background task or guarantee that snapshots are the latest data.

The reference basis follows USDA's Foundation Foods documentation. Energy uses
nutrient 2047 only, never a sum with 2048. Protein, fat and carbohydrate use
1003, 1004 and 1005. Carbohydrate by difference includes fibre; no equivalence
to every packaged-food labelling convention is asserted. Values retain source
precision in the file and display at most two decimals. Unknown, invalid-unit
or censored-zero values must not display as measured zero. No conversion from
grams to millilitres, imputed serving, matching to an OFF item or new nutrition
score is performed. Original alternative energy fields remain in the evidence.

USDA reuse and definition references:

- <https://fdc.nal.usda.gov/api-guide/>
- <https://fdc.nal.usda.gov/Foundation_Foods_Documentation/>
- <https://creativecommons.org/publicdomain/zero/1.0/>

## Verification and release

Local results on 2026-09-08:

- All three bundled records match the inspected USDA response fields exactly.
- All 21 food-logging and search-deadline checks pass, including four new USDA
  checks for identities/basis/units, rendered values and energy-method choice,
  safe source links, no mutation or requests, unknown/censored-zero handling
  and eleven-locale/RTL rendering.
- Standalone TypeScript checking and linting pass. The optimized Next.js build
  also passes, including its type/lint checks and static page generation.
- The repository legal-boundary and whitespace checks pass.

The UI tests use the bounded hook/JSX harness; they do not claim an interactive
browser test or live Xaman signing. Final responsive browser acceptance remains
part of Step 3. No claim of absolute zero regression risk follows from these
checks.

No push, merge, installation or public launch is included in this preparation.
The existing release and source-clearance limits remain in effect. Rollback is
removal of this standalone component, page/attribution additions and bundled
data; no database rollback or Identity Bridge change is needed.

## 10 September follow-up: adjustable reference weight

Site Style 1.4.8's associated app revision adds one shared reference-weight input
(default 100 g) and a reset control. It accepts 0.1–5,000 g, including decimal
comma, and computes each displayed nutrient from the original unrounded amount
multiplied by weight / 100. The display clearly labels the selected edible
weight; rounding is presentation-only. Invalid input yields no calculated
values. Measured zero remains distinct from missing, invalid-unit or LOQ-censored
zero. The original records, publication/retrieval dates and source hashes are
unchanged. No grams-to-millilitres conversion or invented serving/grade is used.

This follows the portion formula in the [USDA Foundation Foods documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/).
All 11 locales include the controls and explanation. This remains a local,
three-food reference independent of private logs and OFF search; it does not
claim full USDA search/import or automatic updates. The earlier “no button”
test now permits the explicitly requested reset button while still rejecting
logging controls, forms, media, source mutation and requests. App deployment
and a real mobile acceptance pass remain required.
