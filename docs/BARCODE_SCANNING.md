# Food barcode scanning

Prepared 10 September 2026 for the owner's Step 1–3 review. This is implemented
source awaiting the normal app release and real-device acceptance.

## User journey

Expand “Scan a food barcode” below food-name search. Start the camera explicitly
or type a barcode. Camera recognition runs locally using lazily bundled ZXing
(browser 0.1.5, library 0.21.3); it does not require the less widely available
native BarcodeDetector API. No image is uploaded, recorded or persisted. No
camera is requested on page load or by opening the disclosure alone.

EAN-8, EAN-13, UPC-A and ITF/GTIN-14 are checked as 8/12/13/14-digit GTINs.
Leading zeros remain strings. QR URLs, invalid checksums, all-zero values and
other barcode formats are rejected; UPC-E is not advertised as supported.
Recognition stops after the first valid code and makes one guarded product
lookup. Users check the returned product and retain the existing explicit
portion/save action. Scanning never logs food, signs in or starts a transaction.

Stop, Escape, closing the disclosure, hiding/leaving the page, component
unmount, an overlapping search/save and a 60-second session deadline release
camera tracks. A permission grant arriving after cancellation is released too.
A stopped session cannot clear a newer camera's video stream. Manual input
remains available after camera failure or refusal. Copy covers the existing
11 locales, inheriting the app's language and direction.

## Exact product lookup

`GET /search-food?q=<GTIN>&mode=barcode` is forwarded by the existing first-party
proxy. The backend validates the GTIN again and makes one identified, bounded
GET to the fixed Open Food Facts v3 food-product endpoint. It follows no redirect
and never falls back to a name search or alternative provider transport for a
barcode. Returned code identity must match, allowing OFF's documented leading
zero normalization. Non-food or malformed responses are rejected.

The request shares the existing admission queue, circuit breaker, egress-rate
governor and provider-directed cooldown. Barcode/name caches and concurrent
request keys remain separate. No numeric conversion, new database, credentials,
telemetry or provider write is introduced. Nutrition uses the existing complete
source-provided serving/100 g-or-ml basis, with unknown values excluded instead
of zero-filled. The frontend independently filters mismatching barcodes, also
protecting a frontend-first rollout against an older backend ignoring `mode`.

Ordinary name search keeps its original route and behavior. Both frontend and
backend must be released before accepting the new scanner journey.

## Camera permissions and deployment

The frontend changes its own Permissions-Policy from camera denial to
`camera=(self)`; microphone, geolocation and payment remain denied. Site Style
1.4.8 delegates camera use only to the one verified existing app iframe on the
canonical CalorieApp page, using its exact approved HTTPS origin. It preserves
other iframe directives and explicit camera restrictions. It does not change
iframe URLs, authentication messages, Identity Bridge or native Xaman controls.

HTTPS, browser permission and every ancestor's camera policy must allow the
request. A restrictive hosting/WordPress response header cannot be overridden
by this plugin. If permission is denied, manual entry works; review an observed
hosting restriction deliberately rather than granting `camera *`. No hosting
configuration was changed in this review.

The WordPress ZIP supplies only the scoped iframe permission and site styling.
It cannot install this app component, backend lookup or USDA changes. A real
Android Chrome and iPhone Safari run, both embedded and standalone, is still
required; synthetic camera tests are not hardware or focus/lighting evidence.

## Acceptance pass

- Open the disclosure: no camera prompt until Start camera.
- Allow a rear-camera scan: one product lookup, correct packaging identity and
  nutrition basis, no diary entry until explicit confirmation.
- Cancel/refuse permission; stop while a prompt is pending; grant it late: no
  lingering camera indicator. Switch tabs, close the disclosure and navigate
  away: camera stops. Try again successfully.
- Enter a barcode with leading zeros. Compare it with the scanned product.
- Invalid code, missing product and incomplete nutrition: useful fallback,
  no invented food or nutritional zero. Test a provider pause without retrying
  in a loop; ordinary name search still works after the pause.
- Confirm locale/RTL, 320–390 px width, logged-in and logged-out flows, retained
  Nutri-Score colors, and that Xaman login/logout remain in the same tab.

## Sources and licensing

Reviewed documentation:
- [OFF product API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/)
- [OFF barcode normalization](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/ref-barcode-normalization/)
- [Camera permissions](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [ZXing browser project](https://github.com/zxing-js/browser)

The fixed compatibility versions support the project's Node 20 build. Latest
ZXing library 0.23.0 requires Node 24 and was deliberately not retained.
Resolved versions are in package-lock.json; required upstream notices are in
`frontend/public/barcode-licenses.txt`. OFF data keeps its existing attribution
and licence. This feature is not a full food catalog, professional nutrition
assessment or guarantee of scanner recognition on every device/package.
