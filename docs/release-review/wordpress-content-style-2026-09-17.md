# WordPress content style — 17 September 2026

## Owner's scope
Use CalorieApp's appearance for content between each page title and the blue footer. Preserve historical header/title/footer artwork, Home moving text, usecase pictures, Tokenomics illustrations, galleries and interactions. The later clipboard report was withdrawn by the owner (copying succeeded); no secret or clipboard changes are part of this release.

## Candidate
Heading Repair 1.6.7, based on the installed 1.6.6 companion. Site Style 1.4.46 and Identity Bridge 0.3.29 remain installed and untouched. No frontend/backend deployment, page-builder writes or campaign edits.

- White rounded cards, thin green upper edge, sans-serif body text, green headings, purple links and 44px actions.
- Consistent content lanes, smaller margins, subdued nested notices and readable XPMarket rows on mobile.
- A separately declared important CSS layer precedes the old presentation layer, resolving its serif/card overrides only on marked content.
- The controller annotates existing eligible nodes after the page title and before the footer. It does not replace, move, clone or rewrite text, forms, links or media. It updates late content and removes styling if a node leaves the region.
- Header, title artwork, footer, images, moving Home columns, carousels, galleries, account widgets, embedded apps, consent controls and editor/admin surfaces are excluded. The owner subsequently requested CalorieHelp and the FAQ page too: the help interior is an explicit scoped exception outside the main content region; mascot, placement and conversation behavior remain unchanged.
- Richlist typography applies once to its table; 14,000 rows do not receive individual annotation mutations.
- No requests, storage, account or transaction actions are introduced.

## Inventory
Authenticated WordPress inventory: 30 published pages and 11 articles. Public HTML was requested for all 41 routes. Three returned the host's verification page (Blog, DAO article, March 2024 journey article); Richlist exceeded the retrieval limit. These limits are recorded rather than described as live visual acceptance. Remaining raw/rendered markup was inspected for content boundaries and historical media.

| Page | Route |
| --- | --- |
| Showcases | /showcases/ |
| Community Voting Hub | /community-voting-hub-info/ |
| CalorieApp | /calorieapp/ |
| Cookie Policy (EU) | /cookie-policy-eu/ |
| Legal & Regulatory Notice | /legal-regulatory-notice/ |
| Merch&NFTs | /merchnfts/ |
| Checkout | /checkout/ |
| Cart | /cart/ |
| Donate | /donate/ |
| FAQ | /faq/ |
| Roadmap | /roadmap/ |
| Integrated Exchange | /integrated-exchange/ |
| How to buy Calorie | /how-to-buy-calorie/ |
| Richlist | /richlist/ |
| How to buy (CEX) | /how-to-buy-cex/ |
| Contact | /contact/ |
| How to buy (DEX) | /how-to-buy-dex/ |
| Tokenomics update | /tokenomics-update/ |
| Blog | /blog/ |
| Trustline | /trustline/ |
| Whitepaper | /whitepaper/ |
| Wholesalers | /wholesalers/ |
| Groceries | /groceries/ |
| Restaurants | /restaurants/ |
| Takeaway | /takeaway/ |
| Cafes | /cafes/ |
| Delivery | /delivery/ |
| Home | / |
| Terms & Conditions | /terms-conditions/ |
| Privacy Policy | /privacy-policy/ |
| Five years of CalorieToken: from a food idea to CalorieApp | /2026/09/16/five-years-of-calorietoken/ |
| The Potential of CalorieToken as a DAO | /2024/08/08/the-potential-of-calorietoken-as-a-dao/ |
| Tackling Frontrunning on the XRPL | /2024/08/01/tackling-frontrunning-on-the-xrpl/ |
| An Update on Our Journey and Future Plans | /2024/03/01/an-update-on-our-journey-and-future-plans/ |
| CalorieApp Test APK on Android! | /2024/01/29/calorieapp-test-apk-on-android/ |
| Our Integrated Exchange | /2024/01/11/our-integrated-exchange/ |
| Our Donations Page is LIVE! | /2023/11/20/our-donations-page-is-live/ |
| CalorieToken Hackathon | /2023/10/09/calorietoken-hackathon/ |
| The Importance of Verified Domains | /2023/08/29/the-importance-of-verified-domains/ |
| The Role of Test Currency | /2023/06/14/the-key-to-successful-testing-and-innovation/ |
| A Comprehensive Overview | /2023/02/01/a-comprehensive-overview/ |

## Preservation decisions
- Home: retain animated intro columns, branding artwork and six usecase tiles; style ordinary/new cards.
- Usecase subpages: retain original illustration sequences and linked images; style explanatory notices and CalorieApp cards.
- Tokenomics: retain allocation artwork and historical branding/developer images; style explanatory and consolidation-wallet cards.
- Contact: retain original social/team images and destinations; style text and ordinary actions.
- Blog: retain article artwork and community-art slider; style excerpts and reading copy. No anniversary content edits.
- Roadmap: retain timeline structure/interactions; style timeline cards and text.
- Shop/cart/checkout: style ordinary controls/cards; no requests or payment flow changes.
- CalorieApp: retain native app iframe, account guides and account security; style surrounding public cards.

## Verification / release boundary
386 local Node regressions pass, including six content-boundary/interaction checks. Five deterministic packaging checks pass. Dedicated browser CI exercises 13 page-family fixtures with captured public Site Style/Bridge CSS at 360/412/1440px, dynamic card insertion, protected DOM/computed styles, controls, XPMarket wrapping and LTR/RTL. It retains preview screenshots and source tree identity. The source-bound CI runs and final visual results are recorded below and in PR 146.

