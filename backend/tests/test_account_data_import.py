"""Safety tests for pure account-data import planning."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import fields
from datetime import datetime
import inspect
import json

import pytest

import app.account_data_import as import_module
from app.account_data_import import (
    IMPORT_PLAN_VERSION,
    REQUIRED_EXCLUDED_SECURITY_FIELDS,
    SUPPORTED_EXPORT_VERSION,
    AccountDataImportPlan,
    AccountDataImportSafetyError,
    plan_account_data_import,
)


SOURCE_USER_ID = "00000000-0000-0000-0000-000000000071"
TARGET_USER_ID = "00000000-0000-0000-0000-000000000072"


def _payload() -> dict[str, object]:
    return {
        "export_version": SUPPORTED_EXPORT_VERSION,
        "exported_at": "2026-09-02T12:00:00Z",
        "account": {
            "user_id": SOURCE_USER_ID,
            "status": "active",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-08-01T00:00:00Z",
            "last_authenticated_activity_at": "2026-09-01T12:00:00Z",
        },
        "external_identities": [
            {
                "provider": "synthetic-provider",
                "external_subject": "private-external-subject",
                "xrpl_address": None,
                "created_at": "2026-01-01T00:00:00Z",
                "last_verified_at": "2026-09-01T12:00:00Z",
            }
        ],
        "food_logs": [
            {
                "id": 41,
                "product_name": "Portable apple",
                "calories": 52.0,
                "protein": 0.3,
                "fat": 0.2,
                "carbohydrates": 14.0,
                "portion_percentage": 100.0,
                "barcode": "synthetic-barcode",
                "image_url": None,
                "brand": "Synthetic orchard",
                "serving_size": "100 g",
                "nutri_score": "A",
                "created_at": "2026-08-31T10:30:00Z",
            }
        ],
        "authentication_sessions": [
            {
                "created_at": "2026-09-01T11:00:00Z",
                "last_seen_at": "2026-09-01T12:00:00Z",
                "expires_at": "2026-09-01T19:00:00Z",
                "revoked_at": None,
            }
        ],
        "authorization_events": [],
        "login_handoffs": [
            {
                "status": "claimed",
                "created_at": "2026-09-01T10:59:00Z",
                "expires_at": "2026-09-01T11:04:00Z",
                "completed_at": "2026-09-01T11:00:00Z",
                "claimed_at": "2026-09-01T11:00:01Z",
                "failure_code": None,
            }
        ],
        "inactive_account_notices": [
            {
                "status": "cancelled",
                "activity_anchor_at": "2024-01-01T00:00:00Z",
                "notice_window_started_at": "2025-12-02T00:00:00Z",
                "retention_due_at": "2026-01-01T00:00:00Z",
                "delivered_at": "2025-12-05T00:00:00Z",
                "delivery_channel": "synthetic-channel",
                "cancelled_at": "2025-12-06T00:00:00Z",
                "recorded_at": "2025-12-05T00:00:01Z",
            }
        ],
        "excluded_security_fields": sorted(REQUIRED_EXCLUDED_SECURITY_FIELDS),
    }


def _encoded(payload: dict[str, object] | None = None, **json_options) -> bytes:
    selected_payload = _payload() if payload is None else payload
    return json.dumps(selected_payload, **json_options).encode("utf-8")


def _plan(payload: bytes | None = None, **overrides) -> AccountDataImportPlan:
    values = {
        "payload": _encoded() if payload is None else payload,
        "confirmed_source_user_id": SOURCE_USER_ID,
        "target_user_id": TARGET_USER_ID,
    }
    values.update(overrides)
    return plan_account_data_import(**values)


def test_planner_prepares_only_newly_owned_food_log_values() -> None:
    plan = _plan()

    assert plan.plan_version == IMPORT_PLAN_VERSION
    assert plan.export_version == SUPPORTED_EXPORT_VERSION
    assert plan.source_account_id == SOURCE_USER_ID
    assert plan.target_account_id == TARGET_USER_ID
    assert plan.exported_at == datetime(2026, 9, 2, 12)
    assert len(plan.private_import_digest) == 64
    int(plan.private_import_digest, 16)
    assert len(plan.food_logs) == 1

    food_log = plan.food_logs[0]
    assert food_log.source_record_id == 41
    assert food_log.target_owner_id == TARGET_USER_ID
    assert food_log.product_name == "Portable apple"
    assert food_log.created_at == datetime(2026, 8, 31, 10, 30)
    insert_values = food_log.as_insert_values()
    assert insert_values["owner_id"] == TARGET_USER_ID
    assert insert_values["product_name"] == "Portable apple"
    assert "id" not in insert_values
    assert "source_record_id" not in insert_values

    assert plan.ignored_collection_counts == (
        ("external_identities", 1),
        ("authentication_sessions", 1),
        ("authorization_events", 0),
        ("login_handoffs", 1),
        ("inactive_account_notices", 1),
    )
    private_plan_text = repr(plan)
    assert "private-external-subject" not in private_plan_text
    assert "synthetic-channel" not in private_plan_text
    assert {field.name for field in fields(plan)} == {
        "plan_version",
        "export_version",
        "private_import_digest",
        "source_account_id",
        "target_account_id",
        "exported_at",
        "food_logs",
        "ignored_collection_counts",
    }


def test_digest_is_stable_across_json_whitespace_and_key_order() -> None:
    compact = _plan(_encoded(separators=(",", ":")))
    reordered = _plan(_encoded(sort_keys=True, indent=2))

    assert compact == reordered
    different_target = _plan(target_user_id="different-target-user")
    assert different_target.private_import_digest != compact.private_import_digest


def test_source_account_requires_explicit_exact_confirmation() -> None:
    with pytest.raises(AccountDataImportSafetyError, match="confirmation"):
        _plan(confirmed_source_user_id="different-source-user")


@pytest.mark.parametrize(
    ("identifier_field", "identifier"),
    [
        ("confirmed_source_user_id", ""),
        ("confirmed_source_user_id", f" {SOURCE_USER_ID}"),
        ("target_user_id", ""),
        ("target_user_id", "é" * 128),
    ],
)
def test_source_and_target_identifiers_are_exact_and_bounded(
    identifier_field: str,
    identifier: str,
) -> None:
    with pytest.raises(AccountDataImportSafetyError, match=identifier_field):
        _plan(**{identifier_field: identifier})


@pytest.mark.parametrize("location", ["top", "account", "food_log"])
def test_unreviewed_fields_are_rejected_at_every_portable_boundary(
    location: str,
) -> None:
    payload = _payload()
    if location == "top":
        payload["session_token_hash"] = "secret"
    elif location == "account":
        payload["account"]["session_token_hash"] = "secret"
    else:
        payload["food_logs"][0]["owner_id"] = "untrusted-owner"

    with pytest.raises(AccountDataImportSafetyError, match="reviewed v1 fields"):
        _plan(_encoded(payload))


def test_duplicate_json_keys_are_rejected_before_schema_validation() -> None:
    duplicate = (
        b'{"export_version":"calorieapp-account-data-v1",'
        b'"export_version":"calorieapp-account-data-v1"}'
    )

    with pytest.raises(AccountDataImportSafetyError, match="duplicate JSON key"):
        _plan(duplicate)


@pytest.mark.parametrize(
    "invalid_payload",
    [
        b"",
        b"[]",
        b"{not-json}",
        b"\xff",
    ],
)
def test_payload_must_be_nonempty_utf8_json_object(invalid_payload: bytes) -> None:
    with pytest.raises(AccountDataImportSafetyError):
        _plan(invalid_payload)


def test_payload_byte_limit_is_checked_before_decoding(monkeypatch) -> None:
    monkeypatch.setattr(import_module, "MAXIMUM_IMPORT_BYTES", 10)

    with pytest.raises(AccountDataImportSafetyError, match="byte limit"):
        _plan(b"\xff" * 11)


def test_pathological_json_integer_has_a_bounded_safety_error() -> None:
    pathological = b'{"number":' + (b"9" * 5_000) + b"}"

    with pytest.raises(AccountDataImportSafetyError, match="bounded JSON"):
        _plan(pathological)


def test_collection_item_limit_fails_closed(monkeypatch) -> None:
    payload = _payload()
    payload["food_logs"].append(deepcopy(payload["food_logs"][0]))
    monkeypatch.setattr(import_module, "MAXIMUM_COLLECTION_ITEMS", 1)

    with pytest.raises(AccountDataImportSafetyError, match="item limit"):
        _plan(_encoded(payload))


@pytest.mark.parametrize(
    "invalid_exclusions",
    [
        [],
        [*sorted(REQUIRED_EXCLUDED_SECURITY_FIELDS), "session_token_hash"],
        [
            field
            for field in sorted(REQUIRED_EXCLUDED_SECURITY_FIELDS)
            if field != "session_token_hash"
        ],
    ],
)
def test_security_exclusion_boundary_must_match_exactly(
    invalid_exclusions: list[str],
) -> None:
    payload = _payload()
    payload["excluded_security_fields"] = invalid_exclusions

    with pytest.raises(AccountDataImportSafetyError, match="security_fields"):
        _plan(_encoded(payload))


def test_authorization_activity_cannot_be_rehydrated_from_v1() -> None:
    payload = _payload()
    payload["authorization_events"] = [
        {
            "external_subject": "unowned-legacy-subject",
            "created_at": "2026-01-01T00:00:00Z",
            "expires_at": "2026-01-01T00:05:00Z",
            "used_at": None,
            "used_by_ip": None,
        }
    ]

    with pytest.raises(AccountDataImportSafetyError, match="must remain empty"):
        _plan(_encoded(payload))


@pytest.mark.parametrize("source_id", [0, -1])
def test_food_log_source_ids_must_be_positive(source_id: int) -> None:
    payload = _payload()
    payload["food_logs"][0]["id"] = source_id

    with pytest.raises(AccountDataImportSafetyError, match="positive"):
        _plan(_encoded(payload))


def test_duplicate_food_log_source_ids_are_rejected() -> None:
    payload = _payload()
    payload["food_logs"].append(deepcopy(payload["food_logs"][0]))

    with pytest.raises(AccountDataImportSafetyError, match="unique"):
        _plan(_encoded(payload))


@pytest.mark.parametrize(
    ("timestamp_path", "timestamp"),
    [
        (("exported_at",), "2026-09-02T12:00:00"),
        (("account", "created_at"), "2026-01-01T00:00:00"),
        (("food_logs", 0, "created_at"), "2026-08-31T10:30:00"),
    ],
)
def test_imported_timestamps_require_explicit_timezones(
    timestamp_path: tuple[str | int, ...],
    timestamp: str,
) -> None:
    payload = _payload()
    selected = payload
    for part in timestamp_path[:-1]:
        selected = selected[part]
    selected[timestamp_path[-1]] = timestamp

    with pytest.raises(AccountDataImportSafetyError, match="timezone"):
        _plan(_encoded(payload))


def test_account_and_food_log_timeline_must_precede_export() -> None:
    account_payload = _payload()
    account_payload["account"]["updated_at"] = "2026-09-03T00:00:00Z"
    with pytest.raises(AccountDataImportSafetyError, match="account timestamps"):
        _plan(_encoded(account_payload))

    food_payload = _payload()
    food_payload["food_logs"][0]["created_at"] = "2026-09-03T00:00:00Z"
    with pytest.raises(AccountDataImportSafetyError, match="food log"):
        _plan(_encoded(food_payload))


def test_wrong_version_invalid_values_and_nonfinite_numbers_fail_closed() -> None:
    wrong_version = _payload()
    wrong_version["export_version"] = "calorieapp-account-data-v2"
    with pytest.raises(AccountDataImportSafetyError, match="not supported"):
        _plan(_encoded(wrong_version))

    invalid_product = _payload()
    invalid_product["food_logs"][0]["product_name"] = ""
    with pytest.raises(AccountDataImportSafetyError, match="schema"):
        _plan(_encoded(invalid_product))

    nonfinite = _payload()
    nonfinite["food_logs"][0]["calories"] = float("nan")
    with pytest.raises(AccountDataImportSafetyError, match="non-finite"):
        _plan(_encoded(nonfinite))


def test_schema_errors_do_not_retain_private_validation_details() -> None:
    payload = _payload()
    private_invalid_value = "private-invalid-product-name" * 10
    payload["food_logs"][0]["product_name"] = private_invalid_value

    with pytest.raises(AccountDataImportSafetyError) as exc_info:
        _plan(_encoded(payload))

    assert private_invalid_value not in str(exc_info.value)
    assert exc_info.value.__cause__ is None


@pytest.mark.parametrize(
    ("field", "value"),
    [("id", "41"), ("calories", "52")],
)
def test_portable_numbers_are_not_coerced_from_strings(
    field: str,
    value: str,
) -> None:
    payload = _payload()
    payload["food_logs"][0][field] = value

    with pytest.raises(AccountDataImportSafetyError, match="schema"):
        _plan(_encoded(payload))


def test_planner_module_has_no_database_network_or_endpoint_capability() -> None:
    source = inspect.getsource(import_module)

    assert "sqlmodel" not in source
    assert "requests" not in source
    assert "@app." not in source
    assert ".commit(" not in source
