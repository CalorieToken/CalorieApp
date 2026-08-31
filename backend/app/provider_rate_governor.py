"""Shared, fail-closed rate governance for external provider attempts."""

from __future__ import annotations

import asyncio
import hashlib
import math
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from threading import Lock
from typing import Protocol
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from .models import ProviderRateEventDB
from .postgresql_locking import acquire_bounded_transaction_advisory_locks
from .source_admission import AdapterAdmissionRejected


OPEN_FOOD_FACTS_PROVIDER_KEY = "open_food_facts_search"
OPEN_FOOD_FACTS_SHARED_LIMIT = 8
OPEN_FOOD_FACTS_SHARED_WINDOW_SECONDS = 60
GOVERNOR_UNAVAILABLE_RETRY_SECONDS = 5


class ProviderRateGovernor(Protocol):
    limit: int
    window_seconds: int

    async def acquire(self) -> None:
        """Reserve one actual upstream attempt or fail before network access."""


def _validate_configuration(provider_key: str, limit: int, window_seconds: int) -> None:
    if not provider_key or len(provider_key) > 100:
        raise ValueError("provider_key must contain 1 to 100 characters")
    if limit <= 0:
        raise ValueError("limit must be greater than zero")
    if window_seconds <= 0 or window_seconds > 60:
        raise ValueError("window_seconds must be between 1 and 60")


def _retry_after(oldest: float, now: float, window_seconds: int) -> int:
    return max(1, min(60, math.ceil(oldest + window_seconds - now)))


class InMemorySlidingWindowRateGovernor:
    """Equivalent local/test governor; intentionally not live multi-process proof."""

    def __init__(
        self,
        *,
        provider_key: str,
        limit: int,
        window_seconds: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        _validate_configuration(provider_key, limit, window_seconds)
        self.provider_key = provider_key
        self.limit = limit
        self.window_seconds = window_seconds
        self._clock = clock
        self._events: list[float] = []
        self._lock = Lock()

    async def acquire(self) -> None:
        now = self._clock()
        cutoff = now - self.window_seconds
        with self._lock:
            self._events = [event for event in self._events if event > cutoff]
            if len(self._events) >= self.limit:
                raise AdapterAdmissionRejected(
                    "shared_provider_rate_limit",
                    _retry_after(self._events[0], now, self.window_seconds),
                    status_code=429,
                )
            self._events.append(now)

    def _reset_for_tests(self) -> None:
        with self._lock:
            self._events.clear()


def _postgresql_lock_key(provider_key: str) -> int:
    raw = int.from_bytes(
        hashlib.sha256(provider_key.encode("utf-8")).digest()[:8],
        byteorder="big",
        signed=False,
    )
    return raw - (1 << 64) if raw >= (1 << 63) else raw


class PostgreSQLSlidingWindowRateGovernor:
    """Strict shared window serialized by a PostgreSQL transaction advisory lock."""

    def __init__(
        self,
        engine: Engine,
        *,
        provider_key: str,
        limit: int,
        window_seconds: int,
    ) -> None:
        _validate_configuration(provider_key, limit, window_seconds)
        if engine.url.get_backend_name() != "postgresql":
            raise ValueError("PostgreSQL shared governor requires a PostgreSQL engine")
        self.engine = engine
        self.provider_key = provider_key
        self.limit = limit
        self.window_seconds = window_seconds
        self._lock_key = _postgresql_lock_key(provider_key)

    async def acquire(self) -> None:
        await asyncio.to_thread(self._acquire_sync)

    def _acquire_sync(self) -> None:
        table = ProviderRateEventDB.__table__
        retry_after_seconds: int | None = None
        try:
            with self.engine.begin() as connection:
                acquire_bounded_transaction_advisory_locks(
                    connection,
                    [self._lock_key],
                )
                now = connection.execute(
                    sa.text("SELECT clock_timestamp()")
                ).scalar_one()
                if not isinstance(now, datetime):
                    raise TypeError("PostgreSQL clock did not return a datetime")
                cutoff = now - timedelta(seconds=self.window_seconds)
                connection.execute(
                    sa.delete(table).where(
                        table.c.provider_key == self.provider_key,
                        table.c.admitted_at <= cutoff,
                    )
                )
                events = list(
                    connection.execute(
                        sa.select(table.c.admitted_at)
                        .where(
                            table.c.provider_key == self.provider_key,
                            table.c.admitted_at > cutoff,
                        )
                        .order_by(table.c.admitted_at)
                    ).scalars()
                )
                if len(events) >= self.limit:
                    oldest = events[0]
                    retry_after_seconds = _retry_after(
                        oldest.timestamp(),
                        now.timestamp(),
                        self.window_seconds,
                    )
                else:
                    connection.execute(
                        sa.insert(table).values(
                            id=str(uuid4()),
                            provider_key=self.provider_key,
                            admitted_at=now,
                        )
                    )
        except (SQLAlchemyError, TypeError, ValueError) as exc:
            raise AdapterAdmissionRejected(
                "shared_rate_governor_unavailable",
                GOVERNOR_UNAVAILABLE_RETRY_SECONDS,
                status_code=503,
            ) from exc

        if retry_after_seconds is not None:
            raise AdapterAdmissionRejected(
                "shared_provider_rate_limit",
                retry_after_seconds,
                status_code=429,
            )


def build_provider_rate_governor(
    engine: Engine,
    *,
    provider_key: str = OPEN_FOOD_FACTS_PROVIDER_KEY,
    limit: int = OPEN_FOOD_FACTS_SHARED_LIMIT,
    window_seconds: int = OPEN_FOOD_FACTS_SHARED_WINDOW_SECONDS,
) -> ProviderRateGovernor:
    """Use the primary PostgreSQL store live and an equivalent local test gate."""
    if engine.url.get_backend_name() == "postgresql":
        return PostgreSQLSlidingWindowRateGovernor(
            engine,
            provider_key=provider_key,
            limit=limit,
            window_seconds=window_seconds,
        )
    if engine.url.get_backend_name() == "sqlite":
        return InMemorySlidingWindowRateGovernor(
            provider_key=provider_key,
            limit=limit,
            window_seconds=window_seconds,
        )
    raise ValueError("Provider rate governor requires SQLite or PostgreSQL")
