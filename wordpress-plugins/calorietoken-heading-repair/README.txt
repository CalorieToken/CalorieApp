CalorieToken Heading and Language Repair 1.3.0

Install as a separate companion plugin. Keep the existing CalorieToken Site Style
and Identity Bridge plugins enabled. The original installed files are never edited.

This release is locally tested, NOT live-site accepted. It applies only to exact
known source hashes from the saved Site Style 1.4.46 or prepared 1.4.47 candidate.
If an admin warning says that files differ, the affected override is not applied.
Do not disable the compatibility checks. Reconcile the current source instead.

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

Task buttons inside the compatible CalorieApp can also request scrolling to a
fixed Account, Add food, Food log or Navigation target. The companion accepts
only those four target names, a finite in-frame offset and the exact approved
iframe window/origin. No account, wallet, login or individual food-log records
are sent.

It also adds a read-only CalorieApp login indicator to the existing account card.
The indicator accepts only a fixed state value from the exact approved iframe
window and origin. It receives no wallet address, account ID, token or food-log
content. Until a compatible CalorieApp build confirms state, it says that it is
checking; on pages without the app it asks the visitor to open CalorieApp.

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
