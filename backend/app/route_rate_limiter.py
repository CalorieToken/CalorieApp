"""Shared, privacy-minimal admission for public application routes."""

from __future__ import annotations

import asyncio
import hashlib
import math
import re
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from threading import Lock
from typing import Protocol
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from .models import RouteRateEventDB


ROUTE_RATE_WINDOW_SECONDS = 60
ROUTE_RATE_RETRY_AFTER_MAX_SECONDS = 60
ROUTE_RATE_UNAVAILABLE_RETRY_SECONDS = 5


@dataclass(frozen=True)
class RouteRatePolicy:
    route_key: str
    limit: int
    window_seconds: int = ROUTE_RATE_WINDOW_SECONDS

    def __post_init__(self) -> None:
        if not self.route_key or len(self.route_key) > 100:
            raise ValueError("route_key must contain 1 to 100 characters")
        if self.limit <= 0:
            raise ValueError("route limit must be greater than zero")
        if self.window_seconds <= 0 or self.window_seconds > 60:
            raise ValueError("route window_seconds must be between 1 and 60")


ROUTE_RATE_POLICIES: dict[tuple[str, str], RouteRatePolicy] = {
    ("GET", "/openapi.json"): RouteRatePolicy("api_metadata", 120),
    ("GET", "/docs"): RouteRatePolicy("api_metadata", 120),
    ("GET", "/docs/oauth2-redirect"): RouteRatePolicy("api_metadata", 120),
    ("GET", "/redoc"): RouteRatePolicy("api_metadata", 120),
    ("POST", "/api/identity/login/start"): RouteRatePolicy("identity_login_start", 30),
    ("POST", "/api/identity/login/state/validate"): RouteRatePolicy(
        "identity_state_validate",
        120,
    ),
    ("POST", "/api/identity/callback"): RouteRatePolicy("identity_callback", 30),
    ("POST", "/api/identity/login/status"): RouteRatePolicy(
        "identity_login_status",
        240,
    ),
    ("GET", "/api/identity/me"): RouteRatePolicy("identity_me", 240),
    ("GET", "/api/identity/export"): RouteRatePolicy("identity_export", 30),
    ("DELETE", "/api/identity/account"): RouteRatePolicy("identity_account_delete", 10),
    ("POST", "/api/identity/logout"): RouteRatePolicy("identity_logout", 120),
    ("POST", "/log-food"): RouteRatePolicy("food_log_create", 120),
    ("GET", "/logs"): RouteRatePolicy("food_log_list", 240),
    ("DELETE", "/logs"): RouteRatePolicy("food_log_delete_all", 30),
    ("GET", "/search-food"): RouteRatePolicy("food_search", 60),
}

UNMATCHED_ROUTE_RATE_POLICY = RouteRatePolicy("unmatched_request", 120)
ROUTE_RATE_EXEMPTIONS = frozenset(
    {
        ("GET", "/health"),
        ("GET", "/ready"),
    }
)

_DYNAMIC_ROUTE_POLICIES: tuple[tuple[str, re.Pattern[str], RouteRatePolicy], ...] = (
    (
        "DELETE",
        re.compile(r"^/logs/[^/]+$"),
        RouteRatePolicy("food_log_delete_one", 120),
    ),
)

_NO_STORE_SECURITY_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}


class RouteRateLimitRejected(Exception):
    """A bounded rejection produced before the protected endpoint runs."""

    def __init__(self, reason: str, retry_after_seconds: int, *, status_code: int) -> None:
        if status_code not in {429, 503}:
            raise ValueError("route admission status_code must be 429 or 503")
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
        self.retry_after_seconds = max(
            1,
            min(ROUTE_RATE_RETRY_AFTER_MAX_SECONDS, retry_after_seconds),
        )


class RouteRateLimiter(Protocol):
    async def acquire(self, policy: RouteRatePolicy) -> None:
        """Reserve route capacity or reject before endpoint execution."""


def policy_for_route(method: str, path: str) -> RouteRatePolicy | None:
    normalized_method = method.upper()
    if (normalized_method, path) in ROUTE_RATE_EXEMPTIONS:
        return None
    exact = ROUTE_RATE_POLICIES.get((normalized_method, path))
    if exact is not None:
        return exact
    for candidate_method, pattern, policy in _DYNAMIC_ROUTE_POLICIES:
        if normalized_method == candidate_method and pattern.fullmatch(path):
            return policy
    return UNMATCHED_ROUTE_RATE_POLICY


def _retry_after(oldest: float, now: float, window_seconds: int) -> int:
    return max(
        1,
        min(
            ROUTE_RATE_RETRY_AFTER_MAX_SECONDS,
            math.ceil(oldest + window_seconds - now),
        ),
    )


