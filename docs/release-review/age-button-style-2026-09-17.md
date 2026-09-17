# Age-specific buttons — 17 September 2026

The owner requested small, age-appropriate changes to button shapes and brand
shades. The adult view must retain the approved 1.6.8 appearance. The owner has
now installed 1.6.8; the authenticated plugin inventory confirms that version.

- Child (0–12): 22px rounded buttons, light green and purple-blue fills, dark
  readable labels. No extra animation or rewards.
- Teen (13–17): 8px corners, deeper green and purple-blue fills, calm surfaces.
- Adult (18+) and unselected: unchanged button declarations and palette.

CSS uses the existing app `data-age-band` and WordPress `data-ct-age-band`
attributes. No age detection, new collection, storage, authentication, nickname,
permissions, navigation, text, historical banner or artwork changes are made.
The initial three-choice age picker remains unchanged. Button labels on the new
solid shades have at least 5.54:1 contrast in the checked normal/hover pairs.

Heading Repair 1.6.9 includes every 1.6.8 fix plus the WordPress button variants.
The app's matching change is confined to `frontend/app/globals.css` and needs
its separate frontend release; installing the WP ZIP does not deploy the app.
Keep 1.6.8 as rollback. No merge or deployment is authorized by the earlier
upload/test approval; PR 146 remains draft.

Validation: existing local Node regressions, deterministic package checks and
CI browser checks. Added browser cases exercise the actual app age selector,
minor/adult tab availability, keyboard navigation, hover contrast, mobile and
desktop overflow, historical preservation, and exact adult-style restoration.
Source-bound CI results and the final package hash are recorded in PR 146.
