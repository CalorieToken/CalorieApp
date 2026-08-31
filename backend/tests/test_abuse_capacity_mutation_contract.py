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


def test_postgresql_advisory_lock_waits_are_bounded_and_fail_closed() -> None:
    contract = _load_contract()
    locking = contract["postgresql_advisory_lock_controls"]

    assert locking["bounded_wait_implemented"] is True
    assert locking["timeout_scope"] == "transaction-local"
    assert locking["per_lock_wait_timeout_milliseconds"] == 1_000
    assert locking["timeout_sqlstate"] == "55P03-lock-not-available"
    assert locking["timeout_rolls_back_transaction"] is True
    assert locking["timeout_response"] == "503-with-retry-after-5"
    assert locking["applies_to"] == [
        "provider-rate-governor",
        "route-rate-limiter",
        "identity-start-admission",
        "private-food-log-subject-budget",
        "source-record-ingest-budget",
        "source-record-moderation",
        "source-assertion-ingest-budget",
    ]
    assert locking["real_contention_ci_proof_implemented"] is True
    assert (
        "postgresql-advisory-lock-waits-bounded-and-contention-tested"
        in contract["current_implemented_evidence"]
    )


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
    assert request["duplicate_in_flight_read_coalescing_implemented"] is True
    assert request["bounded_per_adapter_concurrency_required"] is True
    assert request["bounded_per_adapter_concurrency_implemented"] is True
    assert request["bounded_queue_with_backpressure_required"] is True
    assert request["bounded_queue_with_backpressure_implemented"] is True
    assert request["adapter_admission_scope"] == "per-backend-process"
    assert request["shared_multi_instance_adapter_admission_implemented"] is False
    assert request["queue_overflow_response_implemented"] is True
    assert request["adapter_retry_after_max_seconds"] == 60
    assert request["shared_route_rate_limiter_implemented"] is True
    assert request["shared_route_rate_limiter_algorithm"] == "strict-sliding-window"
    assert request["shared_route_rate_limiter_scope"] == (
        "global-across-backend-processes-sharing-primary-database"
    )
    assert request["shared_route_rate_limiter_state"] == "primary-postgresql"
    assert request["shared_route_rate_limiter_lock"] == (
        "route-keyed-postgresql-transaction-advisory-lock"
    )
    assert request["shared_route_rate_limiter_window_seconds"] == 60
    assert request["shared_route_limits_per_window"] == {
        "GET /openapi.json|/docs|/docs/oauth2-redirect|/redoc combined": 120,
        "POST /api/identity/login/start": 30,
        "POST /api/identity/login/state/validate": 120,
        "POST /api/identity/callback": 30,
        "POST /api/identity/login/status": 240,
        "GET /api/identity/me": 240,
        "GET /api/identity/export": 30,
        "DELETE /api/identity/account": 10,
        "POST /api/identity/logout": 120,
        "POST /log-food": 120,
        "GET /logs": 240,
        "DELETE /logs": 30,
        "DELETE /logs/{log_id}": 120,
        "GET /search-food": 60,
        "unmatched request": 120,
    }
    assert request["health_and_readiness_rate_exempt"] is True
    assert request["route_event_stores_raw_path_query_user_session_or_ip"] is False
    assert request["route_limiter_database_failure_fails_closed"] is True
    assert request["route_limiter_unavailable_response"] == (
        "503-with-bounded-retry-after"
    )
    assert request["body_rejection_precedes_route_admission"] is True
    assert request["sqlite_route_limiter_is_live_multi_instance_proof"] is False
    assert request["postgresql_route_limiter_multi_process_ci_proof_implemented"] is True
    assert retry["single_end_to_end_budget_per_user_action"] is True
    assert retry["max_open_food_facts_attempts_per_search"] == 2
    assert retry["nested_transport_retries_allowed"] is False
    assert retry["unsafe_mutation_automatic_retry_allowed"] is False
    assert retry["circuit_breaker_implemented_per_external_source"] is True
    assert retry["circuit_breaker_failure_threshold"] == 3
    assert retry["circuit_breaker_open_seconds"] == 30
    assert retry["circuit_breaker_half_open_parallel_probes"] == 1
    assert off["published_limit"] == "10-search-requests-per-minute-per-ip"
    assert off["calorieapp_target_budget"] == (
        "at-most-8-search-requests-per-minute-per-egress-ip"
    )
    assert off["shared_egress_rate_governor_implemented"] is True
    assert off["shared_egress_rate_governor_algorithm"] == "strict-sliding-window"
    assert off["shared_egress_rate_governor_state"] == "primary-postgresql"
    assert off["shared_egress_rate_governor_lock"] == (
        "provider-keyed-postgresql-transaction-advisory-lock"
    )
    assert off["shared_egress_rate_governor_limit"] == 8
    assert off["shared_egress_rate_governor_window_seconds"] == 60
    assert off["every_actual_upstream_attempt_requires_admission"] is True
    assert off["rate_event_stores_query_user_or_ip"] is False
    assert off["rate_limit_response"] == "429-with-bounded-retry-after"
    assert off["governor_unavailable_response"] == "503-with-bounded-retry-after"
    assert off["governor_database_failure_fails_closed"] is True
    assert off["sqlite_equivalent_is_live_multi_instance_proof"] is False
    assert off["postgresql_multi_process_ci_proof_implemented"] is True
    assert off["max_concurrent_attempts_per_backend_process"] == 2
    assert off["max_queued_attempts_per_backend_process"] == 4
    assert off["max_queue_wait_seconds"] == 2
    assert off["identical_in_flight_search_coalescing_implemented"] is True
    assert off["circuit_breaker_implemented"] is True
    missing = contract["release_blocking_missing_controls"]
    assert "request-body-and-data-growth-quotas" not in missing
    assert "per-subject-and-source-data-growth-quotas" not in missing
    assert "per-source-data-growth-quota" not in missing
    assert "bounded-adapter-concurrency-queue-and-circuit-breaker" not in missing
    assert "shared-route-and-egress-rate-governor" not in missing
    assert "shared-route-rate-limiter" not in missing
    assert "shared-multi-instance-admission-and-proxy-topology-test" in missing


