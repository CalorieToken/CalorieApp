"""
Integration tests for identity endpoints.
"""
import hashlib
import hmac
import json
import tempfile
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import NullPool

import app.database as db_module
import app.main as main_module
from app.main import app
from app.models import AuthSessionDB, CalorieAppUserDB, ExternalIdentityDB, FoodLogDB, PendingLoginStateDB, SQLModel
from app.schemas import IdentityClaimsResponse
from app.services.identity import hash_login_state
from sqlmodel import Session, create_engine, select
from sqlmodel.pool import StaticPool

SESSION_COOKIE_NAME = "calorieapp_session"
SESSION_TOKEN_BYTES = 48
SESSION_ABSOLUTE_LIFETIME_SECONDS = 8 * 60 * 60


def _set_session_cookie_security_config(
    monkeypatch: pytest.MonkeyPatch,
    *,
    secure: bool,
    environment: str | None,
) -> None:
    monkeypatch.setattr(main_module, "_SESSION_COOKIE_SECURE", secure)
    monkeypatch.setattr(main_module, "_CALORIEAPP_ENV", environment)


def _canonical_bridge_payload_for_test(
    *,
    client_id: str,
    timestamp: int,
    nonce: str,
    state: str,
) -> str:
    # Independent protocol construction used by tests to avoid circular reliance
    # on application canonicalization code.
    pieces = [
        '"version":"v1"',
        '"client_id":' + json.dumps(client_id, ensure_ascii=False, separators=(",", ":")),
        '"timestamp":' + json.dumps(str(timestamp), ensure_ascii=False, separators=(",", ":")),
        '"nonce":' + json.dumps(nonce, ensure_ascii=False, separators=(",", ":")),
        '"state":' + json.dumps(state, ensure_ascii=False, separators=(",", ":")),
    ]
    return "{" + ",".join(pieces) + "}"


def _create_session_for_user(
    user_id: str,
    *,
    last_seen_at: datetime | None = None,
    expires_at: datetime | None = None,
    revoked: bool = False,
) -> str:
    now = datetime.now(UTC)
    token = token_urlsafe(SESSION_TOKEN_BYTES)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    session_row = AuthSessionDB(
        session_token_hash=token_hash,
        calorieapp_user_id=user_id,
        created_at=now,
        last_seen_at=last_seen_at or now,
        expires_at=expires_at or (now + timedelta(seconds=SESSION_ABSOLUTE_LIFETIME_SECONDS)),
        revoked_at=now if revoked else None,
    )
    with Session(db_module.engine) as session:
        session.add(session_row)
        session.commit()
    return token


def _set_authenticated_cookie(client: TestClient, user_id: str) -> str:
    token = _create_session_for_user(user_id)
    client.cookies.set(SESSION_COOKIE_NAME, token)
    return token


def _build_bridge_headers(
    *,
    state: str,
    secret: str,
    client_id: str = "calorieapp-backend",
    timestamp: int | None = None,
    nonce: str | None = None,
    signature_override: str | None = None,
) -> dict[str, str]:
    ts = timestamp if timestamp is not None else int(datetime.now(UTC).timestamp())
    nonce_value = nonce or token_urlsafe(24)
    payload = main_module._bridge_auth_canonical_payload(
        client_id=client_id,
        timestamp=ts,
        nonce=nonce_value,
        state=state,
    )
    signature = signature_override or hmac.new(
        secret.encode("utf-8"), payload.encode("utf-8"), "sha256"
    ).hexdigest()

    return {
        "x-calorieapp-client-id": client_id,
        "x-calorieapp-timestamp": str(ts),
        "x-calorieapp-nonce": nonce_value,
        "x-calorieapp-signature": signature,
    }


@pytest.fixture()
def client() -> TestClient:
    """Return a TestClient backed by a fresh in-memory SQLite database."""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    original_engine = db_module.engine
    db_module.engine = test_engine

    with TestClient(app) as test_client:
        yield test_client

    db_module.engine = original_engine
    test_engine.dispose()


