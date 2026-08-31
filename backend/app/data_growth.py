"""Race-safe storage admission for private food history."""

from __future__ import annotations

import hashlib
from threading import Lock

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from .models import FoodLogDB


FOOD_LOG_SUBJECT_ENTRY_LIMIT = 10_000
DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS = 5


class DataGrowthAdmissionRejected(Exception):
    """Reject a write without deleting or shortening existing history."""

    def __init__(
        self,
        reason: str,
        *,
        status_code: int,
        retry_after_seconds: int | None = None,
    ) -> None:
        if status_code not in {409, 503}:
            raise ValueError("data growth status_code must be 409 or 503")
        if status_code == 503 and retry_after_seconds is None:
            raise ValueError("503 data growth rejection requires Retry-After")
        if status_code == 409 and retry_after_seconds is not None:
            raise ValueError("persistent storage budget rejection is not time-based")
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


_sqlite_subject_lock = Lock()


def _postgresql_lock_key(owner_id: str) -> int:
    raw = int.from_bytes(
        hashlib.sha256(f"food-log-subject:{owner_id}".encode("utf-8")).digest()[:8],
        byteorder="big",
        signed=False,
    )
    return raw - (1 << 64) if raw >= (1 << 63) else raw


def _count_subject_entries(session: Session, owner_id: str) -> int:
    return int(
        session.exec(
            select(sa.func.count(FoodLogDB.id)).where(
                FoodLogDB.owner_id == owner_id
            )
        ).one()
    )


def _insert_if_within_budget(
    session: Session,
    entry: FoodLogDB,
    *,
    limit: int,
) -> FoodLogDB:
    assert entry.owner_id is not None
    if _count_subject_entries(session, entry.owner_id) >= limit:
        raise DataGrowthAdmissionRejected(
            "food_log_subject_budget_reached",
            status_code=409,
        )

    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def create_food_log_with_subject_budget(
    session: Session,
    entry: FoodLogDB,
    *,
    limit: int | None = None,
) -> FoodLogDB:
    """Atomically count and insert one owner-bound log entry.

    PostgreSQL serializes concurrent writers for the same internal user across
    backend processes. SQLite uses a process-local equivalent for local
    development and unit tests; it is not production multi-process proof.
    """

    if not entry.owner_id:
        raise ValueError("food log growth admission requires an owner")
    effective_limit = FOOD_LOG_SUBJECT_ENTRY_LIMIT if limit is None else limit
    if effective_limit <= 0:
        raise ValueError("food log subject limit must be greater than zero")

    try:
        backend = session.get_bind().dialect.name
        if backend == "postgresql":
            session.exec(
                sa.text("SELECT pg_advisory_xact_lock(:lock_key)"),
                params={"lock_key": _postgresql_lock_key(entry.owner_id)},
            )
            return _insert_if_within_budget(
                session,
                entry,
                limit=effective_limit,
            )
        if backend == "sqlite":
            with _sqlite_subject_lock:
                return _insert_if_within_budget(
                    session,
                    entry,
                    limit=effective_limit,
                )
        raise TypeError("unsupported database backend for data growth admission")
    except DataGrowthAdmissionRejected:
        session.rollback()
        raise
    except (SQLAlchemyError, TypeError) as exc:
        session.rollback()
        raise DataGrowthAdmissionRejected(
            "data_growth_admission_unavailable",
            status_code=503,
            retry_after_seconds=DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS,
        ) from exc
