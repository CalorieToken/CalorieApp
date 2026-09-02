"""Deterministic tests for shared public-route admission."""

from __future__ import annotations

import asyncio
import json

import pytest
from sqlmodel import create_engine
from starlette.middleware.cors import CORSMiddleware
from starlette.types import Message, Scope

from app.main import app
from app.request_limits import RequestBodyLimitMiddleware
from app.route_rate_limiter import (
    DatabaseBackedRouteRateLimiter,
    InMemoryRouteRateLimiter,
    PostgreSQLRouteRateLimiter,
    ROUTE_RATE_POLICIES,
    UNMATCHED_ROUTE_RATE_POLICY,
    RouteRateLimitMiddleware,
    RouteRateLimitRejected,
    RouteRatePolicy,
    policy_for_route,
)


def _scope(method: str = "GET", path: str = "/synthetic") -> Scope:
    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "https",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 443),
    }


def _run_middleware(
    limiter,
    *,
    method: str = "GET",
    path: str = "/synthetic",
    policies=None,
) -> tuple[bool, list[Message], int]:
    downstream_called = False
    receive_calls = 0
    sent: list[Message] = []

    async def receive() -> Message:
        nonlocal receive_calls
        receive_calls += 1
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: Message) -> None:
        sent.append(message)

    async def downstream(scope: Scope, receive, send) -> None:
        nonlocal downstream_called
        downstream_called = True
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    middleware = RouteRateLimitMiddleware(
        downstream,
        limiter=limiter,
        policies=policies,
    )
    asyncio.run(middleware(_scope(method, path), receive, send))
    return downstream_called, sent, receive_calls


def _response_start(messages: list[Message]) -> Message:
    return next(message for message in messages if message["type"] == "http.response.start")


def _response_json(messages: list[Message]) -> dict[str, str]:
    body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    return json.loads(body)


def test_current_public_route_budgets_are_explicit_and_reviewable() -> None:
    assert {
        (method, path): (policy.route_key, policy.limit, policy.window_seconds)
        for (method, path), policy in ROUTE_RATE_POLICIES.items()
    } == {
        ("GET", "/openapi.json"): ("api_metadata", 120, 60),
        ("GET", "/docs"): ("api_metadata", 120, 60),
        ("GET", "/docs/oauth2-redirect"): ("api_metadata", 120, 60),
        ("GET", "/redoc"): ("api_metadata", 120, 60),
        ("POST", "/api/identity/login/start"): ("identity_login_start", 30, 60),
        ("POST", "/api/identity/login/state/validate"): (
            "identity_state_validate",
            120,
            60,
        ),
        ("POST", "/api/identity/callback"): ("identity_callback", 30, 60),
        ("POST", "/api/identity/login/status"): (
            "identity_login_status",
            240,
            60,
        ),
        ("GET", "/api/identity/me"): ("identity_me", 240, 60),
        ("GET", "/api/identity/export"): ("identity_export", 30, 60),
        ("POST", "/api/identity/import"): ("identity_import", 5, 60),
        ("DELETE", "/api/identity/account"): (
            "identity_account_delete",
            10,
            60,
        ),
        ("POST", "/api/identity/logout"): ("identity_logout", 120, 60),
        ("POST", "/log-food"): ("food_log_create", 120, 60),
        ("GET", "/logs"): ("food_log_list", 240, 60),
        ("DELETE", "/logs"): ("food_log_delete_all", 30, 60),
        ("GET", "/search-food"): ("food_search", 60, 60),
    }


def test_health_and_readiness_are_exempt_while_unknown_traffic_is_bounded() -> None:
    assert policy_for_route("GET", "/health") is None
    assert policy_for_route("GET", "/ready") is None
    assert policy_for_route("GET", "/unknown") == UNMATCHED_ROUTE_RATE_POLICY
    assert policy_for_route("OPTIONS", "/unknown") == UNMATCHED_ROUTE_RATE_POLICY


def test_body_limit_wraps_route_admission_and_cors_remains_outermost() -> None:
    middleware_classes = [entry.cls for entry in app.user_middleware]
    assert middleware_classes.index(CORSMiddleware) < middleware_classes.index(
        RequestBodyLimitMiddleware
    )
    assert middleware_classes.index(RequestBodyLimitMiddleware) < middleware_classes.index(
        RouteRateLimitMiddleware
    )


def test_dynamic_log_identifier_uses_one_low_cardinality_route_key() -> None:
    first = policy_for_route("DELETE", "/logs/1")
    second = policy_for_route("delete", "/logs/550e8400-e29b-41d4-a716-446655440000")
    assert first is not None
    assert second is not None
    assert first == second == RouteRatePolicy("food_log_delete_one", 120)
    assert policy_for_route("DELETE", "/logs/1/extra") == UNMATCHED_ROUTE_RATE_POLICY


