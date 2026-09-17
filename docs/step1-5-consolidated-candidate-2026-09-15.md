# Consolidated food-UX candidate - 15 September 2026

## Canonical source and deployment boundary

Continue PR #146 on `repair/food-ux-integration-20260915`, from head `bcf4130b7080df704bf71401815e5b4aaeeca504`. This is not a merge of PR #147. Its independently useful UI changes were compared file by file and carried over deliberately. The alternate branch remains retained for history.

Render frontend service `srv-da356k0u01pc73ftva8g` was checked on 15 September 2026. Its live application commit is `d74baa42fffb10191eff1bcfc9a967f3c5e4c03a`, not automatically the current PR head. Auto-deploy is off; no deployment, branch retargeting, WordPress installation or campaign publication is performed by this candidate. Earlier PR wording saying that no code was ever deployed is superseded by this explicit distinction.

## Changes and retained behavior

- Combine the alternate three-way navigation (packaged products, basic foods and diary) and compact inline confirmation with PR #146's correct saved USDA gram labels.
- Navigation opens the basic-food section, moves keyboard focus, and scrolls without making a write. Preserve all five existing food mutation/selection handlers, working authentication and scanner logic.
- Keep all three existing USDA browser-test selectors and the collapsed explanation behavior; add the missing focus target attribute.
- Use accurate period grade-count explanations in all eleven locales. The explanation is still displayed by FoodDiaryPeriod; do not duplicate it beneath the overview heading.
- Retain PR #146's latest singular-safe known/missing labels and add translated navigation labels. Do not replace these with the older alternate labels.
- Leave backend, catalogue, lockfile, environment configuration and hosting unchanged.

## Evidence

The exact local candidate passed 293 Node regression tests with zero failures/skips and TypeScript checking. Navigation tests include all eleven locales, unique keyboard targets, actual handler execution, no fetch on navigation, correct period wording and preservation of saved gram behavior.

The local Next build compiled and typechecked but did not finish its trace stage within the tool timeout. The container browser refused localhost with `ERR_BLOCKED_BY_ADMINISTRATOR`; that restriction was not bypassed. Therefore a completed production build and browser acceptance must come from the existing read-only GitHub Actions workflow for this candidate, not from those incomplete local attempts. Keep resulting CI evidence with its exact source tree. These frontend tests use synthetic backend fixtures and do not establish physical-camera, real-wallet or real-diary acceptance.

## Remaining steps 1-5

Authenticated current WordPress source/version verification is still needed before reconciling Identity Bridge, Heading Repair and XPMarket candidates. The old plugin versions in this application source snapshot must not be packaged as a current WordPress release.

The saved campaign material remains retained, but the complete new-feature coverage, eleven-language audiovisual delivery and final quality review are not declared finished. All relevant app, site, help, documentation and media must be available in one freely browsable review. Only the owner's later explicit overall approval in chat can authorize channel scheduling/publication. No individual approval forms and no catch-up publication of expired proposed dates.
