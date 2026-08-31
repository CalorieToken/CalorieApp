"""Tests for the provider-neutral capacity alert adapter interface."""

from __future__ import annotations

import json

import pytest
from sqlalchemy import create_engine
from sqlmodel import Session

import app.capacity_probe as probe_module
from app.capacity import CapacityMeasurementError
from app.capacity_probe import (
    EXIT_CRITICAL,
    EXIT_NORMAL,
    EXIT_PAUSE,
    EXIT_UNAVAILABLE,
    EXIT_UNCONFIGURED,
    EXIT_WARNING,
    PROBE_SCHEMA_VERSION,
    capacity_probe_from_session,
)


@pytest.mark.parametrize(
    ("used_bytes", "level", "threshold", "paused", "exit_code"),
    [
        (699, "normal", None, False, EXIT_NORMAL),
        (700, "warning", 70, False, EXIT_WARNING),
        (850, "critical", 85, False, EXIT_CRITICAL),
        (950, "pause", 95, True, EXIT_PAUSE),
    ],
)
def test_probe_maps_capacity_levels_to_stable_alert_contract(
    monkeypatch: pytest.MonkeyPatch,
    used_bytes: int,
    level: str,
    threshold: int | None,
    paused: bool,
    exit_code: int,
) -> None:
    monkeypatch.setattr(probe_module, "database_used_bytes", lambda session: used_bytes)

    result = capacity_probe_from_session(
        object(),  # type: ignore[arg-type]
        {"CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES": "1000"},
    )

    assert result.exit_code == exit_code
    assert result.payload == {
        "schema_version": PROBE_SCHEMA_VERSION,
        "status": "measured",
        "configured": True,
        "level": level,
        "threshold_percent": threshold,
        "onboarding_paused": paused,
        "action": {
            "normal": "none",
            "warning": "review-capacity-growth",
            "critical": "prepare-onboarding-pause",
            "pause": "keep-existing-access-pause-new-onboarding",
        }[level],
    }
    assert "used_bytes" not in result.payload
    assert "limit_bytes" not in result.payload
    assert "utilization_percent" not in result.payload


def test_probe_reports_unconfigured_limit_without_measuring(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        probe_module,
        "database_used_bytes",
        lambda session: pytest.fail("unconfigured probe must not query the database"),
    )
    result = capacity_probe_from_session(object(), {})  # type: ignore[arg-type]

    assert result.exit_code == EXIT_UNCONFIGURED
    assert result.payload["status"] == "unconfigured"
    assert result.payload["onboarding_paused"] is False
    assert result.payload["reason_code"] == "capacity-limit-unconfigured"


def test_probe_reports_invalid_configuration_without_echoing_value() -> None:
    result = capacity_probe_from_session(
        object(),  # type: ignore[arg-type]
        {"CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES": "sensitive-invalid-value"},
    )

    assert result.exit_code == EXIT_UNAVAILABLE
    assert result.payload["status"] == "unavailable"
    assert result.payload["configured"] is False
    assert result.payload["onboarding_paused"] is True
    assert result.payload["reason_code"] == "capacity-configuration-invalid"
    assert "sensitive-invalid-value" not in json.dumps(result.payload)


def test_probe_reports_measurement_failure_without_exception_detail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_measurement(session: object) -> int:
        raise CapacityMeasurementError("synthetic private diagnostic")

    monkeypatch.setattr(probe_module, "database_used_bytes", fail_measurement)
    result = capacity_probe_from_session(
        object(),  # type: ignore[arg-type]
        {"CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES": "1000"},
    )

    assert result.exit_code == EXIT_UNAVAILABLE
    assert result.payload["status"] == "unavailable"
    assert result.payload["onboarding_paused"] is True
    assert result.payload["reason_code"] == "capacity-measurement-unavailable"
    assert "synthetic private diagnostic" not in json.dumps(result.payload)


def test_cli_prints_deterministic_low_cardinality_pause_signal(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    test_engine = create_engine("sqlite://")
    monkeypatch.setattr(probe_module, "engine", test_engine)
    monkeypatch.setattr(probe_module, "_DATABASE_URL_WAS_EXPLICIT", False)
    monkeypatch.setenv("CALORIEAPP_ENV", "test")
    monkeypatch.setenv("CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES", "1000")
    monkeypatch.setattr(probe_module, "database_used_bytes", lambda session: 950)
    try:
        assert probe_module.main() == EXIT_PAUSE
    finally:
        test_engine.dispose()

    payload = json.loads(capsys.readouterr().out)
    assert payload["schema_version"] == PROBE_SCHEMA_VERSION
    assert payload["level"] == "pause"
    assert payload["threshold_percent"] == 95
    assert payload["onboarding_paused"] is True
    assert set(payload) == {
        "schema_version",
        "status",
        "configured",
        "level",
        "threshold_percent",
        "onboarding_paused",
        "action",
    }
