"""Boundary tests for authenticated server-issued login codes."""

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import pytest
from sqlmodel import Session, select

import app.database as db
import app.main as main
from app.models import AuthorizationCodeDB, AuthSessionDB, PendingLoginStateDB
from app.services.identity import hash_login_state

SECRET = "synthetic-bridge-secret-for-tests-only"
CLIENT = "calorieapp-backend"
ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"
ROUTE = "/api/identity/bridge/code"


@pytest.fixture(autouse=True)
def bridge_config(monkeypatch):
    monkeypatch.setattr(main, "_WORDPRESS_BRIDGE_SECRET", SECRET)
    monkeypatch.setattr(main, "_CALORIEAPP_CLIENT_ID", CLIENT)
    monkeypatch.setattr(main, "_WORDPRESS_URL", "https://calorietoken.net")


def body_for(state, **changes):
    return dict(state=state, external_subject="wp:calorietoken.net:42", xrpl_address=ADDRESS, locale="en", **changes)


def signed_headers(body, *, nonce=None, timestamp=None, secret=SECRET, purpose="issue_login_code_v1"):
    timestamp = str(timestamp if timestamp is not None else int(datetime.now(UTC).timestamp()))
    nonce = nonce or token_urlsafe(24)
    # Independent protocol construction; never call application signing code.
    signed = {
        "version": "v2", "purpose": purpose, "client_id": CLIENT,
        "timestamp": timestamp, "nonce": nonce,
        "state": body["state"], "external_subject": body["external_subject"],
        "xrpl_address": body["xrpl_address"], "locale": body["locale"],
    }
    digest = hmac.new(secret.encode(), json.dumps(signed, ensure_ascii=False, separators=(",", ":")).encode(), hashlib.sha256).hexdigest()
    return {"X-CalorieApp-Client-Id": CLIENT, "X-CalorieApp-Timestamp": timestamp,
            "X-CalorieApp-Nonce": nonce, "X-CalorieApp-Signature": digest}


def issue(client, body, **kwargs):
    return client.post(ROUTE, json=body, headers=signed_headers(body, **kwargs))


def rows(model):
    with Session(db.engine) as session:
        return session.exec(select(model)).all()


def test_signed_issuance_callback_origin_handoff_and_logout(client, monkeypatch):
    client.base_url = "https://testserver"
    start = client.post("/api/identity/login/start", json={"locale": "nl"}).json()
    payload = body_for(start["state"])
    payload["locale"] = "nl"
    issued = issue(client, payload)
    assert issued.status_code == 200
    assert issued.headers["cache-control"] == "no-store"
    code = issued.json()["code"]
    assert code.startswith("cb1.") and len(code) == 47
    stored = rows(AuthorizationCodeDB)[0]
    assert stored.code_hash == hashlib.sha256(code.encode()).hexdigest()
    assert stored.state == hash_login_state(start["state"])
    assert not rows(AuthSessionDB)
    assert SECRET not in issued.text and ADDRESS not in issued.text

    def no_wordpress_request(*args, **kwargs):
        pytest.fail("Server-issued code must not make a WordPress HTTP request")
    monkeypatch.setattr(main.httpx, "post", no_wordpress_request)
    response = client.post("/api/identity/callback", json={"state": start["state"], "code": code})
    assert response.status_code == 200
    assert response.json()["locale"] == "nl"
    assert client.get("/api/identity/me").status_code == 200
    assert rows(AuthorizationCodeDB)[0].used_at is not None
    assert client.post("/api/identity/callback", json={"state": start["state"], "code": code}).status_code == 400
    status = client.post("/api/identity/login/status", json={"state": start["state"], "browser_handoff_token": start["browser_handoff_token"]})
    assert status.status_code == 200 and status.json()["status"] == "authenticated"
    assert client.post("/api/identity/logout").status_code == 200
    assert client.get("/api/identity/me").status_code == 401


@pytest.mark.parametrize("case", ["unsigned", "wrong_secret", "expired_signature", "future_signature", "wrong_purpose", "old_protocol", "missing_nonce", "wrong_client"])
def test_untrusted_assertions_create_no_codes_or_sessions(client, case):
    payload = body_for(client.post("/api/identity/login/start").json()["state"])
    opts = {}
    if case == "wrong_secret": opts["secret"] = "wrong"
    if case == "expired_signature": opts["timestamp"] = int(datetime.now(UTC).timestamp()) - 1000
    if case == "future_signature": opts["timestamp"] = int(datetime.now(UTC).timestamp()) + 1000
    if case == "wrong_purpose": opts["purpose"] = "login_state_validate"
    headers = signed_headers(payload, **opts)
    if case == "unsigned": headers = {}
    if case == "missing_nonce": headers.pop("X-CalorieApp-Nonce")
    if case == "wrong_client": headers["X-CalorieApp-Client-Id"] = "other-client"
    if case == "old_protocol":
        old = {"version": "v1", "client_id": CLIENT, "timestamp": headers["X-CalorieApp-Timestamp"], "nonce": headers["X-CalorieApp-Nonce"], "state": payload["state"]}
        headers["X-CalorieApp-Signature"] = hmac.new(SECRET.encode(), json.dumps(old, separators=(",", ":")).encode(), hashlib.sha256).hexdigest()
    response = client.post(ROUTE, json=payload, headers=headers)
    assert response.status_code == 403
    assert not rows(AuthorizationCodeDB) and not rows(AuthSessionDB)


