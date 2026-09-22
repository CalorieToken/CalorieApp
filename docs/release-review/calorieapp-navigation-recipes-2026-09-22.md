# CalorieApp navigation, recipes and measured portions — 22 September 2026

## Changes

- Product details have four sections, a location label and explicit return controls. Existing OFF and USDA routes stay available. USDA ingredient links retain product history and the previously selected section.
- OFF alternatives use all comparable loaded results, two per page. Filters cover other known brands, better recorded Nutri-Score, organic and animal-welfare evidence. USDA alternatives offer up to 24 candidates, two per page. These are comparisons, not medical recommendations. No environmental impact or certification is inferred from a name.
- 80 distinct base recipe titles across 15 cuisine-inspiration filters and all inhabited continents. Each has seven explicitly named variations: 640 named choices, not 640 independently researched traditional recipes. Data contains 96 family-targeted records because some dishes are available from several ingredients. The interface keeps variants inside each base card.
- Recipe nutrition is estimated from weighed edible ingredients and cited USDA snapshot records. Both raw/cooked state and the serving count are visible. The exact chosen servings are reviewed before an explicit diary save. Estimates are distinct from source-reported products and carry no invented Nutri-Score.
- Eaten pieces can be calculated from pieces eaten, total count and net pack weight, or a weight per piece. Missing counts can be entered manually. This is offered only for the canonical 100 g / 100 ml source-reference records; the interface asks users to verify a 100 g basis. Unknown weights cannot produce a valid save.
- 18 locally hosted 384 px WebP serving illustrations, generated with the built-in image tool. Original prompts requested matching hand-painted food on white ceramic with a restrained indigo rim and cream background. Illustrations are shared across related recipes/variants, labelled as serving illustrations rather than exact photographs. Lazy loading and fixed dimensions avoid layout jumps.
- Xaman installation guidance distinguishes Android, iPhone and computer, links directly to verified official stores, and breaks installation/return into short steps. Existing recovery and testnet acknowledgements remain mandatory. No account is created by choosing an installation option.
- A Showcase-only activity display uses a five-minute bounded, in-memory count of random app-window session tokens. No wallet, account, IP or persistent user identifier is stored by the counter. It is an estimate of open sessions, not unique users; it resets on restart and is supported only for the existing single frontend instance. The app itself has no counter widget.

## Deployment scope and restrictions

Frontend changes are independent of the unchanged backend. Deploy the tested commit explicitly to the existing frontend service, not the old default branch's latest commit.

The WordPress focus-button and help/FAQ changes are prepared in the heading-repair asset files. Live WordPress currently denies plugin editing, and the supported file tools expose these files as read-only. They are not automatically deployed with Render. Do not install the repository's older PHP plugin over the newer live plugin; merge only the reviewed asset edits into the current live version once authorized file access is available. Preserve concurrent site edits.

## OpenNutrition research (not integrated)

The earlier restaurant-data candidate was OpenNutrition, not OpenMenu. The official dataset page supplies a downloadable TSV and lists ODbL plus modified DbCL conditions, including attribution at data displays and applicable website/about/store locations, preservation of OFF attribution, and share-alike for derivative databases. Restaurant items are not guaranteed complete or current restaurant menus; the provider describes AI estimates and attribution gaps. This remains a separately identified potential pilot, not an unlabelled merger into OFF/USDA.

Sources checked: https://www.opennutrition.app/download and https://www.opennutrition.app/about . The user's Xaman/compliance comment was explicitly withdrawn as belonging to another chat.

## Verification

Production build succeeds. Targeted tests cover account navigation and recovery checkpoints, source boundaries, food logging, piece-to-gram conversion and explicit POST payload, recipe weights/servings and every ingredient's agreement with the USDA snapshot, all illustrations, variant count, alternative paging/filtering, activity expiry/capacity and the WordPress focus-control script. Live deployment status and browser checks must be recorded separately after publication.


## Live verification

Frontend commit `6df3b7e2299b9a4e62f5c964c164824f218c2032` was deployed explicitly on Render, deploy `dep-daovkl80cd8s73b78o60`, live at 2026-09-22 03:48:47 UTC. The GitHub tree `e403158ba83f5e968757b34f6b755819472d4d18` exactly matches the tested local source tree. The existing backend and service sizes were unchanged.

93 targeted tests passed. Production build passed with only the two pre-existing TestnetEntry cleanup-ref lint warnings. A local production HTTP check caught internal/public origin normalization in the session counter; the route was corrected to validate the public Host and fetch-site, then its bounded-body, wrong-origin, no-store, count and Showcase route checks passed.

Live browser verification confirmed the deployed SHA, Dutch navigation, USDA search, recipe variation selection, source-based nutrition, two-serving review (without a diary POST), ingredient navigation and return to the recipe section, successful 80 × 80 image rendering, and the Android installation link. The live activity endpoint and route returned 200 and an actual session count; a generated WebP returned 200. No Render error logs were present after deployment. Physical mobile-device behavior was not tested.

Showcase page 7945 received only a match-once insertion after its existing Explore CalorieToken link. `docs/live-wordpress/showcase-calorieapp-features-2026-09-22.html` records the inserted block. The Dutch feature text and localized counter iframe were verified on the public page. The existing videos and page content were not replaced.

Still pending: WordPress focus controls and shared help/FAQ assets. The current tools expose plugin files as read-only and the plugin editor denies access. Prepared changes include app-focus.js, app-focus.css, help-link-labels.json, help-topic-additions.json and help-label-bootstrap.js. They require a merge into the current live plugin; do not install the older PHP plugin from this checkout over it.
