import unittest

from tools.participation_data_release_simulator import (
    ShardState, StorageReleaseCoordinator, demo_release_matrix
)


class ParticipationDataReleaseSimulatorTests(unittest.TestCase):
    def setUp(self):
        self.coordinator = StorageReleaseCoordinator(desired_remote_replicas=3)

    def test_stop_can_keep_existing_local_data_without_new_work(self):
        result = self.coordinator.release(
            ShardState("sim-a", healthy_remote_replicas=0),
            "keep-local",
        )
        self.assertFalse(result.accept_new_storage_work)
        self.assertTrue(result.local_copy_after)
        self.assertEqual(result.status, "stopped-keeping-local-copy")

    def test_safe_handoff_can_use_hosted_fallback_in_early_phase(self):
        result = self.coordinator.release(
            ShardState("sim-a", healthy_remote_replicas=0, hosted_copy_available=True),
            "handoff-then-delete",
        )
        self.assertTrue(result.safe_handoff_verified)
        self.assertTrue(result.fallback_used)
        self.assertFalse(result.local_copy_after)

    def test_safe_handoff_can_use_enough_remote_replicas_without_hosted_copy(self):
        result = self.coordinator.release(
            ShardState("sim-a", healthy_remote_replicas=3, hosted_copy_available=False),
            "handoff-then-delete",
        )
        self.assertTrue(result.safe_handoff_verified)
        self.assertFalse(result.fallback_used)
        self.assertFalse(result.local_copy_after)

    def test_handoff_waits_when_no_safe_copy_exists(self):
        result = self.coordinator.release(
            ShardState("sim-a", healthy_remote_replicas=1, hosted_copy_available=False),
            "handoff-then-delete",
        )
        self.assertFalse(result.safe_handoff_verified)
        self.assertTrue(result.local_copy_after)
        self.assertEqual(result.status, "handoff-pending-keep-local-copy")

    def test_user_can_delete_local_copy_immediately(self):
        result = self.coordinator.release(
            ShardState("sim-a", healthy_remote_replicas=0, hosted_copy_available=True),
            "delete-now",
        )
        self.assertFalse(result.accept_new_storage_work)
        self.assertFalse(result.local_copy_after)
        self.assertTrue(result.fallback_used)
        self.assertEqual(result.status, "local-copy-deleted-by-user-choice")

    def test_delete_now_does_not_require_participant_to_wait_for_replication(self):
        result = self.coordinator.release(
            ShardState("sim-a", healthy_remote_replicas=0, hosted_copy_available=False),
            "delete-now",
        )
        self.assertFalse(result.local_copy_after)
        self.assertFalse(result.safe_handoff_verified)
        self.assertFalse(result.fallback_used)

    def test_invalid_release_mode_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "invalid-release-mode"):
            self.coordinator.release(ShardState("sim-a"), "mystery")

    def test_demo_matrix_covers_all_modes(self):
        results = demo_release_matrix()
        self.assertEqual(len(results), 9)
        self.assertEqual(
            {item["mode"] for item in results},
            {"keep-local", "handoff-then-delete", "delete-now"},
        )


if __name__ == "__main__":
    unittest.main()
