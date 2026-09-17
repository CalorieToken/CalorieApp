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
