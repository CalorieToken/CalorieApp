"""Command-line entry point for approved schema migration operations."""

from __future__ import annotations

import argparse
import os

from .database import (
    _DATABASE_URL_WAS_EXPLICIT,
    database_readiness,
    engine,
    validate_database_environment,
)
from .schema_migrations import SCHEMA_HEAD, current_revision, upgrade_database


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CalorieApp schema migration control")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("current", help="Print the recorded database revision")
    subparsers.add_parser("check", help="Check connectivity, schema and migration head")
    upgrade = subparsers.add_parser("upgrade", help="Apply forward migrations to schema head")
    upgrade.add_argument(
        "--approval-reference",
        help="Required change/review reference for staging and production",
    )
    return parser


def main() -> int:
    args = _parser().parse_args()
    environment = validate_database_environment(
        str(engine.url),
        os.getenv("CALORIEAPP_ENV"),
        database_url_was_explicit=_DATABASE_URL_WAS_EXPLICIT,
    )

    if args.command == "current":
        print(current_revision(engine) or "unversioned")
        return 0
    if args.command == "check":
        result = database_readiness()
        print(f"{result['status']} revision={result['database_revision']}")
        return 0

    approval_reference = args.approval_reference.strip() if args.approval_reference else None
    if environment in {"staging", "production"} and not approval_reference:
        raise SystemExit(
            "--approval-reference is required for staging and production migrations"
        )
    revision = upgrade_database(engine, approval_reference=approval_reference)
    if revision != SCHEMA_HEAD:
        raise SystemExit("Migration finished without reaching schema head")
    print(f"upgraded revision={revision}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
