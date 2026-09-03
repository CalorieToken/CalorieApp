"""Fail-closed readiness check before any synthetic external-provider use."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Mapping


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = (
    ROOT / "contracts" / "data-safety" / "v1" / "provider-evaluation.json"
)

PREFLIGHT_SCHEMA_VERSION = "calorieapp.synthetic-provider-use-preflight.v1"

EXIT_READY = 0
EXIT_BLOCKED = 40
EXIT_INVALID = 50

_EXPECTED_CONTRACT_ID = "calorieapp.zero-additional-cost-provider-evaluation"
_EXPECTED_CONTRACT_VERSION = "1.9.0"
_EXPECTED_PROVIDER = "neon_free"
_EXPECTED_SCOPE = "isolated-synthetic-staging-only"
_EXPECTED_PROJECT = "calorieapp-synthetic-staging"
_EXPECTED_REGION = "aws-eu-central-1"
_EXPECTED_DPA_RECORD_KEYS = frozenset(
    {
        "confirmed_on",
        "agreement",
        "signing_channel",
        "completion_certificate_privately_archived",
        "signed_agreement_or_certificate_in_public_repository",
    }
)
_EXPECTED_SUBPROCESSOR_RECORD_KEYS = frozenset(
    {
        "confirmed_on",
        "recipient_address_recorded_in_public_repository",
    }
)
_EXPECTED_PROVIDER_MEASUREMENT_REVIEW_KEYS = frozenset(
    {
        "reviewed_on",
        "decision_state",
        "database_native_storage_signal",
        "database_native_signal_read_only",
        "database_native_signal_covers_all_free_plan_allowances",
        "usage_based_consumption_api_documented_for_live_free_plan",
        "legacy_consumption_api_documented_for_live_free_plan",
        "quota_configuration_api_availability_on_live_free_plan_confirmed",
        "console_only_monitoring_counts_as_complete",
        "persistent_provider_api_key_creation_approved",
        "complete_measurement_path_selected",
        "complete_measurement_path_configuration_verified",
        "private_provider_identifiers_or_credentials_in_public_repository",
    }
)


@dataclass(frozen=True)
class SyntheticProviderUsePreflightResult:
    """Stable result without provider account/project identifiers or credentials."""

    payload: dict[str, str | bool | list[str]]
    exit_code: int


def _invalid_result() -> SyntheticProviderUsePreflightResult:
    return SyntheticProviderUsePreflightResult(
        payload={
            "schema_version": PREFLIGHT_SCHEMA_VERSION,
            "status": "invalid",
            "ready": False,
            "provider": _EXPECTED_PROVIDER,
            "scope": _EXPECTED_SCOPE,
            "blocked_gate_codes": [],
            "action": "repair-or-revalidate-provider-contract",
        },
        exit_code=EXIT_INVALID,
    )


def _validate_safe_boundary(contract: Mapping[str, Any], today: date) -> None:
    """Reject stale, incomplete or broadened provider policy as invalid."""
    if contract["contract_id"] != _EXPECTED_CONTRACT_ID:
        raise ValueError("unexpected contract")
    if contract["contract_version"] != _EXPECTED_CONTRACT_VERSION:
        raise ValueError("unexpected contract version")
    if contract["provider_selection_scope"] != _EXPECTED_SCOPE:
        raise ValueError("unexpected scope")
    if contract["provider_selected"] is not True:
        raise ValueError("provider not selected")
    if contract["provider_account_created"] is not True:
        raise ValueError("provider account creation evidence missing")
    if contract["provider_project_created"] is not True:
        raise ValueError("provider project creation evidence missing")
    if contract["provider_selected_for_public_release"] is not False:
        raise ValueError("public release is outside this preflight")
    if contract["payment_method_added"] is not False:
        raise ValueError("paid provider state is outside this preflight")
    if contract["deployment_or_live_data_mutation_performed"] is not False:
        raise ValueError("provider was already used")
    if today > date.fromisoformat(contract["evidence_revalidate_by"]):
        raise ValueError("provider evidence expired")

    selection = contract["selection_record"]
    project = contract["project_creation_record"]
    review = contract["preconfiguration_review"]
    region = review["eu_region"]
    data_processing = review["data_processing"]
    billing = review["billing_and_quota"]
    capacity = contract["capacity_policy"]
    backup = review["portable_backup"]
    provider_exit = review["provider_exit"]

    if selection["selected_candidate"] != _EXPECTED_PROVIDER:
        raise ValueError("unexpected provider")
    if project["approved_scope"] != (
        "one-free-frankfurt-project-for-isolated-synthetic-staging-only"
    ):
        raise ValueError("unexpected project scope")
    if project["account_created"] is not True or project["project_created"] is not True:
        raise ValueError("project creation evidence missing")
    for key in (
        "payment_method_or_paid_upgrade_approved",
        "real_user_or_production_data_approved",
        "external_schema_migration_approved",
        "production_deployment_approved",
    ):
        if project[key] is not False:
            raise ValueError("provider-use boundary widened")

    if region["confirmed_in_live_project"] is not True:
        raise ValueError("region not confirmed")
    if region["documented_candidate"] != _EXPECTED_REGION:
        raise ValueError("unexpected region")
    if region["project_postgres_version"] != 16:
        raise ValueError("unexpected PostgreSQL version")
    if data_processing["approved_for_real_personal_data"] is not False:
        raise ValueError("real personal data is outside this preflight")
    if data_processing["dpa_execution_or_account_acceptance_confirmed"] is not True:
        raise ValueError("DPA execution confirmation missing")
    if (
        data_processing["subprocessor_notification_subscription_confirmed"]
        is not True
    ):
        raise ValueError("subprocessor notification confirmation missing")
    dpa_record = data_processing["dpa_execution_record"]
    subprocessor_record = data_processing["subprocessor_notification_record"]
    if not isinstance(dpa_record, Mapping) or set(dpa_record) != (
        _EXPECTED_DPA_RECORD_KEYS
    ):
        raise ValueError("unexpected DPA evidence fields")
    if not isinstance(subprocessor_record, Mapping) or set(subprocessor_record) != (
        _EXPECTED_SUBPROCESSOR_RECORD_KEYS
    ):
        raise ValueError("unexpected subprocessor evidence fields")
    if date.fromisoformat(dpa_record["confirmed_on"]) > today:
        raise ValueError("DPA evidence is dated in the future")
    if date.fromisoformat(subprocessor_record["confirmed_on"]) > today:
        raise ValueError("subprocessor evidence is dated in the future")
    if dpa_record["completion_certificate_privately_archived"] is not True:
        raise ValueError("DPA completion evidence missing")
    if dpa_record["signed_agreement_or_certificate_in_public_repository"] is not False:
        raise ValueError("private DPA evidence must not be public")
    if subprocessor_record["recipient_address_recorded_in_public_repository"] is not False:
        raise ValueError("subprocessor recipient must not be public")
    measurement_review = billing["provider_measurement_review"]
    if not isinstance(measurement_review, Mapping) or set(measurement_review) != (
        _EXPECTED_PROVIDER_MEASUREMENT_REVIEW_KEYS
    ):
        raise ValueError("unexpected provider measurement review fields")
    if date.fromisoformat(measurement_review["reviewed_on"]) > today:
        raise ValueError("provider measurement review is dated in the future")
    if measurement_review["database_native_storage_signal"] != (
        "pg_database_size(current_database())"
    ):
        raise ValueError("unexpected database-native capacity signal")
    if measurement_review["database_native_signal_read_only"] is not True:
        raise ValueError("database-native capacity signal must be read-only")
    if (
        measurement_review[
            "database_native_signal_covers_all_free_plan_allowances"
        ]
        is not False
    ):
        raise ValueError("database-native signal cannot represent all provider limits")
    if billing["usage_based_consumption_api_documented_for_free_plan"] is not False:
        raise ValueError("unexpected Free plan consumption API claim")
    if (
        measurement_review[
            "usage_based_consumption_api_documented_for_live_free_plan"
        ]
        is not False
    ):
        raise ValueError("usage-based consumption API is not documented for Free")
    if (
        measurement_review["legacy_consumption_api_documented_for_live_free_plan"]
        is not False
    ):
        raise ValueError("legacy consumption API is not documented for Free")
    if (
        measurement_review[
            "quota_configuration_api_availability_on_live_free_plan_confirmed"
        ]
        is not False
    ):
        raise ValueError("Free plan quota API availability is not confirmed")
    if measurement_review["console_only_monitoring_counts_as_complete"] is not False:
        raise ValueError("console-only monitoring cannot complete the measurement gate")
    if (
        measurement_review["persistent_provider_api_key_creation_approved"]
        is not False
    ):
        raise ValueError("persistent provider API key creation is not approved")
    if (
        measurement_review[
            "private_provider_identifiers_or_credentials_in_public_repository"
        ]
        is not False
    ):
        raise ValueError("private provider metadata must not be public")
    measurement_approved = billing["provider_measurement_path_approved"]
    measurement_configured = billing["provider_measurement_path_configured"]
    if measurement_approved is not True and measurement_approved is not False:
        raise ValueError("invalid provider measurement approval state")
    if measurement_configured is not True and measurement_configured is not False:
        raise ValueError("invalid provider measurement configuration state")
    if measurement_configured and not measurement_approved:
        raise ValueError("provider measurement cannot be configured before approval")
    if (
        measurement_review["complete_measurement_path_selected"]
        is not measurement_approved
    ):
        raise ValueError("provider measurement selection evidence is inconsistent")
    if (
        measurement_review["complete_measurement_path_configuration_verified"]
        is not measurement_configured
    ):
        raise ValueError("provider measurement configuration evidence is inconsistent")
    expected_measurement_state = (
        "complete-measurement-path-approved-and-configured"
        if measurement_configured
        else (
            "measurement-path-approved-configuration-blocked"
            if measurement_approved
            else "blocked-no-documented-free-plan-consumption-api"
        )
    )
    if measurement_review["decision_state"] != expected_measurement_state:
        raise ValueError("unexpected provider measurement decision state")
    if billing["live_plan"] != "Free" or billing["live_price_usd_per_month"] != 0:
        raise ValueError("unexpected plan")
    if billing["live_project_count"] != 1:
        raise ValueError("unexpected project count")
    if billing["live_synthetic_project_name"] != _EXPECTED_PROJECT:
        raise ValueError("unexpected project")
    if billing["payment_method_absence_confirmed_in_live_account"] is not True:
        raise ValueError("payment boundary not confirmed")
    if billing["automatic_paid_upgrade_disabled_in_live_account"] is not True:
        raise ValueError("automatic paid upgrade not disabled")
    if capacity["persistent_provider_api_key_created"] is not False:
        raise ValueError("persistent provider API keys are forbidden")

    if backup["selection_scope"] != "isolated-synthetic-neon-staging-only":
        raise ValueError("unexpected backup scope")
    if backup["plaintext_artifact_upload_allowed"] is not False:
        raise ValueError("plaintext artifacts are forbidden")
    if backup["permanent_github_private_key_secret_allowed"] is not False:
        raise ValueError("permanent private key is forbidden")
    if backup["credentials_or_keys_may_be_committed"] is not False:
        raise ValueError("committed credentials are forbidden")
    if backup["real_user_or_production_data_allowed"] is not False:
        raise ValueError("real data is forbidden")
    if provider_exit["target_is_outside_neon"] is not True:
        raise ValueError("provider-exit target must be independent")
    if provider_exit["real_user_or_production_data_allowed"] is not False:
        raise ValueError("real data is forbidden")


def evaluate_synthetic_provider_use_preflight(
    contract: Mapping[str, Any],
    *,
    today: date | None = None,
) -> SyntheticProviderUsePreflightResult:
    """Evaluate documented controls without contacting an external provider."""
    try:
        _validate_safe_boundary(contract, today or datetime.now(UTC).date())
        review = contract["preconfiguration_review"]
        billing = review["billing_and_quota"]
        capacity = contract["capacity_policy"]
        backup = review["portable_backup"]

        blocked_gate_codes: list[str] = []
        if not (
            billing["provider_measurement_path_approved"]
            and billing["provider_measurement_path_configured"]
        ):
            blocked_gate_codes.append("provider-measurement-controls")
        if not (
            capacity["exact_provider_quota_configured"]
            and capacity["alert_delivery_configured"]
        ):
            blocked_gate_codes.append("provider-capacity-controls")
        if not (
            backup["private_key_generated_or_configured"]
            and backup["offline_primary_copy_recovery_verified"]
            and backup["offline_recovery_copy_recovery_verified"]
            and backup["client_side_encryption_recipient_configured"]
        ):
            blocked_gate_codes.append("offline-age-custody")
    except (KeyError, TypeError, ValueError):
        return _invalid_result()

    ready = not blocked_gate_codes
    return SyntheticProviderUsePreflightResult(
        payload={
            "schema_version": PREFLIGHT_SCHEMA_VERSION,
            "status": "controls-ready" if ready else "blocked",
            "ready": ready,
            "provider": _EXPECTED_PROVIDER,
            "scope": _EXPECTED_SCOPE,
            "blocked_gate_codes": blocked_gate_codes,
            "action": (
                "request-separate-synthetic-operation-approval"
                if ready
                else "keep-provider-unused-complete-blocked-controls"
            ),
        },
        exit_code=EXIT_READY if ready else EXIT_BLOCKED,
    )


def main() -> int:
    """Print one low-cardinality JSON record and return the readiness status."""
    try:
        contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        result = _invalid_result()
    else:
        result = evaluate_synthetic_provider_use_preflight(contract)

    print(json.dumps(result.payload, sort_keys=True, separators=(",", ":")))
    return result.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
