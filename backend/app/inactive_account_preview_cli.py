"""Fail-closed operator CLI for read-only inactive-account preview."""

from __future__ import annotations

import argparse
import json
import os
from collections.abc import Callable

from sqlalchemy.engine import Engine
from sqlmodel import Session

from .inactive_account_preview import (
    DEFAULT_BATCH_LIMIT,
    MAX_BATCH_LIMIT,
    PREVIEW_SCHEMA_VERSION,
    InactiveAccountPreviewSafetyError,
    preview_inactive_accounts,
)
from .schema_migrations import assert_database_at_head


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
        description="Preview bounded inactive-account lifecycle counts"
    )
    parser.add_argument(
        "--batch-limit",
        default=DEFAULT_BATCH_LIMIT,
        type=_batch_limit,
        help=f"Maximum oldest active accounts to evaluate (default {DEFAULT_BATCH_LIMIT})",
    )
    return parser


def _failure_payload(reason_code: str) -> dict[str, object]:
    return {
        "schema_version": PREVIEW_SCHEMA_VERSION,
        "status": "blocked",
        "read_only": True,
        "reason_code": reason_code,
    }


def main() -> int:
    args = _parser().parse_args()

    try:
        selected_engine, database_url_was_explicit, validator = (
            _load_database_runtime()
        )
        environment = validator(
            str(selected_engine.url),
            os.getenv("CALORIEAPP_ENV"),
            database_url_was_explicit=database_url_was_explicit,
        )
        if environment == "production":
            raise InactiveAccountPreviewSafetyError(
                "production preview requires a separate activation change"
            )
        assert_database_at_head(selected_engine)
        with Session(selected_engine) as session:
            result = preview_inactive_accounts(
                session,
                batch_limit=args.batch_limit,
            )
    except Exception:
        print(
            json.dumps(
                _failure_payload("preview-unavailable"),
                sort_keys=True,
                separators=(",", ":"),
            )
        )
        return 2

    print(json.dumps(result.as_payload(), sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
