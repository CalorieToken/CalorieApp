from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from tools.participation_simulator import (
    Consent, Coordinator, DAY, FIXTURES, Proof, ROOT, SPEC, SimulationError,
    VolunteerNode, manifest_for, run_demo, storage_response,
)


class ParticipationSimulatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.now = DAY * 10 + 3600
        self.database = self.root / "synthetic-coordinator.sqlite3"
        self.coordinator = self.reopen()
        self.consent = Consent(storage=True, rewards=True)
        self.coordinator.register("sim-alice", age_band="adult")
        self.coordinator.set_consent("sim-alice", self.consent)
        self.node = VolunteerNode(self.root / "node", enabled=True, consent=self.consent,
                                  clock=lambda: self.now)

    def reopen(self) -> Coordinator:
        return Coordinator(self.database, enabled=True, clock=lambda: self.now)

    def prepare(self, fixture="apple", participant="sim-alice", node=None):
        node = node or self.node
        challenge = self.coordinator.issue(participant, fixture)
        node.store(challenge.shard, FIXTURES[fixture])
        return challenge, node.prove(challenge, now=self.now)

    def test_disabled_constructors_do_not_create_files(self) -> None:
        for action in (
            lambda: Coordinator(self.root / "disabled.sqlite3"),
            lambda: VolunteerNode(self.root / "disabled-node"),
            lambda: run_demo(),
        ):
            with self.assertRaisesRegex(SimulationError, "simulation-disabled"):
                action()
        self.assertFalse((self.root / "disabled.sqlite3").exists())
        self.assertFalse((self.root / "disabled-node").exists())

    def test_storage_and_compute_consent_are_separate_and_opt_in(self) -> None:
        self.coordinator.register("sim-new", age_band="adult")
        with self.assertRaisesRegex(SimulationError, "storage-not-consented"):
            self.coordinator.issue("sim-new", "apple")
        consent = Consent(compute=True, rewards=True)
        self.coordinator.set_consent("sim-new", consent)
        with self.assertRaisesRegex(SimulationError, "storage-not-consented"):
            self.coordinator.issue("sim-new", "apple")
        self.node.consent = consent
        with self.assertRaisesRegex(SimulationError, "storage-not-consented"):
            self.node.store(manifest_for("apple"), FIXTURES["apple"])

    def test_non_boolean_consent_and_invalid_limits_fail_closed(self) -> None:
        for values in ({"storage": "false"}, {"rewards": 1}, {"compute": None},
                       {"storage_limit_bytes": True}, {"storage_limit_bytes": -1},
                       {"transfer_limit_bytes": SPEC["max_transfer_bytes_per_run"] + 1}):
            with self.subTest(values=values), self.assertRaises(SimulationError):
                Consent(**values)

    def test_round_trip_reads_real_local_file_and_credits_once(self) -> None:
        challenge, proof = self.prepare()
        stored = self.node.directory / (challenge.shard.sha256 + ".shard")
        self.assertEqual(stored.read_bytes(), FIXTURES["apple"])
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 1)
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status, "already-consumed")
        self.assertEqual(self.coordinator.balance("sim-alice"), 1)

    def test_new_challenge_for_same_work_does_not_multiply_credit(self) -> None:
        first, proof = self.prepare()
        self.coordinator.verify("sim-alice", proof)
        second, proof = self.prepare()
        self.assertNotEqual(first.nonce, second.nonce)
        self.assertNotEqual(first.challenge_id, second.challenge_id)
        receipt = self.coordinator.verify("sim-alice", proof)
        self.assertTrue(receipt.verified)
        self.assertEqual(receipt.status, "verified-already-rewarded")
        self.assertEqual(receipt.credited_units, 0)

    def test_two_nodes_for_one_participant_share_reward_deduplication(self) -> None:
        _, proof = self.prepare()
        self.coordinator.verify("sim-alice", proof)
        other = VolunteerNode(self.root / "other-node", enabled=True, consent=self.consent)
        _, other_proof = self.prepare(node=other)
        self.coordinator.verify("sim-alice", other_proof)
        self.assertEqual(self.coordinator.balance("sim-alice"), 1)

    def test_receipts_and_consent_survive_coordinator_restart(self) -> None:
        _, proof = self.prepare()
        self.coordinator.verify("sim-alice", proof)
        self.coordinator = self.reopen()
        self.assertEqual(self.coordinator.balance("sim-alice"), 1)
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 0)
        _, another = self.prepare()
        self.assertEqual(self.coordinator.verify("sim-alice", another).credited_units, 0)

    def test_corrupted_and_missing_local_bytes_cannot_produce_proof(self) -> None:
        challenge, _ = self.prepare()
        stored = self.node.directory / (challenge.shard.sha256 + ".shard")
        stored.write_bytes(b"changed")
        with self.assertRaisesRegex(SimulationError, "shard-integrity-failed"):
            self.node.prove(challenge, now=self.now)
        stored.unlink()
        with self.assertRaisesRegex(SimulationError, "shard-missing"):
            self.node.prove(challenge, now=self.now)
        self.assertEqual(self.coordinator.balance("sim-alice"), 0)

    def test_public_hash_or_wrong_content_is_not_a_valid_response(self) -> None:
        for response in (lambda c: c.shard.sha256,
                         lambda c: storage_response(c, b"changed"),
                         lambda c: "z" * 64, lambda c: None):
            challenge = self.coordinator.issue("sim-alice", "apple")
            receipt = self.coordinator.verify("sim-alice", Proof(challenge.challenge_id, response(challenge)))
            self.assertEqual(receipt.status, "invalid-proof")
        self.assertEqual(self.coordinator.balance("sim-alice"), 0)

    def test_failed_owned_challenge_is_consumed(self) -> None:
        _, proof = self.prepare()
        self.coordinator.verify("sim-alice", replace(proof, response_sha256="0" * 64))
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status, "already-consumed")
        self.assertEqual(self.coordinator.balance("sim-alice"), 0)

    def test_proof_is_bound_to_nonce_task_owner_and_original_manifest(self) -> None:
        for changes in ({"nonce": "0" * 64}, {"participant_id": "sim-other"},
                        {"task_type": "other"}, {"shard": manifest_for("bread")},
                        {"consent_revision": 0}):
            challenge = self.coordinator.issue("sim-alice", "apple")
            forged = replace(challenge, **changes)
            receipt = self.coordinator.verify("sim-alice", Proof(
                challenge.challenge_id, storage_response(forged, FIXTURES["apple"])))
            self.assertEqual(receipt.status, "invalid-proof")

    def test_proof_from_another_challenge_cannot_be_reused(self) -> None:
        _, proof = self.prepare()
        other = self.coordinator.issue("sim-alice", "apple")
        forged = replace(proof, challenge_id=other.challenge_id)
        self.assertEqual(self.coordinator.verify("sim-alice", forged).status, "invalid-proof")

    def test_wrong_caller_cannot_claim_or_consume_someone_elses_proof(self) -> None:
        _, proof = self.prepare()
        receipt = self.coordinator.verify("sim-other", proof)
        self.assertEqual(receipt.status, "unknown-challenge-or-owner")
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 1)

    def test_unknown_challenge_cannot_mint_credit(self) -> None:
        receipt = self.coordinator.verify("sim-alice", Proof("sim-unknown", "0" * 64))
        self.assertFalse(receipt.verified)
        self.assertEqual(self.coordinator.balance("sim-alice"), 0)

    def test_expiry_is_enforced_at_node_and_coordinator(self) -> None:
        challenge, proof = self.prepare()
        self.now = challenge.expires_at
        with self.assertRaisesRegex(SimulationError, "challenge-outside-window"):
            self.node.prove(challenge, now=self.now)
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status, "challenge-outside-window")

    def test_clock_before_issue_does_not_accept_proof(self) -> None:
        challenge, proof = self.prepare()
        self.now = challenge.issued_at - 1
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status, "challenge-outside-window")

    def test_withdraw_and_reoptin_cannot_revive_old_challenge(self) -> None:
        _, proof = self.prepare()
        self.coordinator.set_consent("sim-alice", Consent())
        self.coordinator.set_consent("sim-alice", self.consent)
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status, "consent-changed-or-paused")
        self.assertEqual(self.coordinator.balance("sim-alice"), 0)

    def test_pause_stops_work_but_allows_local_cleanup(self) -> None:
        challenge, proof = self.prepare()
        paused = replace(self.consent, paused=True)
        self.coordinator.set_consent("sim-alice", paused)
        self.node.consent = paused
        with self.assertRaisesRegex(SimulationError, "paused"):
            self.node.prove(challenge, now=self.now)
        with self.assertRaisesRegex(SimulationError, "paused"):
            self.coordinator.issue("sim-alice", "apple")
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 0)
        self.node.remove(challenge.shard)
        self.assertEqual(self.node._stored_bytes(), 0)

    def test_timed_pause_resumes_at_selected_time_but_never_revives_old_work(self) -> None:
        _, old_proof = self.prepare()
        until = self.now + 60
        self.node.pause(until=until)
        self.coordinator.pause("sim-alice", until=until)
        self.coordinator = self.reopen()
        self.now = until - 1
        with self.assertRaisesRegex(SimulationError, "paused"):
            self.node.store(manifest_for("apple"), FIXTURES["apple"])
        with self.assertRaisesRegex(SimulationError, "paused"):
            self.coordinator.issue("sim-alice", "apple")
        self.now = until
        self.assertEqual(self.coordinator.verify("sim-alice", old_proof).status,
                         "consent-changed-or-paused")
        _, fresh = self.prepare()
        self.assertEqual(self.coordinator.verify("sim-alice", fresh).credited_units, 1)

    def test_indefinite_pause_requires_explicit_resume(self) -> None:
        self.node.pause()
        self.coordinator.pause("sim-alice")
        self.now += DAY
        with self.assertRaisesRegex(SimulationError, "paused"):
            self.node.store(manifest_for("apple"), FIXTURES["apple"])
        with self.assertRaisesRegex(SimulationError, "paused"):
            self.coordinator.issue("sim-alice", "apple")
        self.node.resume()
        self.coordinator.resume("sim-alice")
        _, proof = self.prepare()
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 1)

    def test_stop_revokes_all_roles_cleans_files_and_preserves_earned_balance(self) -> None:
        _, proof = self.prepare()
        self.coordinator.verify("sim-alice", proof)
        _, pending = self.prepare("bread")
        self.node.stop()
        self.coordinator.stop("sim-alice")
        self.assertFalse(self.node.consent.storage)
        self.assertFalse(self.node.consent.compute)
        self.assertFalse(self.node.consent.rewards)
        self.assertEqual(self.node._stored_bytes(), 0)
        self.assertEqual(self.coordinator.verify("sim-alice", pending).credited_units, 0)
        self.assertEqual(self.coordinator.balance("sim-alice"), 1)
        self.now += DAY
        self.coordinator = self.reopen()
        self.node.resume()
        self.coordinator.resume("sim-alice")
        with self.assertRaisesRegex(SimulationError, "storage-not-consented"):
            self.coordinator.issue("sim-alice", "apple")
        with self.assertRaisesRegex(SimulationError, "storage-not-consented"):
            self.node.store(manifest_for("apple"), FIXTURES["apple"])

    def test_invalid_pause_deadlines_cannot_accidentally_resume_or_start_work(self) -> None:
        for until in (self.now, self.now - 1, True, "tomorrow"):
            with self.assertRaisesRegex(SimulationError, "pause-end-must-be-in-the-future"):
                self.node.pause(until=until)
            with self.assertRaisesRegex(SimulationError, "pause-end-must-be-in-the-future"):
                self.coordinator.pause("sim-alice", until=until)
        with self.assertRaisesRegex(SimulationError, "invalid-pause-until"):
            Consent(pause_until=self.now + 60)
        self.node.stop()
        with self.assertRaisesRegex(SimulationError, "participation-not-consented"):
            self.node.pause()

    def test_more_verified_useful_bytes_earn_more_simulated_units(self) -> None:
        _, small = self.prepare()
        small_credit = self.coordinator.verify("sim-alice", small).credited_units
        self.coordinator.register("sim-larger", age_band="adult")
        self.coordinator.set_consent("sim-larger", self.consent)
        _, larger = self.prepare("vegetable-catalog", participant="sim-larger")
        large_credit = self.coordinator.verify("sim-larger", larger).credited_units
        self.assertEqual(small_credit, 1)
        self.assertEqual(large_credit, 2)

    def test_larger_resource_allowance_alone_does_not_inflate_same_work(self) -> None:
        generous = replace(self.consent, storage_limit_bytes=SPEC["max_storage_bytes"],
                           transfer_limit_bytes=SPEC["max_transfer_bytes_per_run"])
        self.node.consent = generous
        self.coordinator.set_consent("sim-alice", generous)
        _, proof = self.prepare()
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 1)

    def test_larger_work_is_capped_atomically_and_cannot_claim_remainder_twice(self) -> None:
        _, small = self.prepare()
        self.coordinator.verify("sim-alice", small)
        _, larger = self.prepare("vegetable-catalog")
        receipt = self.coordinator.verify("sim-alice", larger)
        self.assertEqual(receipt.status, "verified-and-credited-capped")
        self.assertEqual(receipt.credited_units, 1)
        _, retry = self.prepare("vegetable-catalog")
        self.assertEqual(self.coordinator.verify("sim-alice", retry).credited_units, 0)
        self.assertEqual(self.coordinator.balance("sim-alice"), 2)

    def test_node_cannot_pad_bytes_to_manufacture_extra_work(self) -> None:
        manifest = manifest_for("apple")
        padded = FIXTURES["apple"] + b" " * 1024
        with self.assertRaisesRegex(SimulationError, "shard-integrity-failed"):
            self.node.store(manifest, padded)
        challenge = self.coordinator.issue("sim-alice", "apple")
        proof = Proof(challenge.challenge_id, storage_response(challenge, padded))
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 0)

    def test_children_teens_and_adults_without_reward_optin_receive_no_credit(self) -> None:
        for age, optin in (("child", True), ("teen", True), ("adult", False)):
            participant = "sim-" + age
            self.coordinator.register(participant, age_band=age)
            self.coordinator.set_consent(participant, Consent(storage=True, rewards=optin))
            _, proof = self.prepare(participant=participant)
            receipt = self.coordinator.verify(participant, proof)
            self.assertEqual(receipt.status, "verified-without-reward")
            self.assertTrue(receipt.verified)
            self.assertEqual(self.coordinator.balance(participant), 0)

    def test_reward_daily_cap_preserves_valid_data_acceptance(self) -> None:
        receipts = []
        for fixture in FIXTURES:
            _, proof = self.prepare(fixture)
            receipts.append(self.coordinator.verify("sim-alice", proof))
        self.assertTrue(all(receipt.verified for receipt in receipts))
        self.assertEqual(receipts[-1].status, "verified-reward-cap-reached")
        self.assertEqual(self.coordinator.balance("sim-alice"), 2)

    def test_new_day_requires_new_proof_and_has_its_own_cap(self) -> None:
        _, proof = self.prepare()
        self.coordinator.verify("sim-alice", proof)
        self.now += DAY
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 0)
        _, new_proof = self.prepare()
        self.assertEqual(self.coordinator.verify("sim-alice", new_proof).credited_units, 1)

    def test_challenge_cannot_cross_reward_day_boundary(self) -> None:
        self.now = DAY * 11 - 1
        challenge, proof = self.prepare()
        self.assertEqual(challenge.expires_at, DAY * 11)
        self.now += 1
        self.assertEqual(self.coordinator.verify("sim-alice", proof).status, "challenge-outside-window")

    def test_storage_budget_is_cumulative_and_rechecking_does_not_expand_disk(self) -> None:
        size = len(FIXTURES["apple"])
        self.node.consent = replace(self.consent, storage_limit_bytes=size)
        manifest = manifest_for("apple")
        self.node.store(manifest, FIXTURES["apple"])
        self.node.store(manifest, FIXTURES["apple"])
        self.assertEqual(self.node._stored_bytes(), size)
        with self.assertRaisesRegex(SimulationError, "storage-budget-exceeded"):
            self.node.store(manifest_for("bread"), FIXTURES["bread"])
        self.node.consent = replace(self.consent, storage_limit_bytes=0)
        challenge = self.coordinator.issue("sim-alice", "apple")
        with self.assertRaisesRegex(SimulationError, "storage-budget-exceeded"):
            self.node.prove(challenge, now=self.now)

    def test_transfer_budget_counts_both_download_and_proof_response(self) -> None:
        size = len(FIXTURES["apple"])
        self.node.consent = replace(self.consent, transfer_limit_bytes=size)
        self.node.store(manifest_for("apple"), FIXTURES["apple"])
        challenge = self.coordinator.issue("sim-alice", "apple")
        with self.assertRaisesRegex(SimulationError, "transfer-budget-exceeded"):
            self.node.prove(challenge, now=self.now)
        with self.assertRaisesRegex(SimulationError, "transfer-budget-exceeded"):
            self.node.store(manifest_for("bread"), FIXTURES["bread"])
        self.assertEqual(self.node.transferred_bytes, size)

    def test_coordinator_respects_zero_resource_limits(self) -> None:
        for limits in ({"storage_limit_bytes": 0}, {"transfer_limit_bytes": 0}):
            self.coordinator.set_consent("sim-alice", replace(self.consent, **limits))
            with self.assertRaisesRegex(SimulationError, "budget-exceeded"):
                self.coordinator.issue("sim-alice", "apple")

    def test_arbitrary_private_or_pathlike_inputs_are_not_admitted(self) -> None:
        manifest = manifest_for("apple")
        for forged in (replace(manifest, sha256="../../private"),
                       replace(manifest, classification="private"),
                       replace(manifest, byte_length=1000000000)):
            with self.assertRaisesRegex(SimulationError, "synthetic-fixture-required"):
                self.node.store(forged, b"private")
        with self.assertRaisesRegex(SimulationError, "shard-integrity-failed"):
            self.node.store(manifest, b"private")
        with self.assertRaisesRegex(SimulationError, "synthetic-fixture-required"):
            self.coordinator.issue("sim-alice", "https://example.invalid/data")
        self.assertEqual(list(self.node.directory.iterdir()), [])

    def test_symlink_is_not_read_or_overwritten(self) -> None:
        manifest = manifest_for("apple")
        target = self.root / "unrelated.txt"
        target.write_text("untouched")
        path = self.node.directory / (manifest.sha256 + ".shard")
        path.symlink_to(target)
        with self.assertRaisesRegex(SimulationError, "invalid-shard-file"):
            self.node.store(manifest, FIXTURES["apple"])
        self.assertEqual(target.read_text(), "untouched")

    def test_concurrent_replays_credit_once(self) -> None:
        _, proof = self.prepare()
        with ThreadPoolExecutor(max_workers=8) as pool:
            receipts = list(pool.map(lambda _: self.reopen().verify("sim-alice", proof), range(8)))
        self.assertEqual(sum(receipt.credited_units for receipt in receipts), 1)
        self.assertEqual(self.coordinator.balance("sim-alice"), 1)

    def test_concurrent_different_challenges_for_same_work_credit_once(self) -> None:
        proofs = [self.prepare()[1] for _ in range(6)]
        with ThreadPoolExecutor(max_workers=6) as pool:
            receipts = list(pool.map(lambda proof: self.reopen().verify("sim-alice", proof), proofs))
        self.assertTrue(all(receipt.verified for receipt in receipts))
        self.assertEqual(sum(receipt.credited_units for receipt in receipts), 1)

    def test_concurrent_distinct_shards_cannot_exceed_daily_cap(self) -> None:
        proofs = [self.prepare(fixture)[1] for fixture in FIXTURES]
        with ThreadPoolExecutor(max_workers=3) as pool:
            receipts = list(pool.map(lambda proof: self.reopen().verify("sim-alice", proof), proofs))
        self.assertTrue(all(receipt.verified for receipt in receipts))
        self.assertEqual(sum(receipt.credited_units for receipt in receipts), 2)

    def test_receipt_and_credit_roll_back_together_on_database_failure(self) -> None:
        _, proof = self.prepare()
        with self.coordinator._connection() as db:
            db.execute("""CREATE TRIGGER fail_credit BEFORE INSERT ON credits
                          BEGIN SELECT RAISE(ABORT, 'synthetic-failure'); END""")
        import sqlite3
        with self.assertRaises(sqlite3.IntegrityError):
            self.coordinator.verify("sim-alice", proof)
        self.assertEqual(self.coordinator.balance("sim-alice"), 0)
        with self.coordinator._connection() as db:
            db.execute("DROP TRIGGER fail_credit")
        self.assertEqual(self.coordinator.verify("sim-alice", proof).credited_units, 1)

    def test_demo_completes_without_network_and_cleans_up(self) -> None:
        with patch("socket.socket", side_effect=AssertionError("network-forbidden")):
            report = run_demo(enabled=True)
        self.assertEqual(report["balance"], 1)
        self.assertEqual(report["accepted"]["credited_units"], 1)
        self.assertEqual(report["replay"]["credited_units"], 0)
        self.assertEqual(report["duplicate_work"]["credited_units"], 0)
        self.assertEqual(report["withdrawn_consent"]["credited_units"], 0)
        self.assertEqual(report["onchain_transactions"], 0)
        self.assertTrue(report["local_shard_removed"])
        self.assertTrue(report["temporary_pause_blocked_local_work"])
        self.assertTrue(report["fresh_work_after_selected_pause_end"]["verified"])
        self.assertEqual(report["larger_verified_work"]["credited_units"], 2)
        self.assertEqual(report["reward_asset"], "CALT")

    def test_cli_needs_explicit_enable_and_reports_only_simulated_units(self) -> None:
        for flags, expected_status in (([], 2), (["--enable-synthetic-demo"], 0)):
            result = subprocess.run([sys.executable, "-m", "tools.participation_simulator", *flags],
                                    cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, expected_status, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["mode"], "local-synthetic-only")
            if flags:
                self.assertEqual(report["unit"], "CALT_SIMULATED")
                self.assertEqual(report["balance"], 1)


if __name__ == "__main__":
    unittest.main()
