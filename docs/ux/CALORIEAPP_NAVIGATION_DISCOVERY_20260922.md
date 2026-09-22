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

## Publication and browser acceptance

- Published the complete candidate through GitHub branch
  `polish/navigation-alternatives-20260922`. Remote `affbd7b49c5de66c38664551c0f6b40d827cdc09`
  had an identical tree to the locally tested candidate before deployment.
- Render frontend and backend both reported **Deploy succeeded / Live** for
  that exact commit. Backend deployment: `dep-daottd60tbcc73fllagg`. Backend
  remains on this version: the final follow-up changes only frontend food
  categorisation, recipe data and a regression test.
- Applied the four merged Heading Repair help assets and the minimal PHP version
  change to 1.6.45 through the authenticated editor. Each saved file was reloaded
  and compared to the exact candidate. The newer live website code was preserved.
- Compared live Account Profile PHP, login CSS and login JS with their 0.1.1
  baseline before updating to the tested 0.1.2 files. Reloaded and verified each
  file. Public app HTML loads login assets 0.1.2 and help.js 1.6.45.
- Live browser checks: Dutch language, OFF search for havermelk, real product
  photos, product-detail expanders, EU Organic source label with OFF link,
  comparison controls, recipe preference controls, USDA search for rijst,
  selection of cooked rice FDC 169704, its 100 g nutrition, illustration fallback,
  and a South Asian recipe idea. Helpbot answers explain labels/alternatives and
  recipes. The FAQ page exposes the same new topics. A fresh FAQ tab presents its
  existing age-choice dialog; no age assertion was submitted during this check.
- Live review caught an oat drink being classified as oats. Corrected plant-drink
  grouping, cross-brand matches and the recipe ingredient role. The regression
  exercises the observed products, related drink names, grain exclusion and
  continued source-evidence requirements for a restrictive eating preference.
  All 62 food UI tests and the production build passed again; combined targeted
  UI total is now 131, alongside the previously passing 144 backend tests.
- Final runtime candidate `4d7984b484d24e08f7074782cb49038d59e4a29e` exactly matches
  the local tested tree. Frontend deployment `dep-daou2fm0tbcc73fm4olg` is in
  progress at this checkpoint. Do not interpret this paragraph as final proof
  of that deployment until the next entry confirms it.
- No real Xaman signature, account creation, transaction or diary write was
  performed in browser acceptance. Authentication/diary regression tests pass;
  a completed real-wallet sign-in and physical mobile-device acceptance are not
  claimed. Existing mobile width rules were preserved.

## Final user steering: medical boundary and floating controls

- Frontend `4d7984b` was subsequently confirmed Deploy succeeded / Live.
- The user explicitly required no medical advice. Reviewed new features: no
  diagnosis, treatment, condition-specific diet or personalised medical choice
  is generated. Added the existing eleven-language non-medical/non-dietetic
  explanation to packaged alternatives and recipe expanders, and to the shared
  recipe FAQ/help answer. Source Nutri-Score comparisons remain attributed data,
  not personal health recommendations; labels remain provider claims.
- The user requested the app sizing button to join the WordPress floating
  controls and reported accidental selection of the CalorieHelp launcher label.
  Docked the existing toggle in the existing page-tools container, retaining
  accessible labels and the original focus behavior. During app focus only its
  restore control is shown from that dock. Help summaries/buttons use user-select
  none; the question input and answer text retain normal selection.
- Heading Repair 1.6.46 was published as a minimal update of the actual live
  1.6.45 files. Saved JS, CSS, help data and PHP were individually reloaded and
  compared to their candidates. Public DOM confirms 1.6.46 CSS, a docked 48px
  desktop button and user-select none on the help launcher. Both maximize and
  restore were clicked and verified live. Mobile remains a 44px touch control.
  Reversible update: WORDPRESS_HELP_1_6_45_TO_1_6_46.patch.
- All 74 targeted food/help tests and 19 focus/login/help tests passed after these
  additions (overlapping suites, not an additive total). The production frontend
  build, type check and lint passed again. Existing warnings remain unchanged.
- Remote runtime tree `1889705af26df1229642c2f94e5900c51766ece3` matches the local
  tested frontend/backend/plugins/tests exactly. Only this checkpoint document
  differs. The frontend deployment for this final content clarification has been
  started; final success is recorded in the next entry after verification.

## Final deployment confirmation

Render confirmed frontend commit `1889705af26df1229642c2f94e5900c51766ece3`
**Deploy succeeded / Live**, deployment `dep-daou85o0cd8s73b26pm0`, duration
1m14s. Backend remains on verified `affbd7b`; the subsequent changes do not
alter its code. WordPress account presentation is 0.1.2 and Heading Repair is
1.6.46. Live OFF results now compare the lifestyle oat drink with Albert Heijn
Haverdrink and use the drink as the liquid in the porridge recipe. All existing
search lanes remain present. No service plan, auto-deploy branch, database,
account identity or CalorieVerse code was changed.
