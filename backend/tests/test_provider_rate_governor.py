"""Deterministic tests for the provider-wide strict sliding window."""

from __future__ import annotations

import asyncio

import pytest
from sqlmodel import create_engine

from app.provider_rate_governor import (
    InMemorySlidingWindowRateGovernor,
    PostgreSQLSlidingWindowRateGovernor,
    build_provider_rate_governor,
)
from app.source_admission import AdapterAdmissionRejected


def _governor(now: list[float], *, limit: int = 8):
    return InMemorySlidingWindowRateGovernor(
        provider_key="synthetic_provider",
        limit=limit,
        window_seconds=60,
        clock=lambda: now[0],
    )


@pytest.mark.parametrize(
    ("provider_key", "limit", "window_seconds", "message"),
    [
        ("", 8, 60, "provider_key"),
        ("x" * 101, 8, 60, "provider_key"),
        ("synthetic", 0, 60, "limit"),
        ("synthetic", 8, 0, "window_seconds"),
        ("synthetic", 8, 61, "window_seconds"),
    ],
)
def test_invalid_governor_configuration_fails_closed(
    provider_key: str,
    limit: int,
    window_seconds: int,
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        InMemorySlidingWindowRateGovernor(
            provider_key=provider_key,
            limit=limit,
            window_seconds=window_seconds,
        )


def test_strict_window_allows_eight_attempts_then_returns_bounded_429() -> None:
    now = [100.0]
    governor = _governor(now)

    for _ in range(8):
        asyncio.run(governor.acquire())

    with pytest.raises(AdapterAdmissionRejected) as rejected:
        asyncio.run(governor.acquire())
    assert rejected.value.reason == "shared_provider_rate_limit"
    assert rejected.value.status_code == 429
    assert rejected.value.retry_after_seconds == 60

    now[0] = 159.1
    with pytest.raises(AdapterAdmissionRejected) as nearly_ready:
        asyncio.run(governor.acquire())
    assert nearly_ready.value.retry_after_seconds == 1


def test_expired_window_event_is_removed_before_new_admission() -> None:
    now = [100.0]
    governor = _governor(now, limit=1)
    asyncio.run(governor.acquire())

    now[0] = 160.0
    asyncio.run(governor.acquire())


def test_concurrent_local_attempts_cannot_exceed_window_limit() -> None:
    now = [100.0]
    governor = _governor(now, limit=4)

    async def attempt() -> str:
        try:
            await governor.acquire()
        except AdapterAdmissionRejected:
            return "rejected"
        return "admitted"

    async def scenario() -> list[str]:
        return await asyncio.gather(*(attempt() for _ in range(12)))

    results = asyncio.run(scenario())
    assert results.count("admitted") == 4
    assert results.count("rejected") == 8


def test_sqlite_builds_only_the_local_test_governor() -> None:
    engine = create_engine("sqlite://")
    try:
        governor = build_provider_rate_governor(engine)
        assert isinstance(governor, InMemorySlidingWindowRateGovernor)
    finally:
        engine.dispose()


def test_postgresql_governor_rejects_non_postgresql_engine() -> None:
    engine = create_engine("sqlite://")
    try:
        with pytest.raises(ValueError, match="PostgreSQL"):
            PostgreSQLSlidingWindowRateGovernor(
                engine,
                provider_key="synthetic",
                limit=8,
                window_seconds=60,
            )
    finally:
        engine.dispose()
