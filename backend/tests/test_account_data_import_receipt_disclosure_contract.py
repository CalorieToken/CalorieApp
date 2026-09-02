"""Contract tests for privacy-safe account-import receipt disclosure."""

from __future__ import annotations

import json
from pathlib import Path

from app.account_data_import import SUPPORTED_EXPORT_VERSION
from app.schemas import AccountDataExportResponse


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIR = ROOT / "contracts" / "data-safety" / "v1"


def _load_contract(name: str) -> dict:
    return json.loads((CONTRACT_DIR / name).read_text(encoding="utf-8"))


def test_future_v2_receipt_summary_is_minimal_and_digest_free() -> None:
    contract = _load_contract("account-data-import-receipt-disclosure.json")
    decision = contract["decision"]

    assert contract["contract_id"] == (
        "calorieapp.account-data-import-receipt-disclosure"
    )
    assert contract["contract_version"] == "1.0.0"
    assert contract["status"] == (
        "future-v2-disclosure-selected-runtime-implementation-pending"
    )
    assert contract["release_state"] == "blocked"
    assert decision["completed"] is True
    assert decision["current_export_version"] == "calorieapp-account-data-v1"
    assert decision["future_export_version"] == "calorieapp-account-data-v2"
    assert decision["future_collection_name"] == "account_import_receipts"
    assert decision["current_export_changed_by_this_contract"] is False
    assert decision["runtime_implementation_completed"] is False

    allowed = {
        field["export_name"]: field for field in decision["allowed_summary_fields"]
    }
    assert set(allowed) == {
        "imported_at",
        "food_log_count",
        "source_export_version",
        "import_plan_version",
    }
    assert allowed["imported_at"]["receipt_source"] == "created_at"
    assert allowed["food_log_count"]["receipt_source"] == "food_log_count"
    assert allowed["source_export_version"]["receipt_source"] == "export_version"
    assert allowed["import_plan_version"]["receipt_source"] == "plan_version"
    assert set(decision["forbidden_receipt_source_fields"]) == {
        "id",
        "target_account_id",
        "private_import_digest",
    }
    assert set(decision["forbidden_derived_or_joined_fields"]) == {
        "source_account_identifier",
        "source_food_log_identifiers",
        "source_food_values",
        "approval_or_release_commit_reference",
    }


def test_receipt_summary_cannot_become_live_replay_evidence() -> None:
    contract = _load_contract("account-data-import-receipt-disclosure.json")
    security = contract["security_boundary"]
    future_import = contract["future_import_behavior"]

    assert security["private_import_digest_is_internal_replay_evidence"] is True
    assert security["private_import_digest_export_allowed"] is False
    assert security["private_import_digest_log_or_error_disclosure_allowed"] is False
    assert security["target_account_id_repetition_required"] is False
    assert security["deterministic_order"] == [
        "imported_at",
        "internal-receipt-id-private-tiebreaker",
    ]
    assert security["private_tiebreaker_exported"] is False
    assert future_import["v1_export_remains_accepted"] is True
    assert future_import["v2_receipt_summary_validation_required"] is True
    assert future_import["receipt_summaries_are_informational_history_only"] is True
    assert future_import["receipt_summaries_restored_as_live_replay_receipts"] is False
    assert (
        future_import["receipt_summaries_may_bypass_target_bound_replay_controls"]
        is False
    )
    assert (
        future_import["live_receipt_requires_fresh_target_bound_verified_import_transaction"]
        is True
    )


def test_receipt_decision_does_not_change_current_runtime_or_activation() -> None:
    contract = _load_contract("account-data-import-receipt-disclosure.json")
    guards = contract["activation_guards"]

    assert SUPPORTED_EXPORT_VERSION == "calorieapp-account-data-v1"
    assert "account_import_receipts" not in AccountDataExportResponse.model_fields
    assert guards == {
        "release_remains_blocked": True,
        "endpoint_changed": False,
        "database_schema_changed": False,
        "export_version_changed": False,
        "feature_flag_changed": False,
        "migration_performed": False,
        "deployment_performed": False,
        "provider_action_performed": False,
        "live_personal_data_mutated": False,
    }


def test_receipt_disclosure_contract_is_linked_across_safety_records() -> None:
    path = "contracts/data-safety/v1/account-data-import-receipt-disclosure.json"
    safety = _load_contract("data-safety.json")["account_data_export"]
    alignment = _load_contract("privacy-notice-alignment.json")
    future = alignment["selected_future_disclosure"][
        "private_import_receipt_summaries"
    ]

    assert safety["import_receipt_disclosure_contract"] == path
    assert safety["import_receipt_disclosure_decision_completed"] is True
    assert safety["import_receipt_disclosure_selected_export_version"] == (
        "calorieapp-account-data-v2"
    )
    assert safety["import_receipt_disclosure_runtime_implemented"] is False
    assert safety["current_v1_export_changed_by_receipt_disclosure_decision"] is False
    assert safety["private_import_digest_export_allowed"] is False
    assert (
        safety["imported_receipt_summaries_may_be_restored_as_live_replay_receipts"]
        is False
    )
    assert future["contract"] == path
    assert future["target_export_version"] == "calorieapp-account-data-v2"
    assert future["current_runtime_changed"] is False
    assert future["restored_as_live_replay_evidence"] is False
