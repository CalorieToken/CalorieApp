CalorieToken Heading and Language Repair 1.6.7

Version 1.6.7 adds the CalorieApp content style to public pages and articles,
including Home, usecase subpages, documents, shop views and dynamic cards.
White cards, sans-serif body text, green headings, compact buttons and aligned
spacing apply only after the page title and before the footer. XPMarket stats
use readable rows on narrow screens. CalorieHelp and the FAQ page share the
same typography, answer cards and controls; mascot and conversation logic stay
intact. Header, title artwork, blue footer,
historical illustrations, image galleries, moving text, sliders, embedded apps
and account widgets are excluded. Existing nodes, links, data and handlers are
retained. No page-builder content or other installed plugin is overwritten.
The previous 1.6.6 ZIP is the rollback. No database migration is involved.

Install as a separate companion plugin. Keep the existing CalorieToken Site Style
and Identity Bridge plugins enabled. The original installed files are never edited.

Version 1.6.6 presents Testnet setup inline in the app area instead of a theme-
styled overlay. It uses CalorieApp typography, green actions, purple outlines,
four accessible step tabs, Previous/Next and a return to the existing app frame.
Going back retains the one created test account; closing or leaving a step hides
the recovery code. The code remains only in page memory, never in bridge messages.
Screenshots are optional disclosures. The companion is paired with the app's
two discoverable account-help entry points and five separate migration screens.
Neither package enables import, performs a migration or changes login protocols.
This release is prepared for review, not evidence of installation or live QA.

Version 1.6.5 repairs the two mobile identity hand-offs reported after the
1.6.4 acceptance. The site-wide Log out action now keeps its trusted
CalorieApp bridge alive for the app's full bounded logout window instead of
removing it after 30 seconds, and uses an off-screen one-pixel frame rather
than a display:none frame that privacy-focused mobile browsers may defer. The
legacy QR login intent also treats /index.php/calorieapp/ and the canonical
/calorieapp/ redirect as the same page, so the trusted CalorieApp frame starts
the existing joint Xaman login automatically after the navigation. The repair
replaces only the public URL of the exact reviewed Identity Bridge 0.3.29
site-session controller; the installed Bridge file, authentication endpoints,
proof checks, logout URL and CalorieApp code remain untouched. A different
Bridge version or byte hash fails closed.

Version 1.6.4 absorbs the live Additional CSS v4 regression repair into the
versioned companion. It restores the original account/login controls, aligns the
mobile header at one breakpoint, preserves 44-pixel controls and makes the top
and bottom shortcut arrows match their actions. On age-restricted routes it also
hides the native header login card even when the installed bridge omits the newer
identity-card class, then restores that same untouched card for adults. The
existing live override can
remain as a byte-for-byte behavioural fallback until this package has completed
backup, CI and live visual acceptance; removing that duplicate is a separate,
reversible cleanup.

Version 1.6.3 reconciles the reviewed source with the repair currently served on
the live site. It keeps the first CalorieApp document load intact while syncing
the resolved language before the identity bridge starts, avoiding a harmless but
noisy aborted-iframe error. It also keeps the public minor notice outside the
adult-only legacy buying sections, gives that notice the route's primary heading,
and supplies a hidden Twenty Nineteen compatibility target on headerless pages.
The missing-home-heading repair now also works when no conventional main wrapper
exists. The four changed browser assets are byte-identical to the reviewed live
1.6.3 assets.

The companion applies only to exact known source hashes from the saved Site Style
1.4.46 or prepared 1.4.47 candidate. If an admin warning says that files differ,
the affected override is not applied. Do not disable the compatibility checks.
Reconcile the current source instead.

Version 1.6.1 is the final pre-campaign UX polish pass. It safely accepts common
marketing parameters such as UTM and click identifiers, so the existing Help,
CalorieApp, discovery, Testnet and page enhancements remain available from
campaign links while preview/editor and unknown parameters remain blocked. It
also paginates and filters the 14,000-row Richlist, repairs duplicate/missing
heading semantics and document language metadata, keeps 44-pixel controls, and
prevents the theme's document-click handler from crashing on the automatic app
reveal. Child and teen modes now use public-only app wording and also protect
Trustline, donation and legacy buying routes while preserving public project and
transparency information. The paired app uses public search wording until the
adult experience is selected.

Version 1.6.0 adds the final age-aware and account-journey UX pass. Child and
teen modes now hide the complete Showcases account/wallet block, the personal
logbook journey and every internal or external financial shortcut. FAQ links
are filtered as soon as an age is selected without forcing an age dialog on an
otherwise public FAQ page. Child, teen and adult surfaces receive restrained,
brand-safe visual cues, while mobile floating controls keep 44-pixel targets.

