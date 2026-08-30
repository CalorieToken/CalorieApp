from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

import app.database as db_module
from app.models import (
    AuthorizationCodeDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    OriginLoginHandoffDB,
)


def test_account_data_export_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/identity/export")

    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


def test_account_data_export_is_complete_scoped_versioned_and_secret_free(
    authenticated_client: TestClient,
) -> None:
    me = authenticated_client.get("/api/identity/me")
    assert me.status_code == 200
    user_id = me.json()["user_id"]

    now = datetime.now(UTC)
    own_subject = "wp:calorietoken.net:export-owner"
    other_subject = "wp:calorietoken.net:other-user"
    own_code_hash = "a" * 64
    own_state = "private-export-state-value"
    own_login_session_id = "private-login-session-id"
    own_handoff_state_hash = "b" * 64
    own_handoff_token_hash = "c" * 64

    with Session(db_module.engine) as session:
        other_user = CalorieAppUserDB(status="active")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)

        session.add_all(
            [
                ExternalIdentityDB(
                    calorieapp_user_id=user_id,
                    provider="wordpress_xumm",
                    external_subject=own_subject,
                    xrpl_address="rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
                    created_at=now - timedelta(days=2),
                    last_verified_at=now - timedelta(days=1),
                ),
                ExternalIdentityDB(
                    calorieapp_user_id=other_user.id,
                    provider="wordpress_xumm",
                    external_subject=other_subject,
                    created_at=now - timedelta(days=2),
                    last_verified_at=now - timedelta(days=1),
                ),
                AuthorizationCodeDB(
                    code_hash=own_code_hash,
                    external_subject=own_subject,
                    state=own_state,
                    login_session_id=own_login_session_id,
                    created_at=now - timedelta(minutes=3),
                    expires_at=now + timedelta(minutes=2),
                    used_at=now - timedelta(minutes=1),
                    used_by_ip="203.0.113.10",
                ),
                AuthorizationCodeDB(
                    code_hash="d" * 64,
                    external_subject=other_subject,
                    state="other-private-state",
                    login_session_id="other-login-session",
                    created_at=now - timedelta(minutes=3),
                    expires_at=now + timedelta(minutes=2),
                    used_by_ip="203.0.113.11",
                ),
                OriginLoginHandoffDB(
                    state_hash=own_handoff_state_hash,
                    handoff_token_hash=own_handoff_token_hash,
                    status="claimed",
                    calorieapp_user_id=user_id,
                    created_at=now - timedelta(minutes=3),
                    expires_at=now + timedelta(minutes=2),
                    completed_at=now - timedelta(minutes=2),
                    claimed_at=now - timedelta(minutes=1),
                ),
                OriginLoginHandoffDB(
                    state_hash="e" * 64,
                    handoff_token_hash="f" * 64,
                    status="completed",
                    calorieapp_user_id=other_user.id,
                    created_at=now - timedelta(minutes=3),
                    expires_at=now + timedelta(minutes=2),
                ),
                FoodLogDB(
                    product_name="Other user's private food",
                    calories=999,
                    owner_id=other_user.id,
                ),
            ]
        )
        session.commit()

    create_log = authenticated_client.post(
        "/log-food",
        json={"product_name": "Exported apple", "calories": 52},
    )
    assert create_log.status_code == 200

    response = authenticated_client.get("/api/identity/export")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    assert response.headers["content-disposition"] == (
        'attachment; filename="calorieapp-account-data-v1.json"'
    )

    data = response.json()
    assert data["export_version"] == "calorieapp-account-data-v1"
    assert data["account"]["user_id"] == user_id
    assert data["account"]["status"] == "active"
    assert {identity["external_subject"] for identity in data["external_identities"]} == {
        own_subject
    }
    assert [food_log["product_name"] for food_log in data["food_logs"]] == [
        "Exported apple"
    ]
    assert len(data["authentication_sessions"]) == 1
    assert len(data["authorization_events"]) == 1
    assert data["authorization_events"][0]["external_subject"] == own_subject
    assert data["authorization_events"][0]["used_by_ip"] == "203.0.113.10"
    assert len(data["login_handoffs"]) == 1
    assert data["login_handoffs"][0]["status"] == "claimed"

    exported_text = response.text
    for secret in (
        own_code_hash,
        own_state,
        own_login_session_id,
        own_handoff_state_hash,
        own_handoff_token_hash,
        "other-user",
        "Other user's private food",
    ):
        assert secret not in exported_text

    assert "session_token_hash" not in data["authentication_sessions"][0]
    assert "authorization_code_hash" in data["excluded_security_fields"]
    assert "handoff_token_hash" in data["excluded_security_fields"]
