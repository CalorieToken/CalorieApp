import json
from dataclasses import replace
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from tools.participation_compute_simulator import (
    COMPUTE, ComputeCoordinator, ComputeNode, ComputeProof, SimulationError,
    run_compute_demo,
)
from tools.participation_simulator import Consent


ROOT = Path(__file__).resolve().parents[2]
DAY = 86400


class ComputeSimulatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.now = 20 * DAY + 1000
        self.clock = lambda: self.now
        self.db = Path(self.tmp.name) / "compute.sqlite"
        self.coordinator = ComputeCoordinator(self.db, enabled=True, clock=self.clock)
        self.consent = Consent(compute=True, rewards=True)
        self.coordinator.register("sim-alice", age_band="adult")
        self.coordinator.set_consent("sim-alice", self.consent)
        self.node = ComputeNode(enabled=True, consent=self.consent, clock=self.clock)

    def test_disabled_by_default(self) -> None:
        with self.assertRaisesRegex(SimulationError, "simulation-disabled"):
            ComputeNode()
        with self.assertRaisesRegex(SimulationError, "simulation-disabled"):
            ComputeCoordinator(self.db)
        with self.assertRaisesRegex(SimulationError, "simulation-disabled"):
            run_compute_demo()

    def test_compute_requires_separate_opt_in(self) -> None:
        storage_only = Consent(storage=True, rewards=True)
        self.coordinator.set_consent("sim-alice", storage_only)
        with self.assertRaisesRegex(SimulationError, "compute-not-consented"):
            self.coordinator.issue("sim-alice", "apple")
        node = ComputeNode(enabled=True, consent=storage_only, clock=self.clock)
        self.coordinator.set_consent("sim-alice", self.consent)
        task = self.coordinator.issue("sim-alice", "apple")
        with self.assertRaisesRegex(SimulationError, "compute-not-consented"):
            node.execute(task, now=self.now)

    def test_fixed_worker_result_is_independently_recomputed(self) -> None:
        task = self.coordinator.issue("sim-alice", "vegetable-catalog")
        proof = self.node.execute(task, now=self.now)
        receipt = self.coordinator.verify("sim-alice", proof)
        self.assertTrue(receipt.verified)
        self.assertEqual(receipt.credited_units, 2)
        self.assertEqual(self.coordinator.balance("sim-alice"), 2)

    def test_forged_output_is_rejected_and_consumes_task(self) -> None:
        task = self.coordinator.issue("sim-alice", "apple")
        proof = self.node.execute(task, now=self.now)
        forged = ComputeProof(proof.task_id, {"record_count": 999}, proof.output_sha256)
        self.assertEqual(self.coordinator.verify("sim-alice", forged).status,
                         "invalid-compute-result")
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status, "already-consumed")
        self.assertEqual(self.coordinator.balance("sim-alice"), 0)

    def test_arbitrary_fixture_or_task_type_is_not_accepted(self) -> None:
        with self.assertRaisesRegex(SimulationError, "synthetic-fixture-required"):
            self.coordinator.issue("sim-alice", "../../private")
        task = self.coordinator.issue("sim-alice", "apple")
        with self.assertRaisesRegex(SimulationError, "unsupported-compute-task"):
            self.node.execute(replace(task, task_type="run-shell.v1"), now=self.now)

    def test_pause_or_consent_change_invalidates_pending_compute(self) -> None:
        task = self.coordinator.issue("sim-alice", "apple")
        proof = self.node.execute(task, now=self.now)
        self.coordinator.set_consent("sim-alice", Consent(compute=True, rewards=True, paused=True))
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status,
                         "consent-changed-or-paused")

    def test_expiry_is_enforced(self) -> None:
        task = self.coordinator.issue("sim-alice", "apple")
        proof = self.node.execute(task, now=self.now)
        self.now = task.expires_at
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status,
                         "compute-task-outside-window")

    def test_duplicate_compute_input_does_not_multiply_reward(self) -> None:
        first = self.coordinator.issue("sim-alice", "apple")
        first_receipt = self.coordinator.verify(
            "sim-alice", self.node.execute(first, now=self.now))
        second = self.coordinator.issue("sim-alice", "apple")
        second_receipt = self.coordinator.verify(
            "sim-alice", self.node.execute(second, now=self.now))
        self.assertEqual(first_receipt.credited_units, 1)
        self.assertEqual(second_receipt.credited_units, 0)
        self.assertEqual(self.coordinator.balance("sim-alice"), 1)

    def test_minors_and_reward_opt_out_can_compute_without_credit(self) -> None:
        for participant, age, rewards in (
            ("sim-child", "child", True),
            ("sim-teen", "teen", True),
            ("sim-adult-no-reward", "adult", False),
        ):
            consent = Consent(compute=True, rewards=rewards)
            self.coordinator.register(participant, age_band=age)
            self.coordinator.set_consent(participant, consent)
            node = ComputeNode(enabled=True, consent=consent, clock=self.clock)
            task = self.coordinator.issue(participant, "apple")
            receipt = self.coordinator.verify(participant, node.execute(task, now=self.now))
            self.assertEqual(receipt.status, "verified-without-reward")
            self.assertEqual(receipt.credited_units, 0)

    def test_task_count_is_bounded_per_node_run(self) -> None:
        node = ComputeNode(enabled=True, consent=self.consent, clock=self.clock)
        for index in range(COMPUTE["max_tasks_per_node_run"]):
            fixture = "apple" if index % 2 == 0 else "bread"
            task = self.coordinator.issue("sim-alice", fixture)
            node.execute(task, now=self.now)
        task = self.coordinator.issue("sim-alice", "water")
        with self.assertRaisesRegex(SimulationError, "compute-task-budget-exceeded"):
            node.execute(task, now=self.now)

    def test_worker_timeout_is_fail_closed(self) -> None:
        task = self.coordinator.issue("sim-alice", "apple")
        with patch("tools.participation_compute_simulator.subprocess.run",
                   side_effect=subprocess.TimeoutExpired(cmd="worker", timeout=2)):
            with self.assertRaisesRegex(SimulationError, "compute-time-budget-exceeded"):
                self.node.execute(task, now=self.now)

    def test_demo_is_offline_and_has_no_chain_or_arbitrary_code(self) -> None:
        with patch("socket.socket", side_effect=AssertionError("network-forbidden")):
            report = run_compute_demo(enabled=True)
        self.assertTrue(report["verified"])
        self.assertEqual(report["credited_units"], 2)
        self.assertEqual(report["onchain_transactions"], 0)
        self.assertFalse(report["arbitrary_code_execution"])
        self.assertFalse(report["secure_general_purpose_sandbox"])

    def test_cli_needs_explicit_enable(self) -> None:
        for flags, code in (([], 2), (["--enable-synthetic-demo"], 0)):
            result = subprocess.run(
                [sys.executable, "-m", "tools.participation_compute_simulator", *flags],
                cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, code, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["mode"], "local-synthetic-compute-only")


if __name__ == "__main__":
    unittest.main()
