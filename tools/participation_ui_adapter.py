"""Local synthetic participation UI state adapter.

Bridges the Participation Lab prototype to separate synthetic storage/compute
simulators without enabling remote nodes, networking, token settlement or
arbitrary jobs.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, replace
import json
from pathlib import Path
import tempfile
import time

from tools.participation_compute_simulator import ComputeCoordinator, ComputeNode
from tools.participation_data_release_simulator import (
    ShardState,
    StorageReleaseCoordinator,
)
from tools.participation_simulator import (
    Consent,
    Coordinator,
    FIXTURES,
    SPEC,
    SimulationError,
    VolunteerNode,
    manifest_for,
)


LIFECYCLE_STATES = {"off", "running", "paused"}
STORAGE_RELEASE_MODES = {"keep-local", "handoff-then-delete", "delete-now"}


@dataclass(frozen=True)
class ParticipationSelection:
    storage: bool = False
    compute: bool = False
    rewards: bool = False
    storage_limit_mb: int = 250
    compute_limit_percent: int = 25
    storage_release_mode: str = "keep-local"
    storage_state: str = "off"
    process_state: str = "off"


class ParticipationSession:
    """Synthetic-only session with independent storage/compute lifecycles."""

    def __init__(self, *, enabled: bool = False, age_band: str = "adult",
                 clock=time.time) -> None:
        if enabled is not True:
            raise SimulationError("simulation-disabled")
        self.clock = clock
        self.age_band = age_band
        self.selection = ParticipationSelection()
        self._tmp = tempfile.TemporaryDirectory(prefix="participation-ui-")
        self.root = Path(self._tmp.name)
        self.storage_node_dir = self.root / "storage-node"
        self.storage_coord = Coordinator(
            self.root / "storage.sqlite", enabled=True, clock=clock
        )
        self.compute_coord = ComputeCoordinator(
            self.root / "compute.sqlite", enabled=True, clock=clock
        )
        self.release_coord = StorageReleaseCoordinator(desired_remote_replicas=3)
        self.participant_id = "sim-ui"
        self.storage_coord.register(self.participant_id, age_band=age_band)
        self.compute_coord.register(self.participant_id, age_band=age_band)

    def _storage_consent(self) -> Consent:
        selected = self.selection.storage
        state = self.selection.storage_state
        return Consent(
            storage=selected and state in {"running", "paused"},
            compute=False,
            rewards=self.selection.rewards,
            paused=selected and state == "paused",
            storage_limit_bytes=SPEC["max_storage_bytes"],
            transfer_limit_bytes=SPEC["max_transfer_bytes_per_run"],
        )

    def _compute_consent(self) -> Consent:
        selected = self.selection.compute
        state = self.selection.process_state
        return Consent(
            storage=False,
            compute=selected and state in {"running", "paused"},
            rewards=self.selection.rewards,
            paused=selected and state == "paused",
        )

    def apply(self, selection: ParticipationSelection) -> dict:
        if selection.storage_limit_mb < 50 or selection.storage_limit_mb > 2000:
            raise SimulationError("storage-limit-out-of-range")
        if selection.compute_limit_percent < 5 or selection.compute_limit_percent > 75:
            raise SimulationError("compute-limit-out-of-range")
        if selection.storage_release_mode not in STORAGE_RELEASE_MODES:
            raise SimulationError("invalid-storage-release-mode")
        if selection.storage_state not in LIFECYCLE_STATES:
            raise SimulationError("invalid-storage-state")
        if selection.process_state not in LIFECYCLE_STATES:
            raise SimulationError("invalid-process-state")
        if selection.storage_state in {"running", "paused"} and not selection.storage:
            raise SimulationError("storage-must-be-enabled-before-process")
        if selection.process_state in {"running", "paused"} and not selection.compute:
            raise SimulationError("compute-must-be-enabled-before-process")

        self.selection = selection
        self.storage_coord.set_consent(self.participant_id, self._storage_consent())
        self.compute_coord.set_consent(self.participant_id, self._compute_consent())
        return self.snapshot()

    def _local_fixture_shards(self) -> list[tuple[str, Path]]:
        shards = []
        for fixture in FIXTURES:
            manifest = manifest_for(fixture)
            path = self.storage_node_dir / (manifest.sha256 + ".shard")
            if path.exists():
                shards.append((manifest.sha256, path))
        return shards

    def snapshot(self) -> dict:
        return {
            "mode": "local-synthetic-ui-adapter",
            "community_volunteer_nodes": 0,
            "hosted_core_active": True,
            "normal_app_access": True,
            "normal_gameverse_access": True,
            "selection": asdict(self.selection),
            "effective_storage_consent": asdict(self._storage_consent()),
            "effective_compute_consent": asdict(self._compute_consent()),
            "retained_local_synthetic_shards": len(self._local_fixture_shards()),
            "real_network_enabled": False,
            "real_token_settlement": False,
        }

    def run_storage_probe(self) -> dict:
        if not self.selection.storage:
            return {"status": "storage-off"}
        if self.selection.storage_state == "paused":
            return {"status": "storage-paused"}
        if self.selection.storage_state != "running":
            return {"status": "storage-stopped"}

        consent = self._storage_consent()
        node = VolunteerNode(
            self.storage_node_dir,
            enabled=True,
            consent=consent,
            clock=self.clock,
        )
        challenge = self.storage_coord.issue(self.participant_id, "apple")
        node.store(challenge.shard, FIXTURES["apple"])
        proof = node.prove(challenge, now=int(self.clock()))
        receipt = self.storage_coord.verify(self.participant_id, proof)
        return {
            "status": receipt.status,
            "verified": receipt.verified,
            "synthetic_shard_retained_locally": True,
        }

    def run_compute_probe(self) -> dict:
        if not self.selection.compute:
            return {"status": "compute-off"}
        if self.selection.process_state == "paused":
            return {"status": "compute-paused"}
        if self.selection.process_state != "running":
            return {"status": "compute-stopped"}

        consent = self._compute_consent()
        node = ComputeNode(enabled=True, consent=consent, clock=self.clock)
        task = self.compute_coord.issue(self.participant_id, "apple")
        proof = node.execute(task, now=int(self.clock()))
        receipt = self.compute_coord.verify(self.participant_id, proof)
        return {"status": receipt.status, "verified": receipt.verified}

    def release_existing_storage(
        self,
        *,
        mode: str | None = None,
        healthy_remote_replicas: int = 0,
        hosted_copy_available: bool = True,
    ) -> list[dict]:
        release_mode = mode or self.selection.storage_release_mode
        if release_mode not in STORAGE_RELEASE_MODES:
            raise SimulationError("invalid-storage-release-mode")
        if type(healthy_remote_replicas) is not int or healthy_remote_replicas < 0:
            raise SimulationError("invalid-remote-replica-count")

        results = []
        for shard_id, path in self._local_fixture_shards():
            result = self.release_coord.release(
                ShardState(
                    shard_id=shard_id,
                    local_copy=True,
                    healthy_remote_replicas=healthy_remote_replicas,
                    hosted_copy_available=hosted_copy_available,
                ),
                release_mode,
            )
            if not result.local_copy_after:
                path.unlink(missing_ok=True)
            results.append(asdict(result))
        return results

    def stop_storage(
        self,
        *,
        healthy_remote_replicas: int = 0,
        hosted_copy_available: bool = True,
    ) -> dict:
        if self.selection.storage_state == "off":
            raise SimulationError("storage-already-off")
        self.selection = replace(self.selection, storage_state="off")
        self.storage_coord.set_consent(self.participant_id, self._storage_consent())
        releases = self.release_existing_storage(
            healthy_remote_replicas=healthy_remote_replicas,
            hosted_copy_available=hosted_copy_available,
        )
        snapshot = self.snapshot()
        snapshot["storage_release_results"] = releases
        return snapshot

    def exit(
        self,
        *,
        healthy_remote_replicas: int = 0,
        hosted_copy_available: bool = True,
    ) -> dict:
        release_mode = self.selection.storage_release_mode
        releases = self.release_existing_storage(
            mode=release_mode,
            healthy_remote_replicas=healthy_remote_replicas,
            hosted_copy_available=hosted_copy_available,
        )
        self.selection = ParticipationSelection()
        self.storage_coord.set_consent(self.participant_id, Consent())
        self.compute_coord.set_consent(self.participant_id, Consent())
        snapshot = self.snapshot()
        snapshot["storage_release_results"] = releases
        snapshot["exit_storage_release_mode"] = release_mode
        return snapshot

    def close(self) -> None:
        self._tmp.cleanup()


def demo_matrix() -> list[dict]:
    now = 30 * 86400 + 3600
    session = ParticipationSession(enabled=True, clock=lambda: now)
    try:
        cases = [
            ParticipationSelection(),
            ParticipationSelection(storage=True, storage_state="off"),
            ParticipationSelection(storage=True, storage_state="running"),
            ParticipationSelection(storage=True, storage_state="paused"),
            ParticipationSelection(compute=True, process_state="off"),
            ParticipationSelection(compute=True, process_state="running"),
            ParticipationSelection(compute=True, process_state="paused"),
            ParticipationSelection(
                storage=True,
                compute=True,
                rewards=True,
                storage_state="running",
                process_state="running",
            ),
        ]
        results = []
        for case in cases:
            snap = session.apply(case)
            snap["storage_probe"] = session.run_storage_probe()
            snap["compute_probe"] = session.run_compute_probe()
            results.append(snap)
        results.append(session.exit())
        return results
    finally:
        session.close()


if __name__ == "__main__":
    print(json.dumps(demo_matrix(), sort_keys=True))
