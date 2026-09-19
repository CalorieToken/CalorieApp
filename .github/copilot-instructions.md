# Project continuity

- Keep the currently deployed CalorieApp stable; changes to a new surface should
  not silently deploy unrelated draft backend, identity or database work.
- CalorieVerse is one continuously growing world. Preserve the original meadow,
  starter identity, stable content IDs and earned progress. Internal schema
  migrations must not create a replacement game or require a user reset.
- Read `docs/CALORIEVERSE_LIVE_CHECKPOINT.md` before continuing CalorieVerse. The
  larger architecture and built simulator/Studio/F&B modules are preserved in
  PR #150 at `f8711ee`; do not repeat or discard that work.
- Reuse the shared display-language provider and eleven-locale registry.
- Ordinary exploration never requires a wallet, node, storage, compute or rewards.
  Those roles need separate opt-in, resource limits, pause/resume/full stop.
- Local guest game state is not verified reward evidence. Keep private identity,
  food logs and credentials outside public participant storage/compute.
- Preserve deferred architecture/governance decisions in repository documents;
  never record secrets or temporary chat credentials.
