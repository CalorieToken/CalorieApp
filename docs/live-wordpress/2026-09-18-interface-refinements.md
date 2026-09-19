# Live WordPress interface refinements — 18 September 2026

Applied to calorietoken.net using WPVibe's supported content patch endpoint, in the active Twenty Nineteen Additional CSS post (7013). WP Super Cache was purged after changes. No plugin upload, theme publication or Render deployment was needed; the active repair plugin remains 1.6.17.

## Changes

- Open submenu links have an 8 px gap. Desktop dropdowns start below the complete main menu, including a second row; mobile submenus expand in document flow.
- The CAL buying guide uses the existing green cards and green action buttons. Its redundant outer frame is removed on desktop and mobile, including the mobile disclosure wrapper. Text, issuer details, URLs, consent and transaction behavior are preserved.
- Pages without an XPMarket widget receive the same centered, translated slogan above the ending CalorieApp card. Existing market-widget slogans keep their original placement.
- Arabic and Urdu mirror menu order, account and information cards, XPMarket, and the floating controls. The help launcher stays opposite the shortcuts. Mobile shortcut order also mirrors. Numbers and account addresses retain isolated left-to-right rendering.
- At widths up to 360 px, shortcuts use a 4 px gap to keep space beside the help launcher.

## Verification

All 30 published WordPress page routes were inspected in the browser, including all six usecases. Each rendered a centered slogan above its market widget or ending information card, with no measured help/shortcut overlap or horizontal overflow at desktop width. Checkout redirected to the cart with the empty test cart. See the accompanying JSON audit.

Switching languages through CalorieHelp was tested for Dutch, French, Arabic and Urdu, then back to Dutch. The slogan and menu/widget direction changed immediately. The help launcher and shortcuts remained separate.

Visual browser checks covered the desktop dropdown and buying guide, the Arabic mobile menu and floating controls at 390 and 320 px, and expanding the Dutch mobile buying guide. The existing mobile disclosure behavior was retained. No wallet, transaction, consent or account-creation action was performed.

The stylesheet parses successfully with PostCSS. Its rules use the existing calorietoken-content cascade layer and named component selectors; no global font reset or artwork replacement is introduced.

## Deployment and rollback

The accompanying CSS is the source of the live override. For a future deployment, apply it once to Additional CSS; do not publish the unrelated WPVibe draft theme. Existing slogan language variables remain in the earlier Additional CSS blocks.

To reverse this change, remove only the block between `BEGIN CalorieToken menu, guide, slogan and RTL refinements 2026-09-18 v1` and its matching `END` marker, then purge the WordPress page cache. Keep the preceding slogan, translation, contact, showcase and donation rules.
