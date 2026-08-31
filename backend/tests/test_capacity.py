"""Regression tests for the provider-neutral database capacity policy."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlmodel import Session

import app.capacity as capacity_module
from app.capacity import (
    CapacityMeasurementError,
    OnboardingCapacityPaused,
    capacity_policy_from_environment,
    database_capacity_snapshot,
    database_used_bytes,
    enforce_new_user_onboarding_capacity,
    evaluate_capacity,
    validate_capacity_configuration,
)


def test_capacity_policy_remains_unconfigured_without_approved_limit() -> None:
    policy = capacity_policy_from_environment({})
    assert policy.configured is False
    assert policy.limit_bytes is None


@pytest.mark.parametrize("value", ["0", "-1", "not-a-number", "1.5"])
def test_capacity_policy_rejects_invalid_limits(value: str) -> None:
    with pytest.raises(RuntimeError, match="must be a positive integer"):
        capacity_policy_from_environment(
            {"CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES": value}
        )


def test_startup_validation_rejects_malformed_capacity_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES", "invalid")
    with pytest.raises(RuntimeError, match="must be a positive integer"):
        validate_capacity_configuration()


@pytest.mark.parametrize(
    ("used_bytes", "expected_level", "onboarding_paused"),
    [
        (699, "normal", False),
        (700, "warning", False),
        (849, "warning", False),
        (850, "critical", False),
        (949, "critical", False),
        (950, "pause", True),
        (1100, "pause", True),
    ],
)
def test_capacity_threshold_boundaries(
    used_bytes: int,
    expected_level: str,
    onboarding_paused: bool,
) -> None:
    snapshot = evaluate_capacity(used_bytes=used_bytes, limit_bytes=1000)
    assert snapshot.level == expected_level
    assert snapshot.onboarding_paused is onboarding_paused


def test_sqlite_capacity_measurement_is_read_only_and_positive() -> None:
    engine = create_engine("sqlite://")
    try:
        with Session(engine) as session:
            assert database_used_bytes(session) > 0
    finally:
        engine.dispose()


def test_unconfigured_policy_does_not_attempt_measurement(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES", raising=False)
    monkeypatch.setattr(
        capacity_module,
        "database_used_bytes",
        lambda session: pytest.fail("unconfigured policy must not measure capacity"),
    )
    enforce_new_user_onboarding_capacity(object())  # type: ignore[arg-type]


def test_configured_policy_allows_new_user_below_pause_threshold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES", "1000")
    monkeypatch.setattr(capacity_module, "database_used_bytes", lambda session: 949)
    enforce_new_user_onboarding_capacity(object())  # type: ignore[arg-type]


def test_configured_policy_pauses_new_user_at_threshold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES", "1000")
    monkeypatch.setattr(capacity_module, "database_used_bytes", lambda session: 950)
    with pytest.raises(OnboardingCapacityPaused):
        enforce_new_user_onboarding_capacity(object())  # type: ignore[arg-type]


def test_configured_policy_fails_closed_when_measurement_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES", "1000")

    def fail_measurement(session: object) -> int:
        raise CapacityMeasurementError("synthetic failure")

    monkeypatch.setattr(capacity_module, "database_used_bytes", fail_measurement)
    with pytest.raises(OnboardingCapacityPaused):
        enforce_new_user_onboarding_capacity(object())  # type: ignore[arg-type]


def test_database_snapshot_is_none_until_exact_limit_is_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES", raising=False)
    assert database_capacity_snapshot(object()) is None  # type: ignore[arg-type]
