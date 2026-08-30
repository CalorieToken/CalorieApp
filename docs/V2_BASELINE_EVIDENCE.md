# V2 baseline evidence

Observation: 2026-08-30 05:58 UTC. This was a read-only, non-authenticated
live-smoke; no food log was created and no Xaman flow was started.

## Repository reference points

| Reference | Commit | What it establishes |
|---|---|---|
| Known working checkpoint | `c6cdf49e23e93d227667ef179c8832e9e2b23e20` | Repository checkpoint after the Render wake-up/login fix merged on 2026-08-27 |
| Latest integrated V2 `main` at observation | `58dd4b828cd49459890af9fc904621f24421773d` | Includes the canonical WordPress CalorieApp route fix merged on 2026-08-30 |

The working checkpoint is an ancestor of that `main` commit. The deployed
runtime does not expose a build identifier, so neither reference is claimed as
the exact currently deployed artifact yet.

## Live observation

- `https://calorieapp-frontend.onrender.com/` woke from Render cold start and
  loaded the CalorieApp page with its sign-in entry, public food search and Open
  Food Facts attribution.
- `https://calorietoken.net/index.php/calorieapp/` loaded the canonical
  WordPress page and one embedded iframe from
  `https://calorieapp-frontend.onrender.com?embedded=1`.
- A public search for `apple` completed after the backend cold start and returned
  multiple products with calorie, protein, fat and carbohydrate values.

This supersedes the earlier observation of a 404 on the non-canonical
`/calorieapp/` route only for the canonical `/index.php/calorieapp/` path. It
does not erase the historical screenshot or prove every alternate route.

## Deliberately not tested yet

The smoke does not prove Xaman completion, joint WordPress/CalorieApp session
restoration, authenticated food-log operations, long-term persistence, backup
restore or any certification. Those belong in the prepared integrated acceptance
round after the Identity Bridge and durable-data work is complete.

## Remaining provenance gate

V2 needs a non-secret build identifier in both frontend and backend plus a
release manifest recording the source commit, dependency-lock digests, WordPress
plugin artifact digest and deployment time. Until an observed runtime identifier
matches that manifest, `v2_deployment_provenance` remains a partial,
release-blocking gate.