class InMemoryRouteRateLimiter:
    """Equivalent local/test limiter; not production multi-process proof."""

    def __init__(self, *, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._events: dict[str, list[float]] = {}
        self._lock = Lock()

    async def acquire(self, policy: RouteRatePolicy) -> None:
        now = self._clock()
        cutoff = now - policy.window_seconds
        with self._lock:
            events = [
                event
                for event in self._events.get(policy.route_key, [])
                if event > cutoff
            ]
            if len(events) >= policy.limit:
                raise RouteRateLimitRejected(
                    "shared_route_rate_limit",
                    _retry_after(events[0], now, policy.window_seconds),
                    status_code=429,
                )
            events.append(now)
            self._events[policy.route_key] = events

    def reset_for_tests(self) -> None:
        with self._lock:
            self._events.clear()


def _postgresql_lock_key(route_key: str) -> int:
    raw = int.from_bytes(
        hashlib.sha256(f"route-rate:{route_key}".encode("utf-8")).digest()[:8],
        byteorder="big",
        signed=False,
    )
    return raw - (1 << 64) if raw >= (1 << 63) else raw


class PostgreSQLRouteRateLimiter:
    """Strict route window serialized across processes by PostgreSQL."""

    def __init__(self, engine: Engine) -> None:
        if engine.url.get_backend_name() != "postgresql":
            raise ValueError("Shared route limiter requires a PostgreSQL engine")
        self.engine = engine

    async def acquire(self, policy: RouteRatePolicy) -> None:
        await asyncio.to_thread(self._acquire_sync, policy)

    def _acquire_sync(self, policy: RouteRatePolicy) -> None:
        table = RouteRateEventDB.__table__
        retry_after_seconds: int | None = None
        try:
            with self.engine.begin() as connection:
                connection.execute(
                    sa.text("SELECT pg_advisory_xact_lock(:lock_key)"),
                    {"lock_key": _postgresql_lock_key(policy.route_key)},
                )
                now = connection.execute(
                    sa.text("SELECT clock_timestamp()")
                ).scalar_one()
                if not isinstance(now, datetime):
                    raise TypeError("PostgreSQL clock did not return a datetime")
                cutoff = now - timedelta(seconds=policy.window_seconds)
                connection.execute(
                    sa.delete(table).where(
                        table.c.route_key == policy.route_key,
                        table.c.admitted_at <= cutoff,
                    )
                )
                event_count, oldest = connection.execute(
                    sa.select(
                        sa.func.count(table.c.id),
                        sa.func.min(table.c.admitted_at),
                    ).where(
                        table.c.route_key == policy.route_key,
                        table.c.admitted_at > cutoff,
                    )
                ).one()
                if int(event_count) >= policy.limit:
                    if not isinstance(oldest, datetime):
                        raise TypeError("Oldest route admission was not a datetime")
                    retry_after_seconds = _retry_after(
                        oldest.timestamp(),
                        now.timestamp(),
                        policy.window_seconds,
                    )
                else:
                    connection.execute(
                        sa.insert(table).values(
                            id=str(uuid4()),
                            route_key=policy.route_key,
                            admitted_at=now,
                        )
                    )
        except (SQLAlchemyError, TypeError, ValueError) as exc:
            raise RouteRateLimitRejected(
                "shared_route_limiter_unavailable",
                ROUTE_RATE_UNAVAILABLE_RETRY_SECONDS,
                status_code=503,
            ) from exc

        if retry_after_seconds is not None:
            raise RouteRateLimitRejected(
                "shared_route_rate_limit",
                retry_after_seconds,
                status_code=429,
            )


class DatabaseBackedRouteRateLimiter:
    """Select live PostgreSQL or local in-memory behavior from the current engine."""

    def __init__(self, engine_provider: Callable[[], Engine]) -> None:
        self._engine_provider = engine_provider
        self._local = InMemoryRouteRateLimiter()

    async def acquire(self, policy: RouteRatePolicy) -> None:
        try:
            engine = self._engine_provider()
            backend = engine.url.get_backend_name()
        except Exception as exc:
            raise RouteRateLimitRejected(
                "shared_route_limiter_unavailable",
                ROUTE_RATE_UNAVAILABLE_RETRY_SECONDS,
                status_code=503,
            ) from exc

        if backend == "postgresql":
            await PostgreSQLRouteRateLimiter(engine).acquire(policy)
            return
        if backend == "sqlite":
            await self._local.acquire(policy)
            return
        raise RouteRateLimitRejected(
            "shared_route_limiter_unavailable",
            ROUTE_RATE_UNAVAILABLE_RETRY_SECONDS,
            status_code=503,
        )

    def reset_for_tests(self) -> None:
        self._local.reset_for_tests()


class RouteRateLimitMiddleware:
    """Reject protected routes before endpoint work or external access begins."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        limiter: RouteRateLimiter,
        policies: Mapping[tuple[str, str], RouteRatePolicy] | None = None,
    ) -> None:
        self.app = app
        self.limiter = limiter
        self.policies = ROUTE_RATE_POLICIES if policies is None else dict(policies)

    def _policy_for_scope(self, scope: Scope) -> RouteRatePolicy | None:
        method = str(scope.get("method", "")).upper()
        path = str(scope.get("path", ""))
        exact = self.policies.get((method, path))
        if exact is not None:
            return exact
        if self.policies is ROUTE_RATE_POLICIES:
            return policy_for_route(method, path)
        return None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        policy = self._policy_for_scope(scope)
        if policy is None:
            await self.app(scope, receive, send)
            return

        try:
            await self.limiter.acquire(policy)
        except RouteRateLimitRejected as exc:
            detail = (
                "Request rate limit reached"
                if exc.status_code == 429
                else "Request admission temporarily unavailable"
            )
            response = JSONResponse(
                {"detail": detail},
                status_code=exc.status_code,
                headers={
                    **_NO_STORE_SECURITY_HEADERS,
                    "Retry-After": str(exc.retry_after_seconds),
                },
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
