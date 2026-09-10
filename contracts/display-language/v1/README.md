# Display-language protocol v1

Status on 2026-09-10: integrated app release candidate, with Site Style 1.4.0 as
the matching website host. The app control is enabled by default. This is bounded
LANG-1 delivery, not translation of every page, login message or legal document.
The historical development evidence below is retained with its original scope.
The Step 3 master remains `docs/STEP_3_REPAIR_CHECKPOINT.md` on the maintenance
branch; this file documents the protocol rather than starting another plan.

## Inspected WordPress state

The authenticated installed-plugin list was read, without changes, on
2026-09-08. Its 25 listed plugins include Brizy/Brizy Pro, Complianz, WooCommerce
and Identity Bridge, but no separate translation plugin. The rendered public
home used `en-US` and had no language control. This does not exclude a custom
theme translation mechanism; complete CMS content/routing inventory remains
open. No plugin was installed/activated and no site settings were changed.

## Preview behavior

The WP selector is placed inside the existing account card when that card is
outside a form; otherwise it remains in ordinary page flow. The app selector
appears inside the app. Both use the fixed eleven native-language names.
The translated WP app-information component and the app's introduction, source
footer, food search/portion/diary controls, own request messages, USDA reference
and diary filter subscribe to display changes. Entered queries, custom portions,
filter text and existing product records are preserved; provider food names,
brands, barcodes and serving descriptions are not translated.

The visible preview notice explains that some content remains English. These
controls do not yet translate the full Brizy site, the existing login/account
summary and its parent feedback, artwork or complete legal documents. The
private export/import/erasure controls now also subscribe to display changes.
The page-level `lang` remains truthful for the existing English
content; already translated regions set their own `lang`/`dir`.

The separate pending-login locale, its checks, API requests, redirect/session
routing, consent and payment handlers are unchanged. No mutation of the
authentication `locale` query parameter or root data attributes is used.

## Activation and storage

The app is on by default; `NEXT_PUBLIC_CALORIEAPP_DISPLAY_LANGUAGE=0` is the
explicit off switch. Site Style 1.4.0 connects its website picker and recognizes
the existing app iframe without changing the Identity Bridge. Its host yields
to an already active native display-language controller. The older Maintenance
Bridge opt-in preview is not required for this release. Old `*_PREVIEW` flags
do not activate the new app control. The disabled app control renders nothing.

The only new browser record is `calorieapp.display-language.v1`, containing
`locale` and `savedAt`. An explicit changed selection is remembered for at most
30 days per origin. Re-reading an unchanged preference does not refresh its
expiry. Invalid/future/expired data is ignored, and denied storage falls back
to an in-memory choice. No preference is saved in an account, diary, database
or XRPL transaction. No polling, new provider, translation API or remote
preference service is added. Public WP HTML continues to use public locale
configuration; private preference state is not put into shared server caches.
The visible language notice discloses this browser storage and its 30-day lifetime.

## App introduction and source-footer slice

`frontend/config/app-introduction-copy.json` contains nine display strings for
each registry locale. The two small client components use the existing display
context; the page's login, search, reference and diary components retain their
placement and state. Disabled preview or an unsupported display locale renders
English. Each translated region sets its own `lang`/`dir`; changing these regions
does not change the English page language or the pending-login locale.

Attribution sentences contain plain-text tokens for the four existing source
and licence links. Translators may change word order, not destinations or HTML.
Brand/licence names retain their spelling and use bidi isolation. The footer
explicitly distinguishes OFF product data from the separate USDA reference
foods. It does not promise live USDA search or attribute the visitor's entire
diary to that source. The existing local logo, colours and links are retained;
the contribution label can wrap instead of forcing a wide footer.

