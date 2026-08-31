"""Machine-readable, provider-neutral database capacity probe."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Mapping

from sqlmodel import Session

from .capacity import (
    CapacityMeasurementError,
    CapacitySnapshot,
    capacity_policy_from_environment,
    database_used_bytes,
    evaluate_capacity,
)
from .database import (
    _DATABASE_URL_WAS_EXPLICIT,
    engine,
    validate_database_environment,
)

PROBE_SCHEMA_VERSION = "calorieapp.capacity-probe.v1"

EXIT_NORMAL = 0
EXIT_WARNING = 10
EXIT_CRITICAL = 20
EXIT_PAUSE = 30
EXIT_UNCONFIGURED = 40
EXIT_UNAVAILABLE = 50

_LEVEL_EXIT_CODES = {
    "normal": EXIT_NORMAL,
    "warning": EXIT_WARNING,
    "critical": EXIT_CRITICAL,
    "pause": EXIT_PAUSE,
}
_LEVEL_THRESHOLDS = {
    "normal": None,
    "warning": 70,
    "critical": 85,
    "pause": 95,
}
_LEVEL_ACTIONS = {
    "normal": "none",
    "warning": "review-capacity-growth",
    "critical": "prepare-onboarding-pause",
    "pause": "keep-existing-access-pause-new-onboarding",
}


@dataclass(frozen=True)
class CapacityProbeResult:
    """Stable alert-adapter result containing no user or request content."""

    payload: dict[str, str | int | bool | None]
    exit_code: int


def _snapshot_result(snapshot: CapacitySnapshot) -> CapacityProbeResult:
    level = snapshot.level
    return CapacityProbeResult(
        payload={
            "schema_version": PROBE_SCHEMA_VERSION,
            "status": "measured",
            "configured": True,
            "level": level,
            "threshold_percent": _LEVEL_THRESHOLDS[level],
            "onboarding_paused": snapshot.onboarding_paused,
            "action": _LEVEL_ACTIONS[level],
        },
        exit_code=_LEVEL_EXIT_CODES[level],
    )


def _unconfigured_result() -> CapacityProbeResult:
    return CapacityProbeResult(
        payload={
            "schema_version": PROBE_SCHEMA_VERSION,
            "status": "unconfigured",
            "configured": False,
            "level": "unknown",
            "threshold_percent": None,
            "onboarding_paused": False,
            "action": "configure-approved-limit-before-release",
            "reason_code": "capacity-limit-unconfigured",
        },
        exit_code=EXIT_UNCONFIGURED,
    )


def _unavailable_result(reason_code: str) -> CapacityProbeResult:
    return CapacityProbeResult(
        payload={
            "schema_version": PROBE_SCHEMA_VERSION,
            "status": "unavailable",
            "configured": reason_code != "capacity-configuration-invalid",
            "level": "unknown",
            "threshold_percent": None,
            "onboarding_paused": True,
            "action": "investigate-signal-keep-new-onboarding-paused",
            "reason_code": reason_code,
        },
        exit_code=EXIT_UNAVAILABLE,
    )


def capacity_probe_from_session(
    session: Session,
    environment: Mapping[str, str] | None = None,
) -> CapacityProbeResult:
    """Evaluate one read-only capacity sample for an alert adapter."""
    try:
        policy = capacity_policy_from_environment(environment)
    except RuntimeError:
        return _unavailable_result("capacity-configuration-invalid")

    if policy.limit_bytes is None:
        return _unconfigured_result()

    try:
        snapshot = evaluate_capacity(
            database_used_bytes(session),
            policy.limit_bytes,
        )
    except (CapacityMeasurementError, RuntimeError, ValueError):
        return _unavailable_result("capacity-measurement-unavailable")
    return _snapshot_result(snapshot)


def main() -> int:
    """Print one deterministic JSON record and return its monitoring exit code."""
    try:
        policy = capacity_policy_from_environment()
    except RuntimeError:
        result = _unavailable_result("capacity-configuration-invalid")
    else:
        if policy.limit_bytes is None:
            result = _unconfigured_result()
        else:
            try:
                validate_database_environment(
                    str(engine.url),
                    os.getenv("CALORIEAPP_ENV"),
                    database_url_was_explicit=_DATABASE_URL_WAS_EXPLICIT,
                )
                with Session(engine) as session:
                    result = capacity_probe_from_session(session)
            except Exception:
                result = _unavailable_result("capacity-measurement-unavailable")

    print(json.dumps(result.payload, sort_keys=True, separators=(",", ":")))
    return result.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
