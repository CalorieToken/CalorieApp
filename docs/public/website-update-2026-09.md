# September 2026 website and CalorieApp update

Updated 10 September 2026. This is a source and release-scope record, not proof of the latest live installation or a production-readiness certificate.

| Area | Implemented or prepared | Remaining acceptance |
| --- | --- | --- |
| Food search | Pending-search guard, bounded startup feedback and provider-aware retry pause; query survives language changes | Actual host availability and the owner's current device journey |
| Food sources | Open Food Facts search; three attributed, dated USDA FoodData Central reference foods | Broader USDA search is not implemented |
| Language | Eleven-language UI and synchronized website/app preference; known public-copy catalogue | Complete historical CMS/blog/legal copy is not available in all eleven languages |
| Website | Shared chrome, donation/Trustline/Contact/FAQ corrections and continuous paper background | New ZIP installation and mobile/desktop visual acceptance |
| CAL & Crypto | Verified external XPMarket CAL/XRP routes, buying guide, then SWFT interface | External provider availability; no own order-execution engine |
| Testnet | Explicit user-triggered Testnet creation/guide, no automatic account/session or pilot role | Faucet, Xaman import and sign-in on a real device |
| Community | Informational Voting Hub with historical artwork | No active voting, proposal submission or reward programme |

The WordPress package preserves the accepted Home title banner and native identity controls. The six usecase headers use the Home widget colours, while the compact usecase navigation supplies the desktop proportions. Known Privacy/Terms source text is updated once, only when it matches the expected older version, after an exact local WordPress backup. Different operator copy is preserved and reported. The public information hub is a new page; the original Brizy voting draft and its voting shortcodes are not published.

The website and food application remain distinct. The external CAL/XRP routes do not give the food app custody or order-execution powers. CAL is temporarily unavailable in the SWFT integration according to the operator. Other supported routes may be available; check the actual provider interface. A wallet signature is not a blanket MiCA exemption. See [ESMA Q&A 2671](https://www.esma.europa.eu/print/pdf/node/222469) and the applicable project regulatory boundary.

## Verification and boundaries

The app continuation passed 53 focused tests covering search deadlines, rapid resubmission, provider retry pauses, food logging, locale changes, identity return and Testnet-guide handoff. Its production build passed. Website checks use captured public DOM/CSS, PHP execution and interaction fixtures. The candidate WordPress release has not been visually accepted on the live site in this session. No real Xaman signing, exchange order or live Render acceptance is claimed.

Step 1/2 privacy, durable-data, migration, capacity and identity gates stay in effect. This styling release does not enable private import, automatic inactive-account erasure, a financial execution service or a pilot programme. Step 4 showcases must describe only functionality demonstrated in the actual environment.

## Public reading

- [CalorieApp](https://calorietoken.net/index.php/calorieapp/)
- [Current publications](https://github.com/CalorieToken/Publications)
- [Website privacy notice](https://calorietoken.net/index.php/privacy-policy/)
- [Website terms](https://calorietoken.net/index.php/terms-conditions/)
- [FAQ and bounded help](https://calorietoken.net/index.php/faq/)

The new informational hub is created at `community-voting-hub-info` on installation when that route is free; the footer uses the actual published permalink. Before installation the page need not exist. No confidential evidence, credentials or private account exports are part of these public documents.
