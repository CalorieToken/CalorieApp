# Dropdown stacking follow-up — 18 September 2026

The homepage dropdown's last link was covered by the following Brizy section. The menu column used `isolation:isolate`; the header had `z-index:auto`, so raising the dropdown itself did not lift it above the later section.

Applied `2026-09-18-dropdown-stacking.css` through WPVibe to Additional CSS post 7013 and purged WP Super Cache. Only an open menu raises its existing header context (z-index 100) and menu column (2). Modal and floating-control layers stay above it. Closed header layout and menu visibility are unchanged.

Before the fix, hit testing at the center of Home → CAL & Crypto → Houderslijst returned the next section's background. After the fix, the center and four inset corners of every link in all four homepage dropdowns returned the corresponding link. Rechecked the Arabic menu, the Showcases header and the Restaurants fallback header; all inspected links were unobstructed. A browser screenshot confirmed the dropdown above the banner.

Rollback: remove only the Additional CSS block marked `CalorieToken dropdown stacking repair 2026-09-18`, then purge the page cache. Keep the earlier menu-spacing, RTL, guide and slogan changes.
