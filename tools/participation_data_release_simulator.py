"""Synthetic storage release and safe-handoff simulator.

Models what happens to already assigned public/synthetic shards when a volunteer
pauses, stops, or exits storage participation. No private user data, remote
networking, real nodes, or token settlement are enabled.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ReleaseMode = Literal["keep-local", "handoff-then-delete", "delete-now"]


@dataclass(frozen=True)
class ShardState:
    shard_id: str
    local_copy: bool = True
    healthy_remote_replicas: int = 0
    hosted_copy_available: bool = True


@dataclass(frozen=True)
class ReleaseResult:
    shard_id: str
    mode: ReleaseMode
    accept_new_storage_work: bool
    local_copy_after: bool
    safe_handoff_verified: bool
    fallback_used: bool
    remote_replicas_after: int
    status: str


class StorageReleaseCoordinator:
    """Deterministic synthetic release policy with participant-first control."""

    def __init__(self, *, desired_remote_replicas: int = 3) -> None:
        if type(desired_remote_replicas) is not int or desired_remote_replicas < 0:
            raise ValueError("invalid-replica-target")
        self.desired_remote_replicas = desired_remote_replicas

    def release(self, shard: ShardState, mode: ReleaseMode) -> ReleaseResult:
        if mode not in {"keep-local", "handoff-then-delete", "delete-now"}:
            raise ValueError("invalid-release-mode")

        if mode == "keep-local":
            return ReleaseResult(
                shard_id=shard.shard_id,
                mode=mode,
                accept_new_storage_work=False,
                local_copy_after=shard.local_copy,
                safe_handoff_verified=False,
                fallback_used=False,
                remote_replicas_after=shard.healthy_remote_replicas,
                status="stopped-keeping-local-copy",
            )

        if mode == "delete-now":
            # A participant always retains the right to remove their own local
            # copy immediately. Availability is absorbed by the hosted fallback
            # in this early architecture rather than pressuring the participant.
            return ReleaseResult(
                shard_id=shard.shard_id,
                mode=mode,
                accept_new_storage_work=False,
                local_copy_after=False,
                safe_handoff_verified=shard.hosted_copy_available
                or shard.healthy_remote_replicas >= self.desired_remote_replicas,
                fallback_used=(
                    shard.hosted_copy_available
                    and shard.healthy_remote_replicas < self.desired_remote_replicas
                ),
                remote_replicas_after=shard.healthy_remote_replicas,
                status="local-copy-deleted-by-user-choice",
            )

        # handoff-then-delete
        enough_remote = shard.healthy_remote_replicas >= self.desired_remote_replicas
        safe = enough_remote or shard.hosted_copy_available
        if not safe:
            return ReleaseResult(
                shard_id=shard.shard_id,
                mode=mode,
                accept_new_storage_work=False,
                local_copy_after=shard.local_copy,
                safe_handoff_verified=False,
                fallback_used=False,
                remote_replicas_after=shard.healthy_remote_replicas,
                status="handoff-pending-keep-local-copy",
            )

        return ReleaseResult(
            shard_id=shard.shard_id,
            mode=mode,
            accept_new_storage_work=False,
            local_copy_after=False,
            safe_handoff_verified=True,
            fallback_used=not enough_remote and shard.hosted_copy_available,
            remote_replicas_after=shard.healthy_remote_replicas,
            status="handoff-verified-local-copy-released",
        )


def demo_release_matrix() -> list[dict]:
    coordinator = StorageReleaseCoordinator(desired_remote_replicas=3)
    cases = [
        ShardState("sim-a", healthy_remote_replicas=0, hosted_copy_available=True),
        ShardState("sim-b", healthy_remote_replicas=3, hosted_copy_available=False),
        ShardState("sim-c", healthy_remote_replicas=1, hosted_copy_available=False),
    ]
    results = []
    for shard in cases:
        for mode in ("keep-local", "handoff-then-delete", "delete-now"):
            results.append(coordinator.release(shard, mode).__dict__)
    return results
