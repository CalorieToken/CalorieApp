# CalorieApp navigation and food discovery — 22 September 2026

Candidate based on frontend release e98119e82dabf6465e367bac25b790bf5b280c5f.
Render Dashboard now confirms that exact previous commit is live. The changes
below are not live until their exact deployment is verified.

## Scope

- Explicit navigation reveals the nearest relevant tab, portion editor or product
  detail. Background updates do not request scrolling. List edges allow scrolling
  to continue through the page. A successful save offers an explicit diary button.
- Desktop app width grows from 768 to at most 1152 pixels at the 1024px breakpoint.
  Mobile rules remain as before.
- Alternatives use brand-independent food names, preserve category boundaries,
  diversify brands, and can highlight a better recorded OFF Nutri-Score. Known
  differing score versions cannot produce that comparison. Unknown versions remain
  explicitly qualified in the source note. This is not an overall health assessment.
- Organic and animal-welfare filters apply only to comparable loaded results with
  recognised OFF label tags. Organic source claims and EU Organic are distinguished;
  Beter Leven retains its supplied stars and conflicting levels are suppressed.
  MSC/ASC are not classified as animal welfare. These are recorded source claims,
  not independent certification by CalorieApp. Missing evidence is unknown.
- Plant-based suggestions are explicit search directions. They do not claim a
  verified environmental footprint, animal welfare, ingredient list or certification.
- Optional OFF labels and known score-version metadata pass through the existing
  bounded search/barcode requests. No database migration, extra provider fan-out,
  account-contract change or diary-storage change is introduced. Old API responses
  remain usable and show unknown metadata.
- Compact recipe ideas sit behind an expander. At most two ideas are shown; users
  choose cuisine inspiration, meal and eating style themselves. A small original
  catalogue covers seven cuisine inspirations plus general ideas; it does not
  cover every culture or dietary need. UI copy covers eleven languages; recipe
  prose currently covers Dutch and English, with an explicit English fallback.
  Restrictive preferences do not certify unknown packaged ingredients. Halal,
  kosher and allergen-free status are not inferred. No recipe calories or automatic
  diary writes are invented. Recipes appear in both packaged-food and USDA details.
- Existing product photos retain the thumbnail/original/fallback chain. Missing
  photos use the existing original 38-illustration collection, now matching more
  names such as havermelk, dal, injera and jollof. Nutrient icons are decorative SVGs
  accompanying translated text. No image or recipe provider is called.
- The WordPress login presentation opens a compact bottom panel without explicitly
  scrolling up or exiting app focus. Original bridge controls and sign-in semantics
  remain. The existing successful-login page refresh is retained.
- Helpbot and inline FAQ use the same updated answer data and include recipes,
  labels, alternatives and navigation. Age restrictions and secret boundaries remain.

## Validation

- 129 targeted frontend/authentication/navigation/WordPress UI tests pass, no skips.
- 144 backend search/barcode/endpoint tests pass, no skips.
- Next production build, type checking and lint pass. Two pre-existing TestnetEntry
  effect-cleanup warnings remain; backend tests report a dependency deprecation.
- An existing readiness test still expected migration 0016 although the unchanged
  baseline already contains 0017. Only that stale test expectation was corrected;
  no runtime migration or readiness behavior changed.
- Tests exercise label provenance/malformed input, cross-brand selection, category
  exclusions, differing score versions, recipe preference filtering and no automatic
  writes, FAQ/help answer parity, explicit scrolling and original login behavior.
- Browser acceptance of the candidate has not yet been completed. The browser
  connection recovered after the implementation tests; GitHub/Render connector
  calls still return HTTP 400 Invalid MCP request metadata.

## Deployment boundaries

Frontend and backend require their own Render deployments for the full feature.
WordPress changes require a separate installation/update. In particular, this
checkout's Heading Repair plugin is 1.6.17 while later live edits have been reported;
do not install that whole old plugin over live. Read and reconcile the current live
assets/version before applying the four help-asset edits. Account Profile is 0.1.2.
Do not deploy an intermediate upload commit or switch to the older release head.
Do not change service plans, create services, or modify CalorieVerse.

## Evidence references

- OFF documents source labels and field-limited queries:
  https://openfoodfacts.github.io/documentation/docs/Product-Opener/v2/search/get-search/
- Nutri-Score comparison context and version qualifications:
  https://www.santepubliquefrance.fr/sites/default/files/cadic_files/documents/spf00006074.pdf
- Beter Leven scheme and star levels:
  https://beterleven.dierenbescherming.nl/over-het-keurmerk/wat-is-beter-leven/

## Live WordPress reconciliation

The authenticated editor reported Heading Repair 1.6.44 (an older open public tab
still displayed 1.6.42 cache URLs). The four help assets were read before editing.
The newer website topics, market routes, language-preserving links, contribution
links and secret-handling guidance are retained. Account guidance is appended
after the site-specific override so it reaches both the FAQ and the helpbot.
The 12 focused WordPress tests pass after reconciliation, including this override
and the existing market-help hook. Combined candidate total is now 130 UI tests.
No live WordPress file has been written at this checkpoint.
