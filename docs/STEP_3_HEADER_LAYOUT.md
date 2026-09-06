# Step 3: mobile header layout candidate

This bounded presentation change starts from Identity Bridge 0.3.20, public
checkpoint `checkpoint/2026-09-06-bridge-0.3.20` at
`ba149602fbc7c0ae0f2fce00a92af3cc9dd8439f`. It is not the completion of all
Step 3 website work.

## Changes in 0.3.21

- Reuse the earlier compact-card/shortcode-width and centring approach in
  separate CSS and JavaScript assets; do not copy the older login controller.
- At mobile widths, place the card in the header's flow. It stays visible with
  the menu open or closed and scrolls away with the header.
- Reserve at least 12px above an overlapping menu column, measured from the
  actual card height. Re-measure on resize, card/column size changes, fonts
  loading, and restored-page display; do not accumulate previous corrections.
- Keep sign-in and sign-out touch targets at least 44px high. Preserve the
  existing colour palette, text, buttons, and link destinations.
- Remove mobile corrections when returning to desktop widths.

The entry point enqueues the two independent assets. All existing files under
the plugin's `includes/`, both authentication/session JavaScript files, existing
embed CSS, and the app/backend source are byte-identical to the accepted base.
No new requests, browser storage, session messages, or logout handlers are used
by the layout script. The accepted backend cold-start navigation remains.

## Validation and limits

`tools/tests/wordpress_site_layout.test.mjs` exercises correction lifecycle with
a deterministic DOM geometry model. Existing authentication regression tests
remain the separate behaviour gate. The package's usual PHP and deterministic
archive checks still apply.

`tools/fixtures/bridge-mobile-layout.html` is a synthetic browser review fixture
with 360px, 412px and 1440px frames. Its review button checks signed-in/out card
sizes, open/closed menus, longer labels, scrolling, repeated resize, and a
desktop/mobile round trip. It uses the actual candidate assets. The fixture
markup models the legacy selectors and narrow shortcode wrapper; it is not a
snapshot of the installed Brizy page. No real wallet or account data is included.

Browser execution was blocked by the review environment's URL policy. Neither
the fixture's rendered geometry nor the installed WordPress layout is claimed
as visually verified. Before deploying this candidate, review it in an allowed
browser. After installation, check the real mobile header on the homepage,
CalorieApp and FAQ with the menu open/closed and signed in/out. Confirm that
the original sign-in and joint sign-out still work. The retained 0.3.20 ZIP is
the rollback artifact.

Other Step 3 items, including an embedded-app loading cover, shortcut icons,
market-card alignment and wider page refinement, remain separate follow-ups.
