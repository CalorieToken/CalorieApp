"""Operator CLI for the PostgreSQL runtime application-role boundary."""

from __future__ import annotations

import argparse
import os

from .database import (
    _DATABASE_URL_WAS_EXPLICIT,
    engine,
    validate_database_environment,
)
from .postgresql_privileges import (
    apply_postgresql_application_privileges,
    verify_postgresql_application_privileges,
)
from .schema_migrations import assert_database_at_head


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="CalorieApp PostgreSQL application-role privilege control"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    check = subparsers.add_parser("check", help="Verify the effective role privileges")
    check.add_argument("--application-role", required=True)
    apply = subparsers.add_parser(
        "apply",
        help="Apply and verify the reviewed role privileges",
    )
    apply.add_argument("--application-role", required=True)
    apply.add_argument(
        "--approval-reference",
        required=True,
        help="Required change/review reference for this privilege mutation",
    )
    return parser


def main() -> int:
    args = _parser().parse_args()
    validate_database_environment(
        str(engine.url),
        os.getenv("CALORIEAPP_ENV"),
        database_url_was_explicit=_DATABASE_URL_WAS_EXPLICIT,
    )
    assert_database_at_head(engine)

    if args.command == "apply":
        with engine.begin() as connection:
            proof = apply_postgresql_application_privileges(
                connection,
                args.application_role,
                approval_reference=args.approval_reference,
            )
    else:
        with engine.connect() as connection:
            proof = verify_postgresql_application_privileges(
                connection,
                args.application_role,
            )

    print(
        "verified "
        f"role={proof.application_role} "
        f"database={proof.database_name} "
        f"read_write_tables={proof.read_write_table_count} "
        f"insert_only_audits={proof.insert_only_audit_table_count} "
        f"read_only_tables={proof.read_only_table_count} "
        f"sequences={proof.sequence_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
