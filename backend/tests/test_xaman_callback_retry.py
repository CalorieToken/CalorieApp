"""Regression coverage for retry-safe Xaman/WordPress callback handling."""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlmodel import Session

import app.database as db_module
import app.main as main_module
from app.main import app
from app.schemas import IdentityClaimsResponse
from app.services.identity import validate_pending_login_state


def _claims() -> IdentityClaimsResponse:
    now = datetime.now(UTC)
    return IdentityClaimsResponse(
        external_subject="wp_user_retry_test",
        xrpl_address="rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg",
        issued_at=now,
        expires_at=now + timedelta(seconds=60),
        jti="retry-test-jti",
    )


def test_transient_bridge_failure_does_not_consume_login_state(
    monkeypatch,
):
    """A retryable bridge error must leave the pending state usable."""
    monkeypatch.setattr(main_module, "_SESSION_COOKIE_SECURE", False)
    monkeypatch.setattr(main_module, "_CALORIEAPP_ENV", "local")
    monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "test-secret")

    calls = {"count": 0}

    def flaky_exchange(code: str, state: str) -> IdentityClaimsResponse:
        calls["count"] += 1
        if calls["count"] == 1:
            raise HTTPException(status_code=502, detail="WordPress bridge exchange failed")
        return _claims()

    monkeypatch.setattr(main_module, "_exchange_code_for_claims", flaky_exchange)

    with TestClient(app) as client:
        start = client.post("/api/identity/login/start")
        assert start.status_code == 200
        state = start.json()["state"]

        failed = client.post(
            "/api/identity/callback",
            json={"code": "bridge-code", "state": state},
        )
        assert failed.status_code == 502

        with Session(db_module.engine) as session:
            valid, reason, pending = validate_pending_login_state(session, state)
            assert valid is True
            assert reason == "ok"
            assert pending is not None

        retried = client.post(
            "/api/identity/callback",
            json={"code": "bridge-code", "state": state},
        )
        assert retried.status_code == 200

        replay = client.post(
            "/api/identity/callback",
            json={"code": "bridge-code", "state": state},
        )
        assert replay.status_code == 400
        assert "already consumed" in replay.json()["detail"]