@pytest.mark.parametrize(
    ("route_key", "limit", "window_seconds", "message"),
    [
        ("", 1, 60, "route_key"),
        ("x" * 101, 1, 60, "route_key"),
        ("synthetic", 0, 60, "route limit"),
        ("synthetic", 1, 0, "window_seconds"),
        ("synthetic", 1, 61, "window_seconds"),
    ],
)
def test_invalid_policy_fails_configuration(
    route_key: str,
    limit: int,
    window_seconds: int,
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        RouteRatePolicy(route_key, limit, window_seconds)


def test_route_rejection_rejects_invalid_status_and_bounds_retry_after() -> None:
    with pytest.raises(ValueError, match="429 or 503"):
        RouteRateLimitRejected("invalid", 1, status_code=200)
    assert (
        RouteRateLimitRejected("low", 0, status_code=429).retry_after_seconds == 1
    )
    assert (
        RouteRateLimitRejected("high", 999, status_code=503).retry_after_seconds
        == 60
    )


def test_strict_window_rejects_with_bounded_retry_and_expires_at_boundary() -> None:
    now = [100.0]
    limiter = InMemoryRouteRateLimiter(clock=lambda: now[0])
    policy = RouteRatePolicy("synthetic", 2)

    asyncio.run(limiter.acquire(policy))
    asyncio.run(limiter.acquire(policy))
    with pytest.raises(RouteRateLimitRejected) as rejected:
        asyncio.run(limiter.acquire(policy))
    assert rejected.value.reason == "shared_route_rate_limit"
    assert rejected.value.status_code == 429
    assert rejected.value.retry_after_seconds == 60

    now[0] = 159.1
    with pytest.raises(RouteRateLimitRejected) as nearly_ready:
        asyncio.run(limiter.acquire(policy))
    assert nearly_ready.value.retry_after_seconds == 1

    now[0] = 160.0
    asyncio.run(limiter.acquire(policy))


def test_route_windows_are_independent_and_concurrent_admission_is_atomic() -> None:
    limiter = InMemoryRouteRateLimiter(clock=lambda: 100.0)
    first = RouteRatePolicy("first", 2)
    second = RouteRatePolicy("second", 2)

    async def attempt(policy: RouteRatePolicy) -> str:
        try:
            await limiter.acquire(policy)
        except RouteRateLimitRejected:
            return "rejected"
        return "admitted"

    async def scenario() -> tuple[list[str], list[str]]:
        return (
            await asyncio.gather(*(attempt(first) for _ in range(8))),
            await asyncio.gather(*(attempt(second) for _ in range(3))),
        )

    first_results, second_results = asyncio.run(scenario())
    assert first_results.count("admitted") == 2
    assert first_results.count("rejected") == 6
    assert second_results.count("admitted") == 2
    assert second_results.count("rejected") == 1


def test_database_backed_limiter_uses_only_local_equivalent_for_sqlite() -> None:
    engine = create_engine("sqlite://")
    limiter = DatabaseBackedRouteRateLimiter(lambda: engine)
    policy = RouteRatePolicy("synthetic", 1)
    try:
        asyncio.run(limiter.acquire(policy))
        with pytest.raises(RouteRateLimitRejected) as rejected:
            asyncio.run(limiter.acquire(policy))
        assert rejected.value.status_code == 429
    finally:
        engine.dispose()


def test_database_engine_resolution_failure_fails_closed() -> None:
    def unavailable_engine():
        raise RuntimeError("database unavailable")

    limiter = DatabaseBackedRouteRateLimiter(unavailable_engine)
    with pytest.raises(RouteRateLimitRejected) as rejected:
        asyncio.run(limiter.acquire(RouteRatePolicy("synthetic", 1)))
    assert rejected.value.reason == "shared_route_limiter_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5


def test_postgresql_limiter_rejects_non_postgresql_engine() -> None:
    engine = create_engine("sqlite://")
    try:
        with pytest.raises(ValueError, match="PostgreSQL"):
            PostgreSQLRouteRateLimiter(engine)
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("status_code", "detail"),
    [
        (429, "Request rate limit reached"),
        (503, "Request admission temporarily unavailable"),
    ],
)
def test_middleware_rejects_before_endpoint_with_private_bounded_response(
    status_code: int,
    detail: str,
) -> None:
    class RejectingLimiter:
        async def acquire(self, policy: RouteRatePolicy) -> None:
            raise RouteRateLimitRejected(
                "synthetic_rejection",
                999,
                status_code=status_code,
            )

    policy = RouteRatePolicy("synthetic", 1)
    called, sent, receive_calls = _run_middleware(
        RejectingLimiter(),
        method="POST",
        path="/synthetic",
        policies={("POST", "/synthetic"): policy},
    )

    assert called is False
    assert receive_calls == 0
    start = _response_start(sent)
    assert start["status"] == status_code
    assert _response_json(sent) == {"detail": detail}
    headers = {name.lower(): value for name, value in start["headers"]}
    assert headers[b"retry-after"] == b"60"
    assert headers[b"cache-control"] == b"no-store"
    assert headers[b"pragma"] == b"no-cache"
    assert headers[b"x-content-type-options"] == b"nosniff"


def test_middleware_bypasses_health_route_without_acquiring() -> None:
    class UnexpectedLimiter:
        async def acquire(self, policy: RouteRatePolicy) -> None:
            raise AssertionError("health must bypass shared route admission")

    called, sent, _ = _run_middleware(
        UnexpectedLimiter(),
        method="GET",
        path="/health",
    )
    assert called is True
    assert _response_start(sent)["status"] == 204
