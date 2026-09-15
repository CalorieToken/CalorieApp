# XPMarket expiry review — 15 September 2026

Status: locally tested repair candidate; NOT installed on WordPress. This document belongs to the existing content-review branch, not a new app implementation or a production release.

## Source boundaries

The connected WordPress site reports Identity Bridge 0.3.29, Site Style 1.4.46 and Heading Repair 1.0.1. Its existing `/calorieapp/v1/xpmarket-widget` route returned a successful public-data response during this run. That single successful response does not establish long-term reliability.

The repair baseline is the previously retained Identity Bridge 0.3.30 candidate archive. It is NOT a verified current live plugin snapshot. Do not install an older full repository plugin tree or overwrite working authentication from this archive.

The baseline `assets/calorieapp-page-ending.js` SHA-256 is:
`1d85e101ca56defdf1844c4fedbe8c5a38717100d11183b1a4e04523ee4cfc24`.

The locally patched file SHA-256 is:
`f712938d12b7b4c0a9ff5787a0ac1724d3c936b33eb5b4c28e6fbb403ca31f9e`.

## Reproduced problem

The retained baseline stores a successful XPMarket response indefinitely within the tab. After a long-open tab returns, its existing payload prevents another request. Previously validated prices can consequently remain visible beyond the server's intended cache window.

A Chromium test reproduces this using synthetic data and a controlled clock. The retained baseline fails the long-open-page recovery assertion. The patch passes the same assertion and retrieves replacement data.

## Local repair

- Expire successful in-tab payloads instead of caching them indefinitely.
- Limit normal freshness to five minutes and accepted source age to thirty minutes.
- Clearly label older accepted values as cached; reject an expired or invalid stale timestamp.
- Refresh only while the document is visible and the browser is online; retry on return.
- Preserve bounded automatic retries, manual retry and the direct XPMarket token link.
- Bound a never-resolving fetch with a Promise timeout, including environments without AbortController.
- Preserve the non-market iframe-loading and footer logic. Authentication/session files, wallet signing, accounts, backend and database were not edited.

## Executed checks

The actual retained PHP class was executed in a native PHP runtime against isolated WordPress function doubles: **21 checks passed**. They cover sanitization, canonical issuer validation, response limits, fresh/stale caching, cooldown, refresh markers and failure responses. No live WordPress storage or upstream network requests were used.

The patched JavaScript was executed in Chromium against synthetic HTML and fetch responses: **66 assertions passed**, with no JavaScript runtime errors. Coverage includes transient failures, bounded failure fallback, manual retry, wrong issuer, cached labels, all eleven locales, no horizontal overflow at 360/412/1440 px in the tested component, long-open-tab recovery, expired data and a fetch that never resolves.

The retained baseline run was deliberately kept as failing evidence; it was not relabelled as a pass. PHP/JavaScript syntax checks of the retained plugin candidates passed 23 checks. This is component/source testing, not a full WordPress, real-wallet, camera, live-diary or multi-browser acceptance test.

## Reproducible conversation artifacts

The run package contains `tests/xpmarket_native.php`, `tests/xpmarket_browser.py`, `tests/prepare_market_patch.py`, the exact `candidates/xpmarket-expiry.patch`, the candidate JavaScript and JSON reports under `evidence/`. Run the PHP test with PHP and the browser test with Python/Playwright plus Chromium. Paths in the scripts point to the preserved run workspace and are documented in the package.

Before installation, obtain and compare the actual current live plugin files through an authorized supported file-management path, preserve the working login repair, validate the complete intended target, apply only the reviewed changes and perform live acceptance with rollback available. Standard WordPress REST access is working; the WPVibe companion/CLI route separately returns 404 because the companion plugin is missing or inactive. Do not repeatedly reauthorize the already working site connection.

## Release gate

No plugin installation, frontend/backend deployment, subscription change, wallet action or campaign publication is authorized by these checks. The selected Render workspace is My Workspace; the frontend still reports the older deployed commit `d74baa42fffb10191eff1bcfc9a967f3c5e4c03a`, not the tested `ac724aabf1534e51e819ef5d84df04f246eeea23` candidate.

Preserve the 97 campaign proposals. No scheduling or publication until the owner's later explicit overall approval after the complete review. No catch-up publication from expired proposed dates.
