import unittest

from tools.participation_resource_policy import (
    COMPUTE_TASK,
    STORAGE_TASK,
    DeviceConditions,
    ResourcePreferences,
    ResourceUsage,
    admit_task,
)
from tools.participation_simulator import SimulationError


class ParticipationResourcePolicyTests(unittest.TestCase):
    def setUp(self):
        self.preferences = ResourcePreferences()
        self.usage = ResourceUsage()

    def admit(self, task_type=COMPUTE_TASK, **kwargs):
        conditions = kwargs.pop("conditions", DeviceConditions())
        return admit_task(
            kwargs.pop("preferences", self.preferences),
            conditions,
            kwargs.pop("usage", self.usage),
            task_type=task_type,
            estimated_transfer_bytes=kwargs.pop("estimated_transfer_bytes", 1024),
            manual_start=kwargs.pop("manual_start", True),
        )

    def test_defaults_are_conservative_and_manual(self):
        p = self.preferences
        self.assertTrue(p.wifi_only)
        self.assertFalse(p.allow_battery)
        self.assertTrue(p.idle_compute_only)
        self.assertFalse(p.auto_start)

    def test_manual_start_is_required_by_default(self):
        result = self.admit(manual_start=False)
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "manual-start-required")

    def test_wifi_only_pauses_work_without_wifi(self):
        result = self.admit(conditions=DeviceConditions(on_wifi=False))
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "wifi-required")

    def test_battery_use_is_off_by_default(self):
        result = self.admit(conditions=DeviceConditions(on_battery=True))
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "battery-use-disabled")

    def test_compute_waits_for_idle_by_default_but_storage_does_not(self):
        busy = DeviceConditions(idle=False)
        compute = self.admit(COMPUTE_TASK, conditions=busy)
        storage = self.admit(STORAGE_TASK, conditions=busy)
        self.assertFalse(compute.allowed)
        self.assertEqual(compute.reason, "idle-compute-required")
        self.assertTrue(storage.allowed)

    def test_user_can_disable_individual_task_classes(self):
        p = ResourcePreferences(allowed_task_classes=frozenset({STORAGE_TASK}))
        compute = self.admit(COMPUTE_TASK, preferences=p)
        storage = self.admit(STORAGE_TASK, preferences=p)
        self.assertEqual(compute.reason, "task-class-not-selected")
        self.assertTrue(storage.allowed)

    def test_monthly_transfer_cap_is_enforced_before_task_admission(self):
        cap = self.preferences.monthly_bandwidth_limit_mb * 1024 * 1024
        usage = ResourceUsage(monthly_transfer_bytes=cap - 100)
        result = self.admit(usage=usage, estimated_transfer_bytes=101)
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "monthly-bandwidth-cap-reached")

    def test_exact_bandwidth_boundary_is_allowed(self):
        cap = self.preferences.monthly_bandwidth_limit_mb * 1024 * 1024
        usage = ResourceUsage(monthly_transfer_bytes=cap - 100)
        result = self.admit(usage=usage, estimated_transfer_bytes=100)
        self.assertTrue(result.allowed)

    def test_explicit_auto_start_choice_can_replace_manual_start(self):
        p = ResourcePreferences(auto_start=True)
        result = self.admit(preferences=p, manual_start=False)
        self.assertTrue(result.allowed)

    def test_compute_limit_is_carried_into_admission(self):
        p = ResourcePreferences(compute_limit_percent=10)
        result = self.admit(preferences=p)
        self.assertTrue(result.allowed)
        self.assertEqual(result.compute_limit_percent, 10)

    def test_invalid_preferences_fail_closed(self):
        invalid = (
            {"monthly_bandwidth_limit_mb": 99},
            {"monthly_bandwidth_limit_mb": 10001},
            {"compute_limit_percent": 4},
            {"compute_limit_percent": 76},
            {"allowed_task_classes": frozenset({"arbitrary-shell.v1"})},
        )
        for kwargs in invalid:
            with self.assertRaises(SimulationError):
                ResourcePreferences(**kwargs)

    def test_unknown_task_never_runs_even_with_auto_start(self):
        p = ResourcePreferences(auto_start=True)
        result = self.admit("arbitrary-shell.v1", preferences=p, manual_start=False)
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "unsupported-task-class")


if __name__ == "__main__":
    unittest.main()
