"""Safety tests for the disabled-by-default account-erasure endpoint."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

import app.database as db_module
import app.main as main_module
from app.models import (
    AuthSessionDB,
    AuthorizationCodeDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
)


def _confirmation(user_id: str) -> dict[str, str]:
    return {
        "confirm_user_id": user_id,
        "acknowledgement": "delete-my-calorieapp-account",
    }


def test_account_erasure_requires_authentication(client: TestClient) -> None:
    response = client.request(
        "DELETE",
        "/api/identity/account",
        json=_confirmation("unknown-user"),
    )

    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


def test_account_erasure_is_disabled_by_default(
    authenticated_client: TestClient,
    monkeypatch,
) -> None:
    user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    monkeypatch.setattr(main_module, "_ACCOUNT_ERASURE_ENABLED", False)

    response = authenticated_client.request(
        "DELETE",
        "/api/identity/account",
        json=_confirmation(user_id),
    )

    assert response.status_code == 503
    with Session(db_module.engine) as session:
        assert session.get(CalorieAppUserDB, user_id) is not None


def test_account_erasure_rejects_mismatched_confirmation_without_mutation(
    authenticated_client: TestClient,
    monkeypatch,
) -> None:
    user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    monkeypatch.setattr(main_module, "_ACCOUNT_ERASURE_ENABLED", True)

    response = authenticated_client.request(
        "DELETE",
        "/api/identity/account",
        json=_confirmation("different-user-id"),
    )

    assert response.status_code == 409
    with Session(db_module.engine) as session:
        assert session.get(CalorieAppUserDB, user_id) is not None
        assert session.exec(
            select(AuthSessionDB).where(AuthSessionDB.calorieapp_user_id == user_id)
        ).first() is not None


def test_account_erasure_removes_only_authenticated_users_primary_data(
    authenticated_client: TestClient,
    monkeypatch,
) -> None:
    user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    monkeypatch.setattr(main_module, "_ACCOUNT_ERASURE_ENABLED", True)
    now = datetime.now(UTC)
    own_subject = "wp:calorietoken.net:erase-owner"
    other_subject = "wp:calorietoken.net:keep-other"

    with Session(db_module.engine) as session:
        other_user = CalorieAppUserDB(status="active")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)

        current_auth_session = session.exec(
            select(AuthSessionDB).where(AuthSessionDB.calorieapp_user_id == user_id)
        ).one()
        replacement = AuthSessionDB(
            session_token_hash="1" * 64,
            calorieapp_user_id=user_id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(hours=1),
        )
        session.add(replacement)
        session.flush()
        current_auth_session.replaced_by_session_id = replacement.id
        session.add(current_auth_session)

        session.add_all(
            [
                ExternalIdentityDB(
                    calorieapp_user_id=user_id,
                    provider="wordpress_xumm",
                    external_subject=own_subject,
                ),
                ExternalIdentityDB(
                    calorieapp_user_id=other_user.id,
                    provider="wordpress_xumm",
                    external_subject=other_subject,
                ),
                AuthorizationCodeDB(
                    code_hash="3" * 64,
                    external_subject=other_subject,
                    state="other-state",
                    login_session_id="other-login",
                    expires_at=now + timedelta(minutes=5),
                ),
                FoodLogDB(
                    product_name="Erase private apple",
                    calories=52,
                    owner_id=user_id,
                ),
                FoodLogDB(
                    product_name="Keep private oats",
                    calories=380,
                    owner_id=other_user.id,
                ),
                OriginLoginHandoffDB(
                    state_hash="4" * 64,
                    handoff_token_hash="5" * 64,
                    status="claimed",
                    calorieapp_user_id=user_id,
                    created_at=now,
                    expires_at=now + timedelta(minutes=5),
                ),
                InactiveAccountNoticeDB(
                    calorieapp_user_id=user_id,
                    activity_anchor_at=now - timedelta(days=730),
                    notice_window_started_at=now - timedelta(days=29),
                    retention_due_at=now + timedelta(days=1),
                    delivered_at=now - timedelta(days=20),
                    delivery_channel="reviewed-channel",
                    delivery_evidence_digest="a" * 64,
                    status="delivered",
                    recorded_at=now - timedelta(days=20),
                ),
                InactiveAccountNoticeDB(
                    calorieapp_user_id=other_user.id,
                    activity_anchor_at=now - timedelta(days=730),
                    notice_window_started_at=now - timedelta(days=29),
                    retention_due_at=now + timedelta(days=1),
                    delivered_at=now - timedelta(days=20),
                    delivery_channel="reviewed-channel",
                    delivery_evidence_digest="b" * 64,
                    status="delivered",
                    recorded_at=now - timedelta(days=20),
                ),
                OriginLoginHandoffDB(
                    state_hash="6" * 64,
                    handoff_token_hash="7" * 64,
                    status="completed",
                    calorieapp_user_id=other_user.id,
                    created_at=now,
                    expires_at=now + timedelta(minutes=5),
                ),
            ]
        )
        session.commit()
        other_user_id = other_user.id

    response = authenticated_client.request(
        "DELETE",
        "/api/identity/account",
        json=_confirmation(user_id),
    )

    assert response.status_code == 200
    assert response.json() == {"status": "erased"}
    assert "calorieapp_session=" in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert authenticated_client.get("/api/identity/me").status_code == 401

    with Session(db_module.engine) as session:
        assert session.get(CalorieAppUserDB, user_id) is None
        assert session.get(CalorieAppUserDB, other_user_id) is not None
        assert session.exec(
            select(FoodLogDB).where(FoodLogDB.owner_id == user_id)
        ).all() == []
        assert session.exec(
            select(AuthSessionDB).where(AuthSessionDB.calorieapp_user_id == user_id)
        ).all() == []
        assert session.exec(
            select(ExternalIdentityDB).where(
                ExternalIdentityDB.calorieapp_user_id == user_id
            )
        ).all() == []
        assert session.exec(
            select(OriginLoginHandoffDB).where(
                OriginLoginHandoffDB.calorieapp_user_id == user_id
            )
        ).all() == []
        assert session.exec(
            select(InactiveAccountNoticeDB).where(
                InactiveAccountNoticeDB.calorieapp_user_id == user_id
            )
        ).all() == []
        assert len(
            session.exec(
                select(InactiveAccountNoticeDB).where(
                    InactiveAccountNoticeDB.calorieapp_user_id == other_user_id
                )
            ).all()
        ) == 1
        assert session.exec(
            select(AuthorizationCodeDB).where(
                AuthorizationCodeDB.external_subject == other_subject
            )
        ).one().external_subject == other_subject


def test_account_erasure_stops_on_ambiguous_legacy_identity_without_mutation(
    authenticated_client: TestClient,
    monkeypatch,
) -> None:
    user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    monkeypatch.setattr(main_module, "_ACCOUNT_ERASURE_ENABLED", True)
    shared_subject = "shared-subject-across-providers"

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
                    external_subject=shared_subject,
                ),
                ExternalIdentityDB(
                    calorieapp_user_id=other_user.id,
                    provider="future_provider",
                    external_subject=shared_subject,
                ),
                FoodLogDB(
                    product_name="Must remain after rejected erasure",
                    calories=10,
                    owner_id=user_id,
                ),
            ]
        )
        session.commit()

    response = authenticated_client.request(
        "DELETE",
        "/api/identity/account",
        json=_confirmation(user_id),
    )

    assert response.status_code == 409
    with Session(db_module.engine) as session:
        assert session.get(CalorieAppUserDB, user_id) is not None
        assert session.exec(
            select(FoodLogDB).where(FoodLogDB.owner_id == user_id)
        ).one().product_name == "Must remain after rejected erasure"


def test_account_erasure_stops_on_unowned_legacy_authorization_without_mutation(
    authenticated_client: TestClient,
    monkeypatch,
) -> None:
    user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    monkeypatch.setattr(main_module, "_ACCOUNT_ERASURE_ENABLED", True)
    legacy_subject = "wp:calorietoken.net:unowned-legacy-authorization"

    with Session(db_module.engine) as session:
        session.add_all(
            [
                ExternalIdentityDB(
                    calorieapp_user_id=user_id,
                    provider="wordpress_xumm",
                    external_subject=legacy_subject,
                ),
                AuthorizationCodeDB(
                    code_hash="8" * 64,
                    external_subject=legacy_subject,
                    state="unowned-legacy-state",
                    login_session_id="unowned-legacy-login",
                    expires_at=datetime.now(UTC) + timedelta(minutes=5),
                ),
                FoodLogDB(
                    product_name="Must remain with unowned authorization",
                    calories=11,
                    owner_id=user_id,
                ),
            ]
        )
        session.commit()

    response = authenticated_client.request(
        "DELETE",
        "/api/identity/account",
        json=_confirmation(user_id),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Account authorization history requires operator review before erasure"
    )
    with Session(db_module.engine) as session:
        assert session.get(CalorieAppUserDB, user_id) is not None
        assert session.exec(
            select(FoodLogDB).where(FoodLogDB.owner_id == user_id)
        ).one().product_name == "Must remain with unowned authorization"
        assert session.exec(
            select(AuthorizationCodeDB).where(
                AuthorizationCodeDB.external_subject == legacy_subject
            )
        ).one().used_at is None


def test_account_erasure_clears_other_users_inbound_session_replacement_reference(
    authenticated_client: TestClient,
    monkeypatch,
) -> None:
    user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    monkeypatch.setattr(main_module, "_ACCOUNT_ERASURE_ENABLED", True)
    now = datetime.now(UTC)

    with Session(db_module.engine) as session:
        target_session = session.exec(
            select(AuthSessionDB).where(AuthSessionDB.calorieapp_user_id == user_id)
        ).one()
        other_user = CalorieAppUserDB(status="active")
        session.add(other_user)
        session.flush()
        other_session = AuthSessionDB(
            session_token_hash="9" * 64,
            calorieapp_user_id=other_user.id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(hours=1),
            replaced_by_session_id=target_session.id,
        )
        session.add(other_session)
        session.commit()
        other_user_id = other_user.id
        other_session_id = other_session.id

    response = authenticated_client.request(
        "DELETE",
        "/api/identity/account",
        json=_confirmation(user_id),
    )

    assert response.status_code == 200
    with Session(db_module.engine) as session:
        assert session.get(CalorieAppUserDB, user_id) is None
        assert session.get(CalorieAppUserDB, other_user_id) is not None
        preserved_session = session.get(AuthSessionDB, other_session_id)
        assert preserved_session is not None
        assert preserved_session.replaced_by_session_id is None
