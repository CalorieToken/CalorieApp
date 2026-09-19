import unittest

from tools.participation_ui_adapter import (
    ParticipationSelection, ParticipationSession, demo_matrix
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

    def test_storage_only(self):
        self.session.apply(ParticipationSelection(storage=True))
        self.assertTrue(self.session.run_storage_probe()["verified"])
        self.assertEqual(self.session.run_compute_probe()["status"], "compute-off")

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

    def test_storage_can_remain_on_while_compute_paused(self):
        self.session.apply(ParticipationSelection(storage=True, compute=True, process_state="paused"))
        self.assertTrue(self.session.run_storage_probe()["verified"])
        self.assertEqual(self.session.run_compute_probe()["status"], "compute-paused")

    def test_exit_keeps_product_access(self):
        self.session.apply(ParticipationSelection(storage=True, compute=True, rewards=True, process_state="running"))
        snap = self.session.exit()
        self.assertFalse(snap["selection"]["storage"])
        self.assertFalse(snap["selection"]["compute"])
        self.assertTrue(snap["normal_app_access"])
        self.assertTrue(snap["normal_gameverse_access"])
        self.assertTrue(snap["hosted_core_active"])

    def test_invalid_limits_or_state_fail_closed(self):
        for selection in (
            ParticipationSelection(storage_limit_mb=49),
            ParticipationSelection(compute_limit_percent=80),
            ParticipationSelection(compute=False, process_state="running"),
        ):
            with self.assertRaises(SimulationError):
                self.session.apply(selection)

    def test_demo_matrix_covers_expected_paths(self):
        results = demo_matrix()
        self.assertGreaterEqual(len(results), 7)
        self.assertTrue(all(r["hosted_core_active"] for r in results))
        self.assertTrue(all(r["normal_app_access"] for r in results))


if __name__ == "__main__":
    unittest.main()
