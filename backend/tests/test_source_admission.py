"""Deterministic tests for bounded adapter admission and circuit recovery."""

from __future__ import annotations

import asyncio

import pytest

from app.source_admission import (
    AdapterAdmissionController,
    AdapterAdmissionRejected,
    DuplicateRequestCoalescer,
    MAX_ADAPTER_RETRY_AFTER_SECONDS,
)


def _controller(
    *,
    max_concurrency: int = 2,
    max_queue: int = 1,
    queue_timeout_seconds: float = 0.5,
    failure_threshold: int = 3,
    recovery_timeout_seconds: float = 30.0,
    clock=lambda: 100.0,
) -> AdapterAdmissionController:
    return AdapterAdmissionController(
        max_concurrency=max_concurrency,
        max_queue=max_queue,
        queue_timeout_seconds=queue_timeout_seconds,
        failure_threshold=failure_threshold,
        recovery_timeout_seconds=recovery_timeout_seconds,
        clock=clock,
    )


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"max_concurrency": 0}, "max_concurrency"),
        ({"max_queue": -1}, "max_queue"),
        ({"queue_timeout_seconds": 0}, "queue_timeout_seconds"),
        ({"failure_threshold": 0}, "failure_threshold"),
        ({"recovery_timeout_seconds": 0}, "recovery_timeout_seconds"),
    ],
)
def test_invalid_admission_configuration_fails_closed(
    overrides: dict[str, int],
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        _controller(**overrides)


def test_retry_after_is_always_bounded() -> None:
    assert AdapterAdmissionRejected("synthetic", 0).retry_after_seconds == 1
    assert AdapterAdmissionRejected("synthetic", 999).retry_after_seconds == (
        MAX_ADAPTER_RETRY_AFTER_SECONDS
    )


def test_concurrency_and_queue_are_bounded() -> None:
    async def scenario() -> None:
        controller = _controller()
        release = asyncio.Event()
        active = 0
        peak = 0

        async def held_operation() -> str:
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            try:
                await release.wait()
                return "done"
            finally:
                active -= 1

        first = asyncio.create_task(controller.run_attempt(held_operation))
        second = asyncio.create_task(controller.run_attempt(held_operation))
        while active < 2:
            await asyncio.sleep(0)

        queued = asyncio.create_task(controller.run_attempt(held_operation))
        while controller.queued_attempts < 1:
            await asyncio.sleep(0)
        with pytest.raises(AdapterAdmissionRejected) as rejected:
            await controller.run_attempt(held_operation)
        assert rejected.value.reason == "adapter_queue_full"
        assert rejected.value.retry_after_seconds == 1

        release.set()
        assert await asyncio.gather(first, second, queued) == [
            "done",
            "done",
            "done",
        ]
        assert peak == 2

    asyncio.run(scenario())


def test_queue_wait_has_a_hard_timeout() -> None:
    async def scenario() -> None:
        controller = _controller(
            max_concurrency=1,
            queue_timeout_seconds=0.01,
        )
        release = asyncio.Event()
        started = asyncio.Event()

        async def held_operation() -> None:
            started.set()
            await release.wait()

        active = asyncio.create_task(controller.run_attempt(held_operation))
        await started.wait()

        with pytest.raises(AdapterAdmissionRejected) as rejected:
            await controller.run_attempt(held_operation)
        assert rejected.value.reason == "adapter_queue_timeout"
        assert rejected.value.retry_after_seconds == 1

        release.set()
        await active

    asyncio.run(scenario())


def test_failed_operation_releases_concurrency_slot() -> None:
    async def scenario() -> None:
        controller = _controller(max_concurrency=1)

        async def fail() -> None:
            raise RuntimeError("synthetic failure")

        async def succeed() -> str:
            return "ok"

        with pytest.raises(RuntimeError, match="synthetic failure"):
            await controller.run_attempt(fail)
        assert await controller.run_attempt(succeed) == "ok"

    asyncio.run(scenario())


def test_circuit_opens_then_allows_one_successful_recovery_probe() -> None:
    now = [100.0]
    controller = _controller(clock=lambda: now[0])

    permits = [controller.begin_action() for _ in range(3)]
    for permit in permits:
        controller.record_failure(permit)

    assert controller.circuit_state == "open"
    with pytest.raises(AdapterAdmissionRejected) as rejected:
        controller.begin_action()
    assert rejected.value.reason == "circuit_open"
    assert rejected.value.retry_after_seconds == 30

    now[0] = 130.0
    probe = controller.begin_action()
    assert probe.half_open_probe is True
    assert controller.circuit_state == "half-open"
    with pytest.raises(AdapterAdmissionRejected) as concurrent:
        controller.begin_action()
    assert concurrent.value.reason == "circuit_probe_in_progress"

    controller.record_success(probe)
    assert controller.circuit_state == "closed"
    assert controller.failure_count == 0


def test_failed_recovery_probe_reopens_circuit() -> None:
    now = [100.0]
    controller = _controller(failure_threshold=1, clock=lambda: now[0])
    controller.record_failure(controller.begin_action())
    now[0] = 130.0

    probe = controller.begin_action()
    controller.record_failure(probe)

    assert controller.circuit_state == "open"
    with pytest.raises(AdapterAdmissionRejected) as rejected:
        controller.begin_action()
    assert rejected.value.retry_after_seconds == 30


def test_stale_success_cannot_close_newly_opened_circuit() -> None:
    controller = _controller(failure_threshold=2)
    first = controller.begin_action()
    second = controller.begin_action()

    controller.record_failure(first)
    controller.record_failure(second)
    controller.record_success(first)

    assert controller.circuit_state == "open"


def test_identical_in_flight_reads_share_one_task() -> None:
    async def scenario() -> None:
        coalescer: DuplicateRequestCoalescer[str] = DuplicateRequestCoalescer()
        release = asyncio.Event()
        started = asyncio.Event()
        calls = 0

        async def operation() -> str:
            nonlocal calls
            calls += 1
            started.set()
            await release.wait()
            return "shared"

        first = asyncio.create_task(coalescer.run(("banana", 10), operation))
        second = asyncio.create_task(coalescer.run(("banana", 10), operation))
        await started.wait()
        assert calls == 1

        release.set()
        assert await asyncio.gather(first, second) == ["shared", "shared"]

    asyncio.run(scenario())


def test_different_read_keys_do_not_coalesce() -> None:
    async def scenario() -> None:
        coalescer: DuplicateRequestCoalescer[str] = DuplicateRequestCoalescer()
        calls = 0

        async def operation() -> str:
            nonlocal calls
            calls += 1
            return "result"

        assert await asyncio.gather(
            coalescer.run(("banana", 10), operation),
            coalescer.run(("apple", 10), operation),
        ) == ["result", "result"]
        assert calls == 2

    asyncio.run(scenario())


def test_cancelled_waiter_does_not_cancel_shared_work() -> None:
    async def scenario() -> None:
        coalescer: DuplicateRequestCoalescer[str] = DuplicateRequestCoalescer()
        release = asyncio.Event()

        async def operation() -> str:
            await release.wait()
            return "completed"

        leader = asyncio.create_task(coalescer.run("same", operation))
        waiter = asyncio.create_task(coalescer.run("same", operation))
        await asyncio.sleep(0)
        waiter.cancel()
        with pytest.raises(asyncio.CancelledError):
            await waiter

        release.set()
        assert await leader == "completed"

    asyncio.run(scenario())
