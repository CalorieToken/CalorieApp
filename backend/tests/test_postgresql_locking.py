from __future__ import annotations

from typing import Any

import pytest

from app.postgresql_locking import (
    POSTGRESQL_ADVISORY_LOCK_TIMEOUT_MILLISECONDS,
    acquire_bounded_transaction_advisory_locks,
)


class RecordingExecutor:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any] | None]] = []

    def execute(
        self,
        statement: Any,
        parameters: dict[str, Any] | None = None,
    ) -> None:
        self.calls.append((str(statement), parameters))


def test_transaction_lock_timeout_precedes_sorted_unique_locks() -> None:
    executor = RecordingExecutor()

    acquire_bounded_transaction_advisory_locks(  # type: ignore[arg-type]
        executor,
        [12, -4, 12, 3],
    )

    assert executor.calls == [
        (
            "SELECT set_config('lock_timeout', :timeout_value, true)",
            {
                "timeout_value": (
                    f"{POSTGRESQL_ADVISORY_LOCK_TIMEOUT_MILLISECONDS}ms"
                )
            },
        ),
        ("SELECT pg_advisory_xact_lock(:lock_key)", {"lock_key": -4}),
        ("SELECT pg_advisory_xact_lock(:lock_key)", {"lock_key": 3}),
        ("SELECT pg_advisory_xact_lock(:lock_key)", {"lock_key": 12}),
    ]


@pytest.mark.parametrize("timeout", [True, 0, -1, 1.5])
def test_transaction_lock_timeout_must_be_a_positive_integer(timeout: object) -> None:
    executor = RecordingExecutor()

    with pytest.raises(ValueError, match="timeout must be a positive integer"):
        acquire_bounded_transaction_advisory_locks(  # type: ignore[arg-type]
            executor,
            [1],
            timeout_milliseconds=timeout,  # type: ignore[arg-type]
        )

    assert executor.calls == []


@pytest.mark.parametrize("lock_keys", [[], [True], [1 << 63], [-(1 << 63) - 1]])
def test_transaction_lock_keys_are_nonempty_signed_bigints(
    lock_keys: list[object],
) -> None:
    executor = RecordingExecutor()

    with pytest.raises(ValueError, match="lock key|At least one"):
        acquire_bounded_transaction_advisory_locks(  # type: ignore[arg-type]
            executor,
            lock_keys,  # type: ignore[arg-type]
        )

    assert executor.calls == []
