# Nutrition summary, product illustrations and stable navigation

This change follows the user's video of a logged week with an empty score bar,
and their reports of jumps when opening diary entries and alternative products.
It is based on the same source tree as live release
`6ba4acc4f1866bd3155e17b0bf69d84a295c5b81` (PR #146).

## Changes

- Heading Repair 1.6.11 restores the missing A–E segment colours. The summary
  shows the number of logged entries, how many have a supplied score, and why
  a logged period can have no score distribution. Empty periods have their own
  message. Unscored food still counts; no nutrition grade is invented.
- The compact summary has larger text and 44px period controls, with copy in
  all eleven supported display languages.
- Missing, rejected and broken product photos use 38 original local food
  illustrations. A fixed multilingual name matcher chooses the picture, with
  a supplied USDA category as a fallback. Unrecognised foods use a neutral
  meal illustration. Real allowed source photos remain preferred.
- Diary details open inside the clicked row. Closing restores focus to that
  row without scrolling the outer page.
- Alternative searches retain a stack of the original results, query and list
  position. A named back button restores the original product without another
  request. USDA alternatives also restore the previous grams and locale.
- Portion forms stay beside the originating product. Routine search, result,
  detail and tab focus uses `preventScroll`; duplicate child/parent scroll
  commands were removed. The WordPress bridge only moves an off-screen
  destination into view, using one immediate adjustment.

## Navigation audit

Reviewed packaged search and retries, product detail/portion opening and
cancellation, alternative selection/search/back, USDA results/grams/back,
diary detail/filter/close, workspace tabs, account/guide returns and explicit
guide navigation. Deliberate navigation to a separate guide section retains
its destination request. Source/origin validation on the parent bridge is
unchanged.

## Verification

- Full local JavaScript regression suite: 413 passed after the final edits,
  including category safety and rendering restored details before resetting
  the remembered list offset.
- TypeScript `--noEmit` passed; the final Next.js production build passed.
- Five Heading Repair packaging tests passed; the ZIP builder verified all
  25 packaged files against the source tree.
- Original SVG contact sheet rendered and visually inspected.
- Food UX CI run 35267251414 passed: 413 JavaScript and 340 backend tests,
  production build, packaging/PHP checks, and isolated browser checks for food,
  account/profile, account guides and the WordPress score summary. Food browser:
  80 checks; heading nutrition browser: 71 checks; guide browser: 47 checks.
- WordPress content styling CI run 35267251484 passed.
- Browser coverage includes all 11 display languages and 360/412/1440px widths.
- Live verification confirmed the deployed build ID, a successfully loaded rice
  illustration and details inside the selected row. Choosing a rice alternative
  and returning restored the exact original record and its 75g amount. This
  check used the public search flow and made no diary or account writes.

## Release and rollback

The app changes require a frontend release; the upper WordPress summary and
outer-page scroll adjustment require Heading Repair 1.6.11. The ZIP alone
does not publish the frontend. No backend, database, authentication or account
data changes are included. Keep Heading Repair 1.6.10 and frontend commit
`6ba4acc4f1866bd3155e17b0bf69d84a295c5b81` available for rollback.

Prepared ZIP SHA-256:
`5949750c076f6694548d407cb8b87fdd9ce490b0dfdb05ca939180970403ad9c`.

## Live release — 17 September 2026

The user approved GitHub publication and deployment after passing browser
checks. PR #149 merged as `905cba09d389da9069015fba81d398937f74c33f`.
The merged tree `a47eaef2bb66c38c0d052a6933c1940ee0117c19` exactly matches
the tested source tree. The existing release branch was fast-forwarded.
Only the existing frontend service was deployed; plans and backend deployment
were unchanged.

Render deploy `dep-dam4b4fcgkoc7389rr90` became live at 19:56:16 UTC.
`https://app.calorietoken.net/` exposes the matching build ID. No new
application errors were returned by the post-deploy Render error-log check.

After the user confirmed installation, the live WordPress CalorieApp page
served Heading Repair 1.6.11 for app-focus.css, app-focus.js and
nutrition-summary.js. Both the frontend release and companion plugin are now
live. The aggregate panel remained hidden in this signed-out browser session;
private logged-week behaviour was verified in the isolated browser tests.

- Pull request: https://github.com/CalorieToken/CalorieApp/pull/149
- Food/browser CI: https://github.com/CalorieToken/CalorieApp/actions/runs/35267251414
- WordPress CI: https://github.com/CalorieToken/CalorieApp/actions/runs/35267251484
