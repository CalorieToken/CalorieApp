"""Synthetic participation growth simulator.

Models capacity growth from zero volunteers upward while preserving the hosted
fallback. No real nodes, remote execution, networking, storage, or token
settlement are enabled by this model.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
import json


@dataclass(frozen=True)
class CapacityPolicy:
    hosted_storage_units: int = 100
    hosted_compute_units: int = 100
    storage_units_per_node: int = 4
    compute_units_per_node: int = 3
    max_storage_units_per_node: int = 8
    max_compute_units_per_node: int = 6
    fallback_floor_percent: int = 20


@dataclass(frozen=True)
class GrowthSnapshot:
    volunteer_nodes: int
    volunteer_storage_units: int
    volunteer_compute_units: int
    hosted_storage_units: int
    hosted_compute_units: int
    total_storage_units: int
    total_compute_units: int
    hosted_fallback_active: bool
    app_available: bool
    gameverse_available: bool
    volunteer_storage_share_percent: int
    volunteer_compute_share_percent: int


class GrowthModel:
    def __init__(self, policy: CapacityPolicy = CapacityPolicy()) -> None:
        self.policy = policy

    @staticmethod
    def _checked_nodes(volunteer_nodes: int) -> int:
        if type(volunteer_nodes) is not int or volunteer_nodes < 0:
            raise ValueError("volunteer-nodes-must-be-nonnegative-integer")
        return volunteer_nodes

    def snapshot(
        self,
        volunteer_nodes: int,
        *,
        storage_units_per_node: int | None = None,
        compute_units_per_node: int | None = None,
    ) -> GrowthSnapshot:
        nodes = self._checked_nodes(volunteer_nodes)
        storage_rate = (
            self.policy.storage_units_per_node
            if storage_units_per_node is None else storage_units_per_node
        )
        compute_rate = (
            self.policy.compute_units_per_node
            if compute_units_per_node is None else compute_units_per_node
        )
        if not 0 <= storage_rate <= self.policy.max_storage_units_per_node:
            raise ValueError("storage-rate-out-of-range")
        if not 0 <= compute_rate <= self.policy.max_compute_units_per_node:
            raise ValueError("compute-rate-out-of-range")

        volunteer_storage = nodes * storage_rate
        volunteer_compute = nodes * compute_rate

        # The first release keeps the hosted core fully available. A future
        # policy may taper it, but never below the configured fallback floor.
        hosted_storage = self.policy.hosted_storage_units
        hosted_compute = self.policy.hosted_compute_units

        total_storage = hosted_storage + volunteer_storage
        total_compute = hosted_compute + volunteer_compute
        storage_share = 0 if total_storage == 0 else round(volunteer_storage * 100 / total_storage)
        compute_share = 0 if total_compute == 0 else round(volunteer_compute * 100 / total_compute)

        return GrowthSnapshot(
            volunteer_nodes=nodes,
            volunteer_storage_units=volunteer_storage,
            volunteer_compute_units=volunteer_compute,
            hosted_storage_units=hosted_storage,
            hosted_compute_units=hosted_compute,
            total_storage_units=total_storage,
            total_compute_units=total_compute,
            hosted_fallback_active=True,
            app_available=True,
            gameverse_available=True,
            volunteer_storage_share_percent=storage_share,
            volunteer_compute_share_percent=compute_share,
        )

    def matrix(self) -> list[GrowthSnapshot]:
        return [self.snapshot(nodes) for nodes in (0, 1, 10, 100, 1000)]


if __name__ == "__main__":
    model = GrowthModel()
    print(json.dumps([asdict(item) for item in model.matrix()], sort_keys=True))
