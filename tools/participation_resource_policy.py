"""Synthetic participant resource-policy model.

This module models user-selected device and network limits for the optional
participation layer. It does not inspect a real device, network interface,
battery, idle state, or operating-system scheduler.
"""
from __future__ import annotations

from dataclasses import dataclass

from tools.participation_simulator import SPEC, SimulationError


STORAGE_TASK = SPEC["task_type"]
COMPUTE_TASK = SPEC["compute"]["task_type"]
SUPPORTED_TASK_CLASSES = frozenset({STORAGE_TASK, COMPUTE_TASK})
MIB = 1024 * 1024


@dataclass(frozen=True)
class ResourcePreferences:
    monthly_bandwidth_limit_mb: int = 500
    compute_limit_percent: int = 25
    wifi_only: bool = True
    allow_battery: bool = False
    idle_compute_only: bool = True
    auto_start: bool = False
    allowed_task_classes: frozenset[str] = SUPPORTED_TASK_CLASSES

    def __post_init__(self) -> None:
        if type(self.monthly_bandwidth_limit_mb) is not int:
            raise SimulationError("invalid-monthly-bandwidth-limit")
        if not 100 <= self.monthly_bandwidth_limit_mb <= 10000:
            raise SimulationError("invalid-monthly-bandwidth-limit")
        if type(self.compute_limit_percent) is not int or not 5 <= self.compute_limit_percent <= 75:
            raise SimulationError("invalid-compute-limit")
        if any(type(value) is not bool for value in (
            self.wifi_only,
            self.allow_battery,
            self.idle_compute_only,
            self.auto_start,
        )):
            raise SimulationError("invalid-resource-preference")
        if type(self.allowed_task_classes) is not frozenset:
            raise SimulationError("invalid-task-class-selection")
        if not self.allowed_task_classes.issubset(SUPPORTED_TASK_CLASSES):
            raise SimulationError("unsupported-task-class")


@dataclass(frozen=True)
class DeviceConditions:
    on_wifi: bool = True
    on_battery: bool = False
    idle: bool = True

    def __post_init__(self) -> None:
        if any(type(value) is not bool for value in (
            self.on_wifi,
            self.on_battery,
            self.idle,
        )):
            raise SimulationError("invalid-device-condition")


@dataclass(frozen=True)
class ResourceUsage:
    monthly_transfer_bytes: int = 0

    def __post_init__(self) -> None:
        if type(self.monthly_transfer_bytes) is not int or self.monthly_transfer_bytes < 0:
            raise SimulationError("invalid-transfer-usage")


@dataclass(frozen=True)
class TaskAdmission:
    allowed: bool
    reason: str
    projected_monthly_transfer_bytes: int
    compute_limit_percent: int


def admit_task(
    preferences: ResourcePreferences,
    conditions: DeviceConditions,
    usage: ResourceUsage,
    *,
    task_type: str,
    estimated_transfer_bytes: int,
    manual_start: bool,
) -> TaskAdmission:
    if type(estimated_transfer_bytes) is not int or estimated_transfer_bytes < 0:
        raise SimulationError("invalid-estimated-transfer")
    if type(manual_start) is not bool:
        raise SimulationError("invalid-manual-start")

    projected = usage.monthly_transfer_bytes + estimated_transfer_bytes
    base = {
        "projected_monthly_transfer_bytes": projected,
        "compute_limit_percent": preferences.compute_limit_percent,
    }

    if task_type not in SUPPORTED_TASK_CLASSES:
        return TaskAdmission(False, "unsupported-task-class", **base)
    if task_type not in preferences.allowed_task_classes:
        return TaskAdmission(False, "task-class-not-selected", **base)
    if not manual_start and not preferences.auto_start:
        return TaskAdmission(False, "manual-start-required", **base)
    if preferences.wifi_only and not conditions.on_wifi:
        return TaskAdmission(False, "wifi-required", **base)
    if conditions.on_battery and not preferences.allow_battery:
        return TaskAdmission(False, "battery-use-disabled", **base)
    if task_type == COMPUTE_TASK and preferences.idle_compute_only and not conditions.idle:
        return TaskAdmission(False, "idle-compute-required", **base)
    if projected > preferences.monthly_bandwidth_limit_mb * MIB:
        return TaskAdmission(False, "monthly-bandwidth-cap-reached", **base)

    return TaskAdmission(True, "allowed-within-user-limits", **base)
