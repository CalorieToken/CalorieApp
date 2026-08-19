# CalorieApp Project Checkpoint

- Checkpoint ID: `2026-07-23-project-checkpoint`
- Captured at (UTC): `2026-07-23T11:56:49Z`
- Scope: Full MVP source snapshot evidence (frontend, backend, docs, config)
- Purpose: Reproducible baseline for planning, audit handoff, and rollback reference

## Included Evidence

1. `release-check-output.txt`
- End-to-end quality gate run output
- Includes backend tests, frontend lint/build, and developer health-check
- File size: `4760` bytes

2. `source-file-manifest.sha256.txt`
- SHA256 manifest for source/config files in checkpoint scope
- Entry count: `35`

3. `CHECKPOINT.md`
- This checkpoint metadata summary

## Validation State at Checkpoint Time

- Backend tests: PASS (`17 passed`)
- Frontend lint: PASS
- Frontend production build: PASS
- Developer health-check: PASS (`RESULT: SUCCESS`)

## Scope Notes

- Runtime artifacts such as `node_modules`, `.next`, `.venv`, caches, and `checkpoints` folder itself are excluded from hash manifest.
- Live SQLite database files are excluded from hash manifest to avoid lock/read race and to keep source integrity manifest deterministic.

## How to Verify This Checkpoint

From repo root:

```powershell
Get-FileHash -Algorithm SHA256 .\checkpoints\2026-07-23-project-checkpoint\source-file-manifest.sha256.txt
```

Re-run release gate:

```powershell
.\release-check.ps1
```

Regenerate source manifest (if you intentionally create a new checkpoint):

```powershell
# Use current checkpoint process; do not overwrite this checkpoint unless intentional.
```

## Best-Practice Checkpoint Guidance

- Treat this folder as immutable historical evidence.
- Create a new timestamped checkpoint for each major milestone.
- Pair each checkpoint with a planning note describing goals, risks, and decisions.

## Current Environment Constraint

- Git metadata is not available in this workspace instance (`.git` directory not present), so commit hash anchoring is not included in this checkpoint.