The companion remains paired with the updated CalorieApp frontend: its guided
test-account route now has visible progress, numbered migration steps and an
export-only label while import is safely disabled. A logged-out export request
no longer fails silently; it returns to Account tools, explains that sign-in is
needed and moves focus to that message. Export/import panels use full-width
actions, a selected-file receipt and a four-part readiness indicator without
weakening exact-account confirmations or the reviewed server safety gate.

Version 1.5.6 completes the live embed hand-off. On the CalorieApp page it
synchronizes the already resolved display language with both the trusted iframe
URL and identity-bridge locale before that bridge starts. Its short loading card
uses the same one of eleven interface languages. If the trusted embed reports
that it loaded but the older bridge keeps its loading cover open, the companion
uses that bridge's own existing Show app action to reveal it automatically.

Version 1.5.5 completes the mobile repair pass. It resolves an explicit or saved
display language before public widgets are built, then uses the browser language
and Dutch site default as safe fallbacks. The embedded app stays visually pending
until its trusted host language arrives, preventing a flash of the wrong language.
For both 0–12 and 13–17 modes the complete dynamically inserted CAL/SWFT/DEX,
wallet and buying route is now hidden, including nodes added after page load.
It also compacts app tabs, search/results, login and nickname controls; prevents
logout-state contradictions; and reduces overlapping, oversized mobile controls,
dialogs, FAQ/help cards and test-account guidance.

Version 1.0.1 additionally accepted the exact live 1.4.46 presentation script
whose only byte difference is removal of the final empty newline by WordPress.
The JavaScript instructions are otherwise byte-identical to the reviewed source.

Version 1.1.0 adds a reversible CalorieApp focus view. It maximizes the existing
approved CalorieApp iframe inside the browser page instead of requesting native
fullscreen, so the existing CalorieHelp launcher remains available above it.
The same control or Escape returns to the prior page position.

Version 1.1.1 keeps the newly selected display language on the focus control and
session indicator while Site Style synchronizes its two language selectors. The
change event's exact supported locale is used immediately, so labels cannot lag
one language behind until a reload. Its focus-button click is also kept local to
the control. This avoids an unrelated Twenty Nineteen 2.1 document-click handler
that throws when a custom page intentionally has no .site-branding element.

Version 1.2.0 adds a compact product-grade summary to the existing CalorieApp
block inside the Xaman account card, outside the iframe. It receives only the
five A-E counts, total and known/missing coverage from the exact approved
CalorieApp iframe. It never receives food names, meals, nutrient totals, dates,
wallet/account identifiers or an averaged diet score. Nothing is stored in
WordPress or browser storage. Invalid, unavailable or signed-out data removes
the summary immediately. The explanatory text states that these are
source-provided product counts, not an overall nutrition or health assessment.

Version 1.3.0 makes that summary a combined OFF/USDA source overview. It shows
only aggregate counts for Open Food Facts, USDA and other/unknown entries. The
five A-E counts are explicitly limited to OFF products with a source-supplied
Nutri-Score. USDA entries still count in the app's nutrient totals but are not
misrepresented as products with a missing or inferred Nutri-Score. The same
strict iframe window/origin, count consistency and signed-out clearing rules
remain in force; no individual food or nutrient value crosses into WordPress.
The same release appends two short, translated notes to the existing CalorieHelp
CalorieApp and USDA answers: local alternative images are not source photos,
and USDA nutrient entries are separate from the OFF A-E product grades. Existing
help answers, steps, links and the original character are preserved.

Version 1.4.0 makes the summary compact and adds Today, This week, This month
and All period presets in all eleven interface languages. A preset sends only
its fixed name to the exact approved CalorieApp iframe; no diary date crosses
the frame boundary. The app returns the same bounded aggregate counts for that
period. Source counts and explanation remain available in a collapsed details
section, while loading and unavailable states clear the previous counts.

Task buttons inside the compatible CalorieApp can also request scrolling to a
fixed Account, Add food, Food log or Navigation target. The companion accepts
only those four target names, a finite in-frame offset and the exact approved
iframe window/origin. No account, wallet, login or individual food-log records
are sent.

It also adds a read-only CalorieApp login indicator to the existing account card
on the CalorieApp page only.
The indicator accepts only a fixed state value from the exact approved iframe
window and origin. It receives no wallet address, account ID, token or food-log
content. Until a compatible CalorieApp build confirms state, it says that it is
checking.

