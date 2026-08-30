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
                    code_hash="2" * 64,
                    external_subject=own_subject,
                    state="own-state",
                    login_session_id="own-login",
                    expires_at=now + timedelta(minutes=5),
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
            select(AuthorizationCodeDB).where(
                AuthorizationCodeDB.external_subject == own_subject
            )
        ).all() == []
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
