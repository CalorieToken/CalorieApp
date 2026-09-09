# Display-language preview v1

Status: local, opt-in development preview. These are bounded LANG-1 implementation
slices, not full eleven-language delivery or an installed feature. Maintenance
Bridge 0.3.37 and the corresponding app candidate are separate artifacts.
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

## Shared shortcut and Richlist helpers — 0.3.37

Five shared-navigation labels and three Richlist helper labels are prepared in
all eleven locales. They subscribe to the existing display store. The navigation
catalogue is included only with the opt-in preview; the Richlist catalogue is
additionally restricted to its known public page. Incomplete/unsupported copy
falls back as a whole to English. Only owned helper regions set `lang`/`dir`;
existing table values, links, ranks and table language/direction are retained.

The local `calorieapp:page-tools-ready` event carries no data. If the shared
shortcut component initializes after the display controller, that controller
reads its own existing store rather than accepting event data as a preference
or identity. No second store, cross-origin channel, authentication signal or
consent mutation is added. Replacement navigation retains destinations/icons
and receives current display copy without accumulating scroll handlers.

These helper catalogues are prepared-unreviewed and release-unapproved. They
do not translate page bodies, native WooCommerce/Complianz copy, artwork or
complete legal documents. Standalone cross-origin/cross-device synchronization
and the other LANG-1 acceptance items remain open.

## Local activation and storage

Both switches are off by default. For an authorized development preview only:

- WordPress: `CALORIEAPP_DISPLAY_LANGUAGE_PREVIEW` must be the boolean `true`.
- App build: `NEXT_PUBLIC_CALORIEAPP_DISPLAY_LANGUAGE_PREVIEW=1`.

This documents the switches; it is not production activation or a bypass of
source clearance, review or publication approval. The WP switch queues no new
assets/markup when disabled; the disabled app control renders nothing and the
existing component locale initialization is retained. The app preview build
was compiled locally with the flag on.

The only new browser record is `calorieapp.display-language.v1`, containing
`locale` and `savedAt`. An explicit changed selection is remembered for at most
30 days per origin. Re-reading an unchanged preference does not refresh its
expiry. Invalid/future/expired data is ignored, and denied storage falls back
to an in-memory choice. No preference is saved in an account, diary, database
or XRPL transaction. No polling, new provider, translation API or remote
preference service is added. Public WP HTML continues to use public locale
configuration; private preference state is not put into shared server caches.
Exact public privacy/cookie wording must cover this storage before activation.

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
  status. The first captured static Brizy sample is now the two-paragraph FAQ
  experiment below. Do not bulk-copy
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

## CMS experiment follow-up

The first bounded experiment is now recorded in [CMS_EXPERIMENT.md](CMS_EXPERIMENT.md).
Cafes has image-led main content; the text prototype instead uses two uniquely
observed public FAQ paragraphs (page 6855). It retains the twelve coloured
question fragments and one answer text node, with an unpublished eleven-language
copy proposal separating current food functions from planned extensions.
The local 0.3.33 candidate now includes byte-identical adapter/catalogue copies.
They load only under the existing opt-in WP preview on the published public FAQ
GET, with page/preview/password/query checks. The same store drives the sample;
load/pageshow allow bounded late discovery, persisted pagehide keeps the connection
and final unload restores still-owned source. No new observer, preference or
provider is added. Twenty-six CMS/display tests and nine package tests pass;
PHP execution, installed/native browser acceptance and copy/visual review remain
open. App `80ba6ff` and the shared display/identity runtime are unchanged. This
completes the bounded wiring, not full-page translation. Before extending the
catalogue, return to the remaining source-copy/page defects in the master.

## Blog helper follow-up

Bridge 0.3.34 connects three public blog helper strings to the same store through
an owned display-only callback. The public WP locale remains the default without
the preview. All eleven entries are prepared-unreviewed; Arabic/Urdu use RTL and
isolate the fixed profile handle. The helper sits outside X/CMP content; no cookie
choice, native banner wording, provider post or account value is translated by
this callback. Load/pageshow applies the current choice if the helper script was
late; no second store, preference or message namespace is added. The focused
blog/source findings and 57-test maintenance selection are recorded in
`docs/STEP_3_BLOG_ROADMAP_REVIEW.md`. Actual provider/native/visual acceptance
and full CMS/legal translation remain open.

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

Next: the bounded FAQ wiring is prepared; finish remaining source
copy, connect the remaining login/account-summary/site surfaces and complete
legal documents, and review all eleven translations/RTL. Standalone app-to-WP navigation preference reconciliation,
multiple independent tabs, unsupported-browser messaging behavior and complete
integrated login/consent/mobile acceptance remain to verify. A display language
is not a country or financial-service eligibility decision. Keep the DEX,
retailer pilot and existing publication requirements separate.


### Trustline helper in rebuilt 0.3.38

The public issuer/currency copy feedback, native-handler action and context note
have eleven prepared, unreviewed translations in `config/trustline.json`. They
use the same display store through `CalorieAppTrustline.setLocale`; a local
`calorieapp:trustline-ready` notification only asks that controller to read its
existing store. Event details are not used as locale or authentication input.
The catalogue is sent on the known Trustline page only when the existing preview
is enabled. Incomplete/malformed/unsupported copy uses the complete English
fallback. Dynamic text is literal, and only helper-owned nodes change language
or direction. Source token paragraphs, native alternatives, account/session
locale and legal documents are not translated by this adapter.


### Tokenomics helper in 0.3.39

Public page 1209 loads seven helper strings from plugin `config/tokenomics.json`.
The eleven prepared-unreviewed locales use the existing display store through
`CalorieAppTokenomics.setLocale`. Late readiness takes that store's current value,
ignoring event payload data. Missing/incomplete copy falls back wholly to English.
Only two added panels receive language/direction; the public address stays LTR,
and historical graphics, native links, account/consent and legal copy are retained.
This is not full-page translation or reviewed multilingual legal publication.


### Complete owned How to Buy guide in 0.3.40

The 29 guide strings in plugin `config/how-to-buy.json` cover the owned newcomer,
asset identity labels, buy/sell/reserve/withdrawal guidance, market scope and
conflict/risk copy in eleven prepared-unreviewed languages. The existing store
calls `CalorieAppBuyGuide.setLocale`; late readiness ignores event data and takes
the current store value. Text nodes and the owned accessible label change only
when the generated guide, exact identities, original destinations and known
copy still match. Missing/partial translations fall back wholly to English.
Addresses, currency codes, links and unrelated account/form state remain intact.
This closes prepared guide-copy coverage, not full CMS/legal/artwork translation
or native linguistic acceptance, and enables no financial service.