class TestIdentityEndpoints:
    """Test identity API endpoints."""

    @pytest.mark.parametrize(
        ("environment", "secure", "should_allow"),
        [
            ("local", False, True),
            ("local", True, True),
            ("staging", False, False),
            ("production", False, False),
            (None, False, False),
            ("unknown", False, False),
            ("staging", True, True),
            ("production", True, True),
        ],
    )
    def test_session_cookie_secure_guardrail_configuration(
        self,
        monkeypatch: pytest.MonkeyPatch,
        environment: str | None,
        secure: bool,
        should_allow: bool,
    ):
        _set_session_cookie_security_config(monkeypatch, secure=secure, environment=environment)

        if should_allow:
            main_module._validate_session_cookie_security_configuration()
        else:
            with pytest.raises(RuntimeError, match="SESSION_COOKIE_SECURE=false is only allowed"):
                main_module._validate_session_cookie_security_configuration()

    @pytest.mark.parametrize(
        "origins",
        [
            [],
            ["*"],
            ["https://app.example.com", "https://app.example.com"],
            ["app.example.com"],
            ["http://app.example.com"],
            ["https://app.example.com/path"],
            ["https://app.example.com/"],
            ["https://app.example.com:not-a-port"],
            ["https://user:password@app.example.com"],
        ],
    )
    def test_cors_configuration_rejects_unsafe_origins(
        self,
        monkeypatch: pytest.MonkeyPatch,
        origins: list[str],
    ):
        monkeypatch.setattr(main_module, "_CORS_ORIGINS", origins)
        with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
            main_module._validate_cors_security_configuration()

    @pytest.mark.parametrize(
        "origins",
        [
            ["https://app.example.com"],
            ["https://app.example.com", "https://admin.example.com:8443"],
            ["http://localhost:3000"],
            ["http://127.0.0.1:3000"],
            ["http://[::1]:3000"],
        ],
    )
    def test_cors_configuration_accepts_explicit_safe_origins(
        self,
        monkeypatch: pytest.MonkeyPatch,
        origins: list[str],
    ):
        monkeypatch.setattr(main_module, "_CORS_ORIGINS", origins)
        main_module._validate_cors_security_configuration()

    def test_startup_fails_closed_for_unsafe_cors_origin(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ):
        monkeypatch.setattr(main_module, "_CORS_ORIGINS", ["*"])
        with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
            with TestClient(app):
                pass

    @pytest.mark.parametrize(
        "redirect",
        [
            "https://evil.example/path",
            "//evil.example/path",
            "dashboard",
            "/\\evil.example/path",
            "/dashboard\nnext",
        ],
    )
    def test_identity_configuration_rejects_external_or_malformed_post_login_redirects(
        self,
        monkeypatch: pytest.MonkeyPatch,
        redirect: str,
    ):
        monkeypatch.setattr(main_module, "_CALORIEAPP_POST_LOGIN_REDIRECT", redirect)
        with pytest.raises(RuntimeError, match="CALORIEAPP_POST_LOGIN_REDIRECT"):
            main_module._validate_identity_url_configuration()

    @pytest.mark.parametrize("redirect", ["/", "/dashboard", "/history?view=recent", "/food/log#top"])
    def test_identity_configuration_accepts_local_post_login_redirects(
        self,
        monkeypatch: pytest.MonkeyPatch,
        redirect: str,
    ):
        monkeypatch.setattr(main_module, "_CALORIEAPP_POST_LOGIN_REDIRECT", redirect)
        main_module._validate_identity_url_configuration()

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("_WORDPRESS_URL", "http://calorietoken.net"),
            ("_WORDPRESS_URL", "https://user:password@calorietoken.net"),
            ("_WORDPRESS_URL", "https://calorietoken.net/site"),
            ("_WORDPRESS_BRIDGE_AUTHORIZE_URL", "http://calorietoken.net/authorize"),
            ("_WORDPRESS_BRIDGE_AUTHORIZE_URL", "https://evil.example/authorize"),
            ("_WORDPRESS_BRIDGE_AUTHORIZE_URL", "https://calorietoken.net"),
            ("_WORDPRESS_BRIDGE_EXCHANGE_URL", "https://evil.example/exchange"),
            ("_WORDPRESS_BRIDGE_EXCHANGE_URL", "https://calorietoken.net/exchange?target=other"),
            ("_WORDPRESS_BRIDGE_AUTHORIZE_URL", "http://localhost:8881/index.php?rest_route=/calorieapp/v1/authorize"),
            ("_WORDPRESS_BRIDGE_EXCHANGE_URL", "http://localhost:8881/index.php?rest_route=/calorieapp/v1/exchange"),
        ],
    )
    def test_identity_configuration_rejects_unsafe_bridge_urls(
        self,
        monkeypatch: pytest.MonkeyPatch,
        field: str,
        value: str,
    ):
        monkeypatch.setattr(main_module, field, value)
        with pytest.raises(RuntimeError, match="WORDPRESS"):
            main_module._validate_identity_url_configuration()

    def test_startup_fails_closed_for_external_post_login_redirect(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ):
        monkeypatch.setattr(
            main_module,
            "_CALORIEAPP_POST_LOGIN_REDIRECT",
            "https://evil.example",
        )
        with pytest.raises(RuntimeError, match="CALORIEAPP_POST_LOGIN_REDIRECT"):
            with TestClient(app):
                pass

    def test_startup_fails_closed_for_insecure_cookie_outside_local(self, monkeypatch: pytest.MonkeyPatch):
        _set_session_cookie_security_config(monkeypatch, secure=False, environment="staging")

        with pytest.raises(RuntimeError, match="SESSION_COOKIE_SECURE=false is only allowed"):
            with TestClient(app):
                pass

    def test_health_returns_200(self, client: TestClient):
        """Health endpoint should return 200."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_login_start(self, client: TestClient):
        """Starting login should return a high-entropy state and fixed XUMM signin URL."""
        response = client.post("/api/identity/login/start")
        assert response.status_code == 200

        data = response.json()
        assert "state" in data
        assert "expires_at" in data
        assert "wordpress_signin_url" in data
        assert data["wordpress_signin_url"].startswith("https://calorietoken.net/?xl-signin&redirect=")
        assert "%2Findex.php%2Fwp-json%2Fcalorieapp%2Fv1%2Fauthorize" in data["wordpress_signin_url"]
        assert "state%3D" in data["wordpress_signin_url"]
        assert len(data["state"]) >= 32
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["pragma"] == "no-cache"
        assert data["expires_at"].endswith("Z")

    def test_login_start_generates_unique_high_entropy_states(self, client: TestClient):
        first = client.post("/api/identity/login/start").json()["state"]
        second = client.post("/api/identity/login/start").json()["state"]
        assert first != second
        assert len(first) >= 32
        assert len(second) >= 32

    def test_login_start_redirect_target_is_fixed_to_bridge_authorize(self, client: TestClient):
        response = client.post("/api/identity/login/start")
        assert response.status_code == 200
        signin_url = response.json()["wordpress_signin_url"]
        assert "redirect=https%3A%2F%2Fcalorietoken.net%2Findex.php%2Fwp-json%2Fcalorieapp%2Fv1%2Fauthorize%3Fstate%3D" in signin_url
        assert "evil.example" not in signin_url

    def test_me_requires_authentication(self, client: TestClient):
        """Getting current user without authentication should return 401."""
        response = client.get("/api/identity/me")
        assert response.status_code == 401

    def test_logout_requires_authentication(self, client: TestClient):
        """Logout without authentication should return 401."""
        response = client.post("/api/identity/logout")
        assert response.status_code == 401

    def test_me_with_valid_session(self, client: TestClient):
        user = CalorieAppUserDB(status="active")
        with Session(db_module.engine) as session:
            session.add(user)
            session.commit()
            user_id = user.id

        _set_authenticated_cookie(client, user_id)

        response = client.get("/api/identity/me")
        assert response.status_code == 200
        assert response.json()["user_id"] == user_id

    def test_me_rejects_unknown_token(self, client: TestClient):
        client.cookies.set(SESSION_COOKIE_NAME, token_urlsafe(SESSION_TOKEN_BYTES))
        response = client.get("/api/identity/me")
        assert response.status_code == 401

    def test_me_rejects_tampered_token(self, client: TestClient):
        user = CalorieAppUserDB(status="active")
        with Session(db_module.engine) as session:
            session.add(user)
            session.commit()
            user_id = user.id

        token = _set_authenticated_cookie(client, user_id)
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        client.cookies.set(SESSION_COOKIE_NAME, tampered)

        response = client.get("/api/identity/me")
        assert response.status_code == 401

    def test_me_rejects_absolute_expired_session(self, client: TestClient):
        user = CalorieAppUserDB(status="active")
        with Session(db_module.engine) as session:
            session.add(user)
            session.commit()
            user_id = user.id

        token = _create_session_for_user(
            user_id,
            expires_at=datetime.now(UTC) - timedelta(seconds=1),
        )
        client.cookies.set(SESSION_COOKIE_NAME, token)

        response = client.get("/api/identity/me")
        assert response.status_code == 401

    def test_me_rejects_idle_expired_session(self, client: TestClient):
        user = CalorieAppUserDB(status="active")
        with Session(db_module.engine) as session:
            session.add(user)
            session.commit()
            user_id = user.id

        token = _create_session_for_user(
            user_id,
            last_seen_at=datetime.now(UTC) - timedelta(minutes=31),
            expires_at=datetime.now(UTC) + timedelta(hours=4),
        )
        client.cookies.set(SESSION_COOKIE_NAME, token)

        response = client.get("/api/identity/me")
        assert response.status_code == 401

    def test_me_rejects_revoked_session(self, client: TestClient):
        user = CalorieAppUserDB(status="active")
        with Session(db_module.engine) as session:
            session.add(user)
            session.commit()
            user_id = user.id

        token = _create_session_for_user(user_id, revoked=True)
        client.cookies.set(SESSION_COOKIE_NAME, token)

        response = client.get("/api/identity/me")
        assert response.status_code == 401

    def test_bridge_state_validate_rejects_wrong_client_id(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        start = client.post("/api/identity/login/start").json()
        headers = _build_bridge_headers(
            state=start["state"],
            secret="supersecret",
            client_id="wrong-client-id",
        )
        response = client.post(
            "/api/identity/login/state/validate",
            json={"state": start["state"]},
            headers=headers,
        )
        assert response.status_code == 403

    def test_bridge_canonicalization_independent_interoperability(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = 'state-with\\nnewline=eq"quote\\\\slash-unicode-\u03c0-and-padding-1234567890'
        with Session(db_module.engine) as session:
            now = datetime.now(UTC)
            pending = PendingLoginStateDB(
                state_hash=hash_login_state(state),
                status="pending",
                created_at=now,
                expires_at=now + timedelta(minutes=5),
            )
            session.add(pending)
            session.commit()

        ts = int(datetime.now(UTC).timestamp())
        nonce = "nonce-special_1234567890"
        payload = _canonical_bridge_payload_for_test(
            client_id="calorieapp-backend",
            timestamp=ts,
            nonce=nonce,
            state=state,
        )
        signature = hmac.new(
            b"supersecret",
            payload.encode("utf-8"),
            "sha256",
        ).hexdigest()

        response = client.post(
            "/api/identity/login/state/validate",
            json={"state": state},
            headers={
                "x-calorieapp-client-id": "calorieapp-backend",
                "x-calorieapp-timestamp": str(ts),
                "x-calorieapp-nonce": nonce,
                "x-calorieapp-signature": signature,
            },
        )

        assert response.status_code == 200
        assert response.json()["valid"] is True

    def test_bridge_canonicalization_distinguishes_logically_different_values(self):
        p1 = _canonical_bridge_payload_for_test(
            client_id="calorieapp-backend",
            timestamp=1700000000,
            nonce="nonce_1234567890123456",
            state="alpha\\n=beta",
        )
        p2 = _canonical_bridge_payload_for_test(
            client_id="calorieapp-backend",
            timestamp=1700000000,
            nonce="nonce_1234567890123456",
            state="alpha=\\nbeta",
        )
        assert p1 != p2
        assert p1.encode("utf-8") != p2.encode("utf-8")

        s1 = hmac.new(b"supersecret", p1.encode("utf-8"), "sha256").hexdigest()
        s2 = hmac.new(b"supersecret", p2.encode("utf-8"), "sha256").hexdigest()
        assert s1 != s2

    def test_bridge_state_validate_accepts_valid_hmac(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        start = client.post("/api/identity/login/start").json()
        headers = _build_bridge_headers(state=start["state"], secret="supersecret")
        response = client.post(
            "/api/identity/login/state/validate",
            json={"state": start["state"]},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["valid"] is True

    def test_bridge_state_validate_rejects_invalid_signature(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        start = client.post("/api/identity/login/start").json()
        headers = _build_bridge_headers(state=start["state"], secret="wrong-secret")
        response = client.post(
            "/api/identity/login/state/validate",
            json={"state": start["state"]},
            headers=headers,
        )
        assert response.status_code == 403

    def test_bridge_state_validate_rejects_tampered_payload(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        start = client.post("/api/identity/login/start").json()
        original_state = start["state"]
        tampered_state = original_state[:-1] + ("A" if original_state[-1] != "A" else "B")
        headers = _build_bridge_headers(state=original_state, secret="supersecret")

        response = client.post(
            "/api/identity/login/state/validate",
            json={"state": tampered_state},
            headers=headers,
        )
        assert response.status_code == 403

    def test_bridge_state_validate_rejects_missing_signature(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        headers = _build_bridge_headers(state=state, secret="supersecret")
        headers.pop("x-calorieapp-signature")

        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 400

    def test_bridge_state_validate_rejects_malformed_nonce(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        headers = _build_bridge_headers(state=state, secret="supersecret", nonce="bad nonce")
        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 400

    def test_bridge_state_validate_rejects_malformed_signature(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        headers = _build_bridge_headers(
            state=state,
            secret="supersecret",
            signature_override="not-a-hex-signature",
        )
        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 400

    def test_bridge_state_validate_accepts_exact_stale_timestamp_boundary(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        fixed_now = datetime(2026, 8, 20, 12, 0, 0, tzinfo=UTC)

        class _FixedDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                if tz is None:
                    return fixed_now.replace(tzinfo=None)
                return fixed_now.astimezone(tz)

        monkeypatch.setattr(main_module, "datetime", _FixedDateTime)
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        ts = int(fixed_now.timestamp()) - main_module._BRIDGE_AUTH_MAX_AGE_SECONDS
        headers = _build_bridge_headers(state=state, secret="supersecret", timestamp=ts)

        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 200

    def test_bridge_state_validate_rejects_missing_timestamp(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        headers = _build_bridge_headers(state=state, secret="supersecret")
        headers.pop("x-calorieapp-timestamp")
        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 400

    def test_bridge_state_validate_accepts_exact_future_timestamp_boundary(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        fixed_now = datetime(2026, 8, 20, 12, 0, 0, tzinfo=UTC)

        class _FixedDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                if tz is None:
                    return fixed_now.replace(tzinfo=None)
                return fixed_now.astimezone(tz)

        monkeypatch.setattr(main_module, "datetime", _FixedDateTime)
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        ts = int(fixed_now.timestamp()) + main_module._BRIDGE_AUTH_MAX_FUTURE_SECONDS
        headers = _build_bridge_headers(state=state, secret="supersecret", timestamp=ts)

        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 200

    def test_bridge_state_validate_rejects_malformed_timestamp(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        headers = _build_bridge_headers(state=state, secret="supersecret")
        headers["x-calorieapp-timestamp"] = "not-an-int"
        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 400

    def test_bridge_state_validate_rejects_stale_timestamp(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        stale = int(datetime.now(UTC).timestamp()) - (main_module._BRIDGE_AUTH_MAX_AGE_SECONDS + 1)
        headers = _build_bridge_headers(state=state, secret="supersecret", timestamp=stale)
        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 400

    def test_bridge_state_validate_rejects_future_timestamp(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        future = int(datetime.now(UTC).timestamp()) + (main_module._BRIDGE_AUTH_MAX_FUTURE_SECONDS + 1)
        headers = _build_bridge_headers(state=state, secret="supersecret", timestamp=future)
        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 400

    def test_bridge_state_validate_rejects_missing_nonce(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        headers = _build_bridge_headers(state=state, secret="supersecret")
        headers.pop("x-calorieapp-nonce")
        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 400

    def test_bridge_state_validate_rejects_nonce_replay(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        headers = _build_bridge_headers(state=state, secret="supersecret", nonce="replay_nonce_1234567890")

        first = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        second = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)

        assert first.status_code == 200
        assert second.status_code == 400

    def test_bridge_state_validate_replay_protection_is_concurrent_safe(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        from concurrent.futures import ThreadPoolExecutor

        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = f"{tmpdir}/bridge_replay_concurrency.db".replace("\\", "/")
            concurrent_engine = create_engine(
                f"sqlite:///{db_path}",
                connect_args={"check_same_thread": False},
                poolclass=NullPool,
            )
            SQLModel.metadata.create_all(concurrent_engine)

            original_engine = db_module.engine
            db_module.engine = concurrent_engine

            try:
                state = client.post("/api/identity/login/start").json()["state"]
                headers = _build_bridge_headers(state=state, secret="supersecret", nonce=token_urlsafe(24))

                with TestClient(app) as bridge_client_a, TestClient(app) as bridge_client_b:
                    def validate_once(bridge_client: TestClient) -> int:
                        response = bridge_client.post(
                            "/api/identity/login/state/validate",
                            json={"state": state},
                            headers=headers,
                        )
                        return response.status_code

                    with ThreadPoolExecutor(max_workers=2) as executor:
                        statuses = list(executor.map(validate_once, [bridge_client_a, bridge_client_b]))
            finally:
                db_module.engine = original_engine
                concurrent_engine.dispose()

        assert sorted(statuses) == [200, 400]

    def test_bridge_state_validate_rejects_when_secret_not_configured(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        state = client.post("/api/identity/login/start").json()["state"]
        headers = _build_bridge_headers(state=state, secret="supersecret")

        response = client.post("/api/identity/login/state/validate", json={"state": state}, headers=headers)
        assert response.status_code == 500

    def test_login_state_is_persisted_and_not_stored_plaintext(self, client: TestClient):
        state = client.post("/api/identity/login/start").json()["state"]

        with Session(db_module.engine) as session:
            row = session.exec(
                select(PendingLoginStateDB).where(PendingLoginStateDB.state_hash == hash_login_state(state))
            ).first()

        assert row is not None
        assert row.state_hash == hash_login_state(state)
        assert row.state_hash != state


class TestFoodLogAuthentication:
    """Test that food log endpoints require authentication."""

    def test_log_food_requires_authentication(self, client: TestClient):
        """Logging food without authentication should return 401."""
        response = client.post(
            "/log-food",
            json={
                "product_name": "Banana",
                "calories": 89.0,
            },
        )
        assert response.status_code == 401

    def test_get_logs_requires_authentication(self, client: TestClient):
        """Getting logs without authentication should return 401."""
        response = client.get("/logs")
        assert response.status_code == 401

    def test_delete_log_requires_authentication(self, client: TestClient):
        """Deleting a log without authentication should return 401."""
        response = client.delete("/logs/1")
        assert response.status_code == 401

    def test_delete_all_logs_requires_authentication(self, client: TestClient):
        """Deleting all logs without authentication should return 401."""
        response = client.delete("/logs")
        assert response.status_code == 401


class TestAuthenticatedFoodLog:
    """Test food log endpoints with authentication."""

    def test_log_food_with_authentication(self, authenticated_client: TestClient):
        """Logging food with authentication should work."""
        response = authenticated_client.post(
            "/log-food",
            json={
                "product_name": "Banana",
                "calories": 89.0,
                "protein": 1.1,
                "fat": 0.3,
                "carbohydrates": 23.0,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["product_name"] == "Banana"
        assert data["calories"] == 89.0
        assert data["id"]  # Should have an ID

    def test_get_logs_with_authentication(self, authenticated_client: TestClient):
        """Getting logs with authentication should work."""
        # Log some food first
        authenticated_client.post(
            "/log-food",
            json={
                "product_name": "Apple",
                "calories": 52.0,
            },
        )

        # Get logs should work
        response = authenticated_client.get("/logs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["product_name"] == "Apple"

    def test_user_a_can_access_own_logs_only(self, authenticated_client: TestClient):
        """A user can see only their own logs and not another user's private entries."""
        with Session(db_module.engine) as session:
            user_a = CalorieAppUserDB(status="active")
            user_b = CalorieAppUserDB(status="active")
            session.add_all([user_a, user_b])
            session.commit()
            user_a_id = user_a.id
            user_b_id = user_b.id

        client_a = TestClient(app)
        _set_authenticated_cookie(client_a, user_a_id)
        client_b = TestClient(app)
        _set_authenticated_cookie(client_b, user_b_id)

        client_b.post("/log-food", json={"product_name": "Private B", "calories": 200.0})
        client_a.post("/log-food", json={"product_name": "Public A", "calories": 100.0})

        response = client_a.get("/logs")
        assert response.status_code == 200
        names = [item["product_name"] for item in response.json()]
        assert "Public A" in names
        assert "Private B" not in names

    def test_user_a_cannot_delete_user_b_log(self, authenticated_client: TestClient):
        """User A cannot delete another user's food log."""
        with Session(db_module.engine) as session:
            user_a = CalorieAppUserDB(status="active")
            user_b = CalorieAppUserDB(status="active")
            session.add_all([user_a, user_b])
            session.commit()
            user_a_id = user_a.id
            user_b_id = user_b.id

        client_a = TestClient(app)
        _set_authenticated_cookie(client_a, user_a_id)
        client_b = TestClient(app)
        _set_authenticated_cookie(client_b, user_b_id)

        created = client_b.post("/log-food", json={"product_name": "User B Secret", "calories": 77.0})
        log_id = created.json()["id"]

        response = client_a.delete(f"/logs/{log_id}")
        assert response.status_code == 403

    def test_user_a_cannot_delete_user_b_logs_all(self, authenticated_client: TestClient):
        """Deleting all logs must only affect the authenticated user's own records."""
        with Session(db_module.engine) as session:
            user_a = CalorieAppUserDB(status="active")
            user_b = CalorieAppUserDB(status="active")
            session.add_all([user_a, user_b])
            session.commit()
            user_a_id = user_a.id
            user_b_id = user_b.id

        client_a = TestClient(app)
        _set_authenticated_cookie(client_a, user_a_id)
        client_b = TestClient(app)
        _set_authenticated_cookie(client_b, user_b_id)

        client_b.post("/log-food", json={"product_name": "Other User Food", "calories": 222.0})
        client_a.post("/log-food", json={"product_name": "My Food", "calories": 111.0})

        response = client_a.delete("/logs")
        assert response.status_code == 200
        assert response.json()["deleted_count"] == 1

        remaining = client_b.get("/logs").json()
        assert any(log["product_name"] == "Other User Food" for log in remaining)

    def test_new_logs_always_receive_owner_id(self, authenticated_client: TestClient):
        """Newly-created food logs must always be associated with the owner."""
        response = authenticated_client.post("/log-food", json={"product_name": "Owner Bound", "calories": 15.0})
        assert response.status_code == 200

        log_id = response.json()["id"]
        with Session(db_module.engine) as session:
            entry = session.get(FoodLogDB, log_id)
            assert entry is not None
            assert entry.owner_id is not None

    def test_legacy_null_owner_records_are_excluded_from_queries(self, authenticated_client: TestClient):
        """Legacy ownerless records are intentionally not visible to authenticated users."""
        with Session(db_module.engine) as session:
            legacy = FoodLogDB(
                product_name="Legacy Unowned",
                calories=50.0,
                owner_id=None,
            )
            session.add(legacy)
            session.commit()

        response = authenticated_client.get("/logs")
        assert response.status_code == 200
        items = response.json()
        assert all(item["product_name"] != "Legacy Unowned" for item in items)

    def test_callback_rejects_unknown_state(self, client: TestClient):
        """Callback must fail safely and never authenticate without a recognized state."""
        response = client.post(
            "/api/identity/callback",
            json={"code": "abc123", "state": "missing-state-value-long-enough-012345678901234567890"},
        )
        assert response.status_code == 400
        assert "Unknown login state" in response.json()["detail"]


