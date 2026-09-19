import unittest

from tools.participation_ui_adapter import (
    DeviceContext,
    ParticipationSelection,
    ParticipationSession,
    demo_matrix,
)
from tools.participation_simulator import SimulationError


class ParticipationUiAdapterTests(unittest.TestCase):
    def setUp(self):
        self.now = 40 * 86400 + 1000
        self.session = ParticipationSession(enabled=True, clock=lambda: self.now)
        self.addCleanup(self.session.close)

    def test_zero_participation_is_normal_and_hosted_core_stays_active(self):
        snap = self.session.snapshot()
        self.assertEqual(snap["community_volunteer_nodes"], 0)
        self.assertTrue(snap["hosted_core_active"])
        self.assertTrue(snap["normal_app_access"])
        self.assertTrue(snap["normal_gameverse_access"])
        self.assertEqual(snap["retained_local_synthetic_shards"], 0)

    def test_storage_enabled_but_not_started(self):
        self.session.apply(ParticipationSelection(storage=True, storage_state="off"))
        self.assertEqual(self.session.run_storage_probe()["status"], "storage-stopped")

    def test_storage_start_pause_resume_stop(self):
        self.session.apply(ParticipationSelection(storage=True, storage_state="running"))
        self.assertTrue(self.session.run_storage_probe()["verified"])
        self.assertEqual(self.session.snapshot()["retained_local_synthetic_shards"], 1)

        self.session.apply(ParticipationSelection(storage=True, storage_state="paused"))
        self.assertEqual(self.session.run_storage_probe()["status"], "storage-paused")

        self.session.apply(ParticipationSelection(storage=True, storage_state="running"))
        self.assertTrue(self.session.run_storage_probe()["verified"])

        stopped = self.session.stop_storage()
        self.assertEqual(stopped["selection"]["storage_state"], "off")
        self.assertEqual(stopped["retained_local_synthetic_shards"], 1)
        self.assertEqual(
            stopped["storage_release_results"][0]["status"],
            "stopped-keeping-local-copy",
        )

    def test_compute_enabled_but_not_started(self):
        self.session.apply(ParticipationSelection(compute=True, process_state="off"))
        self.assertEqual(self.session.run_compute_probe()["status"], "compute-stopped")
        self.assertTrue(self.session.snapshot()["normal_app_access"])

    def test_compute_start_pause_resume_stop(self):
        self.session.apply(ParticipationSelection(compute=True, process_state="running"))
        self.assertTrue(self.session.run_compute_probe()["verified"])
        self.session.apply(ParticipationSelection(compute=True, process_state="paused"))
        self.assertEqual(self.session.run_compute_probe()["status"], "compute-paused")
        self.session.apply(ParticipationSelection(compute=True, process_state="running"))
        self.assertTrue(self.session.run_compute_probe()["verified"])
        self.session.apply(ParticipationSelection(compute=True, process_state="off"))
        self.assertEqual(self.session.run_compute_probe()["status"], "compute-stopped")

    def test_storage_can_run_while_compute_is_paused(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            compute=True,
            storage_state="running",
            process_state="paused",
        ))
        self.assertTrue(self.session.run_storage_probe()["verified"])
        self.assertEqual(self.session.run_compute_probe()["status"], "compute-paused")

    def test_compute_can_run_while_storage_is_paused(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            compute=True,
            storage_state="paused",
            process_state="running",
        ))
        self.assertEqual(self.session.run_storage_probe()["status"], "storage-paused")
        self.assertTrue(self.session.run_compute_probe()["verified"])

    def test_stop_storage_keep_local_is_default(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
            storage_release_mode="keep-local",
        ))
        self.session.run_storage_probe()
        stopped = self.session.stop_storage()
        result = stopped["storage_release_results"][0]
        self.assertEqual(result["mode"], "keep-local")
        self.assertTrue(result["local_copy_after"])
        self.assertEqual(stopped["retained_local_synthetic_shards"], 1)

    def test_stop_storage_safe_handoff_then_delete_uses_hosted_fallback(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
            storage_release_mode="handoff-then-delete",
        ))
        self.session.run_storage_probe()
        stopped = self.session.stop_storage(
            healthy_remote_replicas=0,
            hosted_copy_available=True,
        )
        result = stopped["storage_release_results"][0]
        self.assertTrue(result["safe_handoff_verified"])
        self.assertTrue(result["fallback_used"])
        self.assertFalse(result["local_copy_after"])
        self.assertEqual(stopped["retained_local_synthetic_shards"], 0)

    def test_stop_storage_safe_handoff_waits_without_safe_copy(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
            storage_release_mode="handoff-then-delete",
        ))
        self.session.run_storage_probe()
        stopped = self.session.stop_storage(
            healthy_remote_replicas=1,
            hosted_copy_available=False,
        )
        result = stopped["storage_release_results"][0]
        self.assertFalse(result["safe_handoff_verified"])
        self.assertTrue(result["local_copy_after"])
        self.assertEqual(result["status"], "handoff-pending-keep-local-copy")
        self.assertEqual(stopped["retained_local_synthetic_shards"], 1)

    def test_stop_storage_delete_now_honors_participant_choice(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
            storage_release_mode="delete-now",
        ))
        self.session.run_storage_probe()
        stopped = self.session.stop_storage(
            healthy_remote_replicas=0,
            hosted_copy_available=False,
        )
        result = stopped["storage_release_results"][0]
        self.assertFalse(result["local_copy_after"])
        self.assertEqual(result["status"], "local-copy-deleted-by-user-choice")
        self.assertEqual(stopped["retained_local_synthetic_shards"], 0)

    def test_stopping_storage_does_not_stop_running_compute(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            compute=True,
            storage_state="running",
            process_state="running",
            storage_release_mode="keep-local",
        ))
        self.session.run_storage_probe()
        stopped = self.session.stop_storage()
        self.assertEqual(stopped["selection"]["storage_state"], "off")
        self.assertEqual(stopped["selection"]["process_state"], "running")
        self.assertTrue(stopped["effective_compute_consent"]["compute"])
        self.assertTrue(self.session.run_compute_probe()["verified"])

    def test_exit_uses_selected_release_mode_and_keeps_product_access(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            compute=True,
            rewards=True,
            storage_state="running",
            process_state="running",
            storage_release_mode="handoff-then-delete",
        ))
        self.session.run_storage_probe()
        snap = self.session.exit(
            healthy_remote_replicas=0,
            hosted_copy_available=True,
        )
        self.assertFalse(snap["selection"]["storage"])
        self.assertFalse(snap["selection"]["compute"])
        self.assertEqual(snap["selection"]["storage_state"], "off")
        self.assertEqual(snap["selection"]["process_state"], "off")
        self.assertEqual(snap["exit_storage_release_mode"], "handoff-then-delete")
        self.assertEqual(snap["retained_local_synthetic_shards"], 0)
        self.assertTrue(snap["normal_app_access"])
        self.assertTrue(snap["normal_gameverse_access"])
        self.assertTrue(snap["hosted_core_active"])

    def test_invalid_limits_release_modes_or_states_fail_closed(self):
        for selection in (
            ParticipationSelection(storage_limit_mb=49),
            ParticipationSelection(compute_limit_percent=80),
            ParticipationSelection(storage_release_mode="silent-delete"),
            ParticipationSelection(storage=False, storage_state="running"),
            ParticipationSelection(compute=False, process_state="running"),
            ParticipationSelection(storage=True, storage_state="invalid"),
        ):
            with self.assertRaises(SimulationError):
                self.session.apply(selection)

    def test_storage_and_compute_pause_are_independent(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            compute=True,
            storage_state="running",
            process_state="paused",
        ))
        snap = self.session.snapshot()
        self.assertFalse(snap["effective_storage_consent"]["paused"])
        self.assertTrue(snap["effective_storage_consent"]["storage"])
        self.assertTrue(snap["effective_compute_consent"]["paused"])
        self.assertTrue(snap["effective_compute_consent"]["compute"])


    def test_advanced_defaults_are_conservative(self):
        snap = self.session.snapshot()
        selection = snap["selection"]
        self.assertEqual(selection["monthly_bandwidth_limit_mb"], 500)
        self.assertTrue(selection["wifi_only"])
        self.assertFalse(selection["allow_battery"])
        self.assertTrue(selection["idle_compute_only"])
        self.assertFalse(selection["auto_start"])
        self.assertTrue(selection["allow_storage_tasks"])
        self.assertTrue(selection["allow_compute_tasks"])

    def test_wifi_only_blocks_non_wifi_work(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
        ))
        with self.assertRaisesRegex(SimulationError, "wifi-required"):
            self.session.run_storage_probe(DeviceContext(on_wifi=False))

    def test_battery_work_is_blocked_by_default(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
        ))
        with self.assertRaisesRegex(SimulationError, "battery-participation-disabled"):
            self.session.run_storage_probe(DeviceContext(on_battery=True))

    def test_user_can_explicitly_allow_battery_participation(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
            allow_battery=True,
        ))
        result = self.session.run_storage_probe(DeviceContext(on_battery=True))
        self.assertTrue(result["verified"])

    def test_compute_is_idle_only_by_default(self):
        self.session.apply(ParticipationSelection(
            compute=True,
            process_state="running",
        ))
        with self.assertRaisesRegex(SimulationError, "compute-requires-idle-device"):
            self.session.run_compute_probe(DeviceContext(is_idle=False))

    def test_user_can_disable_idle_only_compute_limit(self):
        self.session.apply(ParticipationSelection(
            compute=True,
            process_state="running",
            idle_compute_only=False,
        ))
        result = self.session.run_compute_probe(DeviceContext(is_idle=False))
        self.assertTrue(result["verified"])

    def test_task_class_controls_fail_closed(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
            allow_storage_tasks=False,
        ))
        with self.assertRaisesRegex(SimulationError, "storage-task-class-disabled"):
            self.session.run_storage_probe()

        self.session.apply(ParticipationSelection(
            compute=True,
            process_state="running",
            allow_compute_tasks=False,
        ))
        with self.assertRaisesRegex(SimulationError, "compute-task-class-disabled"):
            self.session.run_compute_probe()

    def test_monthly_bandwidth_cap_blocks_new_work(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            storage_state="running",
            monthly_bandwidth_limit_mb=100,
        ))
        self.session.bandwidth_used_bytes = 100 * 1024 * 1024
        with self.assertRaisesRegex(SimulationError, "monthly-bandwidth-cap-reached"):
            self.session.run_storage_probe()

    def test_auto_start_is_opt_in_preview_only(self):
        self.session.apply(ParticipationSelection(
            storage=True,
            compute=True,
            auto_start=False,
        ))
        before = self.session.snapshot()["selection"]
        preview = self.session.auto_start_preview()
        self.assertFalse(preview["auto_start_opted_in"])
        self.assertEqual(preview["eligible"], [])
        self.assertFalse(preview["state_changed"])
        self.assertEqual(self.session.snapshot()["selection"], before)

        self.session.apply(ParticipationSelection(
            storage=True,
            compute=True,
            auto_start=True,
        ))
        before = self.session.snapshot()["selection"]
        preview = self.session.auto_start_preview()
        self.assertTrue(preview["auto_start_opted_in"])
        self.assertEqual(preview["eligible"], ["storage", "compute"])
        self.assertFalse(preview["state_changed"])
        self.assertEqual(self.session.snapshot()["selection"], before)

    def test_invalid_advanced_preferences_fail_closed(self):
        for selection in (
            ParticipationSelection(monthly_bandwidth_limit_mb=99),
            ParticipationSelection(monthly_bandwidth_limit_mb=10001),
            ParticipationSelection(wifi_only="yes"),
            ParticipationSelection(allow_battery=1),
        ):
            with self.assertRaises(SimulationError):
                self.session.apply(selection)

    def test_demo_matrix_covers_expected_paths(self):
        results = demo_matrix()
        self.assertGreaterEqual(len(results), 9)
        self.assertTrue(all(r["hosted_core_active"] for r in results))
        self.assertTrue(all(r["normal_app_access"] for r in results))


if __name__ == "__main__":
    unittest.main()
