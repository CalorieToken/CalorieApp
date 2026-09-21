# CalorieVerse preview checkpoint — 21 September 2026

## Baseline and scope

Continue draft PR #150, `feat/participation-node-simulator`, directly from
`f8711ee1a7d3c6e43c300fc6b1123ebe0329ad44`. The user explicitly prohibited merge
and deployment. This change adds a review route; it does not replace existing
`/gameverse`, Gallery/Studio, identity, participation or backend code.

Recovered meadow source: commits `e23f9d8896e1f0565be8e006b3e618defd686c87`
and `7f60f3222da93bfe13dba3ddc7d9aafbe3a655f3` from the existing local release
checkout. Reuse is limited to its meadow component/CSS, copy/config, pure state
module and tests. The release branch and unrelated WordPress changes are not
merged into this draft. This document does not assert the current live site state.

## Review the small slice

From `frontend`, run `npm ci`, then `npm run dev -- --port 3100`.
Open `http://localhost:3100/gameverse/preview?ui_lang=nl` on that machine.
The normal shared display-language picker supports all eleven locales.

1. Walk with arrow/WASD keys, the touch pad, or a click/tap on the meadow.
2. Collect the three original apples; plant, water and harvest the garden.
3. Visit the new food-data stand beside the path. An object click approaches it;
   the action card enables the activity when the character is nearby.
4. Match the food illustration to its name. An incorrect answer offers a retry;
   a correct answer completes the local activity once.
5. Pause/resume, reload and revisit: original garden and food activity progress
   remain. The CalorieApp link carries the selected display language.

The example is invented and clearly labelled as practice. It is not an OFF/USDA
record, database edit, real contribution proof or token reward. No participation
runtime, account request or food-data API is invoked by the meadow component.
Progress belongs to this browser/origin. This preview does not sync accounts,
implement multiplayer or distribute data to volunteers. No new infrastructure
or paid service is required.

## Implemented growth boundaries

| Layer | Existing or new boundary |
| --- | --- |
| World identity | Existing `calorie-gameverse-starter-world` and `welcome-meadow` |
| Original activity | Existing `welcome-meadow.garden` and permanent object IDs |
| New content | `config/calorieverse-food-activity.json`, module `welcome-meadow.food-data` |
| Existing F&B connection | Reuses `food-data-reviewer` role ID; does not change selected F&B role |
| Logic | Pure `calorieVerseActivities.ts` reducer; accepts only nearby, correct, first completion |
| Rendering | Recovered `CalorieVerseMeadow`; same scene, one additional stand |
| Persistence | Existing `calorie.calorieverse.meadow.v1`; additive `modules[module_id]` records |
| Compatibility | Unknown modules/fields retained; unsupported activity formats are left untouched |
| Localization | Shared provider/locale registry and separate eleven-language copy packs |

The starter-character key is retained without replacing a previous choice. Other
world, Gallery/Studio, F&B and participation keys remain untouched. Activity
completion does not reset or gate the garden, and the garden does not gate the
new activity. Movement is ephemeral and saves remain debounced plus flushed on
page exit. Keyboard motion also stops when focus leaves the scene.

There is no new consumer-facing version or replacement world. The separate URL
allows this small slice to be reviewed against the larger draft before any
future entry-route decision. Schema numbers are internal compatibility markers.

## Scaling from here

Keep `docs/DECENTRALIZED_PARTICIPATION_ARCHITECTURE.md`, the participation
contracts and simulator tools as the larger foundation. This change establishes
an additive module boundary; it does not claim distributed scalability is tested.

- Add a new content pack and deterministic activity reducer under its own stable
  module ID. Keep provider/network calls outside the game reducer and movement.
- For real food data, introduce a read-only adapter with source/provenance and
  redistribution eligibility. Do not relabel this invented sample as live data.
- For account persistence, add an authenticated progress adapter and explicit
  guest-import choice. Separate public content from private player state and
  define conflict handling/idempotency before synchronizing multiple devices.
- Add shared presence separately from durable progress; never send position
  updates as reward evidence or write each animation frame to a database.
- Connect eligible public-data work to the existing synthetic participation
  adapters only after review. Consent, bounded work, independent verification,
  resource limits, pause/full stop and zero-volunteer hosted fallback remain
  mandatory. Browser participation, XRPL validators and settlement are distinct.
- Real Testnet settlement, a token peg/supply decision, DAO governance, revenue
  policy and changes to public data authority remain separate deferred decisions.
  No automatic paid scaling, deployment or network-phase promotion is enabled.

## Verification and limits

- 76 focused Node tests passed for CalorieVerse, Gameverse and participation UI.
  These include 14 meadow/activity tests: full garden loop, preservation/reload,
  repeat protection, proximity, wrong-answer retry, future saves, pause/resume,
  retained starter identity, eleven-locale coverage and Arabic RTL DOM behavior.
- 124 Python tests passed for storage/compute, UI adapter, growth, reliability,
  public-data release, resource policy and character identity simulators.
- TypeScript and production build passed. Lint reports only two existing
  `react-hooks/exhaustive-deps` warnings in `TestnetEntry.tsx:135`.
- A pre-existing test expected the participation chooser inside Gallery's route
  file. It now follows Gallery's actual `CalorieStudioPage` delegation and still
  checks the shared chooser; no Gallery/Studio product behavior was changed.
- Cloud browser navigation to the local preview failed with
  `net::ERR_BLOCKED_BY_CLIENT`. Visual desktop/mobile and real browser input QA
  remain unverified. The React DOM interaction tests do not replace that check.
- No merge, deployment, WordPress edit, paid infrastructure change, financial
  action or live participation activation was performed.

## Next bounded step

Open this existing preview in a browser with access to the local server and
check desktop/mobile movement, touch controls and the stand placement. Then
review one read-only food-data adapter against the existing F&B role contract.
Keep this meadow and its progress; do not restart the design or merge/deploy as
part of continuation without a new instruction.
