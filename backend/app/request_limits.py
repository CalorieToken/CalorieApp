"""ASGI request-body limits enforced before application parsing or mutation."""

from __future__ import annotations

from collections import deque
from collections.abc import Mapping

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

DEFAULT_MUTATION_BODY_LIMIT_BYTES = 16 * 1024

ROUTE_BODY_LIMIT_BYTES: dict[tuple[str, str], int] = {
    ("POST", "/api/identity/login/start"): 2 * 1024,
    ("POST", "/api/identity/login/state/validate"): 2 * 1024,
    ("POST", "/api/identity/callback"): 4 * 1024,
    ("POST", "/api/identity/login/status"): 4 * 1024,
    ("POST", "/api/identity/import"): 5 * 1024 * 1024,
    ("DELETE", "/api/identity/account"): 4 * 1024,
    ("POST", "/api/identity/logout"): 1024,
    ("POST", "/log-food"): DEFAULT_MUTATION_BODY_LIMIT_BYTES,
}

_BODY_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_NO_STORE_SECURITY_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}


class RequestBodyLimitMiddleware:
    """Bound declared and actual mutation bodies without trusting one header."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        default_limit_bytes: int = DEFAULT_MUTATION_BODY_LIMIT_BYTES,
        route_limits: Mapping[tuple[str, str], int] | None = None,
    ) -> None:
        if default_limit_bytes <= 0:
            raise ValueError("default_limit_bytes must be greater than zero")
        selected_limits = (
            ROUTE_BODY_LIMIT_BYTES if route_limits is None else route_limits
        )
        if any(limit <= 0 for limit in selected_limits.values()):
            raise ValueError("route body limits must be greater than zero")

        self.app = app
        self.default_limit_bytes = default_limit_bytes
        self.route_limits = dict(selected_limits)

    def _limit_for_scope(self, scope: Scope) -> int | None:
        method = str(scope.get("method", "")).upper()
        if method not in _BODY_METHODS:
            return None
        path = str(scope.get("path", ""))
        return self.route_limits.get((method, path), self.default_limit_bytes)

    @staticmethod
    def _declared_content_length(scope: Scope) -> tuple[int | None, bool]:
        values = [
            value
            for name, value in scope.get("headers", [])
            if name.lower() == b"content-length"
        ]
        if not values:
            return None, True
        if len(values) != 1:
            return None, False
        try:
            decoded = values[0].decode("ascii")
        except UnicodeDecodeError:
            return None, False
        if not decoded.isdigit():
            return None, False
        declared = int(decoded)
        return declared, True

    @staticmethod
    async def _reject(scope: Scope, receive: Receive, send: Send, status: int) -> None:
        detail = "Request body too large" if status == 413 else "Invalid Content-Length"
        response = JSONResponse(
            {"detail": detail},
            status_code=status,
            headers=_NO_STORE_SECURITY_HEADERS,
        )
        await response(scope, receive, send)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = self._limit_for_scope(scope)
        if limit is None:
            await self.app(scope, receive, send)
            return

        declared_length, valid_length = self._declared_content_length(scope)
        if not valid_length:
            await self._reject(scope, receive, send, 400)
            return
        if declared_length is not None and declared_length > limit:
            await self._reject(scope, receive, send, 413)
            return

        messages: deque[Message] = deque()
        actual_length = 0
        while True:
            message = await receive()
            messages.append(message)
            if message["type"] == "http.disconnect":
                break
            if message["type"] != "http.request":
                continue

            actual_length += len(message.get("body", b""))
            if actual_length > limit:
                await self._reject(scope, receive, send, 413)
                return
            if not message.get("more_body", False):
                break

        async def replay_receive() -> Message:
            if messages:
                return messages.popleft()
            return {"type": "http.request", "body": b"", "more_body": False}

        await self.app(scope, replay_receive, send)
