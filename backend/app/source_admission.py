"""Bounded admission and circuit breaking for external source adapters."""

from __future__ import annotations

import asyncio
import math
import time
import weakref
from collections.abc import Awaitable, Callable, Hashable
from dataclasses import dataclass
from threading import Lock
from typing import Generic, Literal, TypeVar


T = TypeVar("T")
CircuitState = Literal["closed", "open", "half-open"]
MAX_ADAPTER_RETRY_AFTER_SECONDS = 60


class AdapterAdmissionRejected(Exception):
    """A safe local rejection with a bounded HTTP response contract."""

    def __init__(
        self,
        reason: str,
        retry_after_seconds: int,
        *,
        status_code: int = 503,
    ) -> None:
        if status_code not in {429, 503}:
            raise ValueError("admission status_code must be 429 or 503")
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
        self.retry_after_seconds = min(
            MAX_ADAPTER_RETRY_AFTER_SECONDS,
            max(1, retry_after_seconds),
        )


@dataclass(frozen=True)
class CircuitPermit:
    generation: int
    half_open_probe: bool


@dataclass
class _LoopAdmissionState:
    semaphore: asyncio.Semaphore
    queued: int = 0


class AdapterAdmissionController:
    """Limit adapter work and stop calls while a source is repeatedly failing."""

    def __init__(
        self,
        *,
        max_concurrency: int,
        max_queue: int,
        queue_timeout_seconds: float,
        failure_threshold: int,
        recovery_timeout_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if max_concurrency <= 0:
            raise ValueError("max_concurrency must be greater than zero")
        if max_queue < 0:
            raise ValueError("max_queue cannot be negative")
        if queue_timeout_seconds <= 0:
            raise ValueError("queue_timeout_seconds must be greater than zero")
        if failure_threshold <= 0:
            raise ValueError("failure_threshold must be greater than zero")
        if recovery_timeout_seconds <= 0:
            raise ValueError("recovery_timeout_seconds must be greater than zero")

        self.max_concurrency = max_concurrency
        self.max_queue = max_queue
        self.queue_timeout_seconds = queue_timeout_seconds
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self._clock = clock

        self._loop_states: weakref.WeakKeyDictionary[
            asyncio.AbstractEventLoop, _LoopAdmissionState
        ] = weakref.WeakKeyDictionary()
        self._loop_states_lock = Lock()

        self._circuit_lock = Lock()
        self._circuit_state: CircuitState = "closed"
        self._failure_count = 0
        self._opened_at: float | None = None
        self._generation = 0

    def _loop_state(self) -> _LoopAdmissionState:
        loop = asyncio.get_running_loop()
        with self._loop_states_lock:
            state = self._loop_states.get(loop)
            if state is None:
                state = _LoopAdmissionState(
                    semaphore=asyncio.Semaphore(self.max_concurrency)
                )
                self._loop_states[loop] = state
            return state

    def begin_action(self) -> CircuitPermit:
        """Reserve circuit access for one non-coalesced user action."""
        now = self._clock()
        with self._circuit_lock:
            if self._circuit_state == "open":
                assert self._opened_at is not None
                remaining = self.recovery_timeout_seconds - (now - self._opened_at)
                if remaining > 0:
                    raise AdapterAdmissionRejected(
                        "circuit_open",
                        math.ceil(remaining),
                    )
                self._circuit_state = "half-open"
                self._generation += 1
                return CircuitPermit(self._generation, True)

            if self._circuit_state == "half-open":
                raise AdapterAdmissionRejected("circuit_probe_in_progress", 1)

            return CircuitPermit(self._generation, False)

    def record_success(self, permit: CircuitPermit) -> None:
        with self._circuit_lock:
            if permit.generation != self._generation:
                return
            if permit.half_open_probe and self._circuit_state == "half-open":
                self._circuit_state = "closed"
                self._failure_count = 0
                self._opened_at = None
                self._generation += 1
            elif self._circuit_state == "closed":
                self._failure_count = 0

    def record_failure(self, permit: CircuitPermit) -> None:
        now = self._clock()
        with self._circuit_lock:
            if permit.generation != self._generation:
                return
            if permit.half_open_probe and self._circuit_state == "half-open":
                self._open_circuit(now)
                return
            if self._circuit_state != "closed":
                return

            self._failure_count += 1
            if self._failure_count >= self.failure_threshold:
                self._open_circuit(now)

    def _open_circuit(self, now: float) -> None:
        self._circuit_state = "open"
        self._opened_at = now
        self._generation += 1

    async def run_attempt(self, operation: Callable[[], Awaitable[T]]) -> T:
        """Run one upstream attempt inside the bounded concurrency queue."""
        state = self._loop_state()
        queued = False

        if state.semaphore.locked():
            if state.queued >= self.max_queue:
                raise AdapterAdmissionRejected(
                    "adapter_queue_full",
                    math.ceil(self.queue_timeout_seconds),
                )
            state.queued += 1
            queued = True

        try:
            if queued:
                try:
                    await asyncio.wait_for(
                        state.semaphore.acquire(),
                        timeout=self.queue_timeout_seconds,
                    )
                except TimeoutError as exc:
                    raise AdapterAdmissionRejected(
                        "adapter_queue_timeout",
                        math.ceil(self.queue_timeout_seconds),
                    ) from exc
            else:
                await state.semaphore.acquire()
        finally:
            if queued:
                state.queued -= 1

        try:
            return await operation()
        finally:
            state.semaphore.release()

    @property
    def circuit_state(self) -> CircuitState:
        with self._circuit_lock:
            return self._circuit_state

    @property
    def failure_count(self) -> int:
        with self._circuit_lock:
            return self._failure_count

    @property
    def queued_attempts(self) -> int:
        """Return queue depth for the current event loop."""
        return self._loop_state().queued

    def _reset_for_tests(self) -> None:
        with self._circuit_lock:
            self._circuit_state = "closed"
            self._failure_count = 0
            self._opened_at = None
            self._generation += 1
        with self._loop_states_lock:
            self._loop_states.clear()


@dataclass
class _LoopCoalescingState(Generic[T]):
    tasks: dict[Hashable, asyncio.Task[T]]


class DuplicateRequestCoalescer(Generic[T]):
    """Let identical concurrent reads share one task within an event loop."""

    def __init__(self) -> None:
        self._loop_states: weakref.WeakKeyDictionary[
            asyncio.AbstractEventLoop, _LoopCoalescingState[T]
        ] = weakref.WeakKeyDictionary()
        self._loop_states_lock = Lock()

    def _loop_state(self) -> _LoopCoalescingState[T]:
        loop = asyncio.get_running_loop()
        with self._loop_states_lock:
            state = self._loop_states.get(loop)
            if state is None:
                state = _LoopCoalescingState(tasks={})
                self._loop_states[loop] = state
            return state

    async def run(self, key: Hashable, factory: Callable[[], Awaitable[T]]) -> T:
        state = self._loop_state()
        task = state.tasks.get(key)
        if task is None:
            task = asyncio.create_task(factory())
            state.tasks[key] = task

            def remove_finished(finished: asyncio.Task[T]) -> None:
                if not finished.cancelled():
                    finished.exception()
                if state.tasks.get(key) is finished:
                    state.tasks.pop(key, None)

            task.add_done_callback(remove_finished)

        return await asyncio.shield(task)
