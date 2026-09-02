"""Safety tests for pure account-data import planning."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import fields, replace
from datetime import datetime
import inspect
import json

import pytest
from sqlmodel import Session, create_engine, select
from sqlmodel.pool import StaticPool

import app.account_data_import as import_module
import app.account_data_import_admission as admission_module
import app.account_data_import_transaction as transaction_module
from app.account_data_import import (
    CURRENT_EXPORT_VERSION,
    IMPORT_PLAN_VERSION,
    LEGACY_EXPORT_VERSION,
    REQUIRED_EXCLUDED_SECURITY_FIELDS,
    SUPPORTED_EXPORT_VERSIONS,
    V1_REQUIRED_EXCLUDED_SECURITY_FIELDS,
    AccountDataImportPlan,
    AccountDataImportSafetyError,
    plan_account_data_import,
)
from app.account_data_import_admission import (
    FOOD_LOG_IMPORT_TARGET_LIMIT,
    IMPORT_ADMISSION_VERSION,
    IMPORT_DUPLICATE_POLICY,
    AccountDataImportAdmissionError,
    admit_account_data_import,
)
from app.account_data_import_transaction import (
    IMPORT_TRANSACTION_VERSION,
    AccountDataImportTransactionSafetyError,
    execute_account_data_import_transaction,
)
from app.data_growth import FOOD_LOG_SUBJECT_ENTRY_LIMIT
from app.models import (
    AccountDataImportReceiptDB,
    CalorieAppUserDB,
    FoodLogDB,
)
from app.schema_migrations import upgrade_database


SOURCE_USER_ID = "00000000-0000-0000-0000-000000000071"
TARGET_USER_ID = "00000000-0000-0000-0000-000000000072"


def _payload(
    export_version: str = CURRENT_EXPORT_VERSION,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "export_version": export_version,
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
        "excluded_security_fields": sorted(
            V1_REQUIRED_EXCLUDED_SECURITY_FIELDS
            if export_version == LEGACY_EXPORT_VERSION
            else REQUIRED_EXCLUDED_SECURITY_FIELDS
        ),
    }
    if export_version == CURRENT_EXPORT_VERSION:
        payload["account_import_receipts"] = [
            {
                "imported_at": "2026-08-30T09:00:00Z",
                "food_log_count": 1,
                "source_export_version": LEGACY_EXPORT_VERSION,
                "import_plan_version": IMPORT_PLAN_VERSION,
            }
        ]
    return payload


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


def _admit(plan: AccountDataImportPlan | None = None, **overrides):
    values = {
        "plan": _plan() if plan is None else plan,
        "authenticated_target_account_id": TARGET_USER_ID,
        "confirmed_target_account_id": TARGET_USER_ID,
        "existing_target_food_log_count": 0,
        "private_digest_already_recorded": False,
        "any_private_receipt_recorded": False,
    }
    values.update(overrides)
    return admit_account_data_import(**values)


def test_planner_prepares_only_newly_owned_food_log_values() -> None:
    plan = _plan()

    assert plan.plan_version == IMPORT_PLAN_VERSION
    assert plan.export_version == CURRENT_EXPORT_VERSION
    assert plan.export_version in SUPPORTED_EXPORT_VERSIONS
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
        ("account_import_receipts", 1),
    )
    private_plan_text = repr(plan)
    assert private_plan_text == "AccountDataImportPlan(<private>)"
    assert plan.private_import_digest not in private_plan_text
    assert SOURCE_USER_ID not in private_plan_text
    assert TARGET_USER_ID not in private_plan_text
    assert "Portable apple" not in private_plan_text
    assert repr(food_log) == "PlannedFoodLogImport(<private>)"
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


def test_legacy_v1_export_remains_supported_without_receipt_summaries() -> None:
    payload = _payload(LEGACY_EXPORT_VERSION)

    assert "account_import_receipts" not in payload
    plan = _plan(_encoded(payload))

    assert plan.export_version == LEGACY_EXPORT_VERSION
    assert plan.ignored_collection_counts == (
        ("external_identities", 1),
        ("authentication_sessions", 1),
        ("authorization_events", 0),
        ("login_handoffs", 1),
        ("inactive_account_notices", 1),
    )


def test_export_without_food_logs_is_not_importable() -> None:
    payload = _payload()
    payload["food_logs"] = []

    with pytest.raises(AccountDataImportSafetyError, match="at least one food"):
        _plan(_encoded(payload))


def test_v2_receipt_summaries_are_validated_but_never_planned_for_restore() -> None:
    payload = _payload()
    payload["account_import_receipts"][0]["private_import_digest"] = "a" * 64

    with pytest.raises(AccountDataImportSafetyError, match="reviewed fields"):
        _plan(_encoded(payload))

    del payload["account_import_receipts"][0]["private_import_digest"]
    plan = _plan(_encoded(payload))
    assert not hasattr(plan, "account_import_receipts")
    assert ("account_import_receipts", 1) in plan.ignored_collection_counts


def test_digest_is_stable_across_json_whitespace_and_key_order() -> None:
    compact = _plan(_encoded(separators=(",", ":")))
    reordered = _plan(_encoded(sort_keys=True, indent=2))
    reversed_exclusions_payload = _payload()
    reversed_exclusions_payload["excluded_security_fields"] = list(
        reversed(reversed_exclusions_payload["excluded_security_fields"])
    )
    reversed_exclusions = _plan(_encoded(reversed_exclusions_payload))

    assert compact == reordered
    assert (
        compact.private_import_digest
        == reversed_exclusions.private_import_digest
    )
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

    with pytest.raises(AccountDataImportSafetyError, match="reviewed fields"):
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
    # Syntactically valid JSON; Python's integer-digit limit rejects it safely.
    pathological = f'{{"number":{"9" * 5_000}}}'.encode("ascii")

    with pytest.raises(AccountDataImportSafetyError, match="bounded JSON"):
        _plan(pathological)


def test_large_json_integer_in_unreviewed_shape_fails_closed() -> None:
    large_but_parseable = f'{{"number":{"9" * 1_000}}}'.encode("ascii")

    with pytest.raises(AccountDataImportSafetyError, match="not supported"):
        _plan(large_but_parseable)


@pytest.mark.parametrize("invalid_version", [None, 2, [], {}])
def test_non_string_export_versions_fail_closed(
    invalid_version: object,
) -> None:
    payload = _payload()
    payload["export_version"] = invalid_version

    with pytest.raises(AccountDataImportSafetyError, match="not supported"):
        _plan(_encoded(payload))


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


def test_authorization_activity_cannot_be_rehydrated() -> None:
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
        (("account_import_receipts", 0, "imported_at"), "2026-08-30T09:00:00"),
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

    receipt_payload = _payload()
    receipt_payload["account_import_receipts"][0]["imported_at"] = (
        "2026-09-03T00:00:00Z"
    )
    with pytest.raises(AccountDataImportSafetyError, match="import receipt"):
        _plan(_encoded(receipt_payload))


def test_wrong_version_invalid_values_and_nonfinite_numbers_fail_closed() -> None:
    wrong_version = _payload()
    wrong_version["export_version"] = "calorieapp-account-data-v3"
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


def test_import_admission_accepts_only_a_clean_target_within_budget() -> None:
    plan = _plan()
    admission = _admit(plan)

    assert admission.admission_version == IMPORT_ADMISSION_VERSION
    assert admission.action == "prepare_insert"
    assert admission.duplicate_policy == IMPORT_DUPLICATE_POLICY
    assert admission.plan is plan
    assert admission.existing_target_food_log_count == 0
    assert admission.planned_insert_count == 1
    assert admission.food_log_limit == FOOD_LOG_IMPORT_TARGET_LIMIT
    assert repr(admission) == "AccountDataImportAdmission(<private>)"
    assert plan.private_import_digest not in repr(admission)
    assert TARGET_USER_ID not in repr(admission)
    assert "Portable apple" not in repr(admission)


def test_import_admission_limit_matches_live_food_log_subject_budget() -> None:
    assert FOOD_LOG_IMPORT_TARGET_LIMIT == FOOD_LOG_SUBJECT_ENTRY_LIMIT == 10_000


def test_exact_recorded_digest_is_an_idempotent_noop_even_at_capacity() -> None:
    admission = _admit(
        existing_target_food_log_count=FOOD_LOG_IMPORT_TARGET_LIMIT,
        private_digest_already_recorded=True,
        any_private_receipt_recorded=True,
    )

    assert admission.action == "idempotent_noop"
    assert admission.planned_insert_count == 0


def test_new_import_into_nonempty_target_fails_closed_without_content_dedup() -> None:
    with pytest.raises(AccountDataImportAdmissionError, match="not clean"):
        _admit(existing_target_food_log_count=1)


def test_new_import_rejects_prior_private_import_history() -> None:
    with pytest.raises(AccountDataImportAdmissionError, match="import history"):
        _admit(any_private_receipt_recorded=True)


def test_exact_receipt_evidence_cannot_contradict_receipt_history() -> None:
    with pytest.raises(AccountDataImportAdmissionError, match="inconsistent"):
        _admit(private_digest_already_recorded=True)


def test_distinct_source_rows_with_equal_food_content_are_preserved() -> None:
    payload = _payload()
    second_food_log = deepcopy(payload["food_logs"][0])
    second_food_log["id"] = 42
    payload["food_logs"].append(second_food_log)

    admission = _admit(_plan(_encoded(payload)))

    assert admission.action == "prepare_insert"
    assert admission.planned_insert_count == 2
    assert [item.source_record_id for item in admission.plan.food_logs] == [41, 42]


def test_import_larger_than_available_target_budget_fails_closed() -> None:
    payload = _payload()
    second_food_log = deepcopy(payload["food_logs"][0])
    second_food_log["id"] = 42
    payload["food_logs"].append(second_food_log)

    with pytest.raises(AccountDataImportAdmissionError, match="capacity"):
        _admit(_plan(_encoded(payload)), food_log_limit=1)


@pytest.mark.parametrize(
    ("override", "message"),
    [
        (
            {"authenticated_target_account_id": SOURCE_USER_ID},
            "authenticated target account",
        ),
        (
            {"confirmed_target_account_id": SOURCE_USER_ID},
            "confirmed target account",
        ),
    ],
)
def test_import_admission_requires_authenticated_and_confirmed_exact_target(
    override: dict[str, object],
    message: str,
) -> None:
    with pytest.raises(AccountDataImportAdmissionError, match=message):
        _admit(**override)


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"existing_target_food_log_count": -1}, "non-negative integer"),
        ({"existing_target_food_log_count": True}, "non-negative integer"),
        ({"food_log_limit": 0}, "positive integer"),
        ({"food_log_limit": True}, "positive integer"),
        (
            {"food_log_limit": FOOD_LOG_IMPORT_TARGET_LIMIT + 1},
            "reviewed maximum",
        ),
        ({"private_digest_already_recorded": 1}, "must be a boolean"),
        ({"any_private_receipt_recorded": 1}, "must be a boolean"),
    ],
)
def test_import_admission_rejects_ambiguous_control_values(
    override: dict[str, object],
    message: str,
) -> None:
    with pytest.raises(AccountDataImportAdmissionError, match=message):
        _admit(**override)


@pytest.mark.parametrize(
    "invalid_plan",
    [
        replace(_plan(), plan_version="unreviewed-plan-version"),
        replace(_plan(), export_version=[]),
        replace(_plan(), private_import_digest="A" * 64),
        replace(_plan(), private_import_digest=1),
        replace(_plan(), food_logs=[]),
        replace(_plan(), food_logs=()),
        replace(
            _plan(),
            food_logs=(
                replace(_plan().food_logs[0], target_owner_id=SOURCE_USER_ID),
            ),
        ),
    ],
)
def test_import_admission_revalidates_private_plan_integrity(
    invalid_plan: AccountDataImportPlan,
) -> None:
    with pytest.raises(AccountDataImportAdmissionError):
        _admit(invalid_plan)


def test_import_admission_module_has_no_database_network_or_endpoint_capability() -> None:
    source = inspect.getsource(admission_module)

    assert "sqlmodel" not in source
    assert "requests" not in source
    assert "@app." not in source
    assert ".commit(" not in source


def _transaction_engine(*, target_status: str = "active"):
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    upgrade_database(test_engine)
    with Session(test_engine) as session:
        session.add(CalorieAppUserDB(id=TARGET_USER_ID, status=target_status))
        session.commit()
    return test_engine


def _execute_transaction(session: Session, plan=None, **overrides):
    values = {
        "session": session,
        "plan": _plan() if plan is None else plan,
        "authenticated_target_account_id": TARGET_USER_ID,
        "confirmed_target_account_id": TARGET_USER_ID,
        "environment": "test",
        "execute": True,
        "approval_reference": "synthetic-account-import-test",
    }
    values.update(overrides)
    return execute_account_data_import_transaction(**values)


def test_account_import_transaction_stages_private_rows_for_caller_rollback() -> None:
    test_engine = _transaction_engine()
    try:
        plan = _plan()
        with Session(test_engine) as session:
            result = _execute_transaction(session, plan)

            assert result.action == "staged_insert"
            assert result.staged_food_log_rows == 1
            assert result.staged_receipt_rows == 1
            assert len(result.approval_reference_sha256) == 64
            assert repr(result) == "AccountDataImportTransactionResult(<private>)"
            payload = result.as_payload()
            assert payload["transaction_version"] == IMPORT_TRANSACTION_VERSION
            assert payload["caller_commit_required"] is True
            assert TARGET_USER_ID not in str(payload)
            assert plan.private_import_digest not in str(payload)

            staged_log = session.exec(select(FoodLogDB)).one()
            staged_receipt = session.exec(
                select(AccountDataImportReceiptDB)
            ).one()
            assert staged_log.owner_id == TARGET_USER_ID
            assert staged_log.product_name == "Portable apple"
            assert staged_receipt.target_account_id == TARGET_USER_ID
            assert staged_receipt.private_import_digest == plan.private_import_digest
            assert staged_receipt.food_log_count == 1
            assert repr(staged_receipt) == "AccountDataImportReceiptDB(<private>)"
            session.rollback()

        with Session(test_engine) as session:
            assert session.exec(select(FoodLogDB)).all() == []
            assert session.exec(select(AccountDataImportReceiptDB)).all() == []
            assert session.get(CalorieAppUserDB, TARGET_USER_ID) is not None
    finally:
        test_engine.dispose()


def test_account_import_transaction_commit_makes_exact_replay_a_noop() -> None:
    test_engine = _transaction_engine()
    try:
        plan = _plan()
        with Session(test_engine) as session:
            created = _execute_transaction(session, plan)
            assert created.action == "staged_insert"
            session.commit()

        with Session(test_engine) as session:
            replay = _execute_transaction(session, plan)
            assert replay.action == "idempotent_noop"
            assert replay.staged_food_log_rows == 0
            assert replay.staged_receipt_rows == 0
            assert replay.as_payload()["caller_commit_required"] is False
            assert len(session.exec(select(FoodLogDB)).all()) == 1
            assert len(session.exec(select(AccountDataImportReceiptDB)).all()) == 1
            session.rollback()
    finally:
        test_engine.dispose()


def test_account_import_transaction_rejects_new_plan_after_logs_are_deleted() -> None:
    test_engine = _transaction_engine()
    try:
        with Session(test_engine) as session:
            created = _execute_transaction(session)
            assert created.action == "staged_insert"
            session.commit()

        with Session(test_engine) as session:
            session.delete(session.exec(select(FoodLogDB)).one())
            session.commit()

        changed_payload = _payload()
        changed_payload["food_logs"][0]["product_name"] = "Different apple"
        changed_plan = _plan(_encoded(changed_payload))
        with Session(test_engine) as session:
            with pytest.raises(
                AccountDataImportTransactionSafetyError,
                match="admission was rejected",
            ):
                _execute_transaction(session, changed_plan)
            assert session.exec(select(FoodLogDB)).all() == []
            assert len(
                session.exec(select(AccountDataImportReceiptDB)).all()
            ) == 1
    finally:
        test_engine.dispose()


def test_account_import_transaction_rejects_a_conflicting_private_receipt() -> None:
    test_engine = _transaction_engine()
    try:
        plan = _plan()
        with Session(test_engine) as session:
            created = _execute_transaction(session, plan)
            assert created.action == "staged_insert"
            session.commit()

        with Session(test_engine) as session:
            receipt = session.exec(select(AccountDataImportReceiptDB)).one()
            receipt.food_log_count = 0
            session.add(receipt)
            session.commit()

            with pytest.raises(
                AccountDataImportTransactionSafetyError,
                match="receipt conflicts",
            ):
                _execute_transaction(session, plan)
            assert len(session.exec(select(FoodLogDB)).all()) == 1
            assert len(session.exec(select(AccountDataImportReceiptDB)).all()) == 1
            session.rollback()
    finally:
        test_engine.dispose()


def test_account_import_transaction_rejects_nonclean_or_inactive_target() -> None:
    test_engine = _transaction_engine()
    try:
        with Session(test_engine) as session:
            session.add(
                FoodLogDB(
                    product_name="Existing private row",
                    calories=1,
                    owner_id=TARGET_USER_ID,
                )
            )
            session.commit()
            with pytest.raises(
                AccountDataImportTransactionSafetyError,
                match="admission was rejected",
            ):
                _execute_transaction(session)
            assert len(session.exec(select(FoodLogDB)).all()) == 1
            assert session.exec(select(AccountDataImportReceiptDB)).all() == []
            session.rollback()
    finally:
        test_engine.dispose()

    inactive_engine = _transaction_engine(target_status="inactive")
    try:
        with Session(inactive_engine) as session:
            with pytest.raises(
                AccountDataImportTransactionSafetyError,
                match="target is unavailable",
            ):
                _execute_transaction(session)
            session.rollback()
    finally:
        inactive_engine.dispose()


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"execute": False}, "disabled by default"),
        ({"environment": "production"}, "non-production"),
        ({"approval_reference": ""}, "approval reference"),
        (
            {"authenticated_target_account_id": SOURCE_USER_ID},
            "admission was rejected",
        ),
    ],
)
def test_account_import_transaction_requires_explicit_bounded_authorization(
    overrides: dict[str, object],
    message: str,
) -> None:
    test_engine = _transaction_engine()
    try:
        with Session(test_engine) as session:
            with pytest.raises(
                AccountDataImportTransactionSafetyError,
                match=message,
            ):
                _execute_transaction(session, **overrides)
            assert session.exec(select(FoodLogDB)).all() == []
            assert session.exec(select(AccountDataImportReceiptDB)).all() == []
            session.rollback()
    finally:
        test_engine.dispose()


def test_account_import_transaction_rejects_pending_session_mutations() -> None:
    test_engine = _transaction_engine()
    try:
        with Session(test_engine) as session:
            session.add(
                FoodLogDB(
                    product_name="Unrelated pending row",
                    calories=1,
                    owner_id=TARGET_USER_ID,
                )
            )
            with pytest.raises(
                AccountDataImportTransactionSafetyError,
                match="no pending session mutations",
            ):
                _execute_transaction(session)
            session.rollback()

        with Session(test_engine) as session:
            assert session.exec(select(FoodLogDB)).all() == []
            assert session.exec(select(AccountDataImportReceiptDB)).all() == []
    finally:
        test_engine.dispose()


def test_account_import_transaction_rolls_back_every_row_on_database_failure() -> None:
    payload = _payload()
    second_food_log = deepcopy(payload["food_logs"][0])
    second_food_log["id"] = 42
    payload["food_logs"].append(second_food_log)
    reviewed_plan = _plan(_encoded(payload))
    invalid_second_row = replace(reviewed_plan.food_logs[1], product_name=None)
    tampered_plan = replace(
        reviewed_plan,
        food_logs=(reviewed_plan.food_logs[0], invalid_second_row),
    )

    test_engine = _transaction_engine()
    try:
        with Session(test_engine) as session:
            with pytest.raises(
                AccountDataImportTransactionSafetyError,
                match="transaction is unavailable",
            ) as exc_info:
                _execute_transaction(session, tampered_plan)
            assert exc_info.value.__cause__ is None
            assert session.exec(select(FoodLogDB)).all() == []
            assert session.exec(select(AccountDataImportReceiptDB)).all() == []
            session.rollback()
    finally:
        test_engine.dispose()


def test_account_import_transaction_has_no_endpoint_provider_or_commit_capability() -> None:
    source = inspect.getsource(transaction_module)

    assert "@app." not in source
    assert "requests" not in source
    assert ".commit(" not in source
    assert '"production"' not in source
