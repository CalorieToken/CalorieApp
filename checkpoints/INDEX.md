# Checkpoint Index

This file tracks all project checkpoints in chronological order.

## Latest

- Current latest checkpoint: 2026-07-23-120229-project-checkpoint
- Path: checkpoints/2026-07-23-120229-project-checkpoint
- Summary file: checkpoints/2026-07-23-120229-project-checkpoint/CHECKPOINT.md

## Milestone History

| Date (UTC) | Checkpoint ID | Status | Evidence |
| --- | --- | --- | --- |
| 2026-07-23 | 2026-07-23-120229-project-checkpoint | Validation evidence present | release-check output + SHA256 source manifest |
| 2026-07-23 | 2026-07-23-project-checkpoint | Validation evidence present | release-check output + SHA256 source manifest |

## Update Procedure

1. Create a new checkpoint with:

   powershell -NoProfile -ExecutionPolicy Bypass -File ./checkpoints/new-checkpoint.ps1

2. Confirm LATEST.txt points to the new checkpoint ID.
3. Keep old checkpoint folders immutable except factual metadata fixes.