@pytest.mark.parametrize("field,value", [("state", "x" * 64), ("external_subject", "wp:calorietoken.net:99"), ("xrpl_address", "rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY"), ("locale", "nl")])
def test_every_identity_field_is_authenticated(client, field, value):
    payload = body_for(client.post("/api/identity/login/start").json()["state"])
    headers = signed_headers(payload)
    payload[field] = value
    assert client.post(ROUTE, json=payload, headers=headers).status_code == 403
    assert not rows(AuthorizationCodeDB)


def test_nonce_replay_and_bounded_refresh(client):
    payload = body_for(client.post("/api/identity/login/start").json()["state"])
    headers = signed_headers(payload)
    assert client.post(ROUTE, json=payload, headers=headers).status_code == 200
    assert client.post(ROUTE, json=payload, headers=headers).status_code == 403
    assert issue(client, payload).status_code == 200
    assert issue(client, payload).status_code == 200
    assert issue(client, payload).status_code == 429
    assert len(rows(AuthorizationCodeDB)) == 3


@pytest.mark.parametrize("invalid", ["foreign_subject", "locale", "unknown_state", "expired_state", "consumed_state", "foreign_client"])
def test_signed_request_still_requires_matching_pending_transaction(client, invalid):
    payload = body_for(client.post("/api/identity/login/start").json()["state"])
    if invalid == "foreign_subject": payload["external_subject"] = "wp:other.example:42"
    if invalid == "locale": payload["locale"] = "nl"
    if invalid == "unknown_state": payload["state"] = "x" * 64
    if invalid in {"expired_state", "consumed_state", "foreign_client"}:
        with Session(db.engine) as session:
            row = session.exec(select(PendingLoginStateDB)).one()
            if invalid == "expired_state": row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            if invalid == "consumed_state": row.status = "consumed"
            if invalid == "foreign_client": row.client_id = "another-backend"
            session.add(row)
            session.commit()
    assert issue(client, payload).status_code in {400, 409}
    assert not rows(AuthorizationCodeDB)


def test_expired_code_creates_no_session(client):
    state = client.post("/api/identity/login/start").json()["state"]
    code = issue(client, body_for(state)).json()["code"]
    with Session(db.engine) as session:
        row = session.exec(select(AuthorizationCodeDB)).one()
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        session.add(row)
        session.commit()
    assert client.post("/api/identity/callback", json={"state": state, "code": code}).status_code == 400
    assert not rows(AuthSessionDB)


def test_code_cannot_be_used_with_another_state(client):
    state = client.post("/api/identity/login/start").json()["state"]
    other = client.post("/api/identity/login/start").json()["state"]
    code = issue(client, body_for(state)).json()["code"]
    assert client.post("/api/identity/callback", json={"state": other, "code": code}).status_code == 400
    assert not rows(AuthSessionDB)
    assert client.post("/api/identity/callback", json={"state": state, "code": code}).status_code == 200
    assert issue(client, body_for(state)).status_code == 400


def test_code_lifetime_is_capped_by_pending_state(client):
    state = client.post("/api/identity/login/start").json()["state"]
    with Session(db.engine) as session:
        row = session.exec(select(PendingLoginStateDB)).one()
        row.expires_at = datetime.now(UTC) + timedelta(seconds=15)
        session.add(row)
        session.commit()
    assert issue(client, body_for(state)).status_code == 200
    assert rows(AuthorizationCodeDB)[0].expires_at <= rows(PendingLoginStateDB)[0].expires_at


def test_missing_secret_and_oversize_request_fail_closed(client, monkeypatch):
    state = client.post("/api/identity/login/start").json()["state"]
    monkeypatch.setattr(main, "_WORDPRESS_BRIDGE_SECRET", "")
    assert issue(client, body_for(state)).status_code == 500
    assert client.post(ROUTE, content="x" * 2049).status_code == 413
    assert not rows(AuthorizationCodeDB)


def test_expired_code_cleanup_is_bounded_and_preserves_legacy_and_live_allowances(client):
    state = client.post("/api/identity/login/start").json()["state"]
    for _ in range(3):
        assert issue(client, body_for(state)).status_code == 200
    old = datetime.now(UTC) - timedelta(minutes=10)
    with Session(db.engine) as session:
        for row in session.exec(select(AuthorizationCodeDB)).all():
            row.expires_at = old
            session.add(row)
        for index in range(205):
            session.add(AuthorizationCodeDB(
                code_hash=hashlib.sha256(f"expired-{index}".encode()).hexdigest(),
                external_subject="wp:calorietoken.net:42", xrpl_address=ADDRESS,
                state="expired-state", login_session_id=f"bridge-code:expired-{index}",
                created_at=old, expires_at=old,
            ))
        session.add(AuthorizationCodeDB(
            code_hash="legacy-record", external_subject="legacy", state="old-state",
            login_session_id="legacy", created_at=old, expires_at=old,
        ))
        session.commit()
    other = client.post("/api/identity/login/start").json()["state"]
    assert issue(client, body_for(other)).status_code == 200
    remaining = rows(AuthorizationCodeDB)
    assert len([row for row in remaining if row.login_session_id.startswith("bridge-code:expired-")]) == 5
    assert any(row.code_hash == "legacy-record" for row in remaining)
    assert len([row for row in remaining if row.state == hash_login_state(state)]) == 3
    assert issue(client, body_for(state)).status_code == 429
