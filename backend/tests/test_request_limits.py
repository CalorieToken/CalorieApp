"""Request-body limit tests, including untrusted Content-Length handling."""

from __future__ import annotations

import asyncio
import json
from collections import deque

import pytest
from starlette.types import Message, Scope

from app.account_data_import import MAXIMUM_IMPORT_BYTES
from app.request_limits import (
    DEFAULT_MUTATION_BODY_LIMIT_BYTES,
    ROUTE_BODY_LIMIT_BYTES,
    RequestBodyLimitMiddleware,
)


def _scope(*, headers: list[tuple[bytes, bytes]] | None = None) -> Scope:
    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": "/synthetic-mutation",
        "raw_path": b"/synthetic-mutation",
        "query_string": b"",
        "headers": headers or [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 443),
    }


def _run_middleware(
    messages: list[Message],
    *,
    headers: list[tuple[bytes, bytes]] | None = None,
    limit: int = 8,
) -> tuple[bool, bytes, list[Message], int]:
    incoming = deque(messages)
    sent: list[Message] = []
    downstream_called = False
    downstream_body = b""
    receive_calls = 0

    async def receive() -> Message:
        nonlocal receive_calls
        receive_calls += 1
        if incoming:
            return incoming.popleft()
        return {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        sent.append(message)

    async def downstream(scope: Scope, receive_downstream, send_downstream) -> None:
        nonlocal downstream_called, downstream_body
        downstream_called = True
        while True:
            message = await receive_downstream()
            if message["type"] != "http.request":
                break
            downstream_body += message.get("body", b"")
            if not message.get("more_body", False):
                break
        await send_downstream(
            {"type": "http.response.start", "status": 204, "headers": []}
        )
        await send_downstream({"type": "http.response.body", "body": b""})

    middleware = RequestBodyLimitMiddleware(
        downstream,
        default_limit_bytes=limit,
        route_limits={},
    )
    asyncio.run(middleware(_scope(headers=headers), receive, send))
    return downstream_called, downstream_body, sent, receive_calls


def _response_status(messages: list[Message]) -> int:
    start = next(message for message in messages if message["type"] == "http.response.start")
    return int(start["status"])


def _response_json(messages: list[Message]) -> dict[str, str]:
    body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    return json.loads(body)


def test_current_route_limits_are_narrow_and_explicit() -> None:
    assert DEFAULT_MUTATION_BODY_LIMIT_BYTES == 16 * 1024
    assert ROUTE_BODY_LIMIT_BYTES == {
        ("POST", "/api/identity/login/start"): 2 * 1024,
        ("POST", "/api/identity/login/state/validate"): 2 * 1024,
        ("POST", "/api/identity/callback"): 4 * 1024,
        ("POST", "/api/identity/login/status"): 4 * 1024,
        ("POST", "/api/identity/import"): 5 * 1024 * 1024,
        ("DELETE", "/api/identity/account"): 4 * 1024,
        ("POST", "/api/identity/logout"): 1024,
        ("POST", "/log-food"): 16 * 1024,
    }
    assert ROUTE_BODY_LIMIT_BYTES[("POST", "/api/identity/import")] == MAXIMUM_IMPORT_BYTES


def test_limit_rejects_declared_oversize_without_reading_body() -> None:
    called, _, sent, receive_calls = _run_middleware(
        [{"type": "http.request", "body": b"not-read", "more_body": False}],
        headers=[(b"content-length", b"9")],
    )

    assert called is False
    assert receive_calls == 0
    assert _response_status(sent) == 413
    assert _response_json(sent) == {"detail": "Request body too large"}


def test_limit_rejects_chunked_oversize_actual_body() -> None:
    called, _, sent, receive_calls = _run_middleware(
        [
            {"type": "http.request", "body": b"1234", "more_body": True},
            {"type": "http.request", "body": b"56789", "more_body": False},
        ]
    )

    assert called is False
    assert receive_calls == 2
    assert _response_status(sent) == 413


def test_limit_does_not_trust_smaller_declared_length() -> None:
    called, _, sent, _ = _run_middleware(
        [{"type": "http.request", "body": b"123456789", "more_body": False}],
        headers=[(b"content-length", b"1")],
    )

    assert called is False
    assert _response_status(sent) == 413


def test_limit_replays_exact_boundary_body_unchanged() -> None:
    called, body, sent, _ = _run_middleware(
        [
            {"type": "http.request", "body": b"1234", "more_body": True},
            {"type": "http.request", "body": b"5678", "more_body": False},
        ],
        headers=[(b"content-length", b"8")],
    )

    assert called is True
    assert body == b"12345678"
    assert _response_status(sent) == 204


@pytest.mark.parametrize(
    "headers",
    [
        [(b"content-length", b"invalid")],
        [(b"content-length", b"-1")],
        [(b"content-length", b"+1")],
        [(b"content-length", b" 1")],
        [(b"content-length", b"1"), (b"content-length", b"1")],
    ],
)
def test_limit_rejects_ambiguous_or_invalid_content_length(
    headers: list[tuple[bytes, bytes]],
) -> None:
    called, _, sent, receive_calls = _run_middleware(
        [{"type": "http.request", "body": b"1", "more_body": False}],
        headers=headers,
    )

    assert called is False
    assert receive_calls == 0
    assert _response_status(sent) == 400
    assert _response_json(sent) == {"detail": "Invalid Content-Length"}


def test_rejection_has_private_response_security_headers() -> None:
    _, _, sent, _ = _run_middleware(
        [{"type": "http.request", "body": b"123456789", "more_body": False}]
    )
    start = next(message for message in sent if message["type"] == "http.response.start")
    headers = {name.lower(): value for name, value in start["headers"]}

    assert headers[b"cache-control"] == b"no-store"
    assert headers[b"pragma"] == b"no-cache"
    assert headers[b"x-content-type-options"] == b"nosniff"
    assert headers[b"x-frame-options"] == b"DENY"
    assert b"retry-after" not in headers


def test_limit_configuration_rejects_non_positive_values() -> None:
    async def downstream(scope, receive, send) -> None:
        raise AssertionError("configuration validation should run first")

    with pytest.raises(ValueError, match="default_limit_bytes"):
        RequestBodyLimitMiddleware(downstream, default_limit_bytes=0)
    with pytest.raises(ValueError, match="route body limits"):
        RequestBodyLimitMiddleware(
            downstream,
            route_limits={("POST", "/invalid"): 0},
        )