def test_identity_start_admission_is_shared_bounded_and_privacy_minimal() -> None:
    contract = _load_contract()
    identity = contract["identity_bridge_controls"]
    missing = contract["release_blocking_missing_controls"]

    assert identity["registered_client_login_start_limit_implemented"] is True
    assert identity["registered_client_login_start_limit"] == 20
    assert identity["registered_client_login_start_window_seconds"] == 60
    assert identity["registered_client_id_is_fixed_server_configuration"] is True
    assert identity["request_supplied_client_id_controls_admission_key"] is False
    assert identity["short_lived_network_signal_limit_implemented"] is False
    assert identity["raw_ip_or_network_signal_stored_for_login_admission"] is False
    assert identity["outstanding_unexpired_state_limit_implemented"] is True
    assert identity["outstanding_unexpired_state_limit_per_registered_client"] == 50
    assert identity["outstanding_limit_counts_all_unexpired_retained_statuses"] is True
    assert identity["state_locale_and_origin_handoff_created_atomically"] is True
    assert identity["identity_start_admission_state"] == (
        "primary-postgresql-pendingloginstate"
    )
    assert identity["identity_start_admission_lock"] == (
        "registered-client-keyed-postgresql-transaction-advisory-lock"
    )
    assert identity["identity_start_limit_response"] == (
        "429-with-bounded-retry-after"
    )
    assert identity["identity_start_database_failure_response"] == (
        "503-with-bounded-retry-after"
    )
    assert identity["identity_start_database_failure_fails_closed"] is True
    assert identity["sqlite_identity_start_lock_is_live_multi_process_proof"] is False
    assert identity[
        "postgresql_identity_start_multi_process_ci_proof_implemented"
    ] is True
    assert identity["status_poll_adaptive_slowdown_implemented"] is True
    assert identity["status_poll_elapsed_schedule_seconds"] == {
        "first_30_seconds": 5,
        "30_through_89_seconds": 10,
        "90_seconds_and_later": 20,
    }
    assert identity["status_poll_consecutive_transient_failure_delays_seconds"] == [
        10,
        20,
        30,
    ]
    assert identity["status_poll_transient_failure_max_delay_seconds"] == 30
    assert identity["status_poll_retry_after_max_seconds"] == 60
    assert identity["status_poll_focus_or_pageshow_bypasses_scheduled_delay"] is False
    assert identity["status_poll_layers"] == [
        "calorieapp-origin-handoff",
        "wordpress-xaman-finish",
    ]
    assert identity[
        "event_driven_signed_message_may_trigger_immediate_completion_check"
    ] is True
    assert "identity-start-and-outstanding-state-limits" not in missing
    assert "identity-start-short-lived-network-signal-limit" in missing
    assert "adaptive-status-poll-slowdown" not in missing


