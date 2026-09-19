import unittest

from tools.participation_reliability_simulator import (
    NodeState, ReliabilityScheduler, lifecycle_scenario
)


class ParticipationReliabilitySimulatorTests(unittest.TestCase):
    def setUp(self):
        self.scheduler = ReliabilityScheduler()

    def test_zero_nodes_uses_hosted_fallback(self):
        assignment = self.scheduler.assign("t0", "compute", [])
        self.assertTrue(assignment.fallback)
        self.assertIsNone(assignment.node_id)
        self.assertEqual(assignment.reason, "hosted-core-fallback")

    def test_paused_node_receives_no_work(self):
        nodes = [NodeState("sim-a", compute=True, paused=True)]
        assignment = self.scheduler.assign("t1", "compute", nodes)
        self.assertTrue(assignment.fallback)

    def test_offline_node_receives_no_work(self):
        nodes = [NodeState("sim-a", storage=True, online=False)]
        assignment = self.scheduler.assign("t2", "storage", nodes)
        self.assertTrue(assignment.fallback)

    def test_storage_and_compute_eligibility_are_independent(self):
        nodes = [
            NodeState("sim-storage", storage=True, compute=False),
            NodeState("sim-compute", storage=False, compute=True),
        ]
        storage = self.scheduler.assign("s1", "storage", nodes)
        compute = self.scheduler.assign("c1", "compute", nodes)
        self.assertEqual(storage.node_id, "sim-storage")
        self.assertEqual(compute.node_id, "sim-compute")

    def test_round_robin_spreads_work_across_eligible_nodes(self):
        nodes = [
            NodeState("sim-a", compute=True),
            NodeState("sim-b", compute=True),
            NodeState("sim-c", compute=True),
        ]
        assigned = [
            self.scheduler.assign(f"c{i}", "compute", nodes).node_id
            for i in range(6)
        ]
        self.assertEqual(assigned, ["sim-a", "sim-b", "sim-c", "sim-a", "sim-b", "sim-c"])

    def test_node_can_rejoin_after_pause_or_dropout(self):
        paused = [NodeState("sim-a", compute=True, paused=True)]
        self.assertTrue(self.scheduler.assign("c1", "compute", paused).fallback)
        resumed = [NodeState("sim-a", compute=True, paused=False, online=True)]
        assignment = self.scheduler.assign("c2", "compute", resumed)
        self.assertFalse(assignment.fallback)
        self.assertEqual(assignment.node_id, "sim-a")

    def test_replica_shortfall_falls_back_instead_of_pressuring_users(self):
        nodes = [
            NodeState("sim-a", storage=True),
            NodeState("sim-b", storage=True, paused=True),
        ]
        selected, missing = self.scheduler.assign_replica_set("blob-1", nodes, 3)
        self.assertEqual(selected, ["sim-a"])
        self.assertEqual(missing, 2)

    def test_replica_set_recovers_as_participants_return(self):
        nodes = [
            NodeState("sim-a", storage=True),
            NodeState("sim-b", storage=True),
            NodeState("sim-c", storage=True),
        ]
        selected, missing = self.scheduler.assign_replica_set("blob-2", nodes, 3)
        self.assertEqual(selected, ["sim-a", "sim-b", "sim-c"])
        self.assertEqual(missing, 0)

    def test_lifecycle_scenario_preserves_fallback(self):
        result = lifecycle_scenario()
        self.assertFalse(result["initial_compute"]["fallback"])
        self.assertTrue(result["paused_compute"]["fallback"])
        self.assertFalse(result["rejoined_compute"]["fallback"])
        self.assertTrue(result["hosted_core_always_available"])


if __name__ == "__main__":
    unittest.main()