Version 1.5.0 removes the added CalorieApp status, nutrition overview and language
block from account cards on unrelated pages. Signed-out balance and rank placeholders
are also hidden there, while the original QR sign-in control remains available.
On the CalorieApp page, duplicate app branding, app link and language selector are
hidden from the account card; its short session status remains. The nutrition overview
is a separate panel beside the embedded app instead of part of the Xaman card. The OFF
A-E totals now include a proportional colour bar as well as exact counts.

The same release adds a selective three-band age experience to CalorieApp, CAL &
Crypto, Showcases and the CalorieHelp launcher. The bands are 0–12, 13–17 and 18+.
No date of birth is requested. Only the fixed band is stored in sessionStorage and
is removed when that browser tab closes; it is not identity or age verification.
For the two minor bands, wallet login, transaction links, crypto instructions and
personal diary features are hidden while public nutrition search and general site
content remain available. Most WordPress pages are not gated. Communication with
the embedded app contains only the fixed band and uses the exact approved iframe
window and origin.

Version 1.5.1 integrates the established first-party Testnet account guide into
the adult CalorieApp guided-setup journey. The original guide is moved from the
long section below the app into a keyboard-accessible dialog and returns the
visitor to the next in-app step when its final Back button is used. Only exact
two-field ready/open/available/complete/closed messages pass between the one
approved root-path CalorieApp iframe and WordPress. A recovery seed, address,
account identifier, nickname or export content never crosses that bridge. The
original Testnet controls remain responsible for creating, showing and clearing
the seed, and the guide cannot open until the adult age band is selected.

Version 1.5.2 gives CalorieHelp an open-C mascot that follows the CalorieApp/C
identity: the right side stays visibly open around the fork and knife, while the
character keeps its face, arms and legs. The same local transparent asset is used
in the launcher and Help header. The Help panel is wider and calmer, keeps the
most useful topics immediately visible and places remaining allowed topics in one
native expandable section. Answers, example text, topic visibility and the
page/Help context banner follow the selected 0–12, 13–17 or 18+ mode. Minor modes
receive public food, nutrition, project and privacy help without adult wallet,
trading, trustline, test-fund, account or diary instructions. Relevant WordPress
pages show the selected environment plus a plain-language summary of what is
available; ordinary pages remain open and ungated.

Version 1.5.3 applies the final live visual review: the compact Help age banner
now follows the character heading and states only the selected environment and
available scope. The longer restriction explanation remains available exactly
where it is useful: in a blocked-topic answer and in the relevant page banner.

Version 1.5.4 removes the persistent age banner from the relevant WordPress
pages after a visitor has chosen a band. Changing an existing choice no longer
clears it first: the current band stays active until a replacement is selected,
and the change dialog has a top close control, Escape support and backdrop close
even on CalorieApp, CAL & Crypto and Showcases. The small age control remains
inside CalorieHelp so the choice can still be reviewed without occupying the
page above the app.

The coordinated CalorieApp candidate adds five adult task tabs: Account, Guided
setup, Packaged food, Basic food and Diary. Its optional nickname remains only
in sessionStorage for the current browser tab, is not exported and is removed
on sign-out. Product results and diary entries use bounded internal lists; the
selected portion editor and selected diary detail are brought close to the
current task to reduce long up/down page scrolling. CalorieHelp and inline FAQ
answers in all eleven supported languages explain the tabs, nickname boundary,
seed isolation and the safe test-to-real data route.

A Testnet wallet is not converted into a Mainnet wallet. The safe route is a
private CalorieApp export, complete sign-out, a fresh Mainnet account in Xaman,
an empty destination account and then food-log-only import. Export is available;
import remains fail-closed unless the separately reviewed server-side safety
gate and matching client control are explicitly enabled. Wallet, identity,
session, notice history and nickname are never transferred by that import.

It replaces cosmetic heading wrapping with CSS Custom Highlights, retaining text
nodes for language rendering, and includes the prepared menu/help-label repairs.
Existing general layout CSS, authentication flow and stored data schema are unchanged.
The separately reviewed app candidate adds only aggregate source counts to its
existing diary-overview response; this companion never writes those records.
Older browsers fall back to colouring only a heading's first letter.

Deactivate this companion to restore original asset selection. Reload open pages;
refresh any existing full-page cache through its normal controls when necessary.
There is no migration, setting change, remote call, credential or paid service.

The separate evidence package contains source, tests, limitations and continuation
instructions. Complete live verification before marking the incident resolved.
License: GPL-2.0-or-later, matching the underlying Site Style presentation source.
