#!/usr/bin/env python3
"""Build a non-secret manifest for one deployed CalorieApp V2 release."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = "calorieapp.v2-release-manifest.v1"
LOCK_PATHS = (
    Path("backend/requirements.txt"),
    Path("frontend/package-lock.json"),
)
_COMMIT = re.compile(r"[0-9a-f]{40}")
_UTC_TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")


class ReleaseManifestError(ValueError):
    """A release manifest could not be built safely."""


def source_commit(value: str) -> str:
    candidate = value.strip()
    if _COMMIT.fullmatch(candidate) is None:
        raise argparse.ArgumentTypeError(
            "source commit must be one lowercase 40-character Git SHA"
        )
    return candidate


def deployed_at_utc(value: str) -> str:
    candidate = value.strip()
    if _UTC_TIMESTAMP.fullmatch(candidate) is None:
        raise argparse.ArgumentTypeError(
            "deployment time must use YYYY-MM-DDTHH:MM:SSZ"
        )
    try:
        parsed = datetime.strptime(candidate, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=timezone.utc
        )
    except ValueError as exc:
        raise argparse.ArgumentTypeError("deployment time is invalid") from exc
    if parsed.strftime("%Y-%m-%dT%H:%M:%SZ") != candidate:
        raise argparse.ArgumentTypeError("deployment time is invalid")
    return candidate


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _required_file(root: Path, relative: Path) -> Path:
    try:
        root = root.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ReleaseManifestError("repository root is unavailable") from exc
    candidate = root / relative
    if candidate.is_symlink():
        raise ReleaseManifestError(f"release input must not be a symlink: {relative}")
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(root)
    except (OSError, RuntimeError, ValueError) as exc:
        raise ReleaseManifestError(f"release input is unavailable: {relative}") from exc
    if not resolved.is_file():
        raise ReleaseManifestError(f"release input is not a file: {relative}")
    return resolved


def build_manifest(
    root: Path,
    *,
    commit: str,
    deployment_time: str,
    plugin_archive: Path,
) -> dict[str, object]:
    try:
        validated_commit = source_commit(commit)
        validated_time = deployed_at_utc(deployment_time)
    except argparse.ArgumentTypeError as exc:
        raise ReleaseManifestError(str(exc)) from exc

    try:
        resolved_root = root.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ReleaseManifestError("repository root is unavailable") from exc
    if not resolved_root.is_dir():
        raise ReleaseManifestError("repository root is not a directory")

    if plugin_archive.is_symlink():
        raise ReleaseManifestError("plugin archive must not be a symlink")
    try:
        resolved_archive = plugin_archive.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ReleaseManifestError("plugin archive is unavailable") from exc
    if not resolved_archive.is_file() or resolved_archive.suffix.lower() != ".zip":
        raise ReleaseManifestError("plugin archive must be a ZIP file")

    locks = [
        {
            "path": relative.as_posix(),
            "sha256": _sha256(_required_file(resolved_root, relative)),
        }
        for relative in LOCK_PATHS
    ]
    return {
        "build_id": validated_commit,
        "deployed_at_utc": validated_time,
        "dependency_locks": locks,
        "schema_version": SCHEMA_VERSION,
        "source_commit": validated_commit,
        "wordpress_plugin": {
            "archive": resolved_archive.name,
            "sha256": _sha256(resolved_archive),
        },
    }


def write_manifest(output: Path, payload: dict[str, object]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with output.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
    except FileExistsError as exc:
        raise ReleaseManifestError("release manifest already exists") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-commit", required=True, type=source_commit)
    parser.add_argument("--deployed-at-utc", required=True, type=deployed_at_utc)
    parser.add_argument("--plugin-archive", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        payload = build_manifest(
            ROOT,
            commit=args.source_commit,
            deployment_time=args.deployed_at_utc,
            plugin_archive=args.plugin_archive,
        )
        write_manifest(args.output, payload)
    except (OSError, ReleaseManifestError) as exc:
        print(f"release manifest failed: {exc}", file=sys.stderr)
        return 1
    print(args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