def test_mutation_is_scoped_moderated_and_never_direct() -> None:
    contract = _load_contract()
    principles = contract["principles"]
    mutation = contract["mutation_controls"]
    missing = contract["release_blocking_missing_controls"]

    assert principles["external_integration_default_access"] == "read-only"
    assert principles["direct_ecosystem_database_or_identity_store_access_allowed"] is False
    assert principles["silent_data_overwrite_allowed"] is False
    assert mutation["authentication_required"] is True
    assert mutation["purpose_and_scope_authorization_required"] is True
    assert mutation["idempotency_key_required_for_retryable_mutation"] is True
    assert mutation["optimistic_concurrency_or_expected_version_required"] is True
    assert mutation["source_record_terminal_moderation_implemented"] is True
    assert mutation["source_record_moderation_authorization_scope"] == (
        "catalog:source-record:moderate"
    )
    assert mutation["source_record_moderation_requires_expected_version"] is True
    assert mutation["source_record_moderation_requires_idempotency_key"] is True
    assert mutation["source_record_moderation_transitions"] == [
        "quarantined-to-validated",
        "quarantined-to-rejected",
    ]
    assert mutation["source_record_moderation_terminal_status_rewrite_allowed"] is False
    assert mutation["source_record_moderation_audit_inserted_atomically"] is True
    assert mutation["source_record_moderation_audit_service_is_append_only"] is True
    assert mutation[
        "source_record_moderation_audit_stores_free_text_payload_email_or_ip"
    ] is False
    assert mutation["source_record_moderation_conflict_response"] == (
        "409-without-retry-after"
    )
    assert mutation["source_record_moderation_database_failure_response"] == (
        "503-with-bounded-retry-after"
    )
    assert mutation["source_record_moderation_public_endpoint_enabled"] is False
    assert mutation[
        "postgresql_source_record_moderation_multi_process_ci_proof_implemented"
    ] is True
    assert mutation["source_assertion_ingest_implemented"] is True
    assert mutation["source_assertion_ingest_authorization_scope"] == (
        "catalog:source-assertion:ingest"
    )
    assert mutation[
        "source_assertion_ingest_requires_validated_record_and_link"
    ] is True
    assert mutation["source_assertion_ingest_requires_expected_record_version"] is True
    assert mutation["source_assertion_ingest_requires_idempotency_key"] is True
    assert mutation["source_assertion_ingest_default_status"] == "quarantined"
    assert mutation["source_assertion_ingest_resulting_version"] == 1
    assert mutation["source_assertion_ingest_audit_inserted_atomically"] is True
    assert mutation["source_assertion_ingest_audit_service_is_append_only"] is True
    assert mutation[
        "source_assertion_ingest_audit_stores_free_text_payload_email_or_ip"
    ] is False
    assert mutation["source_assertion_ingest_conflict_response"] == (
        "409-without-retry-after"
    )
    assert mutation["source_assertion_ingest_database_failure_response"] == (
        "503-with-bounded-retry-after"
    )
    assert mutation["source_assertion_ingest_public_endpoint_enabled"] is False
    assert mutation["source_assertion_correction_service_implemented"] is False
    assert mutation["source_assertion_moderation_service_implemented"] is False
    assert mutation[
        "postgresql_source_assertion_ingest_multi_process_ci_proof_implemented"
    ] is True
    assert mutation["complete_source_assertion_mutation_flow_implemented"] is False
    assert mutation["community_or_ecosystem_contribution_enters_quarantine"] is True
    assert mutation["moderation_required_before_public_activation"] is True
    assert mutation["contribution_creates_source_assertion_instead_of_overwrite"] is True
    assert mutation["correction_preserves_superseded_assertion"] is True
    assert mutation["production_application_role_may_execute_ddl"] is False
    assert mutation["production_migration_uses_separate_approved_role"] is True
    assert mutation["xrpl_transaction_creation_or_signing_automatic"] is False
    assert (
        "mutation-quarantine-moderation-audit-and-expected-version-enforcement"
        in missing
    )


