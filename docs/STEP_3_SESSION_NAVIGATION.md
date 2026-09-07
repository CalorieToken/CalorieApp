# Step 3: session labels and floating shortcuts

## Requested changes

- Move the existing authenticated CalorieApp-page logout control from above
  the iframe into the XUMM widget. Use “Log out” on all website controls, with
  an accessible explanation that the website and app sessions end on this device.
- Hide a floating Home shortcut on Home and a floating CalorieApp shortcut on
  CalorieApp, including equivalent URLs without `index.php` or trailing slashes.
- Replace the floating Integrated Exchange shortcut with CalorieApp and the
  original transparent phone mark, retaining Brizy's icon size and wrapper.
- Prepare the app's matching label and Open Food Facts contribution footer in
  a separate main-based PR: https://github.com/CalorieToken/CalorieApp/pull/129.

## Maintenance boundary

Plugin 0.3.22 starts at installed maintenance merge
`6f754c837cf80b05422d347b5a43c512aa3c9dea` (0.3.21). This branch must not be merged
into app main. The full embed controller, PHP authentication methods, accepted
startup URL and session validation are preserved. The site-session script moves
the same button/status nodes after the embed controller has captured them; it
does not register another logout handler for the embedded page.

The navigation script targets existing Brizy icon links in fixed containers.
It does not rewrite inline exchange content, the header logo, other floating
destinations, or create a new floating bar where one is absent. The live Home
and FAQ pages have the older exchange shortcut; the current CalorieApp page
has no such Brizy shortcuts. Its current-page rule is ready for any matching
shortcuts subsequently added to that template.

## Logo source

The transparent SVG uses the nine original phone-mark paths from page 1 of
`calorieappdraft3.ai`, in the CalorieToken Google Drive:
https://drive.google.com/file/d/1FMepF9HinYi9Pd5AuR7BSOO6peY5gIPu/view

The phone mark is visually matched to `logo app.png`. Vector forms, speaker,
home button, fork, knife and original colours are retained. The artboard,
surrounding square and duplicate fork/knife paths are excluded. There is no
embedded raster image, white background, script or external asset in the SVG.
Its source and mark boundary are recorded in the release provenance and notices.

## Verification

The real embed and site-session scripts run together in the existing session
test. After relocation, the captured logout button still requests app logout,
recovers after a timeout, and completes WordPress logout on the accepted iframe
message. The other session tests retain origin/source/locale and retry coverage.
Navigation tests cover Home, CalorieApp, FAQ, URL variants, inline content,
unrelated icons, shared wrappers and invalid external asset configuration.
The existing responsive header tests cover changes in the account card height.

Run:

```sh
node --test tools/tests/calorieapp_embed_readiness.test.mjs tools/tests/wordpress_site_session.test.mjs tools/tests/wordpress_site_layout.test.mjs tools/tests/wordpress_site_navigation.test.mjs
php tools/tests/wordpress_site_session_markup.test.php
python -m unittest tools.tests.test_build_wordpress_plugin_release
python tools/build_wordpress_plugin_release.py --expected-version 0.3.22
```

CI also lints plugin PHP. The original vector extraction is rendered and
visually inspected locally. No candidate is installed by this PR. Native
desktop/mobile rendering of the candidate follows the user's installation
approval; synthetic DOM checks are not a live browser rendering claim.
The previously observed small-desktop card clipping remains a separate followup.
