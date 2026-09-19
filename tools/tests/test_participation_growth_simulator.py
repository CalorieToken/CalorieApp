import unittest

from tools.participation_growth_simulator import CapacityPolicy, GrowthModel


class ParticipationGrowthSimulatorTests(unittest.TestCase):
    def setUp(self):
        self.model = GrowthModel()

    def test_zero_nodes_is_healthy_normal_state(self):
        snap = self.model.snapshot(0)
        self.assertEqual(snap.volunteer_storage_units, 0)
        self.assertEqual(snap.volunteer_compute_units, 0)
        self.assertTrue(snap.hosted_fallback_active)
        self.assertTrue(snap.app_available)
        self.assertTrue(snap.gameverse_available)
        self.assertEqual(snap.total_storage_units, 100)
        self.assertEqual(snap.total_compute_units, 100)

    def test_capacity_grows_monotonically_with_participation(self):
        snaps = [self.model.snapshot(n) for n in (0, 1, 10, 100, 1000)]
        self.assertEqual(
            [s.total_storage_units for s in snaps],
            sorted(s.total_storage_units for s in snaps),
        )
        self.assertEqual(
            [s.total_compute_units for s in snaps],
            sorted(s.total_compute_units for s in snaps),
        )
        self.assertTrue(all(s.hosted_fallback_active for s in snaps))

    def test_small_participation_adds_capacity_without_replacing_hosted_core(self):
        snap = self.model.snapshot(1)
        self.assertEqual(snap.volunteer_storage_units, 4)
        self.assertEqual(snap.volunteer_compute_units, 3)
        self.assertEqual(snap.hosted_storage_units, 100)
        self.assertEqual(snap.hosted_compute_units, 100)

    def test_storage_and_compute_growth_can_be_independent(self):
        storage_only = self.model.snapshot(10, storage_units_per_node=4, compute_units_per_node=0)
        compute_only = self.model.snapshot(10, storage_units_per_node=0, compute_units_per_node=3)
        self.assertGreater(storage_only.volunteer_storage_units, 0)
        self.assertEqual(storage_only.volunteer_compute_units, 0)
        self.assertEqual(compute_only.volunteer_storage_units, 0)
        self.assertGreater(compute_only.volunteer_compute_units, 0)

    def test_rates_are_bounded(self):
        with self.assertRaisesRegex(ValueError, "storage-rate-out-of-range"):
            self.model.snapshot(1, storage_units_per_node=9)
        with self.assertRaisesRegex(ValueError, "compute-rate-out-of-range"):
            self.model.snapshot(1, compute_units_per_node=7)

    def test_invalid_node_counts_fail_closed(self):
        for value in (-1, 1.5, "10"):
            with self.assertRaisesRegex(ValueError, "volunteer-nodes"):
                self.model.snapshot(value)

    def test_matrix_covers_growth_stages(self):
        matrix = self.model.matrix()
        self.assertEqual([item.volunteer_nodes for item in matrix], [0, 1, 10, 100, 1000])
        self.assertTrue(all(item.app_available for item in matrix))
        self.assertTrue(all(item.gameverse_available for item in matrix))


if __name__ == "__main__":
    unittest.main()
