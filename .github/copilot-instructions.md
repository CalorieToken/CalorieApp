# CalorieApp project continuity

- Continue the existing checkpoint; never rebuild the CalorieVerse concept from
  scratch. Read `docs/CALORIEVERSE_PREVIEW_CHECKPOINT.md` before changing it.
- Draft PR #150, branch `feat/participation-node-simulator`, continues from
  `f8711ee1a7d3c6e43c300fc6b1123ebe0329ad44`. No merge or deployment is authorized
  for this work. Keep the PR a draft; do not change live services or WordPress.
- `/gameverse/preview` is the small meadow review route. `/gameverse` retains
  the larger existing draft with Studio, identity and participation integrations.
  The extra route is a review boundary, not a second world or product version.
- CalorieVerse grows continuously: preserve the original world/starter IDs,
  module IDs, storage keys and earned progress. Never require a player reset.
- Reuse the eleven-language display registry. Keep UI copy out of reducers.
- Content packs, pure activity reducers, rendering and persistence are separate.
  Unknown module fields must survive; unsupported formats must not be overwritten.
- Ordinary play requires no account, wallet, storage contribution, compute role
  or reward. Participation is separately opt-in, capped and reversible, with
  independent storage/compute consent and pause/resume/full-stop controls.
- Local guest progress is untrusted and cannot authorize calT/CAL/XRP rewards.
  Synthetic simulators are not an active network or settlement system.
- Never place private food logs, identity, credentials or age records in public
  participant data. Preserve the existing private PostgreSQL boundary.
- Keep deferred architecture, publication and governance work in repository docs;
  never store secrets or temporary chat credentials here.
