"""Synthetic volunteer-node reliability and task assignment model.

Models churn, pause/resume, dropout and rejoin behavior without enabling any real
remote execution, participant storage, networking or token settlement.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class NodeState:
    node_id: str
    storage: bool = False
    compute: bool = False
    paused: bool = False
    online: bool = True
    storage_capacity: int = 1
    compute_capacity: int = 1

    def can_store(self) -> bool:
        return self.online and not self.paused and self.storage and self.storage_capacity > 0

    def can_compute(self) -> bool:
        return self.online and not self.paused and self.compute and self.compute_capacity > 0


@dataclass(frozen=True)
class Assignment:
    task_id: str
    task_type: str
    node_id: str | None
    fallback: bool
    reason: str


class ReliabilityScheduler:
    """Simple deterministic scheduler with safe hosted fallback."""

    def __init__(self) -> None:
        self._storage_cursor = 0
        self._compute_cursor = 0

    @staticmethod
    def _eligible(nodes: Iterable[NodeState], task_type: str) -> list[NodeState]:
        if task_type == "storage":
            return [n for n in nodes if n.can_store()]
        if task_type == "compute":
            return [n for n in nodes if n.can_compute()]
        raise ValueError("unsupported-task-type")

    def assign(self, task_id: str, task_type: str, nodes: Iterable[NodeState]) -> Assignment:
        eligible = sorted(self._eligible(nodes, task_type), key=lambda n: n.node_id)
        if not eligible:
            return Assignment(
                task_id=task_id,
                task_type=task_type,
                node_id=None,
                fallback=True,
                reason="hosted-core-fallback",
            )

        if task_type == "storage":
            index = self._storage_cursor % len(eligible)
            self._storage_cursor += 1
        else:
            index = self._compute_cursor % len(eligible)
            self._compute_cursor += 1

        chosen = eligible[index]
        return Assignment(
            task_id=task_id,
            task_type=task_type,
            node_id=chosen.node_id,
            fallback=False,
            reason="volunteer-node",
        )

    def assign_replica_set(
        self,
        task_id: str,
        nodes: Iterable[NodeState],
        desired_replicas: int,
    ) -> tuple[list[str], int]:
        if desired_replicas < 0:
            raise ValueError("desired-replicas-must-be-nonnegative")
        eligible = sorted(self._eligible(nodes, "storage"), key=lambda n: n.node_id)
        selected = [n.node_id for n in eligible[:desired_replicas]]
        missing = max(0, desired_replicas - len(selected))
        return selected, missing


def lifecycle_scenario() -> dict:
    scheduler = ReliabilityScheduler()
    nodes = [
        NodeState("sim-a", storage=True, compute=True),
        NodeState("sim-b", storage=True, compute=False),
    ]

    first = scheduler.assign("task-1", "compute", nodes)

    paused = [
        NodeState("sim-a", storage=True, compute=True, paused=True),
        NodeState("sim-b", storage=True, compute=False),
    ]
    second = scheduler.assign("task-2", "compute", paused)

    offline = [
        NodeState("sim-a", storage=True, compute=True, online=False),
        NodeState("sim-b", storage=True, compute=False),
    ]
    third = scheduler.assign("task-3", "storage", offline)

    rejoined = [
        NodeState("sim-a", storage=True, compute=True, online=True),
        NodeState("sim-b", storage=True, compute=False, online=True),
    ]
    fourth = scheduler.assign("task-4", "compute", rejoined)

    replicas, missing = scheduler.assign_replica_set("blob-1", rejoined, 3)

    return {
        "initial_compute": first.__dict__,
        "paused_compute": second.__dict__,
        "storage_while_compute_node_offline": third.__dict__,
        "rejoined_compute": fourth.__dict__,
        "replica_nodes": replicas,
        "replica_shortfall": missing,
        "hosted_core_always_available": True,
        "real_network_enabled": False,
        "real_token_settlement": False,
    }