def test_capacity_protects_existing_history_without_forcing_payment() -> None:
    contract = _load_contract()
    growth = contract["data_growth_controls"]
    keys = contract["limit_keys"]

    assert keys["raw_ip_long_term_storage_allowed"] is False
    assert keys["raw_search_query_in_abuse_profile_allowed"] is False
    assert keys["shared-mobile-or-household-network_fairness_required"] is True
    assert keys["ip_signal_may_be_sole_long_term_identity"] is False
    assert growth["capacity_alert_threshold_percent"] == [70, 85, 95]
    assert growth["per_subject_storage_budget_implemented"] is True
    assert growth["per_subject_storage_budget_scope"] == (
        "retained-private-food-log-entries-per-internal-user"
    )
    assert growth["per_subject_food_log_entry_limit"] == 10_000
    assert growth["per_subject_budget_counts_legacy_unowned_rows"] is False
    assert growth["per_subject_budget_delete_frees_space"] is True
    assert growth["per_subject_budget_lock"] == (
        "internal-user-keyed-postgresql-transaction-advisory-lock"
    )
    assert growth["per_subject_budget_limit_response"] == (
        "409-without-retry-after"
    )
    assert growth["per_subject_budget_database_failure_response"] == (
        "503-with-bounded-retry-after"
    )
    assert growth["per_subject_budget_database_failure_fails_closed"] is True
    assert growth["sqlite_subject_budget_is_live_multi_instance_proof"] is False
    assert growth[
        "postgresql_subject_budget_multi_process_ci_proof_implemented"
    ] is True
    assert growth["per_source_ingest_budget_implemented"] is True
    assert growth["per_source_ingest_budget_scope"] == (
        "retained-immutable-records-per-registered-source"
    )
    assert growth["per_source_ingest_limit_source"] == (
        "reviewed-positive-food-source-record-limit"
    )
    assert growth["per_source_ingest_budget_lock"] == (
        "source-keyed-postgresql-transaction-advisory-lock"
    )
    assert growth["per_source_ingest_budget_limit_response"] == (
        "409-without-retry-after"
    )
    assert growth["per_source_ingest_database_failure_response"] == (
        "503-with-bounded-retry-after"
    )
    assert growth["per_source_ingest_database_failure_fails_closed"] is True
    assert growth["per_source_duplicate_idempotency_key_consumes_budget"] is False
    assert growth["per_source_ingest_default_verification_status"] == "quarantined"
    assert growth["per_source_raw_payload_stored"] is False
    assert growth["public_source_onboarding_enabled"] is False
    assert growth["sqlite_source_budget_is_live_multi_instance_proof"] is False
    assert growth[
        "postgresql_source_budget_multi_process_ci_proof_implemented"
    ] is True
    assert growth["per_source_assertion_budget_implemented"] is True
    assert growth["per_source_assertion_budget_scope"] == (
        "retained-source-assertions-per-registered-source"
    )
    assert growth["per_source_assertion_limit_source"] == (
        "reviewed-positive-food-source-assertion-limit"
    )
    assert growth["per_source_assertion_budget_lock"] == (
        "source-keyed-postgresql-transaction-advisory-lock"
    )
    assert growth["per_source_assertion_budget_limit_response"] == (
        "409-without-retry-after"
    )
    assert growth["per_source_assertion_database_failure_response"] == (
        "503-with-bounded-retry-after"
    )
    assert growth["per_source_assertion_database_failure_fails_closed"] is True
    assert growth[
        "per_source_assertion_duplicate_idempotency_key_consumes_budget"
    ] is False
    assert growth[
        "sqlite_source_assertion_budget_is_live_multi_instance_proof"
    ] is False
    assert growth[
        "postgresql_source_assertion_budget_multi_process_ci_proof_implemented"
    ] is True
    assert growth["current_open_food_facts_catalog_persistence_enabled"] is False
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
    assert "per-subject-and-source-data-growth-quotas" not in missing
    assert "per-source-data-growth-quota" not in missing
    assert contract["release_blocking_missing_controls"]
