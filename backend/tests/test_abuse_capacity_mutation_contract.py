from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = (
    ROOT / "contracts" / "operations" / "v2" / "abuse-capacity-mutation.json"
)


def _load_contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_automation_cannot_remove_permanent_human_control() -> None:
    human = _load_contract()["human_control_boundary"]

    assert human["fully_autonomous_operation_allowed"] is False
    assert human["human_approval_required_for_limit_policy_scope_expansion"] is True
    assert human["human_incident_command_and_emergency_pause_required"] is True
    assert human["automated_block_must_have_false_positive_review_and_appeal"] is True
    assert human["automation_may_self_authorize_broader_mutation"] is False
    assert human[
        "emergency_override_may_ignore_privacy_security_or_rights_invariants"
    ] is False


def test_request_and_retry_budgets_prevent_amplification() -> None:
    contract = _load_contract()
    request = contract["request_controls"]
    retry = contract["retry_controls"]
    off = contract["provider_registry"]["open_food_facts_search"]

    assert request["route_specific_limits_required"] is True
    assert request["request_body_size_limit_implemented"] is True
    assert request["declared_and_actual_body_bytes_enforced"] is True
    assert request["invalid_content_length_response"] == 400
    assert request["oversize_body_response"] == 413
    assert request["default_mutation_body_limit_bytes"] == 16 * 1024
    assert request["explicit_route_body_limit_bytes"] == {
        "POST /api/identity/login/start": 2 * 1024,
        "POST /api/identity/login/state/validate": 2 * 1024,
        "POST /api/identity/callback": 4 * 1024,
        "POST /api/identity/login/status": 4 * 1024,
        "DELETE /api/identity/account": 4 * 1024,
        "POST /api/identity/logout": 1024,
        "POST /log-food": 16 * 1024,
    }
    assert request["request_body_content_logged"] is False
    assert request["search_as_you_type_external_requests_allowed"] is False
    assert request["bounded_per_adapter_concurrency_required"] is True
    assert request["bounded_queue_with_backpressure_required"] is True
    assert retry["single_end_to_end_budget_per_user_action"] is True
    assert retry["max_open_food_facts_attempts_per_search"] == 2
    assert retry["nested_transport_retries_allowed"] is False
    assert retry["unsafe_mutation_automatic_retry_allowed"] is False
    assert off["published_limit"] == "10-search-requests-per-minute-per-ip"
    assert off["calorieapp_target_budget"] == (
        "at-most-8-search-requests-per-minute-per-egress-ip"
    )
    assert off["shared_egress_rate_governor_implemented"] is False
    missing = contract["release_blocking_missing_controls"]
    assert "request-body-and-data-growth-quotas" not in missing
    assert "per-subject-and-source-data-growth-quotas" in missing


def test_mutation_is_scoped_moderated_and_never_direct() -> None:
    contract = _load_contract()
    principles = contract["principles"]
    mutation = contract["mutation_controls"]

    assert principles["external_integration_default_access"] == "read-only"
    assert principles["direct_ecosystem_database_or_identity_store_access_allowed"] is False
    assert principles["silent_data_overwrite_allowed"] is False
    assert mutation["authentication_required"] is True
    assert mutation["purpose_and_scope_authorization_required"] is True
    assert mutation["idempotency_key_required_for_retryable_mutation"] is True
    assert mutation["optimistic_concurrency_or_expected_version_required"] is True
    assert mutation["community_or_ecosystem_contribution_enters_quarantine"] is True
    assert mutation["moderation_required_before_public_activation"] is True
    assert mutation["contribution_creates_source_assertion_instead_of_overwrite"] is True
    assert mutation["correction_preserves_superseded_assertion"] is True
    assert mutation["production_application_role_may_execute_ddl"] is False
    assert mutation["production_migration_uses_separate_approved_role"] is True
    assert mutation["xrpl_transaction_creation_or_signing_automatic"] is False


def test_capacity_protects_existing_history_without_forcing_payment() -> None:
    contract = _load_contract()
    growth = contract["data_growth_controls"]
    keys = contract["limit_keys"]

    assert keys["raw_ip_long_term_storage_allowed"] is False
    assert keys["raw_search_query_in_abuse_profile_allowed"] is False
    assert keys["shared-mobile-or-household-network_fairness_required"] is True
    assert keys["ip_signal_may_be_sole_long_term_identity"] is False
    assert growth["capacity_alert_threshold_percent"] == [70, 85, 95]
    assert growth["provider_neutral_database_size_signal_implemented"] is True
    assert growth["exact_capacity_limit_requires_operator_configuration"] is True
    assert growth["new_identity_onboarding_pause_at_percent_implemented"] == 95
    assert growth["configured_measurement_failure_pauses_new_onboarding"] is True
    assert growth["existing_identity_login_bypasses_onboarding_pause"] is True
    assert growth["provider_neutral_alert_adapter_interface_implemented"] is True
    assert growth["alert_adapter_schema_version"] == "calorieapp.capacity-probe.v1"
    assert growth["alert_adapter_exposes_exact_bytes_or_user_content"] is False
    assert growth["capacity_incident_runbook_implemented"] is True
    assert growth["external_alert_destination_configured"] is False
    assert growth["automatic_paid_upgrade_allowed"] is False
    assert growth["automatic_existing_history_deletion_allowed"] is False
    assert growth["new_onboarding_pauses_before_safety_capacity_failure"] is True
    missing = contract["release_blocking_missing_controls"]
    assert "capacity-alert-destination-and-live-delivery-proof" in missing
    assert "capacity-alert-delivery-and-incident-runbook" not in missing
    assert "chosen-provider-exact-quota-configuration-and-live-pause-exercise" in missing
    assert contract["release_blocking_missing_controls"]
