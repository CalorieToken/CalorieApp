# One-page CMS display experiment — 2026-09-08

Status: **included in local Bridge 0.3.33, opt-in and off by default; not installed
or accepted**. App remains at `80ba6ff`.
This records the bounded follow-up to the CMS approach in `README.md`, under
LANG-1 and WEB-16. The maintenance master remains
`docs/STEP_3_REPAIR_CHECKPOINT.md`; this is not a new project plan.

## What the source inspection changed

The [public Cafes page](https://calorietoken.net/index.php/cafes/) presents its
main content through `cafesv.png`, with ordinary Back/footer/consent text around
it. A text-node adapter cannot translate words contained in that image. The
image and other usecase artwork remain separate work; this finding does not
establish that every usecase has the same structure. No image was edited.

The [public FAQ](https://calorietoken.net/index.php/faq/), WordPress ID **6855**,
does have Brizy text. A read-only DOM inspection found exactly one paragraph
with `data-uniq-id="uddCR"` and one with `data-uniq-id="mE0AL"`, both in the same
`div[data-brz-translate-text="1"]` under `.brz-rich-text`. The first question's
coloured initials and word endings occupy twelve separate `strong` elements;
the answer uses one `span`. Replacing whole paragraphs would discard this
historical formatting. The exact public paragraphs are retained in
`tools/fixtures/step3/faq-mission-source.html`. The wrapper in that fixture is
minimal context, not a capture of the entire page or browser state.

Only these two public paragraphs were saved. Account details, cookies, consent
state, admin controls, form values and other private content are not in the
source fixture or catalogue. The browser inspection changed no site content,
settings or consent, and did not execute the candidate in the page.

## Candidate wording and eleven languages

`cms-faq-preview.json` binds the two original DOM shapes and their SHA-256 audit
fingerprints to one draft copy version, `faq-mission-current-and-planned-v1`.
Runtime matching compares the complete original shape/text; the digest is an
audit fingerprint, not an authorization mechanism or cryptographic live check.

The proposed English answer is:

> CalorieToken's goal is to connect food information with uses of the XRP Ledger.
> CalorieApp currently offers food lookup and a personal food log. Retail
> payments, supply-chain tracking and an integrated exchange are planned extensions.

This uses the accepted app baseline and the recorded unimplemented payment,
traceability and DEX requests. It does not announce those planned services as
available or promise a delivery date. It is an unpublished wording proposal,
not a legal classification or a complete review of the FAQ's other claims.

All eleven catalogue entries translate the same proposed answer. Each question
maps explicitly to the twelve existing text nodes. Unused nodes remain present
with empty text; no node is removed or replaced. Non-Latin phrases use complete
prepared fragments without a runtime character-splitting heuristic. Existing
font/style attributes remain intact. Exact translated appearance, glyph support,
colour balance, line wrapping and Arabic/Urdu shaping still require visual and
language review. Every translation remains `prepared-unreviewed`, and
`release_approved` remains false.

## Adapter behavior and boundaries

`cms-preview.js` exposes an explicit `connect({enabled, document, location,
catalogue, store})` experiment. It consumes the existing display store's
`get`/`subscribe` interface and never selects a language, creates another store,
changes storage or emits a message. The canonical adapter and catalogue are
copied byte-for-byte into the WordPress plugin. Package verification compares
both copies, including their ZIP members. Mode is `opt-in-development-preview`;
this names the experiment and does not advance any copy/source approval.

- Only the exact HTTPS FAQ route on the two established site origins and body
  page ID can match. Only an optional `ui_lang` query is allowed; it does not
  set the display language or change the identity locale. Other query contexts
  keep the source content.
  There is no navigation, redirect, locale override or rewritten destination.
- Both paragraphs must be unique, in the same known public Brizy container, and
  match their complete captured tag/attribute/text shape. Forms, links, buttons,
  editable regions, account/embed controls, WooCommerce, the consent banner and
  the editor cannot become translation containers.
- All translated fragments and the copy version are checked before writing.
  Only existing `Text.data` plus the two paragraphs' `lang`/`dir` change. Root
  page language, child elements, classes, inline styles, IDs and links remain
  untouched. No HTML parser, `innerHTML` replacement, automatic translation,
  polling, observer, fetch or provider is used by the adapter.
- A missing or stale translation restores still-owned, unchanged nodes to the
  captured source. A changed/duplicated/replaced/moved node stops the adapter;
  that external edit is left intact. Its unchanged companion can be restored.
  The adapter never overwrites an external edit merely to enforce one language.
- `disconnect()` removes the store listener and restores only still-owned,
  unchanged nodes and their original language attributes. A later `refresh()`
  can discover initially late known content; stopped source conflicts require a
  new reviewed connection. The source fingerprint must change with a real CMS
  source edit, rather than accepting a near match.

This is a display-only experiment. It adds no personal-data collection, provider,
storage, cookie, legal effective date, capability, payment or consent change.
Public privacy/terms, country/service availability and artwork remain separate
review items. It does not relax the existing source/publication restrictions.

## Opt-in WordPress integration

The existing strict boolean `CALORIEAPP_DISPLAY_LANGUAGE_PREVIEW` flag remains
off by default. When enabled, PHP loads the extra adapter and public catalogue
only for a GET of published, non-password-protected FAQ page 6855, outside a WP
content preview and unknown/editor query contexts. Admin, feed, embed, AJAX and
REST retain the existing exclusion. Ordinary pages get no FAQ asset or catalogue.
The server checks use WordPress's page query and preview interfaces; password
protection is checked from the raw page field, independent of a visitor's
password cookie. See [is_page](https://developer.wordpress.org/reference/functions/is_page/),
[is_preview](https://developer.wordpress.org/reference/functions/is_preview/), and
[get_post_field](https://developer.wordpress.org/reference/functions/get_post_field/).
No account preference is placed into cacheable server configuration.

The controller passes its existing store to one adapter connection. Initial
startup, a language change and existing `load`/`pageshow` events can discover late
known content. There is no added observer, retry timer or second preference.
Content arriving after those events waits for a later explicit language change;
that is a deliberate limit of this sample, not universal Brizy lifecycle support.
A persisted `pagehide` keeps the same connection for back/forward restoration;
`pageshow` checks its source again. A final unload disconnects and restores only
still-owned source. Source conflicts stay stopped across lifecycle events.
The ordinary selector continues when the FAQ asset/configuration is absent or
the sample cannot match. These changes do not alter the shared identity/runtime.

Disable the display-preview flag, clear affected page caches when used and
reload to restore ordinary stored CMS content without disabling the identity bridge. Already-open documents need that
reload; changing server configuration cannot rewrite them remotely. Do not
activate the candidate on the live site as a substitute for review/acceptance.

## Evidence and decision

The original offline proof at `bb4c519` passed 21 CMS/display tests. With the
WordPress wiring, **26 CMS/display tests and nine package tests pass**. Five
additional wiring cases exercise the packaged adapter with the actual shared
store: eleven choices without a second store, unavailable config/runtime and
wrong routes, late content, back/forward/final-unload behavior and preserved
external edits. Syntax and the repository's legal-boundary guard pass.
The fixture is parsed independently with Python's
standard HTML parser; a bounded node model exercises all eleven choices,
node/text identity and style preservation, rollback, stale/malformed copy,
literal markup characters, source edits/duplicates and late content.

The control fixture retains the existing donation test's `wcj_open_price`,
`quantity` and product ID **1761** fields with synthetic entered values, plus
synthetic account/consent state and event-handler references. None changes or
submits during language switches. This is **not** a native WooCommerce browser
test, PHP execution, real payment/signing test or complete responsive acceptance.
Seven retained same-tab session/Xaman-readiness tests also pass; the shared
display runtime and existing identity controllers match the pre-wiring commit
byte-for-byte.
The existing PHP fixture now covers default-off behavior even on the FAQ,
dependency/configuration isolation and fifteen request/page cases, including
POST, HEAD, preview, editor, draft, private, password protection and unknown
queries. It remains **unexecuted locally because PHP is unavailable**; the
existing maintenance workflow runs it in its normal and preview modes. Hosted
CI on this candidate is still pending.
The candidate was not injected into the live page or used to retry the earlier
blocked local visual preview.

Conclusion: these exact Brizy fragments can be updated through the existing
display store without replacing their nodes in the bounded model. This supports
a small opt-in integration for this sample; it does **not** establish economical
full-site translation, image translation or compatibility across all 39 routes.
App `80ba6ff`, deployed plugin files and the shared display/identity runtime are
unchanged; maintenance candidate is **0.3.33**, last observed installed **0.3.29**.

The bounded wiring is complete locally. Keep the sample separate from full-page
completion. Next take final source copy and remaining page defects through the
existing acceptance inventory; do not
translate the entire old FAQ or duplicate pages speculatively. Legal documents
must remain whole-version review units. Read-only public DOM inspection here
does not lift the pending PHP/browser or publication requirements.
