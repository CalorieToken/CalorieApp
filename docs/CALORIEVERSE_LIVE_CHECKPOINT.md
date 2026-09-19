# CalorieVerse — first living meadow

User decision, 19 September 2026: get something minuscule interactive running,
then grow that same world gradually. No replacement game or public version reset.

## Continuity

The previous broad design and simulator checkpoint remains available in draft
PR #150, `feat/participation-node-simulator`, commit
`f8711ee1a7d3c6e43c300fc6b1123ebe0329ad44`. Do not rebuild or discard its
participation, content, studio, identity, F&B and world architecture. That entire
draft is not part of this small deployment.

The live slice is built on the existing frontend release branch, with no backend,
database, package, authentication or other CalorieApp page changes. Entry is
`/gameverse` on the existing frontend. The deployment uses the existing paid
frontend service; it creates no additional service or recurring cost.

## Implemented surface

- One meadow; keyboard, touch direction controls and tap-to-walk.
- Three apples to collect; plant, water and harvest a carrot.
- Actions require proximity; each collected object and harvest count only once.
- Pause/resume, stop motion on blur and pause on background visibility.
- Local browser progress, no account or wallet required. This is a single-player
  browser slice; no claim of multiplayer, account synchronization, tokens,
  participant nodes or decentralized storage being live.
- Existing language provider and all eleven registry locales, including RTL.
- Existing starter-character storage key is preserved. No replacement identity
  is written if one already exists. The first visual is the original C marker;
  nickname/identity integration remains available in the broader draft.

## Stable growth boundaries

World ID: `calorie-gameverse-starter-world`; starting region: `welcome-meadow`.
Module: `welcome-meadow.garden`. Object IDs are permanent, namespaced identifiers.
The content pack is separate from movement/action logic, rendering and storage.
`calorie.calorieverse.meadow.v1` holds this module's state. Older world, interaction,
gallery and participation keys remain untouched. Schema numbers are internal
compatibility markers, never new consumer-facing games.

Unknown collected IDs and save extension fields are preserved during restoration.
Unreadable/future saves are left untouched and play continues without writing.
Saving is debounced and flushed when leaving; no per-frame database or network
writes. Progress currently belongs to this browser, not an authenticated account.
Browser storage deletion or changing devices does not transfer that progress.

Keep the start field and earned progress as later content arrives. Add zones and
activities using stable module/object IDs; migrate save formats explicitly. When
account persistence is introduced, import guest progress only with user choice
and bind it to the existing authenticated identity. Do not trust local progress
for token rewards. Keep presence ephemeral and separate from durable progress.

Storage, compute and verification participation remain separately opt-in with
pause/resume/stop and limits. There is no participation runtime in this first live
field. Existing synthetic simulator work is retained in PR #150. Future public
data distribution must never include private food logs, sessions or secrets.

## Next bounded block

Keep this URL and meadow. Connect a single nearby food-data/CalorieApp activity as
an additional content module, preserving this save. Reuse the already-built draft
modules after checking them against this simpler entry. Add shared presence and
server progress only when their cost, identity and age rules are ready.

## Verification

`node --test tools/tests/calorieverse_meadow.test.mjs` executes the full activity
loop, replay protection, restoration/forward compatibility, movement bounds and
the eleven-locale copy contract. TypeScript, frontend lint and a production build
are required. Browser verification covers the public deployed route and reload
persistence before handoff.
