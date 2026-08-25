#!/usr/bin/env python3
"""Create and verify portable PostgreSQL custom-format backups.

The database URL is read from the environment and is never passed on the
command line or written to the manifest. Backup files contain private user
data and must be stored in an access-controlled, encrypted destination.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import unquote, urlsplit


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def postgres_environment(database_url: str) -> dict[str, str]:
    parsed = urlsplit(database_url)
    if parsed.scheme not in {"postgres", "postgresql", "postgresql+psycopg"}:
        raise ValueError("DATABASE_URL must be a PostgreSQL URL")
    if not parsed.hostname or not parsed.path.strip("/"):
        raise ValueError("DATABASE_URL must include a host and database name")

    environment = os.environ.copy()
    environment.update(
        {
            "PGHOST": parsed.hostname,
            "PGPORT": str(parsed.port or 5432),
            "PGDATABASE": unquote(parsed.path.lstrip("/")),
        }
    )
    if parsed.username:
        environment["PGUSER"] = unquote(parsed.username)
    if parsed.password:
        environment["PGPASSWORD"] = unquote(parsed.password)
    return environment


def require_program(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f"{name} is required; install the PostgreSQL client tools")
    return path


def verify(archive: Path, manifest: Path | None = None) -> dict[str, object]:
    archive = archive.resolve()
    if not archive.is_file():
        raise FileNotFoundError(archive)
    pg_restore = require_program("pg_restore")
    subprocess.run(
        [pg_restore, "--list", str(archive)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )

    digest = sha256_file(archive)
    if manifest is not None:
        saved = json.loads(manifest.read_text(encoding="utf-8"))
        if saved.get("sha256") != digest:
            raise ValueError("backup checksum does not match its manifest")
        if saved.get("bytes") != archive.stat().st_size:
            raise ValueError("backup size does not match its manifest")
    return {"archive": archive.name, "bytes": archive.stat().st_size, "sha256": digest}


def backup(output_directory: Path, database_url: str) -> tuple[Path, Path]:
    pg_dump = require_program("pg_dump")
    environment = postgres_environment(database_url)
    output_directory = output_directory.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    archive = output_directory / f"calorieapp-{timestamp}.dump"
    partial = archive.with_suffix(".dump.partial")
    manifest = archive.with_suffix(".dump.manifest.json")
    if archive.exists() or partial.exists() or manifest.exists():
        raise FileExistsError("refusing to overwrite an existing backup")

    try:
        subprocess.run(
            [pg_dump, "--format=custom", "--no-owner", "--no-acl", "--file", str(partial)],
            check=True,
            env=environment,
        )
        partial.chmod(stat.S_IRUSR | stat.S_IWUSR)
        partial.replace(archive)
        details = verify(archive)
        payload = {
            "schema": "calorieapp-postgres-backup-manifest-v1",
            "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "archive": archive.name,
            "format": "postgresql-custom",
            "bytes": details["bytes"],
            "sha256": details["sha256"],
        }
        manifest.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        manifest.chmod(stat.S_IRUSR | stat.S_IWUSR)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    return archive, manifest


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    subcommands = result.add_subparsers(dest="command", required=True)
    create = subcommands.add_parser("create", help="create and verify a backup")
    create.add_argument("--output-directory", type=Path, required=True)
    create.add_argument("--database-url-env", default="DATABASE_URL")
    check = subcommands.add_parser("verify", help="verify an existing backup")
    check.add_argument("archive", type=Path)
    check.add_argument("--manifest", type=Path)
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "create":
            database_url = os.getenv(args.database_url_env)
            if not database_url:
                raise RuntimeError(f"{args.database_url_env} is not set")
            archive, manifest = backup(args.output_directory, database_url)
            print(f"Backup created: {archive}")
            print(f"Manifest created: {manifest}")
        else:
            details = verify(args.archive, args.manifest)
            print(json.dumps(details, indent=2))
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
