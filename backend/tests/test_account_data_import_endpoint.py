"""Authenticated, disabled-by-default account-data import route tests."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

import app.database as db_module
import app.main as main_module
from app.account_data_import import REQUIRED_EXCLUDED_SECURITY_FIELDS
from app.account_data_import_release import (
    ACCOUNT_DATA_IMPORT_ACKNOWLEDGEMENT,
    ACCOUNT_DATA_IMPORT_REQUEST_VALUE,
    AccountDataImportReleaseGateError,
    require_account_data_import_release_gate,
)
from app.models import AccountDataImportReceiptDB, FoodLogDB


SOURCE_USER_ID = "00000000-0000-0000-0000-000000000081"
REVIEWED_COMMIT_SHA = "a" * 40


def _payload() -> bytes:
    return json.dumps(
        {
            "export_version": "calorieapp-account-data-v1",
            "exported_at": "2026-09-02T12:00:00Z",
            "account": {
                "user_id": SOURCE_USER_ID,
                "status": "active",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-08-01T00:00:00Z",
                "last_authenticated_activity_at": "2026-09-01T12:00:00Z",
            },
            "external_identities": [],
            "food_logs": [
                {
                    "id": 81,
                    "product_name": "Portable synthetic pear",
                    "calories": 57.0,
                    "protein": 0.4,
                    "fat": 0.1,
                    "carbohydrates": 15.0,
                    "portion_percentage": 100.0,
                    "barcode": None,
                    "image_url": None,
                    "brand": "Synthetic orchard",
                    "serving_size": "100 g",
                    "nutri_score": "A",
                    "created_at": "2026-08-31T10:30:00Z",
                }
            ],
            "authentication_sessions": [],
            "authorization_events": [],
            "login_handoffs": [],
            "inactive_account_notices": [],
            "excluded_security_fields": sorted(REQUIRED_EXCLUDED_SECURITY_FIELDS),
        },
        separators=(",", ":"),
    ).encode("utf-8")


def _enable_reviewed_test_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main_module, "_ACCOUNT_DATA_IMPORT_ENABLED", True)
    monkeypatch.setattr(main_module, "_CALORIEAPP_ENV", "test")
    monkeypatch.setattr(
        main_module,
        "_ACCOUNT_DATA_IMPORT_APPROVED_COMMIT_SHA",
        REVIEWED_COMMIT_SHA,
    )
    monkeypatch.setattr(
        main_module,
        "_CALORIEAPP_RELEASE_COMMIT_SHA",
        REVIEWED_COMMIT_SHA,
    )


def _headers(target_user_id: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-CalorieApp-Request": ACCOUNT_DATA_IMPORT_REQUEST_VALUE,
        "X-CalorieApp-Import-Source-Account": SOURCE_USER_ID,
        "X-CalorieApp-Import-Target-Account": target_user_id,
        "X-CalorieApp-Import-Acknowledgement": (
            ACCOUNT_DATA_IMPORT_ACKNOWLEDGEMENT
        ),
    }


def test_account_data_import_is_disabled_by_default(
    authenticated_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    target_user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    monkeypatch.setattr(main_module, "_ACCOUNT_DATA_IMPORT_ENABLED", False)

    response = authenticated_client.post(
        "/api/identity/import",
        content=_payload(),
        headers=_headers(target_user_id),
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Account data import is not enabled"}
    assert response.headers["cache-control"] == "no-store"
    with Session(db_module.engine) as session:
        assert session.exec(select(FoodLogDB)).all() == []
        assert session.exec(select(AccountDataImportReceiptDB)).all() == []


def test_account_data_import_requires_authentication(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_reviewed_test_gate(monkeypatch)

    response = client.post(
        "/api/identity/import",
        content=_payload(),
        headers=_headers("untrusted-target"),
    )

    assert response.status_code == 401


def test_account_data_import_commits_only_food_history_to_authenticated_target(
    authenticated_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_reviewed_test_gate(monkeypatch)
    target_user_id = authenticated_client.get("/api/identity/me").json()["user_id"]

    response = authenticated_client.post(
        "/api/identity/import",
        content=_payload(),
        headers=_headers(target_user_id),
    )

    assert response.status_code == 200
    assert response.json() == {
        "import_version": "calorieapp-account-data-import-transaction-v1",
        "status": "imported",
        "imported_food_log_rows": 1,
    }
    assert response.headers["cache-control"] == "no-store"
    with Session(db_module.engine) as session:
        food_logs = session.exec(select(FoodLogDB)).all()
        receipts = session.exec(select(AccountDataImportReceiptDB)).all()
        assert len(food_logs) == 1
        assert food_logs[0].owner_id == target_user_id
        assert food_logs[0].product_name == "Portable synthetic pear"
        assert len(receipts) == 1
        assert receipts[0].target_account_id == target_user_id
        assert SOURCE_USER_ID not in repr(receipts[0])


def test_account_data_import_exact_replay_is_a_zero_write_success(
    authenticated_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_reviewed_test_gate(monkeypatch)
    target_user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    headers = _headers(target_user_id)

    first = authenticated_client.post(
        "/api/identity/import",
        content=_payload(),
        headers=headers,
    )
    replay = authenticated_client.post(
        "/api/identity/import",
        content=_payload(),
        headers=headers,
    )

    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json()["status"] == "already_imported"
    assert replay.json()["imported_food_log_rows"] == 0
    with Session(db_module.engine) as session:
        assert len(session.exec(select(FoodLogDB)).all()) == 1
        assert len(session.exec(select(AccountDataImportReceiptDB)).all()) == 1


@pytest.mark.parametrize(
    ("header_update", "expected_status"),
    [
        ({"X-CalorieApp-Request": "wrong-purpose"}, 403),
        ({"X-CalorieApp-Import-Acknowledgement": "not-approved"}, 409),
        ({"X-CalorieApp-Import-Target-Account": "other-account"}, 409),
        ({"X-CalorieApp-Import-Source-Account": "other-source"}, 422),
    ],
)
def test_account_data_import_requires_exact_request_and_account_confirmations(
    authenticated_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    header_update: dict[str, str],
    expected_status: int,
) -> None:
    _enable_reviewed_test_gate(monkeypatch)
    target_user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    headers = {**_headers(target_user_id), **header_update}

    response = authenticated_client.post(
        "/api/identity/import",
        content=_payload(),
        headers=headers,
    )

    assert response.status_code == expected_status
    with Session(db_module.engine) as session:
        assert session.exec(select(FoodLogDB)).all() == []
        assert session.exec(select(AccountDataImportReceiptDB)).all() == []


def test_account_data_import_returns_bounded_validation_error_without_private_values(
    authenticated_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_reviewed_test_gate(monkeypatch)
    target_user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    private_value = "private-food-value-that-must-not-be-reflected"

    response = authenticated_client.post(
        "/api/identity/import",
        content=json.dumps({"private": private_value}).encode("utf-8"),
        headers=_headers(target_user_id),
    )

    assert response.status_code == 422
    assert private_value not in response.text


def test_account_data_import_rejects_non_json_media_type(
    authenticated_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_reviewed_test_gate(monkeypatch)
    target_user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    headers = _headers(target_user_id)
    headers["Content-Type"] = "text/plain"

    response = authenticated_client.post(
        "/api/identity/import",
        content=_payload(),
        headers=headers,
    )

    assert response.status_code == 415


def test_account_data_import_rejects_a_nonclean_target_without_partial_writes(
    authenticated_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_reviewed_test_gate(monkeypatch)
    target_user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    with Session(db_module.engine) as session:
        session.add(
            FoodLogDB(
                owner_id=target_user_id,
                product_name="Existing private food",
                calories=1,
            )
        )
        session.commit()

    response = authenticated_client.post(
        "/api/identity/import",
        content=_payload(),
        headers=_headers(target_user_id),
    )

    assert response.status_code == 409
    with Session(db_module.engine) as session:
        food_logs = session.exec(select(FoodLogDB)).all()
        assert [food_log.product_name for food_log in food_logs] == [
            "Existing private food"
        ]
        assert session.exec(select(AccountDataImportReceiptDB)).all() == []


@pytest.mark.parametrize(
    ("environment", "approved_sha", "running_sha"),
    [
        ("production", REVIEWED_COMMIT_SHA, REVIEWED_COMMIT_SHA),
        ("staging", "", REVIEWED_COMMIT_SHA),
        ("staging", REVIEWED_COMMIT_SHA, "b" * 40),
        ("staging", REVIEWED_COMMIT_SHA.upper(), REVIEWED_COMMIT_SHA.upper()),
    ],
)
def test_account_data_import_release_gate_rejects_unreviewed_execution(
    environment: str,
    approved_sha: str,
    running_sha: str,
) -> None:
    with pytest.raises(AccountDataImportReleaseGateError):
        require_account_data_import_release_gate(
            enabled=True,
            environment=environment,
            approved_commit_sha=approved_sha,
            running_commit_sha=running_sha,
        )


def test_account_data_import_release_gate_returns_bounded_commit_reference() -> None:
    assert require_account_data_import_release_gate(
        enabled=True,
        environment="staging",
        approved_commit_sha=REVIEWED_COMMIT_SHA,
        running_commit_sha=REVIEWED_COMMIT_SHA,
    ) == f"reviewed-import-commit:{REVIEWED_COMMIT_SHA}"
