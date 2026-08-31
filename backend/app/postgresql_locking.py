"""Bounded PostgreSQL transaction advisory-lock acquisition."""

from __future__ import annotations

from collections.abc import Iterable

import sqlalchemy as sa
from sqlalchemy.engine import Connection
from sqlmodel import Session


POSTGRESQL_ADVISORY_LOCK_TIMEOUT_MILLISECONDS = 1_000
_POSTGRESQL_BIGINT_MIN = -(1 << 63)
_POSTGRESQL_BIGINT_MAX = (1 << 63) - 1


def acquire_bounded_transaction_advisory_locks(
    executor: Connection | Session,
    lock_keys: Iterable[int],
    *,
    timeout_milliseconds: int = POSTGRESQL_ADVISORY_LOCK_TIMEOUT_MILLISECONDS,
) -> None:
    """Acquire sorted transaction locks with a transaction-local wait bound.

    PostgreSQL aborts the current transaction when one of these lock attempts
    exceeds ``lock_timeout``. Callers retain responsibility for rolling back
    and mapping that database error to their fail-closed response.
    """

    if type(timeout_milliseconds) is not int or timeout_milliseconds <= 0:
        raise ValueError("PostgreSQL advisory lock timeout must be a positive integer")

    normalized_keys: set[int] = set()
    for lock_key in lock_keys:
        if (
            type(lock_key) is not int
            or lock_key < _POSTGRESQL_BIGINT_MIN
            or lock_key > _POSTGRESQL_BIGINT_MAX
        ):
            raise ValueError("PostgreSQL advisory lock key must fit a signed bigint")
        normalized_keys.add(lock_key)
    if not normalized_keys:
        raise ValueError("At least one PostgreSQL advisory lock key is required")

    executor.execute(
        sa.text("SELECT set_config('lock_timeout', :timeout_value, true)"),
        {"timeout_value": f"{timeout_milliseconds}ms"},
    )
    for lock_key in sorted(normalized_keys):
        executor.execute(
            sa.text("SELECT pg_advisory_xact_lock(:lock_key)"),
            {"lock_key": lock_key},
        )