class TestIdentityCallbackFlow:
    def _stub_claims(self, subject: str = "wp:calorietoken.net:100", xrpl: str = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh") -> IdentityClaimsResponse:
        now = datetime.now(UTC)
        return IdentityClaimsResponse(
            external_subject=subject,
            xrpl_address=xrpl,
            issued_at=now,
            expires_at=now + timedelta(seconds=60),
            jti=f"jti-{subject}",
        )

    def test_state_validate_accepts_pending_state_with_valid_headers(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        start = client.post("/api/identity/login/start")
        state = start.json()["state"]
        headers = _build_bridge_headers(state=state, secret="supersecret")

        response = client.post(
            "/api/identity/login/state/validate",
            json={"state": state},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["valid"] is True

    def test_state_validate_rejects_expired_state(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        start = client.post("/api/identity/login/start")
        state = start.json()["state"]
        with Session(db_module.engine) as session:
            row = session.exec(
                select(PendingLoginStateDB).where(PendingLoginStateDB.state_hash == hash_login_state(state))
            ).first()
            assert row is not None
            row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            session.add(row)
            session.commit()

        headers = _build_bridge_headers(state=state, secret="supersecret")
        response = client.post(
            "/api/identity/login/state/validate",
            json={"state": state},
            headers=headers,
        )
        assert response.status_code == 400

    def test_callback_creates_session_and_identity(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_SESSION_COOKIE_SECURE", False)
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims())

        start = client.post("/api/identity/login/start")
        state = start.json()["state"]

        callback = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert callback.status_code == 200
        payload = callback.json()
        assert payload["redirect_to"] == "/"
        assert payload["created"] is True
        cookie_header = callback.headers.get("set-cookie", "")
        assert f"{SESSION_COOKIE_NAME}=" in cookie_header
        assert payload["user_id"] not in cookie_header
        assert "HttpOnly" in cookie_header
        assert "SameSite=lax" in cookie_header
        assert "Path=/" in cookie_header
        assert f"Max-Age={SESSION_ABSOLUTE_LIFETIME_SECONDS}" in cookie_header
        assert "Secure" not in cookie_header

        me = client.get("/api/identity/me")
        assert me.status_code == 200
        assert me.json()["user_id"] == payload["user_id"]

        with Session(db_module.engine) as session:
            identity = session.exec(
                select(ExternalIdentityDB).where(ExternalIdentityDB.external_subject == "wp:calorietoken.net:100")
            ).first()
            assert identity is not None
            auth_session = session.exec(
                select(AuthSessionDB).where(AuthSessionDB.calorieapp_user_id == payload["user_id"])
            ).first()
            assert auth_session is not None

    def test_callback_cookie_sets_secure_when_configured(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_SESSION_COOKIE_SECURE", True)
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims())

        state = client.post("/api/identity/login/start").json()["state"]
        callback = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert callback.status_code == 200
        assert "Secure" in callback.headers.get("set-cookie", "")

    def test_logout_revokes_session_and_clears_cookie(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_SESSION_COOKIE_SECURE", False)
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims())

        state = client.post("/api/identity/login/start").json()["state"]
        callback = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert callback.status_code == 200

        session_token = client.cookies.get(SESSION_COOKIE_NAME)
        assert session_token is not None
        session_hash = hashlib.sha256(session_token.encode("utf-8")).hexdigest()

        logout = client.post("/api/identity/logout")
        assert logout.status_code == 200
        logout_cookie = logout.headers.get("set-cookie", "")
        assert f"{SESSION_COOKIE_NAME}=" in logout_cookie
        assert "Max-Age=0" in logout_cookie or "expires=" in logout_cookie.lower()

        with Session(db_module.engine) as session:
            auth_session = session.exec(
                select(AuthSessionDB).where(AuthSessionDB.session_token_hash == session_hash)
            ).first()
            assert auth_session is not None
            assert auth_session.revoked_at is not None

        me = client.get("/api/identity/me")
        assert me.status_code == 401

    def test_login_callback_replaces_existing_session(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_SESSION_COOKIE_SECURE", False)
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims())

        existing_user = CalorieAppUserDB(status="active")
        with Session(db_module.engine) as session:
            session.add(existing_user)
            session.commit()
            existing_user_id = existing_user.id

        old_token = _set_authenticated_cookie(client, existing_user_id)
        old_token_hash = hashlib.sha256(old_token.encode("utf-8")).hexdigest()

        state = client.post("/api/identity/login/start").json()["state"]
        callback = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert callback.status_code == 200

        new_token = callback.cookies.get(SESSION_COOKIE_NAME)
        assert new_token is not None
        new_token_hash = hashlib.sha256(new_token.encode("utf-8")).hexdigest()
        assert old_token_hash != new_token_hash

        with Session(db_module.engine) as session:
            old_session = session.exec(
                select(AuthSessionDB).where(AuthSessionDB.session_token_hash == old_token_hash)
            ).first()
            new_session = session.exec(
                select(AuthSessionDB).where(AuthSessionDB.session_token_hash == new_token_hash)
            ).first()

            assert old_session is not None
            assert new_session is not None
            assert old_session.revoked_at is not None
            assert old_session.replaced_by_session_id == new_session.id

    def test_callback_replay_fails(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims())

        state = client.post("/api/identity/login/start").json()["state"]
        first = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert first.status_code == 200

        second = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert second.status_code == 400
        assert "already consumed" in second.json()["detail"]

    def test_state_survives_client_restart(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_WORDPRESS_BRIDGE_SECRET", "supersecret")
        monkeypatch.setattr(main_module, "_CALORIEAPP_CLIENT_ID", "calorieapp-backend")

        with TestClient(app) as client_a:
            state = client_a.post("/api/identity/login/start").json()["state"]

        headers = _build_bridge_headers(state=state, secret="supersecret")
        with TestClient(app) as client_b:
            response = client_b.post(
                "/api/identity/login/state/validate",
                json={"state": state},
                headers=headers,
            )

        assert response.status_code == 200

    def test_concurrent_callback_state_use_allows_only_one_success(self, monkeypatch: pytest.MonkeyPatch):
        from concurrent.futures import ThreadPoolExecutor

        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims(subject=f"wp:calorietoken.net:{code}"))

        with TestClient(app) as start_client:
            state = start_client.post("/api/identity/login/start").json()["state"]

        def call_callback(code_value: str) -> int:
            with TestClient(app) as callback_client:
                response = callback_client.post(
                    "/api/identity/callback",
                    json={"code": code_value, "state": state},
                )
                return response.status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(call_callback, ["code-1", "code-2"]))

        assert sorted(statuses) == [200, 400]

    def test_bridge_exchange_failure_consumes_state_and_retry_fails(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        def _raise_exchange_failure(code: str, state: str):
            raise main_module.HTTPException(status_code=502, detail="WordPress bridge exchange failed")

        monkeypatch.setattr(main_module, "_exchange_code_for_claims", _raise_exchange_failure)

        state = client.post("/api/identity/login/start").json()["state"]

        failed = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert failed.status_code == 502

        retried = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert retried.status_code == 400
        assert "already consumed" in retried.json()["detail"]

    def test_state_substitution_fails(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims())

        valid_state = client.post("/api/identity/login/start").json()["state"]
        tampered_state = valid_state[:-1] + ("A" if valid_state[-1] != "A" else "B")

        response = client.post("/api/identity/callback", json={"code": "bridge-code", "state": tampered_state})
        assert response.status_code == 400
        assert "unknown" in response.json()["detail"].lower()

    def test_callback_rejects_expired_state(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims())

        state = client.post("/api/identity/login/start").json()["state"]
        with Session(db_module.engine) as session:
            row = session.exec(
                select(PendingLoginStateDB).where(PendingLoginStateDB.state_hash == hash_login_state(state))
            ).first()
            assert row is not None
            row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            session.add(row)
            session.commit()

        response = client.post("/api/identity/callback", json={"code": "bridge-code", "state": state})
        assert response.status_code == 400
        assert "expired" in response.json()["detail"].lower() or "unknown" in response.json()["detail"].lower()

    def test_returning_identity_maps_to_same_calorieapp_user(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims(subject="wp:calorietoken.net:200"))

        state1 = client.post("/api/identity/login/start").json()["state"]
        first = client.post("/api/identity/callback", json={"code": "code-1", "state": state1})
        first_user = first.json()["user_id"]

        state2 = client.post("/api/identity/login/start").json()["state"]
        second = client.post("/api/identity/callback", json={"code": "code-2", "state": state2})
        second_user = second.json()["user_id"]

        assert first_user == second_user

    def test_different_identity_creates_different_calorieapp_user(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims(subject="wp:calorietoken.net:300"))
        state1 = client.post("/api/identity/login/start").json()["state"]
        first_user = client.post("/api/identity/callback", json={"code": "code-1", "state": state1}).json()["user_id"]

        monkeypatch.setattr(main_module, "_exchange_code_for_claims", lambda code, state: self._stub_claims(subject="wp:calorietoken.net:301"))
        state2 = client.post("/api/identity/login/start").json()["state"]
        second_user = client.post("/api/identity/callback", json={"code": "code-2", "state": state2}).json()["user_id"]

        assert first_user != second_user

    def test_browser_cannot_supply_xrpl_address_as_identity(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(
            main_module,
            "_exchange_code_for_claims",
            lambda code, state: self._stub_claims(subject="wp:calorietoken.net:500", xrpl="rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"),
        )

        state = client.post("/api/identity/login/start").json()["state"]
        response = client.post(
            "/api/identity/callback",
            json={
                "code": "bridge-code",
                "state": state,
                "xrpl_address": "rFakeBrowserSuppliedAddress1111111111",
            },
        )
        assert response.status_code == 200

        with Session(db_module.engine) as session:
            identity = session.exec(
                select(ExternalIdentityDB).where(ExternalIdentityDB.external_subject == "wp:calorietoken.net:500")
            ).first()
            assert identity is not None
            assert identity.xrpl_address == "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"
