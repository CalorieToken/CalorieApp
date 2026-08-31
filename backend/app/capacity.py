"""Provider-neutral database capacity policy for safe account onboarding."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Mapping

from sqlalchemy import text
from sqlmodel import Session

logger = logging.getLogger(__name__)

DATABASE_CAPACITY_LIMIT_BYTES_ENV = "CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES"
CAPACITY_ALERT_THRESHOLDS_PERCENT = (70, 85, 95)


class CapacityMeasurementError(RuntimeError):
    """Raised when configured database usage cannot be measured safely."""


class OnboardingCapacityPaused(RuntimeError):
    """Raised when a new account must not be created under the capacity policy."""


@dataclass(frozen=True)
class CapacityPolicy:
    """Approved hard database budget, or an explicitly unconfigured policy."""

    limit_bytes: int | None

    @property
    def configured(self) -> bool:
        return self.limit_bytes is not None


@dataclass(frozen=True)
class CapacitySnapshot:
    """Low-cardinality capacity result without user or request data."""

    used_bytes: int
    limit_bytes: int
    utilization_percent: float
    level: str
    onboarding_paused: bool


def capacity_policy_from_environment(
    environment: Mapping[str, str] | None = None,
) -> CapacityPolicy:
    """Parse the operator-approved byte limit without inventing provider quotas."""
    source = os.environ if environment is None else environment
    raw_value = source.get(DATABASE_CAPACITY_LIMIT_BYTES_ENV, "").strip()
    if not raw_value:
        return CapacityPolicy(limit_bytes=None)

    try:
        limit_bytes = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(
            f"{DATABASE_CAPACITY_LIMIT_BYTES_ENV} must be a positive integer"
        ) from exc
    if limit_bytes <= 0:
        raise RuntimeError(
            f"{DATABASE_CAPACITY_LIMIT_BYTES_ENV} must be a positive integer"
        )
    return CapacityPolicy(limit_bytes=limit_bytes)


def validate_capacity_configuration() -> None:
    """Fail startup on malformed configuration; an absent limit remains explicit."""
    capacity_policy_from_environment()


def evaluate_capacity(used_bytes: int, limit_bytes: int) -> CapacitySnapshot:
    """Classify capacity using fixed 70/85/95 percent safety thresholds."""
    if used_bytes < 0:
        raise ValueError("used_bytes must be zero or greater")
    if limit_bytes <= 0:
        raise ValueError("limit_bytes must be greater than zero")

    utilization_percent = (used_bytes * 100) / limit_bytes
    warning_percent, critical_percent, pause_percent = (
        CAPACITY_ALERT_THRESHOLDS_PERCENT
    )
    if used_bytes * 100 >= limit_bytes * pause_percent:
        level = "pause"
        onboarding_paused = True
    elif used_bytes * 100 >= limit_bytes * critical_percent:
        level = "critical"
        onboarding_paused = False
    elif used_bytes * 100 >= limit_bytes * warning_percent:
        level = "warning"
        onboarding_paused = False
    else:
        level = "normal"
        onboarding_paused = False

    return CapacitySnapshot(
        used_bytes=used_bytes,
        limit_bytes=limit_bytes,
        utilization_percent=utilization_percent,
        level=level,
        onboarding_paused=onboarding_paused,
    )


def database_used_bytes(session: Session) -> int:
    """Measure the current database using backend-native, read-only queries."""
    bind = session.get_bind()
    dialect = bind.dialect.name

    try:
        if dialect == "postgresql":
            value = session.execute(
                text("SELECT pg_database_size(current_database())")
            ).scalar_one()
            return int(value)
        if dialect == "sqlite":
            page_count = int(session.execute(text("PRAGMA page_count")).scalar_one())
            page_size = int(session.execute(text("PRAGMA page_size")).scalar_one())
            return page_count * page_size
    except Exception as exc:
        raise CapacityMeasurementError(
            "Configured database capacity could not be measured"
        ) from exc

    raise CapacityMeasurementError(
        f"Database capacity measurement is not supported for dialect {dialect}"
    )


def database_capacity_snapshot(session: Session) -> CapacitySnapshot | None:
    """Return a snapshot only after an exact operator-approved limit is set."""
    policy = capacity_policy_from_environment()
    if policy.limit_bytes is None:
        return None
    return evaluate_capacity(database_used_bytes(session), policy.limit_bytes)


def enforce_new_user_onboarding_capacity(session: Session) -> None:
    """Fail closed for new users when configured capacity is unsafe or unreadable."""
    try:
        policy = capacity_policy_from_environment()
    except RuntimeError as exc:
        logger.error("New identity onboarding paused: capacity configuration invalid")
        raise OnboardingCapacityPaused(
            "New account onboarding is temporarily paused"
        ) from exc
    if not policy.configured:
        return

    try:
        assert policy.limit_bytes is not None
        snapshot = evaluate_capacity(
            database_used_bytes(session),
            policy.limit_bytes,
        )
    except (CapacityMeasurementError, RuntimeError) as exc:
        logger.error("New identity onboarding paused: capacity measurement unavailable")
        raise OnboardingCapacityPaused(
            "New account onboarding is temporarily paused"
        ) from exc

    if snapshot.level != "normal":
        logger.warning(
            "Database capacity policy threshold reached (level=%s)",
            snapshot.level,
        )
    if snapshot.onboarding_paused:
        raise OnboardingCapacityPaused(
            "New account onboarding is temporarily paused"
        )