No publication is claimed. PR 146 remains draft/unmerged. Install the tested ZIP over the existing Heading Repair companion after review; rollback is the retained 1.6.6 ZIP. No Render deployment or database migration is needed.

## Current handoff status
- All 386 local Node regressions and five packaging checks pass; browser-test Python and new JavaScript parse successfully.
- Offline DOM classification of 38 available page responses (including the partial Richlist response) retains every original image, iframe and form reference. No markers occur inside historical headers, title banners, footers, image wrappers or carousels. CalorieHelp's requested interior is a separate deliberate exception.
- The first GitHub tree creation was rejected by automatic approval review as an unapproved external disclosure. Work paused at that boundary and the owner then explicitly approved uploading this specific styling update to CalorieToken/CalorieApp PR 146 and running its isolated tests ("ja is goed"). Approval covers upload and testing; it does not cover installation, deployment or merging.
- Approved commit `d7223878a075186271c26ec3efcd2a31c244f525`, tree `440c46c971d5fefe938e15eaa2bf90742e60afd2`, was uploaded with a non-forced branch update. [Dedicated browser run 35239975029](https://github.com/CalorieToken/CalorieApp/actions/runs/35239975029) passed 89 checks, PHP syntax and five package checks. Its tested merge tree matches the source tree exactly. [Full regression run 35239975096](https://github.com/CalorieToken/CalorieApp/actions/runs/35239975096) also passed all stages, including the production build and existing browser regressions.
- The first screenshot review found that the synthetic help fixture was always open and covered the content-card examples. The follow-up changes only the test fixture to use the actual native details/summary structure: verify opening the bot, capture its answer, close it, then capture unobscured market/app/FAQ/RTL examples. No product change or release-package change was needed. Final follow-up CI and visual results are recorded in PR 146.
- Prepared package: `calorietoken-heading-repair-1.6.7.zip`, SHA-256 `f10d8cd8e9390ce0f2c4156cd8f2d5a359e55b048d515bdd8fd7395607d4892d`. The first CI build is byte-identical. No live WordPress installation, Render deployment, wallet action or PR merge has been performed for this styling release.

## Follow-up requested after installing 1.6.7
The owner explicitly extended the scope to the login widget and **only the Brizy menu buttons**. Historical header/layout, title banners, footer and page backgrounds remain protected. The owner reiterated coverage of every page and subpage.

Candidate 1.6.8 adds narrowly scoped visual markers for the original login card and menu controls. It does not replace account fields, nicknames, avatars, destinations, language selection, authentication handlers, menu wrappers or disclosure/visibility state. The other chat's nickname/account-settings work must not be overwritten. Browser checks include signed-in/guest synthetic widget states, existing handlers, menu opening/closing, historical background preservation and 360/412/1440px captures.

The owner asked to use another browser or Tinyfish after the primary cloud browser returned 502. Tinyfish run `f4cdb6c5-0e21-4b8f-aac8-9ef08ccf407a` successfully inspected the live FAQ on desktop and reported working FAQ/CalorieHelp disclosures, app-style cards, historical title banner and blue footer. It returned no usable screenshot artifact, did not reach CalorieApp, and could not resize to mobile. This is a provider-reported FAQ check, not visual acceptance of all routes. Its initial strict/custom-step options were rejected before any run started; run listings confirmed zero matching jobs before the standard run was submitted.

Local follow-up validation: 388 Node checks and five deterministic package checks pass; browser-test Python compiles. Current authenticated inventory remains 30 public pages plus 11 articles. Rendered widget/menu evidence and the per-route live audit will be recorded with their actual limits in PR 146.

The owner further requested historical title-initial corrections and room for
long titles. The owner clarified that coloured initials apply **only to the
historical banner titles**, never ordinary content headings or sentences.
Each banner word receives one purple-blue initial; joined names
such as CalorieApp/CalorieToken additionally accent A/T. Abbreviations such as
FAQ, XRPL and NFTs accent only their first letter. Native highlight ranges keep
the original text nodes, cursive shaping and spacing. The historical banner
can grow vertically and use its available width, with balanced wrapping and
no maximum-height clipping. Font, artwork, corners and shadow remain owned by
the existing style. Old browsers without Custom Highlight support keep the
existing safe first-letter fallback; no DOM-splitting fallback is introduced.

All 41 current public routes (30 pages plus 11 articles) now serve the installed
1.6.7 content controller, including the three routes whose earlier full markup
requests met a host challenge. This verifies asset delivery, not complete visual
acceptance. Offline classification of the 38 usable earlier responses retains
every original image, iframe and form, with no protected-region markers outside
the expressly requested login/menu/help exceptions. Richlist markup is partial.

Tinyfish run `8d0fd62d-9d97-4699-9425-9cd5b5d49d42` reached live CalorieApp,
Home and `/index.php/delivery/` on desktop and reported the original artwork and
backgrounds present, with no visible overlap. Its report did not establish the
Home animation or a click through a usecase tile, contains inconsistent XPMarket
observations, and supplied no usable screenshots or mobile verification. It is
supporting evidence only, not a substitute for the deterministic browser checks.

Final local follow-up validation: 389 Node regressions and five package checks
pass. Browser CI adds actual Knewave font rendering, native highlight ranges,
joined-word preservation and long/multiline/translated banners at 360/412/1440px.
The login/menu-only candidate passed both CI workflows at
`7e0ceaf94d06f4522e0b76521b01043bfb793f40`; final title-inclusive results are to
be recorded in PR 146. Version 1.6.8 remains a prepared upload for the owner;
the live site currently has 1.6.7. No installation, merge or Render deployment
is performed by this follow-up.