The official source guidance was checked on 2026-09-08. OFF distinguishes the
database's ODbL, individual contents' DbCL and product images' CC BY-SA rights;
the short footer names the database licence and does not replace the complete
reuse/rights review. USDA identifies FoodData Central data as CC0 and requests
source attribution. Neither source clears the project's own code or trademarks.
See [OFF's licence guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/)
and [USDA's API guide](https://fdc.nal.usda.gov/api-guide/).
These prepared translations still need the integrated language/RTL review;
they are not complete translated privacy policies or terms.

## Food-control and recorded-grade slice

`frontend/config/food-ui-copy.json` adds 90 prepared strings per locale for
search, result cards, portion selection/validation, loading/error/success
messages, diary totals/details/actions and explicit bulk-deletion confirmation.
The English fallback remains available. Each owned region declares its language
and direction; long control groups can wrap, and provider values use bidi
isolation. Display formatting uses the selected locale for numbers and dates,
preserving the existing decimal precision and rounding before localizing the
notation. The custom percentage input and all request/persisted values are
unchanged.

Existing asynchronous controllers continue to store their own fixed English
status messages. `foodUi.ts` translates only that exact catalogue at rendering;
the locale does not enter request keys, effects, callback dependencies or
authentication checks. Success feedback retains the already selected product
and percentage in component memory so an outstanding response renders in the
current language. No translation request, new storage, payload field, provider
call, dependency or schema is introduced. Product text is inserted literally
in one pass and escaped by React. A language switch never accepts a deletion.

The former synthetic average Nutri-Score and gradient marker are replaced by
plain counts of the recorded A–E product letters and a separate missing count.
This corrective summary is present in both preview modes; disabling the
language preview is not a rollback of that correction. Each loaded log entry
counts once, including repeated foods. It does not derive a dietary grade,
weigh portion sizes or change source grades, nutrient totals or diary data.

This is a product decision informed by the inspected code and the official
description of Nutri-Score as a product calculation per 100 g/100 mL; converting
letters to an arithmetic mean was not that calculation. The [Santé publique
France guidance](https://inpes.santepubliquefrance.fr/index.php/en/nutrition-and-physical-activity/nutri-score)
was checked on 2026-09-08. No official logo is added and no trademark approval
or complete legal clearance is claimed. Retained product grades do not establish
which algorithm version was used. Language review and actual RTL/mobile
appearance are still required; automated key coverage is not translation review.

## Private-account display slice

The three existing export, import and erasure components use the shared display
choice only for their rendered copy. They reuse the unchanged eleven-language
`account-privacy-copy.json` catalogue; this is not a new privacy-policy version.
Their source `locale` prop and request handlers keep their original meaning.
Known local errors/success can be rendered in the current display language after
an asynchronous response, without a retry or changing its recorded outcome.
Unknown text and account/file values are not translated. When preview is off,
the original locale prop and message behavior remain in effect.

Selected files, exact account confirmations, acknowledgement state, review
visibility and request controllers survive language switches. Changing language
does not check a box, submit a form, enable a feature or abort/reissue a request.
The export keeps its private JSON bytes/name and object-URL cleanup. Authentication
loss and erasure callbacks still carry the original controller-language messages
to the unchanged Xaman parent; translating that parent feedback remains open.
The existing collapsed account-tools container and feature flags are untouched.

Identifiers remain LTR and isolated from surrounding RTL copy. Long button groups
wrap; these three sections use the existing brand palette with modest button
corners instead of pills. Those presentation changes also apply with preview off.
There is no new storage, provider, dependency, schema or financial operation.
The catalogue still needs linguistic/legal review alongside the full notices.

## CMS approach selected for the next bounded implementation

The 39 published URLs in `cms-surfaces.json` remain the inventory. On 2026-09-08
the [official Polylang WooCommerce product page](https://polylang.pro/pricing/polylang-for-woocommerce/)
describes a paid annual add-on covering checkout, cart, products and emails.
It is therefore not selected as a free solution for this site's complete scope.
This does not assert that ordinary Polylang page translation is paid. Brizy's
[2023 template-support discussion](https://support.brizy.io/hc/en-us/community/posts/13444418552082-Translating-Brizy-dynamic-templates-with-Polylang)
records limitations in that historical version; it is not proof of current
compatibility or incompatibility with the installed build. No translation plugin
has been installed and no new compatibility result is claimed.

Selected next experiment: a manually maintained, versioned first-party display
catalogue for static public content on the existing page URLs. Reuse the current
display controller and reviewed layout rather than implement a second page
system. This is an implementation direction, not an already working CMS renderer
or a claim that full-site translation will be cheap.

- Key entries by observed public WordPress ID and stable content slot, with
  source version, exact source-text/structure fingerprint, locale and review
  status. First prove one captured static Brizy usecase page. Do not bulk-copy
  the 39 pages or begin translating unfinished source copy.
- Patch only identified static text/attributes or reviewed artwork variants,
  preserving the existing nodes, layout and links. Unrecognized or edited source
  must remain intact and be reported as pending. Do not replace whole DOM
  subtrees, form HTML, editable user content or live widget values.
- Keep canonical URLs and existing inbound links. The existing display preference
  can apply on navigation; an optional public `ui_lang` hint is separate from
  the identity `locale`. Do not rewrite login, donation, callback or POST targets,
  redirect a pending flow, or infer cross-origin storage synchronization.
- Native WooCommerce/Complianz and account interactions need their own integration
  through supported localization interfaces. [WordPress's gettext guidance](https://developer.wordpress.org/plugins/internationalization/how-to-internationalize-your-plugin/)
  describes translatable software strings, not automatic translation of Brizy
  page bodies. No global locale override during authentication or checkout is
  selected by this design; dynamic states remain explicit acceptance items.
- Legal documents are versioned as complete documents. A source change invalidates
  the associated translation review; do not mix paragraphs from different source
  versions or label a partial translation as the current complete notice. Mark
  fallback language accurately and do not change a user's consent.

Stop this experiment after the representative Brizy surface and retained native
form fixture establish whether the adapter is small and robust. If safe stable
slots require broad interception or page duplication, record the concrete cost
and scope decision before extending it. This is a budget/implementation cutoff,
not permission to remove LANG-1. Actual Brizy, PHP, browser, native-plugin and
complete legal acceptance remain open. Do not repeat the general plugin survey
on the next turn without a changed fact.

## Message boundary

`runtime.js` is copied byte-for-byte into the independently deployed app and
WP assets. Artifact tests compare each copy with its canonical file, and also
compare the eleven-language selector copy. Publication follows the repository's
existing source and licence controls.

The namespace is `calorieapp:display-language:`; it never emits identity or
consent message types. Exact key sets, supported canonical locale tags, version,
trusted origin and exact sender window are checked. No wildcard destination is
used. The host recognizes only the existing configured app frames. The guest
recognizes its actual parent at the two existing HTTPS website origins.

- `hello` / `ready` establish the display channel on either loading order.
- `state` carries host epoch/revision, guest channel, acknowledgement, locale
  and whether it resulted from an explicit selection.
- `request` carries that epoch/channel, increasing sequence, base revision and
  the requested locale. A stale request receives current state, not permission
  to overwrite it. A still-pending explicit guest choice can then be submitted
  against the new revision.

The WP host coordinates embedded display state. An app's incidental initial
locale does not overwrite the host. A new explicit choice made while handshake
is pending is retained; rapid choices are coalesced so both sides converge.
Load/pageshow events recover startup without polling. Old channels, replayed
sequences, malformed messages and removed frames cannot overwrite current state.
Cleanup removes listeners. These identifiers are protocol context, not identity
proof.

## Evidence and remaining work

- Nine protocol/storage tests cover both directions for eleven languages,
  delayed startup, queued/concurrent choices, malformed/untrusted messages,
  stale/replayed requests, removed frames and cleanup.
- Real React server-render tests cover default-off behavior and the eleven-option
  accessible preview control. Component behavior fixtures cover live language
  updates without diary filter reset or USDA requests.
- The introduction/footer follow-up checks all eleven rendered locales,
  default-off/unsupported English fallback, source/licence token completeness,
  exact link destinations and RTL metadata using the actual React components.
  At the introduction-only commit `1829f31`, the changed-area display/food
  selection passed 33 tests; TypeScript, lint, the legal-boundary guard and a
  preview-enabled Next build passed. Its backend, login, food search/diary,
  language provider/runtime and root layout were byte-identical to `f054ade`.
- The food-control follow-up passed 57 focused food/display/deadline/retained
  readiness checks, TypeScript, lint, the legal guard and a preview-enabled
  Next build (167 kB first-load JS, previously 149 kB). New behavior fixtures
  preserve queries, request signals, custom input and exact save bodies during
  language changes; enforce one save and explicit localized deletion consent;
  update existing errors/success; and count known/missing product grades.
  Real React rendering covers all eleven food-control locales and escapes
  literal product/query text. The backend, Xaman/account/privacy controllers,
  API/auth routes, display provider/runtime, app root, request deadlines and
  dependency files are byte-identical to `1829f31`. This is not a hosted CI,
  signed transaction or new live-session acceptance result.
  The final rounding-preservation adjustment also passed the focused 25 food
  checks and a rebuilt preview; changing locale does not change a decimal value.
- The private-account display follow-up passed 28 account tests and 38 retained
  app display/login/readiness checks, TypeScript, lint, the legal guard and a
  preview-enabled build (still 167 kB first-load JS). Tests exercise pending
  export/import/erasure while switching all eleven languages, preserved exact
  bytes/headers/acknowledgements, no implicit submit, one download/request,
  errors and original authentication callbacks. Real React server rendering
  checks the existing copy, fallback and RTL metadata. Eleven existing controller,
  validation and download function bodies are byte-identical to `d6b3f1d`.
  Backend, Xaman parent, language provider/runtime, privacy catalogue, app root,
  request policies and dependencies are unchanged. Retained readiness checks
  include older co-located WP fixtures, not acceptance of maintenance Bridge
  0.3.32. No private user data, service, wallet or payment was used by the tests.
- WP wiring fixtures cover owned information text/direction, repeated startup,
  editor exclusion and preserving form/account nodes.
- The app authentication/food/private-account selection passed 100 tests; the
  maintenance website selection passed 64 tests. The later targeted original
  login-fixture check also injects display messages during a pending login.
  Nine package tests and both legal-boundary guards passed. TypeScript, lint
  and the preview-enabled Next build passed.
- PHP rendering/lint and actual candidate browser appearance remain unexecuted.
  PHP is unavailable in this environment, and the earlier local-preview URL
  policy block remains in place. This cycle did not retry or bypass that block.
  Public/admin inspection above is not visual acceptance of new code.

Next: execute the bounded static CMS experiment selected above, finish source
copy, connect the remaining login/account-summary/site surfaces and complete
legal documents, and review all eleven translations/RTL. Standalone app-to-WP navigation preference reconciliation,
multiple independent tabs, unsupported-browser messaging behavior and complete
integrated login/consent/mobile acceptance remain to verify. A display language
is not a country or financial-service eligibility decision. Keep the DEX,
retailer pilot and existing publication requirements separate.
