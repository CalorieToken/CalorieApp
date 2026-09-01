"""Fail-closed operator CLI for authentication-transient retention cleanup."""

from __future__ import annotations

import argparse
import json
import os
from collections.abc import Callable

from sqlalchemy.engine import Engine
from sqlmodel import Session

from .auth_transient_retention import (
    CLEANUP_SCHEMA_VERSION,
    DEFAULT_BATCH_LIMIT,
    MAX_BATCH_LIMIT,
    RetentionCleanupSafetyError,
    cleanup_authentication_transients,
)
from .schema_migrations import assert_database_at_head


EXECUTION_ENABLE_ENV = "CALORIEAPP_AUTH_TRANSIENT_CLEANUP_ENABLED"


def _load_database_runtime() -> tuple[Engine, bool, Callable[..., str]]:
    """Load database configuration inside the CLI's redacted failure boundary."""

    from .database import (  # noqa: PLC0415
        _DATABASE_URL_WAS_EXPLICIT,
        engine,
        validate_database_environment,
    )

    return engine, _DATABASE_URL_WAS_EXPLICIT, validate_database_environment


def _batch_limit(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("batch limit must be an integer") from exc
    if not 1 <= parsed <= MAX_BATCH_LIMIT:
        raise argparse.ArgumentTypeError(
            f"batch limit must be between 1 and {MAX_BATCH_LIMIT}"
        )
    return parsed


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Plan or execute bounded authentication-transient cleanup"
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Report bounded eligible counts without writing (default)",
    )
    mode.add_argument(
        "--execute",
        action="store_true",
        help="Delete one bounded batch after all execution guards pass",
    )
    parser.add_argument(
        "--batch-limit",
        default=DEFAULT_BATCH_LIMIT,
        type=_batch_limit,
        help=f"Maximum rows per table (default {DEFAULT_BATCH_LIMIT})",
    )
    parser.add_argument(
        "--approval-reference",
        help="Required reviewed change reference for --execute; never printed",
    )
    return parser


def validate_execution_authorization(
    *,
    environment: str,
    enabled: str | None,
    approval_reference: str | None,
) -> None:
    """Reject execution unless its explicit, non-production guards all pass."""

    if environment == "production":
        raise RetentionCleanupSafetyError(
            "production cleanup is disabled until a separate activation change"
        )
    if enabled != "true":
        raise RetentionCleanupSafetyError(
            f"execution requires {EXECUTION_ENABLE_ENV}=true"
        )
    reference = approval_reference.strip() if approval_reference else ""
    if not reference or len(reference) > 120:
        raise RetentionCleanupSafetyError(
            "execution requires an approval reference of 1 to 120 characters"
        )


def _failure_payload(reason_code: str) -> dict[str, object]:
    return {
        "schema_version": CLEANUP_SCHEMA_VERSION,
        "status": "blocked",
        "dry_run": None,
        "reason_code": reason_code,
    }


def main() -> int:
    args = _parser().parse_args()
    dry_run = not args.execute

    try:
        selected_engine, database_url_was_explicit, validator = (
            _load_database_runtime()
        )
        environment = validator(
            str(selected_engine.url),
            os.getenv("CALORIEAPP_ENV"),
            database_url_was_explicit=database_url_was_explicit,
        )
    except Exception:
        print(
            json.dumps(
                _failure_payload("database-environment-invalid"),
                sort_keys=True,
                separators=(",", ":"),
            )
        )
        return 2

    if not dry_run:
        try:
            validate_execution_authorization(
                environment=environment,
                enabled=os.getenv(EXECUTION_ENABLE_ENV),
                approval_reference=args.approval_reference,
            )
        except RetentionCleanupSafetyError:
            print(
                json.dumps(
                    _failure_payload("execution-not-authorized"),
                    sort_keys=True,
                    separators=(",", ":"),
                )
            )
            return 2

    try:
        assert_database_at_head(selected_engine)
        with Session(selected_engine) as session:
            result = cleanup_authentication_transients(
                session,
                dry_run=dry_run,
                batch_limit=args.batch_limit,
            )
    except Exception:
        print(
            json.dumps(
                _failure_payload("cleanup-unavailable"),
                sort_keys=True,
                separators=(",", ":"),
            )
        )
        return 2

    print(json.dumps(result.as_payload(), sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
