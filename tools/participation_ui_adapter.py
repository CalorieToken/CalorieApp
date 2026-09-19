"""Local synthetic participation UI state adapter.

Bridges the static Participation Lab prototype to the existing synthetic
storage/compute simulators without enabling remote nodes, networking, token
settlement or arbitrary jobs.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
import tempfile
import time

from tools.participation_compute_simulator import ComputeCoordinator, ComputeNode
from tools.participation_simulator import Consent, Coordinator, LocalNode, SimulationError


@dataclass(frozen=True)
class ParticipationSelection:
    storage: bool = False
    compute: bool = False
    rewards: bool = False
    storage_limit_mb: int = 250
    compute_limit_percent: int = 25
    process_state: str = "off"  # off|running|paused


class ParticipationSession:
    """Synthetic-only session with independent storage/compute controls."""

    def __init__(self, *, enabled: bool = False, age_band: str = "adult",
                 clock=time.time) -> None:
        if enabled is not True:
            raise SimulationError("simulation-disabled")
        self.clock = clock
        self.age_band = age_band
        self.selection = ParticipationSelection()
        self._tmp = tempfile.TemporaryDirectory(prefix="participation-ui-")
        root = Path(self._tmp.name)
        self.storage_coord = Coordinator(root / "storage.sqlite", enabled=True, clock=clock)
        self.compute_coord = ComputeCoordinator(root / "compute.sqlite", enabled=True, clock=clock)
        self.participant_id = "sim-ui"
        self.storage_coord.register(self.participant_id, age_band=age_band)
        self.compute_coord.register(self.participant_id, age_band=age_band)

    def _consent(self) -> Consent:
        return Consent(
            storage=self.selection.storage,
            compute=self.selection.compute and self.selection.process_state == "running",
            rewards=self.selection.rewards,
            paused=self.selection.process_state == "paused",
        )

    def apply(self, selection: ParticipationSelection) -> dict:
        if selection.storage_limit_mb < 50 or selection.storage_limit_mb > 2000:
            raise SimulationError("storage-limit-out-of-range")
        if selection.compute_limit_percent < 5 or selection.compute_limit_percent > 75:
            raise SimulationError("compute-limit-out-of-range")
        if selection.process_state not in {"off", "running", "paused"}:
            raise SimulationError("invalid-process-state")
        if selection.process_state in {"running", "paused"} and not selection.compute:
            raise SimulationError("compute-must-be-enabled-before-process")
        self.selection = selection
        consent = self._consent()
        self.storage_coord.set_consent(self.participant_id, consent)
        self.compute_coord.set_consent(self.participant_id, consent)
        return self.snapshot()

    def snapshot(self) -> dict:
        return {
            "mode": "local-synthetic-ui-adapter",
            "community_volunteer_nodes": 0,
            "hosted_core_active": True,
            "normal_app_access": True,
            "normal_gameverse_access": True,
            "selection": asdict(self.selection),
            "effective_consent": asdict(self._consent()),
            "real_network_enabled": False,
            "real_token_settlement": False,
        }

    def run_storage_probe(self) -> dict:
        if not self.selection.storage:
            return {"status": "storage-off"}
        node = LocalNode(enabled=True, consent=self._consent(), capacity_bytes=self.selection.storage_limit_mb * 1024 * 1024)
        challenge = self.storage_coord.issue(self.participant_id, "apple")
        proof = node.accept_and_prove(challenge, now=int(self.clock()))
        receipt = self.storage_coord.verify(self.participant_id, proof)
        return {"status": receipt.status, "verified": receipt.verified}

    def run_compute_probe(self) -> dict:
        if not self.selection.compute:
            return {"status": "compute-off"}
        if self.selection.process_state == "paused":
            return {"status": "compute-paused"}
        if self.selection.process_state != "running":
            return {"status": "compute-stopped"}
        node = ComputeNode(enabled=True, consent=self._consent(), clock=self.clock)
        task = self.compute_coord.issue(self.participant_id, "apple")
        proof = node.execute(task, now=int(self.clock()))
        receipt = self.compute_coord.verify(self.participant_id, proof)
        return {"status": receipt.status, "verified": receipt.verified}

    def exit(self) -> dict:
        self.selection = ParticipationSelection()
        consent = Consent()
        self.storage_coord.set_consent(self.participant_id, consent)
        self.compute_coord.set_consent(self.participant_id, consent)
        return self.snapshot()

    def close(self) -> None:
        self._tmp.cleanup()


def demo_matrix() -> list[dict]:
    now = 30 * 86400 + 3600
    session = ParticipationSession(enabled=True, clock=lambda: now)
    try:
        cases = [
            ParticipationSelection(),
            ParticipationSelection(storage=True),
            ParticipationSelection(compute=True, process_state="off"),
            ParticipationSelection(compute=True, process_state="running"),
            ParticipationSelection(compute=True, process_state="paused"),
            ParticipationSelection(storage=True, compute=True, rewards=True, process_state="running"),
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
