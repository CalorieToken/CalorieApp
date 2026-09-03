"""Tests for the fail-closed synthetic provider-use preflight."""

from __future__ import annotations

import copy
import json
from datetime import date

import pytest

import app.synthetic_provider_use_preflight as preflight_module
from app.synthetic_provider_use_preflight import (
    EXIT_BLOCKED,
    EXIT_INVALID,
    EXIT_READY,
    PREFLIGHT_SCHEMA_VERSION,
    evaluate_synthetic_provider_use_preflight,
)


def _contract() -> dict:
    return json.loads(preflight_module.CONTRACT_PATH.read_text(encoding="utf-8"))


def _ready_contract() -> dict:
    contract = copy.deepcopy(_contract())
    review = contract["preconfiguration_review"]
    review["data_processing"]["dpa_execution_or_account_acceptance_confirmed"] = True
    review["data_processing"]["subprocessor_notification_subscription_confirmed"] = True
    backup = review["portable_backup"]
    backup["private_key_generated_or_configured"] = True
    backup["offline_primary_copy_recovery_verified"] = True
    backup["offline_recovery_copy_recovery_verified"] = True
    backup["client_side_encryption_recipient_configured"] = True
    return contract


def test_current_provider_controls_are_blocked_only_on_offline_custody() -> None:
    result = evaluate_synthetic_provider_use_preflight(
        _contract(), today=date(2026, 9, 3)
    )

    assert result.exit_code == EXIT_BLOCKED
    assert result.payload == {
        "schema_version": PREFLIGHT_SCHEMA_VERSION,
        "status": "blocked",
        "ready": False,
        "provider": "neon_free",
        "scope": "isolated-synthetic-staging-only",
        "blocked_gate_codes": ["offline-age-custody"],
        "action": "keep-provider-unused-complete-blocked-controls",
    }


def test_complete_controls_require_separate_operation_approval() -> None:
    result = evaluate_synthetic_provider_use_preflight(
        _ready_contract(), today=date(2026, 9, 3)
    )

    assert result.exit_code == EXIT_READY
    assert result.payload["status"] == "controls-ready"
    assert result.payload["ready"] is True
    assert result.payload["blocked_gate_codes"] == []
    assert result.payload["action"] == "request-separate-synthetic-operation-approval"


@pytest.mark.parametrize(
    ("path", "unsafe_value"),
    [
        (("contract_version",), "unexpected-version"),
        (("provider_account_created",), False),
        (("provider_project_created",), False),
        (("payment_method_added",), True),
        (("provider_selected_for_public_release",), True),
        (
            (
                "preconfiguration_review",
                "data_processing",
                "dpa_execution_or_account_acceptance_confirmed",
            ),
            False,
        ),
        (
            (
                "preconfiguration_review",
                "data_processing",
                "subprocessor_notification_subscription_confirmed",
            ),
            False,
        ),
        (
            ("project_creation_record", "real_user_or_production_data_approved"),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "portable_backup",
                "plaintext_artifact_upload_allowed",
            ),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "data_processing",
                "dpa_execution_record",
                "signed_agreement_or_certificate_in_public_repository",
            ),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "data_processing",
                "subprocessor_notification_record",
                "recipient_address_recorded_in_public_repository",
            ),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "data_processing",
                "dpa_execution_record",
                "envelope_identifier",
            ),
            "private-envelope-id",
        ),
        (
            (
                "preconfiguration_review",
                "data_processing",
                "subprocessor_notification_record",
                "recipient_address",
            ),
            "private@example.test",
        ),
        (
            (
                "preconfiguration_review",
                "billing_and_quota",
                "provider_measurement_review",
                "database_native_signal_covers_all_free_plan_allowances",
            ),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "billing_and_quota",
                "free_plan_native_hard_limits",
                "overage_billing_on_free_plan",
            ),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "billing_and_quota",
                "synthetic_staging_measurement_path",
                "provider_api_key_required",
            ),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "billing_and_quota",
                "provider_measurement_review",
                "console_only_monitoring_counts_as_complete",
            ),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "billing_and_quota",
                "provider_measurement_review",
                "persistent_provider_api_key_creation_approved",
            ),
            True,
        ),
        (
            (
                "preconfiguration_review",
                "billing_and_quota",
                "provider_measurement_review",
                "private_provider_identifiers_or_credentials_in_public_repository",
            ),
            True,
        ),
    ],
)
def test_unsafe_policy_expansion_is_invalid(
    path: tuple[str, ...], unsafe_value: bool | str
) -> None:
    contract = _ready_contract()
    target = contract
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = unsafe_value

    result = evaluate_synthetic_provider_use_preflight(
        contract, today=date(2026, 9, 3)
    )

    assert result.exit_code == EXIT_INVALID
    assert result.payload["status"] == "invalid"
    assert result.payload["ready"] is False
    assert result.payload["action"] == "repair-or-revalidate-provider-contract"


def test_persistent_provider_api_key_is_invalid() -> None:
    contract = _ready_contract()
    contract["capacity_policy"]["persistent_provider_api_key_created"] = True

    result = evaluate_synthetic_provider_use_preflight(
        contract, today=date(2026, 9, 2)
    )

    assert result.exit_code == EXIT_INVALID
    assert result.payload["status"] == "invalid"


def test_expired_evidence_is_invalid() -> None:
    result = evaluate_synthetic_provider_use_preflight(
        _ready_contract(), today=date(2026, 12, 2)
    )

    assert result.exit_code == EXIT_INVALID
    assert result.payload["status"] == "invalid"


def test_missing_control_is_invalid_instead_of_assumed_false() -> None:
    contract = _ready_contract()
    del contract["preconfiguration_review"]["billing_and_quota"][
        "synthetic_provider_measurement_path_configured"
    ]

    result = evaluate_synthetic_provider_use_preflight(
        contract, today=date(2026, 9, 2)
    )

    assert result.exit_code == EXIT_INVALID
    assert result.payload["blocked_gate_codes"] == []


def test_cli_emits_only_the_stable_low_cardinality_payload(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path,
) -> None:
    contract_path = tmp_path / "provider-evaluation.json"
    contract_path.write_text(json.dumps(_contract()), encoding="utf-8")
    monkeypatch.setattr(preflight_module, "CONTRACT_PATH", contract_path)

    assert preflight_module.main() == EXIT_BLOCKED

    payload = json.loads(capsys.readouterr().out)
    assert payload["schema_version"] == PREFLIGHT_SCHEMA_VERSION
    assert payload["status"] == "blocked"
    assert set(payload) == {
        "schema_version",
        "status",
        "ready",
        "provider",
        "scope",
        "blocked_gate_codes",
        "action",
    }
