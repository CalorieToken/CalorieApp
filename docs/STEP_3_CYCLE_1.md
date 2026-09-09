# Step 3 — first bundled implementation candidate

Candidate: Identity Bridge **0.3.27**, based on the uninstalled 0.3.26 work in
PR #133. Keep its base `fix/desktop-widget-column-fit` (#131), ultimately the
accepted maintenance line. Never merge that maintenance history into app main.
The user requested fewer cycles and plugin uploads after supplying 99 mobile
screenshots, including blog detail links and public usecase pages.

## Included website work

- Retain the prepared CAL market sizing, compact original shortcut artwork,
  Down control on long pages and passive embedded-app startup cover from 0.3.26.
- Apply shared header rules to the public XUMM shortcode immediately, including
  the narrow Richlist header; initialize a card inserted after DOM readiness once.
- Wrap Richlist tables for horizontal scrolling without changing any rows,
  wallet addresses, sorting or destination links. The wrapper is keyboard reachable.
- Keep blog slider pagination in one horizontally scrollable row. All native
  slider controls and the separate blog/article links remain available.
- Refine mobile open-price donation fields/buttons, cart table wrapping and
  the checkout terms area's text size. Rules target the actual Brizy/WooCommerce
  classes found in the public HTML and preserve the existing design language.
- Extend the existing footer-label correction to full product/cart HTML after
  POST. Checkout, AJAX, REST, admin, JSON and fragment responses are excluded.
- Finish a successful open-price donation submission with a GET of the same
  product. Existing redirects and the WooCommerce cart-redirect setting win.
  Prices, quantities, notices, order state and gateway behavior remain owned
  by WooCommerce and the installed donation/payment plugins.

## Evidence and limits

Public product HTML posts `wcj_open_price` to the donation product itself.
[WooCommerce 11.0.1's form handler](https://github.com/woocommerce/woocommerce/blob/11.0.1/plugins/woocommerce/includes/class-wc-form-handler.php)
invokes `woocommerce_add_to_cart_redirect` only after a successful add with no
error notices. Without an explicit URL or its optional cart redirect, it can
render the POST response directly. The narrow bridge callback supplies the
same-product GET destination at that success boundary. This addresses a known
resubmission path consistent with the screenshot's `ERR_CACHE_MISS`; it is not
an end-to-end proof of the user's particular browser history.

The public Xumm payment JavaScript file contained no cancellation handler.
No live checkout was submitted and no payment request was signed, declined or
cancelled in this work. The faded checkout on return therefore remains an
explicit live acceptance item, not a claimed gateway fix.

The header and layout changes are supported by screenshot and public HTML
inspection. Automated DOM fixtures are not browser rendering. Browser tab
listing failed before inspection, so mobile/desktop appearance remains pending.
The startup cover applies only to the embedded frontend; the separate top-level
Render startup page on the accepted login route remains outside this change.

## Separate CalorieApp update

PR #132 against app main retains the prepared product-local portion controls
and CalorieApp wallpaper and adds a bounded food-search deadline correction.
The existing backend may spend 10 seconds on its primary request, 15 on its
fallback, plus queue time, while the old proxy stopped at 18 seconds and the
browser at 20. Search now has a 45-second proxy limit and 50-second browser limit.
Existing provider attempt/rate limits and every identity deadline are preserved.
There are no extra automatic search retries. The captured first failure has no
HTTP trace; the timing defect is demonstrated, its occurrence in that capture
is an inference. App deployment is separate from installing this ZIP.

## Focused acceptance after review

1. On a narrow phone, check Home, Richlist, one blog detail and one usecase:
   header stays readable, menu is usable, table scrolls, dots do not fill rows,
   CAL card is sized correctly and shortcut controls reach the expected place.
2. Enter a small donation, add it once, then use Back/Refresh from the resulting
   page. Confirm the cart amount/quantity do not increase. Review checkout terms;
   return after closing/declining an unsigned request and check checkout recovers.
   Do not treat Close as proof of rejection or an unsigned request as payment.
3. After inactivity, search once for Magnum. Observe completion or a useful
   bounded failure. Select a result near the top of a long list; its portion
   controls and feedback should stay beside that same product.
4. Repeat the accepted joint login/logout once and check a representative
   desktop width. Confirm the original page/browser and both sessions behave
   as before.

The source, behavior and package gates run in the existing PR workflows.
Keep the current installed package available for rollback. This candidate does
not publish prepared page copy, translate content, merge PRs or deploy services.
The second cycle handles the full page/article/usecase content inventory and
remaining source-backed content/asset refinements.
