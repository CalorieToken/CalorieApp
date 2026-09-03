from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIR = ROOT / "contracts" / "data-safety" / "v1"


def _load_json(name: str) -> dict:
    return json.loads((CONTRACT_DIR / name).read_text(encoding="utf-8"))


def _normalized_copy(path: Path) -> str:
    return " ".join(path.read_text(encoding="utf-8").replace("&apos;", "'").split())


def test_data_safety_contract_keeps_live_history_off_sqlite() -> None:
    contract = _load_json("data-safety.json")

    assert contract["contract_id"] == "calorieapp.durable-data-safety"
    assert contract["contract_version"] == "1.38.0"
    assert contract["release_state"] == "blocked"
    assert contract["architecture"]["primary_live_store"] == "postgresql"
    assert contract["architecture"]["provider_selection"] == (
        "neon-free-synthetic-controls-ready-operation-unperformed"
    )
    assert contract["architecture"]["sqlite_allowed_environments"] == ["local", "test"]
    assert contract["architecture"]["sqlite_allowed_for_public_live_history"] is False
    assert contract["architecture"]["provider_driven_history_expiry_allowed"] is False
    assert contract["architecture"]["formal_schema_migrations_required"] is True


def test_data_safety_contract_forbids_public_personal_data_replication() -> None:
    boundary = _load_json("data-safety.json")["decentralized_boundary"]

    assert boundary["personal_data_on_public_blockchain_allowed"] is False
    assert boundary["personal_data_on_public_ipfs_allowed"] is False
    assert boundary["public_cid_treated_as_private"] is False
    assert boundary["current_release_dependency"] is False
    assert "non-reversible" in boundary["allowed_chain_record"]


def test_postgresql_ci_proof_is_synthetic_guarded_and_not_provider_proof() -> None:
    proof = _load_json("data-safety.json")["postgresql_ci_proof"]

    assert proof["status"] == (
        "automated-gate-configured-success-required-per-merge-candidate"
    )
    assert proof["database_version"] == "PostgreSQL 16"
    assert proof["new_provider_or_account_required"] is False
    assert proof["additional_recurring_subscription_required"] is False
    assert proof["synthetic_data_only"] is True
    assert proof["destructive_reset_guard"]["loopback_host_required"] is True
    assert (
        proof["destructive_reset_guard"]["exact_database_name_required"]
        == "calorieapp_ci_test"
    )
    assert proof["destructive_reset_guard"]["real_user_or_production_database_allowed"] is False
    assert "cross-user-food-history-isolation" in proof["automated_evidence"]
    assert "application-engine-restart-persistence" in proof["automated_evidence"]
    assert "two-separate-backend-process-persistence" in proof["automated_evidence"]
    assert "chosen-provider-redeploy-persistence" in proof["does_not_prove"]
    assert "synthetic-custom-format-backup-and-distinct-database-restore" in proof[
        "automated_evidence"
    ]
    assert "synthetic-in-memory-erasure-replay-after-older-backup-restore" in proof[
        "automated_evidence"
    ]
    assert "independently-persisted-provider-restore-erasure-replay" in proof[
        "does_not_prove"
    ]
    assert "bounded-source-assertion-ingest-and-multi-process-budget" in proof[
        "automated_evidence"
    ]
    assert "encrypted-provider-staging-backup-restoration" in proof["does_not_prove"]
    assert "synthetic-account-import-transaction-and-private-replay-idempotency" in proof[
        "automated_evidence"
    ]
    assert "synthetic-runtime-role-row-only-audit-and-import-receipt-enforcement" in proof[
        "automated_evidence"
    ]
    assert "staging-or-production-runtime-role-privilege-application" in proof[
        "does_not_prove"
    ]
    assert proof["provider_selection_status"] == (
        "neon-synthetic-controls-ready-operation-unperformed"
    )


def test_redeploy_ci_proof_is_two_process_synthetic_and_still_partial() -> None:
    proof = _load_json("data-safety.json")["postgresql_redeploy_ci_proof"]

    assert proof["status"] == (
        "synthetic-two-process-proof-configured-provider-proof-pending"
    )
    assert proof["automated_per_merge_candidate"] is True
    assert proof["separate_backend_os_process_lifecycles_required"] == 2
    assert proof["same_external_postgresql_database"] is True
    assert proof["loopback_only"] is True
    assert proof["exact_database_name"] == "calorieapp_ci_test"
    assert proof["synthetic_data_only"] is True
    assert proof["first_process_writes_via_authenticated_http"] is True
    assert proof["first_process_stopped_before_second_starts"] is True
    assert proof["second_process_reads_via_authenticated_http"] is True
    assert proof["schema_head_and_owner_links_verified"] is True
    assert proof["provider_selected"] is True
    assert proof["provider_selection_scope"] == "isolated-synthetic-staging-only"
    assert proof["provider_account_created"] is True
    assert proof["provider_project_created"] is True
    assert proof["real_provider_redeploy_proven"] is False
    assert proof["production_or_staging_data_allowed"] is False
    assert proof["deployment_or_live_mutation_performed"] is False


def test_data_classes_cover_current_and_planned_personal_flows() -> None:
    data_classes = {
        item["id"]: item for item in _load_json("data-safety.json")["data_classes"]
    }

    assert set(data_classes) == {
        "food_history",
        "identity_link",
        "authentication_transient",
        "food_search_query",
        "voluntary_profile",
        "donation_contact",
        "xrpl_transaction_reference",
        "calorie_record_fingerprint",
    }
    assert data_classes["food_search_query"]["persistent_storage_allowed"] is False
    assert data_classes["food_search_query"]["calorieapp_identity_forwarded"] is False
    assert data_classes["food_search_query"]["current_external_adapter"] == (
        "open_food_facts"
    )
    assert data_classes["food_search_query"]["source_architecture_is_exclusive"] is False
    assert data_classes["voluntary_profile"]["explicit_choice_required"] is True
    assert data_classes["donation_contact"]["purpose_separation_required"] is True
    assert data_classes["xrpl_transaction_reference"]["primary_key"] == [
        "network",
        "transaction_hash",
    ]
    assert (
        data_classes["calorie_record_fingerprint"][
            "plain_record_hash_allowed_on_public_ledger"
        ]
        is False
    )


def test_account_export_is_private_versioned_and_secret_free() -> None:
    export = _load_json("data-safety.json")["account_data_export"]

    assert export["status"] == (
        "v2-receipt-export-and-disabled-v1-v2-import-implemented-"
        "provider-exit-and-notice-review-pending"
    )
    assert export["format"] == "versioned-json"
    assert export["format_version"] == "calorieapp-account-data-v2"
    assert export["authenticated_user_only"] is True
    assert export["cross_user_records_allowed"] is False
    assert export["private_http_caching_allowed"] is False
    assert export["external_delivery_or_publication_performed"] is False
    assert export["security_token_hashes_codes_and_login_state_included"] is False
    assert export[
        "identity_food_history_and_directly_owned_authentication_activity_included"
    ] is True
    assert export["durable_last_authenticated_activity_marker_included"] is True
    assert export["inactive_account_notice_lifecycle_included"] is True
    assert (
        export["inactive_account_notice_delivery_evidence_digest_included"]
        is False
    )
    assert export[
        "legacy_authorization_events_without_direct_ownership_included"
    ] is False
    assert export["authorization_events_field_reserved_as_empty_list"] is True
    assert export[
        "direct_ownership_migration_required_before_authorization_event_inclusion"
    ] is True
    assert export["authenticated_frontend_download_control_implemented"] is True
    assert export["same_origin_backend_proxy_required"] is True
    assert export["download_requires_reviewed_export_version"] == (
        "calorieapp-account-data-v2"
    )
    assert export["download_payload_rendered_or_persisted_in_browser_storage"] is False
    assert export["download_sends_data_to_external_service"] is False
    assert export["english_private_file_warning_implemented"] is True
    assert export["english_warning_is_approved_privacy_notice"] is False
    assert export["eleven_language_export_ui_completed"] is True
    assert export["localized_copy_source"] == (
        "frontend/config/account-privacy-copy.json"
    )
    assert export["independent_language_or_legal_review_completed"] is False
    assert export["eleven_language_identity_bridge_ui_required"] is True
    assert export["privacy_notice_alignment_required"] is True
    assert export["provider_neutral_import_plan_implemented"] is True
    assert export["import_plan_version"] == (
        "calorieapp-account-data-import-plan-v1"
    )
    assert export["import_plan_supported_export_versions"] == [
        "calorieapp-account-data-v1",
        "calorieapp-account-data-v2",
    ]
    assert export[
        "import_plan_requires_explicit_source_account_confirmation"
    ] is True
    assert export["import_plan_portable_collections"] == ["food_logs"]
    assert export["import_plan_requires_at_least_one_food_log"] is True
    assert export["import_plan_reuses_source_database_row_ids"] is False
    assert export[
        "import_plan_rehydrates_identity_session_handoff_or_notice_state"
    ] is False
    assert export["import_plan_private_digest_may_be_publicly_logged"] is False
    assert export["import_plan_private_digest_bound_to_target_account"] is True
    assert export[
        "import_validation_errors_retain_private_payload_details"
    ] is False
    assert export["provider_neutral_import_admission_implemented"] is True
    assert export["import_admission_version"] == (
        "calorieapp-account-data-import-admission-v1"
    )
    assert export["import_admission_duplicate_policy"] == (
        "clean-target-exact-plan-replay-only-v1"
    )
    assert export[
        "import_admission_requires_reviewed_plan_version_digest_format_and_target_ownership"
    ] is True
    assert export["import_admission_requires_authenticated_target_match"] is True
    assert export["import_admission_requires_explicit_target_confirmation"] is True
    assert export["import_admission_new_plan_requires_clean_target"] is True
    assert export[
        "import_admission_new_plan_requires_no_prior_private_receipt"
    ] is True
    assert export[
        "import_admission_content_based_food_log_deduplication_performed"
    ] is False
    assert export["import_admission_exact_private_digest_replay_action"] == (
        "idempotent-noop"
    )
    assert export["import_admission_target_food_log_limit"] == 10_000
    assert export[
        "import_admission_limit_may_exceed_live_subject_budget"
    ] is False
    assert export[
        "import_admission_count_and_digest_must_be_read_in_future_transaction"
    ] is True
    assert export["private_import_idempotency_storage_implemented"] is True
    assert export["import_transaction_version"] == (
        "calorieapp-account-data-import-transaction-v1"
    )
    assert export["import_transaction_disabled_by_default"] is True
    assert export["import_transaction_non_production_only"] is True
    assert export["import_transaction_caller_commit_required"] is True
    assert export[
        "import_transaction_requires_no_pending_session_mutations"
    ] is True
    assert export["import_transaction_uses_live_food_log_subject_lock"] is True
    assert export[
        "import_transaction_locks_active_target_and_reads_count_and_digest_before_insert"
    ] is True
    assert export[
        "import_transaction_food_logs_and_private_receipt_share_one_savepoint"
    ] is True
    assert export[
        "import_transaction_database_errors_retain_private_values"
    ] is False
    assert export["import_transaction_exact_digest_replay_writes_rows"] is False
    assert export[
        "import_transaction_conflicting_private_receipt_fails_closed"
    ] is True
    assert export[
        "import_receipt_stores_source_account_identifier_or_food_values"
    ] is False
    assert export["import_receipt_erased_with_account"] is True
    assert export["import_receipt_runtime_update_allowed"] is False
    assert export["import_receipt_disclosure_contract"] == (
        "contracts/data-safety/v1/account-data-import-receipt-disclosure.json"
    )
    assert export["import_receipt_disclosure_decision_completed"] is True
    assert export["import_receipt_disclosure_selected_export_version"] == (
        "calorieapp-account-data-v2"
    )
    assert export["import_receipt_disclosure_runtime_implemented"] is True
    assert export["legacy_v1_import_compatibility_retained"] is True
    assert export["import_receipt_summary_export_fields"] == [
        "imported_at",
        "food_log_count",
        "source_export_version",
        "import_plan_version",
    ]
    assert export["private_import_digest_export_allowed"] is False
    assert (
        export[
            "imported_receipt_summaries_may_be_restored_as_live_replay_receipts"
        ]
        is False
    )
    assert export[
        "synthetic_postgresql_import_transaction_test_implemented"
    ] is True
    assert export[
        "synthetic_postgresql_import_lock_shared_with_live_food_log_writer_tested"
    ] is True
    assert export["import_schema_migration_repository_status"] == (
        "v2-receipt-version-forward-migration-prepared-not-deployed"
    )
    assert export["external_database_migration_or_deployment_performed"] is False
    assert export[
        "import_admission_has_endpoint_database_file_provider_network_or_deployment_capability"
    ] is False
    assert export[
        "import_requires_separate_target_authentication_and_authorization"
    ] is True
    assert export["authenticated_import_endpoint_implemented"] is True
    assert export["authenticated_import_endpoint_disabled_by_default"] is True
    assert export["authenticated_import_endpoint_non_production_only"] is True
    assert export[
        "authenticated_import_route_derives_target_from_server_session"
    ] is True
    assert export[
        "authenticated_import_route_requires_source_and_target_confirmation"
    ] is True
    assert export["authenticated_import_route_same_origin_intent_required"] is True
    assert export["authenticated_import_route_body_limit_bytes"] == 5 * 1024 * 1024
    assert export["authenticated_import_route_requests_per_minute"] == 5
    assert export[
        "authenticated_import_route_exact_reviewed_running_commit_match_required"
    ] is True
    assert export[
        "authenticated_import_route_private_values_in_errors_or_logs_allowed"
    ] is False
    assert export[
        "authenticated_import_route_commits_or_rolls_back_complete_import"
    ] is True
    assert export["authenticated_import_ui_enabled_by_default"] is False
    assert export["eleven_language_import_ui_completed"] is True
    assert export["imported_file_retained_as_file_by_calorieapp"] is False
    assert export["database_import_mutation_implemented"] is True
    assert export["provider_exit_import_proved"] is False
    assert export[
        "import_plan_has_endpoint_database_file_provider_network_or_deployment_capability"
    ] is False
    assert export["account_export_changes_erasure_or_retention_policy"] is False


def test_selected_retention_policy_is_bounded_and_still_not_enforced() -> None:
    retention = _load_json("data-safety.json")["retention"]

    assert retention["status"] == (
        "policy-selected-enforcement-notice-and-provider-proof-pending"
    )
    assert retention["account_erasure_policy_decision_date"] == "2026-09-01"
    assert retention["account_erasure_policy_decision_authority"] == (
        "current-operator-explicit-selection"
    )
    assert retention["selected_account_erasure_recovery_window_days"] == 0
    assert retention["maximum_encrypted_backup_retention_days"] == 30
    assert retention["remaining_retention_policy_decision_date"] == "2026-09-01"
    assert retention["remaining_retention_policy_decision_authority"] == (
        "current-operator-explicit-selection"
    )
    assert retention["inactive_account_retention_months"] == 24
    assert retention["inactive_account_notice_days"] == 30
    assert retention["inactive_account_activity_anchor"] == (
        "last-authenticated-calorieapp-activity"
    )
    assert retention["last_authenticated_activity_marker_repository_status"] == (
        "prepared-forward-migration-not-deployed"
    )
    assert retention["last_authenticated_activity_marker_is_monotonic"] is True
    assert retention["last_authenticated_activity_marker_write_points"] == [
        "successful-session-creation",
        "successful-authenticated-request",
    ]
    assert retention["existing_account_marker_backfill_source"] == (
        "latest-auth-session-last-seen-or-account-created-at"
    )
    assert (
        retention["last_authenticated_activity_marker_deployment_and_backfill_proved"]
        is False
    )
    assert retention["authenticated_activity_during_notice_cancels_pending_erasure"] is True
    assert retention["notice_delivery_required_before_inactive_account_erasure"] is True
    assert retention["inactive_account_notice_delivery_implemented"] is False
    assert retention["inactive_account_erasure_enforcement_implemented"] is False
    preview = retention["inactive_account_preview"]
    assert preview["implementation_status"] == (
        "aggregate-only-read-preview-prepared-production-blocked"
    )
    assert preview["activity_anchor"] == (
        "calorieappuser.last_authenticated_activity_at"
    )
    assert preview["active_account_status_only"] is True
    assert preview["calendar_month_arithmetic_per_account"] is True
    assert preview["leap_day_and_month_end_clamping"] is True
    assert preview["oldest_active_accounts_evaluated_first"] is True
    assert preview["default_batch_limit"] == 500
    assert preview["maximum_batch_limit"] == 5_000
    assert preview["supported_database_backends"] == ["postgresql", "sqlite"]
    assert preview["aggregate_only_output"] is True
    assert (
        preview[
            "account_contact_wallet_session_or_network_identifiers_in_output_allowed"
        ]
        is False
    )
    assert preview["dedicated_clean_database_session_required"] is True
    assert preview["read_transaction_rolled_back_before_return"] is True
    assert preview["notice_delivery_proof_created"] is False
    assert preview["account_marking_implemented"] is False
    assert preview["automatic_erasure_authorized"] is False
    assert preview["scheduler_configured"] is False
    assert preview["production_cli_enabled"] is False
    assert preview["real_data_access_performed_by_this_change"] is False
    assert preview["migration_or_deployment_performed"] is False
    evidence = retention["inactive_account_notice_evidence"]
    assert evidence["implementation_status"] == (
        "receipt-proof-builder-verifier-and-transaction-owned-recording-"
        "schema-and-activity-cancellation-prepared-delivery-disabled"
    )
    assert evidence["successful_delivery_evidence_only"] is True
    assert evidence["pending_delivery_queue_created"] is False
    assert evidence["one_notice_per_user_activity_anchor"] is True
    assert evidence["notice_window_and_retention_timeline_constrained"] is True
    assert evidence["delivery_channel_provider_selected"] is False
    assert evidence["raw_contact_destination_stored"] is False
    assert evidence["raw_provider_receipt_stored"] is False
    assert evidence["keyed_delivery_evidence_digest_required"] is True
    assert evidence["delivery_evidence_digest_algorithm"] == "hmac-sha256-v1"
    assert evidence["minimum_digest_secret_bytes"] == 32
    assert evidence["maximum_raw_provider_receipt_bytes"] == 4096
    assert evidence["provider_neutral_receipt_proof_builder_implemented"] is True
    assert evidence["provider_neutral_receipt_proof_verifier_implemented"] is True
    assert evidence["receipt_proof_digest_comparison"] == "hmac.compare_digest"
    assert evidence["malformed_expected_digest_rejected"] is True
    assert evidence["transaction_owned_evidence_recording_implemented"] is True
    assert evidence["new_recording_requires_current_locked_activity_anchor"] is True
    assert (
        evidence["identical_retry_may_return_existing_row_after_later_activity"]
        is True
    )
    assert evidence["identical_user_anchor_retry_is_idempotent"] is True
    assert evidence["conflicting_user_anchor_retry_rejected"] is True
    assert evidence["recording_function_commits_transaction"] is False
    assert (
        evidence[
            "recording_function_has_provider_network_queue_scheduler_or_erasure_capability"
        ]
        is False
    )
    assert (
        evidence["raw_provider_receipt_returned_or_persisted_by_proof_builder"]
        is False
    )
    assert evidence["returned_delivery_timestamp_convention"] == (
        "naive-utc-for-persistence"
    )
    assert evidence["delivery_evidence_digest_in_private_export"] is False
    assert evidence["lifecycle_timestamps_and_channel_in_private_export"] is True
    assert (
        evidence[
            "successful_authenticated_activity_cancels_older_notice_atomically"
        ]
        is True
    )
    assert evidence["cancellation_requires_activity_at_or_after_delivery"] is True
    assert evidence["cancelled_at_not_before_delivered_at_constrained"] is True
    assert evidence["constraint_hardening_migration"] == (
        "backend/app/schema_migrations/versions/v20260902_0014.py"
    )
    assert evidence["receipt_proof"] == (
        "backend/app/inactive_account_notice_receipt.py"
    )
    assert evidence["evidence_recording"] == (
        "backend/app/inactive_account_notice_recording.py"
    )
    assert evidence["tests"] == [
        "backend/tests/test_inactive_account_notice.py",
        "backend/tests/test_inactive_account_notice_receipt.py",
        "backend/tests/test_inactive_account_notice_recording.py",
    ]
    assert evidence["notice_evidence_removed_by_account_erasure"] is True
    assert evidence["notice_delivery_adapter_implemented"] is False
    assert evidence["scheduler_configured"] is False
    assert evidence["automatic_erasure_authorized"] is False
    assert evidence["production_execution_enabled"] is False
    assert evidence["real_notice_delivery_or_data_mutation_performed"] is False
    assert evidence["migration_or_deployment_performed"] is False
    eligibility = retention["inactive_account_erasure_eligibility"]
    assert eligibility["implementation_status"] == (
        "single-candidate-transaction-bound-read-only-guard-prepared-"
        "erasure-disabled"
    )
    assert eligibility["single_notice_lookup_only"] is True
    assert eligibility["explicit_timezone_evaluation_required"] is True
    assert eligibility["retention_deadline_rechecked"] is True
    assert eligibility[
        "active_account_and_unchanged_activity_anchor_required"
    ] is True
    assert eligibility["delivered_uncancelled_notice_required"] is True
    assert eligibility["postgresql_notice_and_user_for_update_requested"] is True
    assert eligibility["postgresql_lock_order"] == (
        "user-then-notice-matches-authenticated-activity"
    )
    assert eligibility["sqlite_row_lock_equivalence_claimed"] is False
    assert eligibility["pending_session_mutations_allowed"] is False
    assert eligibility["minimal_internal_candidate_returned"] is True
    assert (
        eligibility[
            "evidence_digest_contact_receipt_session_or_network_data_returned"
        ]
        is False
    )
    assert eligibility["candidate_return_authorizes_erasure"] is False
    assert eligibility["batch_selection_implemented"] is False
    assert eligibility["account_deletion_or_marking_implemented"] is False
    assert eligibility[
        "provider_network_queue_scheduler_or_endpoint_capability"
    ] is False
    assert eligibility["function_commits_or_rolls_back"] is False
    assert eligibility["production_execution_enabled"] is False
    assert eligibility["real_data_access_or_mutation_performed"] is False
    assert eligibility["migration_or_deployment_performed"] is False
    assert eligibility["implementation"] == (
        "backend/app/inactive_account_erasure_eligibility.py"
    )
    assert eligibility["tests"] == (
        "backend/tests/test_inactive_account_erasure_eligibility.py"
    )
    assert eligibility["runbook"] == (
        "docs/INACTIVE_ACCOUNT_ERASURE_ELIGIBILITY.md"
    )
    preflight = retention["inactive_account_erasure_preflight"]
    assert preflight["implementation_status"] == (
        "single-candidate-transaction-bound-read-only-dependent-data-"
        "preflight-prepared-erasure-disabled"
    )
    assert preflight["locked_eligibility_guard_reused"] is True
    assert preflight["single_candidate_only"] is True
    assert preflight["maximum_rows_per_relation"] == 10_000
    assert preflight["maximum_total_delete_rows"] == 20_000
    assert preflight["direct_primary_store_delete_shape_counted"] is True
    assert preflight["covered_delete_relations"] == [
        "calorieappuser",
        "food_log",
        "account_data_import_receipt",
        "externalidentity",
        "originloginhandoff",
        "authsession",
        "inactive_account_notice",
    ]
    assert preflight["inbound_session_replacement_references_counted"] is True
    assert preflight["shared_external_subject_requires_operator_review"] is True
    assert (
        preflight["unowned_legacy_authorization_requires_operator_review"] is True
    )
    assert preflight["postgresql_read_only_integration_test_implemented"] is True
    assert (
        preflight[
            "food_values_contact_external_subject_wallet_receipt_session_secret_"
            "or_network_data_returned"
        ]
        is False
    )
    assert preflight["preflight_authorizes_erasure"] is False
    assert preflight["account_deletion_or_marking_implemented"] is False
    assert preflight["function_flushes_commits_or_rolls_back"] is False
    assert (
        preflight["provider_network_queue_scheduler_cli_or_endpoint_capability"]
        is False
    )
    assert preflight["production_execution_enabled"] is False
    assert preflight["real_data_access_or_mutation_performed"] is False
    assert preflight["migration_or_deployment_performed"] is False
    assert preflight["implementation"] == (
        "backend/app/inactive_account_erasure_preflight.py"
    )
    assert preflight["tests"] == (
        "backend/tests/test_inactive_account_erasure_preflight.py"
    )
    assert preflight["runbook"] == (
        "docs/INACTIVE_ACCOUNT_ERASURE_PREFLIGHT.md"
    )
    execution = retention["inactive_account_erasure_execution"]
    assert execution["implementation_status"] == (
        "single-candidate-transaction-bound-non-production-staging-prepared-"
        "production-disabled"
    )
    assert execution["locked_preflight_reused"] is True
    assert execution["single_candidate_only"] is True
    assert execution["explicit_execution_enablement_required"] is True
    assert execution["explicit_approval_reference_required"] is True
    assert execution["maximum_approval_reference_bytes"] == 120
    assert execution["approval_reference_returned_as"] == "sha256-digest-only"
    assert execution["allowed_execution_environments"] == [
        "local",
        "staging",
        "test",
    ]
    assert execution["exact_per_relation_rowcount_revalidation"] is True
    assert execution["covered_delete_relations"] == [
        "calorieappuser",
        "food_log",
        "account_data_import_receipt",
        "externalidentity",
        "originloginhandoff",
        "authsession",
        "inactive_account_notice",
    ]
    assert (
        execution[
            "inbound_session_replacement_references_cleared_before_delete"
        ]
        is True
    )
    assert execution["sqlite_real_outer_transaction_started_before_savepoint"] is True
    assert execution["inner_savepoint_rolls_back_failed_mutation_sequence"] is True
    assert execution["caller_commit_or_rollback_required"] is True
    assert execution["function_commits_or_rolls_back_outer_transaction"] is False
    assert execution["missing_or_ineligible_notice_is_noop"] is True
    assert execution["aggregate_only_result"] is True
    assert (
        execution[
            "account_notice_food_contact_external_subject_wallet_receipt_session_"
            "secret_or_network_data_returned"
        ]
        is False
    )
    assert (
        execution[
            "endpoint_cli_batch_provider_network_queue_or_scheduler_capability"
        ]
        is False
    )
    assert execution["automatic_erasure_authorized"] is False
    assert execution["production_execution_enabled"] is False
    assert execution["postgresql_rollback_integration_test_implemented"] is True
    assert execution["real_data_access_or_mutation_performed"] is False
    assert execution["migration_or_deployment_performed"] is False
    assert execution["implementation"] == (
        "backend/app/inactive_account_erasure_execution.py"
    )
    assert execution["tests"] == (
        "backend/tests/test_inactive_account_erasure_execution.py"
    )
    assert execution["runbook"] == (
        "docs/INACTIVE_ACCOUNT_ERASURE_EXECUTION.md"
    )
    assert (
        retention["authentication_transient_security_retention_max_days_after_expiry"]
        == 30
    )
    assert retention["shorter_authentication_lifetimes_continue_to_apply"] is True
    assert retention["raw_ip_or_equivalent_network_signal_subject_to_same_maximum"] is True
    assert (
        retention["complete_authentication_transient_cleanup_enforcement_implemented"]
        is False
    )
    cleanup = retention["authentication_transient_cleanup"]
    assert cleanup["implementation_status"] == (
        "bounded-runner-implemented-scheduling-and-production-activation-pending"
    )
    assert cleanup["covered_tables"] == [
        "authorizationcode",
        "pendingloginstate",
        "pendingloginlocale",
        "originloginhandoff",
        "authsession",
        "bridgeauthnonce",
    ]
    assert cleanup["expired_rows_eligible_at_operational_expiry"] is True
    assert cleanup["revoked_sessions_eligible_before_expiry"] is True
    assert cleanup["revoked_sessions_require_revocation_at_or_before_cutoff"] is True
    assert cleanup["auth_session_order_uses_earliest_expiry_or_revocation"] is True
    assert cleanup["default_mode"] == "dry-run"
    assert cleanup["default_batch_limit_per_table"] == 500
    assert cleanup["maximum_batch_limit_per_table"] == 5_000
    assert cleanup["maximum_ids_per_mutation_statement"] == 500
    assert cleanup["large_batches_chunked_for_sqlite_parameter_safety"] is True
    assert cleanup["supported_database_backends"] == ["postgresql", "sqlite"]
    assert cleanup["atomic_execution_and_full_rollback_on_failure"] is True
    assert cleanup["inbound_session_replacement_references_cleared_before_delete"] is True
    assert cleanup["aggregate_only_output"] is True
    assert (
        cleanup["record_identifiers_secrets_or_network_signals_in_output_allowed"]
        is False
    )
    assert cleanup["dedicated_clean_database_session_required"] is True
    assert cleanup["preexisting_transaction_or_loaded_identity_map_allowed"] is False
    assert cleanup["dry_run_read_transaction_rolled_back_before_return"] is True
    assert cleanup["explicit_non_production_enablement_required"] is True
    assert cleanup["explicit_approval_reference_required"] is True
    assert cleanup["scheduler_configured"] is False
    assert cleanup["production_execution_enabled"] is False
    assert cleanup["real_data_mutation_performed"] is False
    assert retention["provider_and_restore_replay_proof_pending"] is True
    assert retention["unresolved_release_decisions"] == []


def test_privacy_notice_alignment_records_facts_without_authorizing_publication() -> None:
    alignment = _load_json("privacy-notice-alignment.json")
    safety = _load_json("data-safety.json")
    publication = alignment["publication"]
    facts = alignment["canonical_current_facts"]
    guards = alignment["activation_guards"]

    assert alignment["contract_id"] == "calorieapp.privacy-notice-alignment"
    assert alignment["contract_version"] == "1.6.0"
    assert alignment["status"] == (
        "canonical-v2-facts-and-eleven-language-export-import-erasure-copy-"
        "aligned-publication-pending"
    )
    assert alignment["release_state"] == "blocked"
    assert alignment["legal_certification_claimed"] is False
    assert publication["authorized"] is False
    assert publication["published_by_this_change"] is False
    assert publication["complete_privacy_notice_approved"] is False
    assert publication["controller_identity_and_contact_approved"] is False
    assert publication["processing_purposes_and_legal_bases_approved"] is False
    assert publication["special_category_and_dpia_need_assessed"] is False
    assert publication["processors_recipients_and_transfer_safeguards_approved"] is False
    assert publication["data_subject_request_contact_route_approved"] is False
    assert publication["supervisory_authority_information_approved"] is False
    assert publication["consent_withdrawal_information_approved"] is False
    assert (
        publication["automated_decision_making_and_profiling_information_approved"]
        is False
    )
    assert publication["data_provision_requirements_and_consequences_approved"] is False
    assert publication["child_user_and_age_assurance_assessment_completed"] is False
    assert publication["provider_specific_storage_and_backup_wording_approved"] is False
    assert publication["independent_legal_privacy_review_completed"] is False
    assert publication["eleven_language_review_completed"] is False

    localized = alignment["current_localized_account_action_copy"]
    assert localized["source"] == "frontend/config/account-privacy-copy.json"
    assert localized["required_locales_complete"] is True
    assert localized["private_export_copy_complete"] is True
    assert localized["private_import_copy_complete"] is True
    assert localized["account_erasure_copy_complete"] is True
    assert localized["rtl_direction_applied_for_arabic_and_urdu"] is True
    assert localized["safe_english_fallback_required"] is True
    assert localized["independent_language_review_completed"] is False
    assert localized["independent_legal_privacy_review_completed"] is False
    assert (
        localized["unavailable_independent_review_blocks_five_step_plan_development"]
        is False
    )
    assert localized[
        "publication_and_production_still_require_explicit_operator_approval"
    ] is True
    assert localized["operator_publication_approval_completed"] is False

    assert facts["private_account_export"]["authenticated_user_only"] is True
    assert facts["private_account_export"]["security_secrets_excluded"] is True
    assert (
        "inactive-account-notice-lifecycle-without-delivery-evidence-digest"
        in facts["private_account_export"]["included_categories"]
    )
    assert facts["private_account_export"]["external_delivery_performed"] is False
    assert facts["private_account_export"]["download_changes_or_deletes_server_data"] is False
    private_import = facts["private_account_import"]
    assert private_import["enabled_by_default"] is False
    assert private_import["authenticated_target_only"] is True
    assert private_import["non_production_only"] is True
    assert private_import["same_origin_intent_required"] is True
    assert private_import["exact_reviewed_running_commit_match_required"] is True
    assert private_import["target_account_must_be_empty_for_new_import"] is True
    assert private_import["imported_categories"] == [
        "owned-private-food-log-snapshots"
    ]
    assert "authentication-sessions" in private_import["excluded_live_state"]
    assert private_import["uploaded_export_retained_as_file"] is False
    assert private_import["provider_exit_import_proved"] is False
    receipt_disclosure = alignment["implemented_disclosure"][
        "private_import_receipt_summaries"
    ]
    assert receipt_disclosure["contract"] == (
        "contracts/data-safety/v1/account-data-import-receipt-disclosure.json"
    )
    assert receipt_disclosure["current_export_version"] == (
        "calorieapp-account-data-v2"
    )
    assert receipt_disclosure["current_runtime_changed"] is True
    assert set(receipt_disclosure["included_fields"]) == {
        "imported_at",
        "food_log_count",
        "source_export_version",
        "import_plan_version",
    }
    assert "private-import-digest" in receipt_disclosure["excluded_fields"]
    assert receipt_disclosure["restored_as_live_replay_evidence"] is False
    assert facts["direct_account_erasure"]["enabled_by_default"] is False
    assert facts["direct_account_erasure"][
        "primary_store_erasure_immediate_after_confirmed_request"
    ] == safety["account_erasure"][
        "primary_store_erasure_immediate_after_confirmed_request"
    ]
    assert facts["direct_account_erasure"]["app_recovery_window_days"] == (
        safety["account_erasure"]["recovery_window_days"]
    )
    assert facts["direct_account_erasure"]["maximum_encrypted_backup_retention_days"] == (
        safety["account_erasure"]["maximum_encrypted_backup_retention_days"]
    )
    assert facts["direct_account_erasure"][
        "backup_schedule_and_restore_replay_proved"
    ] == safety["account_erasure"]["backup_schedule_and_restore_replay_proved"]
    assert facts["inactive_account_retention"]["automatic_enforcement_enabled"] is False
    assert facts["inactive_account_retention"]["inactivity_months"] == (
        safety["retention"]["inactive_account_retention_months"]
    )
    assert facts["inactive_account_retention"]["advance_notice_days"] == (
        safety["retention"]["inactive_account_notice_days"]
    )
    assert facts["inactive_account_retention"][
        "activity_marker_repository_implementation_prepared"
    ] is True
    assert facts["inactive_account_retention"][
        "activity_marker_deployed_or_backfilled"
    ] is False
    assert facts["inactive_account_retention"][
        "notice_evidence_schema_and_activity_cancellation_prepared"
    ] is True
    assert facts["inactive_account_retention"][
        "notice_delivery_channel_or_provider_selected"
    ] is False
    assert facts["inactive_account_retention"][
        "raw_contact_or_provider_receipt_stored"
    ] is False
    assert facts["authentication_transients"]["maximum_days_after_expiry"] == (
        safety["retention"][
            "authentication_transient_security_retention_max_days_after_expiry"
        ]
    )
    assert facts["decentralized_boundary"]["personal_data_on_public_blockchain_allowed"] is False
    assert facts["decentralized_boundary"]["personal_data_on_public_ipfs_allowed"] is False

    assert set(alignment["notice_scope_data_classes"]["required_ids"]) == {
        item["id"] for item in safety["data_classes"]
    }

    locale_registry = json.loads(
        (ROOT / "frontend" / "config" / "locales.json").read_text(encoding="utf-8")
    )
    assert alignment["required_locales"] == [
        locale["tag"] for locale in locale_registry["locales"]
    ]

    for copy_boundary in alignment["current_english_product_copy"].values():
        if not isinstance(copy_boundary, dict) or "source" not in copy_boundary:
            continue
        source = _normalized_copy(ROOT / copy_boundary["source"])
        for required_fact in copy_boundary["required_plain_language_facts"]:
            assert required_fact in source

    assert guards["release_remains_blocked"] is True
    assert guards["account_erasure_flags_changed"] is False
    assert guards["account_import_enabled_by_default"] is False
    assert guards["account_import_activated_by_this_change"] is False
    assert guards["inactive_account_deletion_enabled"] is False
    assert guards["authentication_transient_cleanup_enabled"] is False
    assert guards["migration_performed"] is False
    assert guards["deployment_performed"] is False
    assert guards["live_personal_data_mutated"] is False


def test_account_erasure_is_private_fail_closed_and_human_gated() -> None:
    erasure = _load_json("data-safety.json")["account_erasure"]

    assert erasure["status"] == (
        "v2-backend-and-eleven-language-ui-implemented-disabled-"
        "pending-notice-and-provider-proof"
    )
    assert erasure["enabled_by_default"] is False
    assert erasure["ui_enabled_by_default"] is False
    assert erasure["frontend_and_backend_separate_enablement_required"] is True
    assert erasure["authenticated_user_only"] is True
    assert erasure["same_origin_intent_required"] is True
    assert erasure["explicit_internal_user_id_confirmation_required"] is True
    assert erasure["fixed_machine_acknowledgement_required"] is True
    assert erasure["cross_user_deletion_allowed"] is False
    assert erasure["ambiguous_legacy_identity_fails_closed"] is True
    assert erasure["unowned_legacy_authorization_fails_closed"] is True
    assert erasure["legacy_authorization_events_deleted_without_direct_ownership"] is False
    assert erasure[
        "direct_ownership_migration_required_before_legacy_authorization_erasure"
    ] is True
    assert erasure["all_primary_authentication_sessions_removed"] is True
    assert erasure["inbound_session_replacement_references_cleared"] is True
    assert erasure[
        "directly_owned_primary_food_history_identity_links_sessions_and_handoffs_removed"
    ] is True
    assert erasure["private_account_import_replay_receipts_removed"] is True
    assert erasure["browser_session_cookie_cleared"] is True
    assert erasure["backup_erasure_claimed_complete"] is False
    assert erasure["recovery_window_selected"] is True
    assert erasure["recovery_window_days"] == 0
    assert erasure["primary_store_erasure_immediate_after_confirmed_request"] is True
    assert erasure["maximum_encrypted_backup_retention_days"] == 30
    assert erasure["restored_backup_must_reapply_erasure_requests"] is True
    assert erasure["backup_schedule_and_restore_replay_proved"] is False
    assert erasure["english_confirmation_ui_implemented"] is True
    assert erasure["english_ui_is_approved_privacy_notice"] is False
    assert erasure["eleven_language_erasure_ui_completed"] is True
    assert erasure["localized_copy_source"] == (
        "frontend/config/account-privacy-copy.json"
    )
    assert erasure["independent_language_or_legal_review_completed"] is False
    assert erasure["eleven_language_identity_bridge_ui_required"] is True
    assert erasure["privacy_notice_alignment_required"] is True
    assert erasure["human_release_approval_required_to_enable"] is True
    assert erasure["production_enabled_or_data_mutation_performed"] is False


def test_xrpl_linking_is_optional_off_chain_and_privacy_preserving() -> None:
    contract = _load_json("data-safety.json")
    linking = contract["xrpl_transaction_linking"]
    memo = linking["memo"]

    assert linking["status"] == "planned-disabled-by-default"
    assert linking["current_release_dependency"] is False
    assert linking["initial_user_facing_feature"] is False
    assert linking["canonical_anchor"] == ["network", "transaction_hash"]
    assert linking["accepted_ledger_state"] == "validated"
    assert linking["database_link_is_off_chain"] is True
    assert linking["link_requires_explicit_user_action"] is True
    assert linking["automatic_wallet_history_profiling_allowed"] is False
    assert linking["wallet_key_or_custody_access_allowed"] is False
    assert memo["personal_data_allowed"] is False
    assert memo["stable_user_identifier_allowed"] is False
    assert memo["raw_database_identifier_allowed"] is False
    assert memo["plain_record_hash_allowed"] is False
    relation = linking["hash_relation_model"]
    assert relation["public_anchor"] == ["network", "transaction_hash"]
    assert relation["paired_caloriedb_anchor"] == "calorie_anchor_hash"
    assert relation["top_pair_cardinality"] == "one-to-one"
    assert relation["private_record_anchor"] == "calorie_record_fingerprint_id"
    assert relation["join_entity"] == "ledger_record_link"
    assert relation["transaction_hash_equals_record_hash"] is False
    assert relation["anchor_to_record_many_to_many_edges_allowed"] is True
    assert relation["explicit_authorization_required_per_edge"] is True
    assert relation["cross_purpose_auto_linking_allowed"] is False
    assert relation["public_hash_resolver_may_return_private_data"] is False
    assert linking["unlinking"]["off_chain_association_deletable"] is True
    assert linking["unlinking"]["on_chain_transaction_deletable"] is False


def test_xrpl_linking_cannot_claim_automatic_worldwide_compliance() -> None:
    boundary = _load_json("data-safety.json")["global_compliance_boundary"]

    assert boundary["worldwide_compliance_claim_allowed"] is False
    assert boundary["jurisdiction_feature_gates_required"] is True
    assert boundary["data_protection_impact_assessment_required_before_enablement"] is True
    assert boundary["independent_financial_regulatory_review_required_before_enablement"] is True
    assert boundary["transaction_execution_or_routing_enabled"] is False


def test_platform_budget_prevents_duplicate_core_services() -> None:
    platforms = _load_json("data-safety.json")["platform_minimization"]

    assert platforms["duplicate_identity_platform_allowed"] is False
    assert platforms["second_primary_database_allowed"] is False
    assert platforms["separate_graph_database_required"] is False
    assert platforms["blockchain_database_required"] is False
    assert platforms["ipfs_or_filecoin_required_for_core_release"] is False
    assert platforms["new_provider_requires_architecture_record"] is True
    assert platforms["roles"]["optional_ledger_reference"] == "XRPL only"


def test_food_data_sources_are_extensible_without_losing_provenance() -> None:
    sources = _load_json("data-safety.json")["food_data_sources"]

    assert sources["current_adapter"] == "open_food_facts"
    assert sources["current_adapter_catalog_persistence_enabled"] is False
    assert sources["implemented_catalog_tables"] == [
        "food_source",
        "food_source_record",
        "food_source_moderation_audit",
        "food_product",
        "food_product_source_link",
        "food_attribute_assertion",
        "food_attribute_assertion_ingest_audit",
        "food_attribute_assertion_moderation_audit",
        "food_attribute_assertion_correction_audit",
    ]
    assert sources["internal_source_record_ingest_service_implemented"] is True
    assert sources[
        "internal_source_record_terminal_moderation_service_implemented"
    ] is True
    assert sources["source_record_expected_version_and_audit_implemented"] is True
    assert sources["source_neutral_catalog_entity_foundation_implemented"] is True
    assert sources[
        "catalog_conflict_retention_and_licence_evidence_verified"
    ] is True
    assert sources["catalog_assertion_write_service_implemented"] is True
    assert sources["internal_source_assertion_ingest_service_implemented"] is True
    assert sources[
        "source_assertion_ingest_requires_validated_record_and_link"
    ] is True
    assert sources[
        "source_assertion_ingest_requires_expected_record_version_and_idempotency"
    ] is True
    assert sources["source_assertion_ingest_defaults_to_quarantine"] is True
    assert sources[
        "source_assertion_ingest_atomic_minimal_audit_implemented"
    ] is True
    assert sources["source_assertion_ingest_per_source_budget_implemented"] is True
    assert sources["source_assertion_moderation_service_implemented"] is True
    assert sources[
        "source_assertion_moderation_expected_version_and_audit_implemented"
    ] is True
    assert sources[
        "source_assertion_validation_rechecks_policy_and_active_lineage"
    ] is True
    assert sources["source_assertion_correction_service_implemented"] is True
    assert sources[
        "source_assertion_correction_expected_version_idempotency_and_audit_implemented"
    ] is True
    assert sources[
        "source_assertion_correction_rechecks_policy_lineage_and_budget"
    ] is True
    assert sources[
        "source_assertion_correction_preserves_predecessor_and_private_history"
    ] is True
    assert sources["source_assertion_correction_defaults_to_quarantine"] is True
    assert sources["source_assertion_correction_authenticated_caller_enforced"] is False
    assert sources["source_assertion_correction_public_endpoint_enabled"] is False
    assert sources["public_source_assertion_ingest_endpoint_enabled"] is False
    assert sources["public_catalog_read_endpoint_enabled"] is False
    assert sources["complete_source_assertion_mutation_flow_implemented"] is False
    assert sources["public_source_record_moderation_endpoint_enabled"] is False
    assert sources["public_source_onboarding_enabled"] is False
    assert sources["current_adapter_is_canonical_model"] is False
    assert sources["current_adapter_is_exclusive_authority"] is False
    assert sources["additional_sources_require_core_schema_rewrite"] is False
    assert sources["separate_source_assertions_required"] is True
    assert sources["silent_cross_source_overwrite_allowed"] is False
    assert sources["source_licence_and_attribution_preservation_required"] is True
    assert sources["private_history_is_point_in_time_snapshot"] is True
    assert sources["later_source_change_may_rewrite_private_history"] is False
    assert sources["private_history_auto_published_as_catalog_source"] is False
    assert sources["identity_bridge_private_fields_allowed_in_public_catalog"] is False
    assert sources["source_independent_schema_compatibility_required_for_v2"] is True
    assert sources["additional_source_activation_required_for_v2"] is False
    assert sources["current_release_dependency"] is True
    assert sources["v2_forward_migration_required"] is False


def test_abuse_capacity_and_mutation_are_release_blocking() -> None:
    safety = _load_json("data-safety.json")["abuse_capacity_and_mutation_safety"]

    assert safety["status"] == "partial-release-blocking"
    assert safety["route_specific_rate_limits_required"] is True
    assert safety["bounded_end_to_end_retry_budget_required"] is True
    assert safety["nested_retry_amplification_allowed"] is False
    assert safety["bounded_concurrency_and_queue_required"] is True
    assert safety["per_process_adapter_admission_implemented"] is True
    assert safety["duplicate_in_flight_read_coalescing_implemented"] is True
    assert safety["shared_multi_instance_adapter_admission_implemented"] is False
    assert safety["mutation_request_body_size_limit_implemented"] is True
    assert safety["declared_and_actual_body_bytes_enforced"] is True
    assert safety["per_subject_and_source_data_growth_quotas_implemented"] is True
    assert safety["source_record_terminal_moderation_and_audit_implemented"] is True
    assert safety["source_assertion_ingest_and_audit_implemented"] is True
    assert safety["source_assertion_ingest_per_source_budget_implemented"] is True
    assert safety[
        "source_assertion_terminal_moderation_and_audit_implemented"
    ] is True
    assert safety["source_assertion_retained_correction_and_audit_implemented"] is True
    assert safety["complete_contribution_mutation_flow_implemented"] is False
    assert safety["raw_ip_or_search_text_in_long_term_abuse_profile_allowed"] is False
    assert safety["external_integration_default_access"] == "read-only"
    assert safety["direct_ecosystem_database_write_allowed"] is False
    assert safety["silent_catalog_assertion_overwrite_allowed"] is False
    assert safety["unmoderated_public_contribution_activation_allowed"] is False
    assert safety["production_schema_mutation_requires_separate_approval"] is True
    assert safety["postgresql_runtime_role_privilege_policy_implemented"] is True
    assert safety[
        "postgresql_runtime_role_synthetic_ci_proof_implemented"
    ] is True
    assert safety[
        "postgresql_runtime_role_staging_or_production_proof_completed"
    ] is False
    assert safety["automatic_xrpl_transaction_creation_allowed"] is False
    assert safety["current_release_dependency"] is True


def test_core_stays_free_while_separate_value_added_services_remain_possible() -> None:
    contract = _load_json("data-safety.json")
    cost = contract["cost_sustainability"]
    access = contract["free_core_and_optional_services"]
    web3 = contract["web3_cost_boundary"]

    assert cost["core_ecosystem_end_user_price"] == "free"
    assert cost["additional_recurring_app_hosting_subscription_allowed"] is False
    assert cost["additional_recurring_database_hosting_subscription_allowed"] is False
    assert cost["automatic_infrastructure_paid_upgrade_allowed"] is False
    assert cost["paid_database_capability_required_for_core"] is False
    assert cost["paid_web3_capability_required_for_core"] is False
    assert cost["third_party_free_tier_permanence_claim_allowed"] is False
    assert cost["new_onboarding_must_pause_before_data_safety_or_quota_failure"] is True
    assert cost["existing_user_history_may_be_deleted_to_stay_free"] is False
    assert cost["no_additional_cost_exit_plan_required_before_public_onboarding"] is True
    assert cost["provider_evaluation_contract"] == (
        "contracts/data-safety/v1/provider-evaluation.json"
    )
    assert cost["synthetic_provider_use_preflight"] == (
        "backend/app/synthetic_provider_use_preflight.py"
    )
    assert cost["synthetic_provider_use_preflight_status"] == (
        "controls-ready-separate-operation-approval-required-no-provider-contact"
    )
    assert cost["provider_selected"] is True
    assert cost["selected_provider"] == "neon_free"
    assert cost["provider_selection_scope"] == "isolated-synthetic-staging-only"
    assert cost["provider_selected_for_public_release"] is False
    assert cost["provider_account_created"] is True
    assert cost["provider_project_created"] is True
    assert access["optional_value_added_services_may_be_paid"] is True
    assert access["core_data_rights_may_be_paywalled"] is False
    assert access["identity_access_may_be_paywalled"] is False
    assert access["premium_feature_may_enable_automatic_financial_action"] is False
    assert web3["bigchaindb_selected"] is False
    assert web3["automatic_fee_bearing_action_allowed"] is False


def test_external_developer_access_is_brokered_scoped_and_disabled() -> None:
    access = _load_json("data-safety.json")["ecosystem_developer_access"]

    assert access["status"] == "future-candidate-disabled-by-default"
    assert access["official_identity_bridge_operator"] == (
        "Pieter Hendrikse and CalorieToken"
    )
    assert (
        access["identity_bridge_foundation_control_remains_with_current_operator"]
        is True
    )
    assert access["reviewed_ecosystem_linking_interface_allowed"] is True
    assert (
        access["ecosystem_participant_may_administer_identity_bridge_foundation"]
        is False
    )
    assert (
        access["open_specs_contracts_and_local_conformance_tools_must_remain_free"]
        is True
    )
    assert access["registered_and_reviewed_client_required"] is True
    assert access["explicit_user_consent_required_per_purpose"] is True
    assert access["least_privilege_scopes_required"] is True
    assert access["pairwise_pseudonymous_subject_required"] is True
    assert access["short_lived_audience_restricted_tokens_required"] is True
    assert access["direct_identity_database_access_allowed"] is False
    assert access["direct_session_store_access_allowed"] is False
    assert access["password_or_identity_bridge_session_disclosure_allowed"] is False
    assert access["donation_or_food_history_scope_enabled_by_default"] is False
    assert access["payment_may_grant_broader_personal_data_scope"] is False


def test_official_products_and_separate_ecosystem_have_a_reuse_boundary() -> None:
    boundary = _load_json("data-safety.json")["product_ecosystem_boundary"]

    assert boundary["official_product_operator"] == (
        "Pieter Hendrikse with the designated CalorieToken development team"
    )
    assert "calorietoken-website-and-official-wordpress-presentation" in boundary[
        "official_product_layer"
    ]
    assert (
        "official-calorieapp-identity-bridge-service-and-production-configuration"
        in boundary["official_product_layer"]
    )
    assert "approved-extension-interfaces" in boundary["separate_ecosystem_layer"]
    assert boundary["ecosystem_is_part_of_official_product_layer"] is False
    assert boundary["ecosystem_participation_grants_official_product_control"] is False
    assert boundary["public_source_visibility_is_reuse_permission"] is False
    assert boundary["identity_bridge_component_declared_licence"] == "GPL-2.0-or-later"
    assert boundary["identity_bridge_code_provenance_contract"] == (
        "contracts/identity-bridge/v1/code-provenance.json"
    )
    assert boundary["component_rights_registry_contract"] == (
        "contracts/governance/v2/component-rights-registry.json"
    )
    assert boundary["developer_claim_must_be_component_specific_and_evidence_based"] is True
    assert boundary["developer_contribution_grants_claim_over_entire_product_or_ecosystem"] is False
    assert boundary[
        "credit_authorship_copyright_licence_maintenance_and_official_control_are_separate"
    ] is True
    assert boundary["unknown_or_disputed_rights_must_remain_unknown_or_disputed"] is True
    assert boundary["user_data_or_identity_records_may_be_claimed_as_developer_ip"] is False
    assert boundary["dao_may_reassign_or_relicense_existing_component_rights_without_authority"] is False
    assert boundary["identity_bridge_public_distribution_clearance_status"] == (
        "blocked-pending-source-clearance"
    )
    assert boundary["identity_bridge_ecosystem_reuse_expansion_allowed"] is False
    assert boundary["identity_bridge_code_licence_grants_official_service_access"] is False
    assert (
        boundary["identity_bridge_code_licence_grants_brand_or_official_status"]
        is False
    )
    assert (
        boundary["official_identity_bridge_release_and_service_control_remains_with_operator"]
        is True
    )
    assert boundary["legal_ownership_or_third_party_rights_adjudicated_by_this_contract"] is False


def test_official_app_control_and_parallel_ecosystem_are_separate() -> None:
    continuity = _load_json("data-safety.json")["ecosystem_continuity"]

    assert continuity["official_calorieapp_active_operator"] == (
        "Pieter Hendrikse and CalorieToken"
    )
    assert continuity["official_app_management_remains_with_current_operator"] is True
    assert continuity["official_brand_and_release_authority_open_by_default"] is False
    assert continuity["parallel_open_ecosystem_layer_required"] is True
    assert continuity["open_ecosystem_scope"] == [
        "schemas",
        "contracts",
        "data-formats",
        "verification-specifications",
        "extension-interfaces",
    ]
    assert continuity["external_contribution_auto_accepted_into_official_app"] is False
    assert continuity["official_integration_requires_operator_review"] is True
    assert continuity["emergency_continuity_is_active_control_transfer"] is False
    assert continuity["fork_may_claim_official_calorieapp_or_calorietoken_brand"] is False
    assert (
        continuity[
            "open_or_published_ecosystem_layer_overrides_component_licensing"
        ]
        is False
    )
    assert continuity["single_person_operational_dependency_allowed_for_public_release"] is False
    assert continuity["open_schema_and_contracts_required"] is True
    assert continuity["reproducible_build_and_provider_neutral_deployment_required"] is True
    assert continuity["versioned_export_and_import_required"] is True
    assert continuity["pure_versioned_food_history_import_plan_implemented"] is True
    assert continuity[
        "authenticated_transactional_import_and_provider_exit_proof_completed"
    ] is False
    assert continuity[
        "authentication_security_state_may_be_imported_from_user_export"
    ] is False
    assert continuity["user_controlled_encrypted_backup_required_before_continuity_claim"] is True
    assert continuity["public_xrpl_anchors_remain_independently_verifiable"] is True
    assert continuity["confidential_operator_succession_runbook_required"] is True
    assert continuity["secrets_or_personal_data_in_public_runbook_allowed"] is False
    assert continuity["automatic_dead_man_switch_allowed"] is False
    assert continuity["automatic_credential_or_asset_transfer_allowed"] is False


def test_responsible_automation_keeps_human_release_and_privacy_gates() -> None:
    automation = _load_json("data-safety.json")["responsible_automation"]

    assert "test-and-build-checks" in automation["automated_by_default"]
    assert "scheduled-staging-restore-drills" in automation["automated_by_default"]
    assert "localization-completeness-checks" in automation["automated_by_default"]
    assert "identity-purpose-expansion" in automation["approval_required"]
    assert "automation-authority-or-policy-expansion" in automation["approval_required"]
    assert "dao-activation-or-governance-scope-handover" in automation[
        "approval_required"
    ]
    assert "xrpl-feature-enablement" in automation["approval_required"]
    assert "public-content-publication" in automation["approval_required"]
    assert automation["production_automation_runs_only_after_approval"] is True
    assert automation["idempotent_and_retry_safe_required"] is True
    assert automation["fully_autonomous_product_or_ecosystem_operation_allowed"] is False
    assert automation["self_modifying_governance_or_approval_rules_allowed"] is False
    assert automation["ai_or_automation_may_be_final_accountable_authority"] is False
    assert automation[
        "permanent_human_direction_safety_incident_appeal_and_accountability_layer_required"
    ] is True
    assert automation["human_emergency_pause_and_recovery_capability_required"] is True
    assert automation[
        "human_override_may_bypass_law_consent_privacy_or_security_invariants"
    ] is False
    assert automation["automatic_publication_allowed"] is False
    assert automation["automatic_financial_action_allowed"] is False


def test_permanent_human_governance_forbids_full_autonomy() -> None:
    human = _load_json("data-safety.json")["permanent_human_governance"]

    assert human["status"] == "non-removable-safety-and-accountability-boundary"
    assert human["fully_autonomous_operation_allowed"] is False
    assert "purpose-values-and-strategic-direction" in human["human_managed_functions"]
    assert "security-incident-command-emergency-pause-and-recovery" in human[
        "human_managed_functions"
    ]
    assert human["automation_role"] == (
        "bounded-test-evidence-advice-and-preapproved-execution"
    )
    assert human["self_modifying_code_policy_scope_or_governance_allowed"] is False
    assert human[
        "irreversible_privacy_financial_publication_or_production_action_without_fresh_human_approval_allowed"
    ] is False
    assert human["future_dao_may_remove_human_accountability_or_emergency_controls"] is False
    assert human["high_impact_multi_person_approval_required_before_future_distributed_governance"] is True
    assert human["emergency_pause_must_be_time_bounded_audited_and_reviewed"] is True
    assert human[
        "human_override_may_violate_law_consent_data_rights_or_recorded_component_rights"
    ] is False


def test_all_required_durable_data_release_gates_are_explicit_and_blocking() -> None:
    matrix = _load_json("release-test-matrix.json")
    gates = {gate["id"]: gate for gate in matrix["gates"]}
    expected = {
        "abuse_capacity_and_mutation_controls",
        "component_rights_and_contributor_provenance",
        "v2_deployment_provenance",
        "provider_neutral_postgresql_configuration",
        "production_sqlite_fail_closed",
        "formal_schema_migrations",
        "zero_additional_cost_capacity_and_exit_plan",
        "ecosystem_operator_succession_and_handover",
        "owner_isolation",
        "restart_persistence",
        "redeploy_persistence",
        "backup_restore_drill",
        "user_data_export",
        "user_erasure",
        "retention_policy",
        "privacy_notice_alignment",
        "no_personal_data_in_decentralized_public_storage",
    }

    assert matrix["contract_id"] == "calorieapp.durable-data-release-gates"
    assert matrix["contract_version"] == "1.24.0"
    assert set(gates) == expected
    assert all(gate["release_blocking"] is True for gate in gates.values())
    assert all(gate["status"] in matrix["statuses"] for gate in gates.values())
    assert gates["owner_isolation"]["status"] == "verified"
    assert gates["production_sqlite_fail_closed"]["status"] == "verified"
    assert gates["formal_schema_migrations"]["status"] == "verified"
    assert gates["v2_deployment_provenance"]["status"] == "partial"
    assert "tools/build_v2_release_manifest.py" in gates[
        "v2_deployment_provenance"
    ]["evidence"]
    assert gates["abuse_capacity_and_mutation_controls"]["status"] == "partial"
    assert "backend/app/postgresql_privileges.py" in gates[
        "abuse_capacity_and_mutation_controls"
    ]["evidence"]
    assert "backend/app/account_data_import_admission.py" in gates[
        "abuse_capacity_and_mutation_controls"
    ]["evidence"]
    assert "backend/app/account_data_import_transaction.py" in gates[
        "abuse_capacity_and_mutation_controls"
    ]["evidence"]
    assert "backend/app/account_data_import_release.py" in gates[
        "abuse_capacity_and_mutation_controls"
    ]["evidence"]
    assert "docs/POSTGRESQL_APPLICATION_ROLE_PRIVILEGES.md" in gates[
        "abuse_capacity_and_mutation_controls"
    ]["evidence"]
    assert gates["component_rights_and_contributor_provenance"]["status"] == "partial"
    assert gates["zero_additional_cost_capacity_and_exit_plan"]["status"] == "partial"
    assert "backend/app/account_data_import.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert "backend/app/account_data_import_admission.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert "backend/app/account_data_import_transaction.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert "backend/tests/test_account_data_import.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert "backend/tests/test_account_data_import_endpoint.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert gates["ecosystem_operator_succession_and_handover"]["status"] == "partial"
    assert "docs/ACCOUNT_DATA_IMPORT.md" in gates[
        "ecosystem_operator_succession_and_handover"
    ]["evidence"]
    assert "backend/app/account_data_import_admission.py" in gates[
        "ecosystem_operator_succession_and_handover"
    ]["evidence"]
    assert "backend/app/account_data_import_transaction.py" in gates[
        "ecosystem_operator_succession_and_handover"
    ]["evidence"]
    assert "backend/app/account_data_import_release.py" in gates[
        "ecosystem_operator_succession_and_handover"
    ]["evidence"]
    assert gates["restart_persistence"]["status"] == "partial"
    assert gates["redeploy_persistence"]["status"] == "partial"
    assert "backend/app/redeploy_persistence_drill.py" in gates[
        "redeploy_persistence"
    ]["evidence"]
    assert gates["backup_restore_drill"]["status"] == "partial"
    assert "backend/app/backup_restore_drill.py" in gates["backup_restore_drill"][
        "evidence"
    ]
    assert "backend/app/account_erasure_replay_proof.py" in gates[
        "backup_restore_drill"
    ]["evidence"]
    assert "backend/tests/test_account_erasure_replay_proof.py" in gates[
        "backup_restore_drill"
    ]["evidence"]
    assert "docs/ACCOUNT_ERASURE_REPLAY_PROOF.md" in gates[
        "backup_restore_drill"
    ]["evidence"]
    assert "backend/app/synthetic_provider_use_preflight.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert "backend/tests/test_synthetic_provider_use_preflight.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert "backend/app/synthetic_staging_acceptance.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert ".github/workflows/neon-synthetic-acceptance.yml" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert "tools/check_tracked_secret_patterns.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert "tools/tests/test_tracked_secret_patterns.py" in gates[
        "zero_additional_cost_capacity_and_exit_plan"
    ]["evidence"]
    assert gates["user_data_export"]["status"] == "partial"
    assert (
        "contracts/data-safety/v1/account-data-import-receipt-disclosure.json"
        in gates["user_data_export"]["evidence"]
    )
    assert (
        "backend/tests/test_account_data_import_receipt_disclosure_contract.py"
        in gates["user_data_export"]["evidence"]
    )
    assert "backend/app/schema_migrations/versions/v20260902_0016.py" in gates[
        "user_data_export"
    ]["evidence"]
    assert "backend/tests/test_account_data_export.py" in gates["user_data_export"][
        "evidence"
    ]
    assert "backend/app/account_data_import.py" in gates["user_data_export"][
        "evidence"
    ]
    assert "backend/app/account_data_import_admission.py" in gates[
        "user_data_export"
    ]["evidence"]
    assert "backend/app/account_data_import_transaction.py" in gates[
        "user_data_export"
    ]["evidence"]
    assert "backend/tests/test_account_data_import.py" in gates[
        "user_data_export"
    ]["evidence"]
    assert "backend/tests/test_account_data_import_endpoint.py" in gates[
        "user_data_export"
    ]["evidence"]
    assert "frontend/components/AccountDataImportPanel.tsx" in gates[
        "user_data_export"
    ]["evidence"]
    assert "tools/tests/account_data_import_ui.test.mjs" in gates[
        "user_data_export"
    ]["evidence"]
    assert "frontend/config/account-privacy-copy.json" in gates[
        "user_data_export"
    ]["evidence"]
    assert "tools/tests/account_privacy_locales.test.mjs" in gates[
        "user_data_export"
    ]["evidence"]
    assert gates["user_erasure"]["status"] == "partial"
    assert "backend/tests/test_account_erasure.py" in gates["user_erasure"][
        "evidence"
    ]
    assert "frontend/components/AccountErasurePanel.tsx" in gates[
        "user_erasure"
    ]["evidence"]
    assert "frontend/config/account-privacy-copy.json" in gates[
        "user_erasure"
    ]["evidence"]
    assert "backend/app/account_erasure_replay_proof.py" in gates[
        "user_erasure"
    ]["evidence"]
    assert "backend/tests/test_account_erasure_replay_proof.py" in gates[
        "user_erasure"
    ]["evidence"]
    assert "docs/ACCOUNT_ERASURE_REPLAY_PROOF.md" in gates["user_erasure"][
        "evidence"
    ]
    assert gates["retention_policy"]["status"] == "partial"
    assert "docs/RETENTION_POLICY.md" in gates["retention_policy"]["evidence"]
    assert "docs/AUTHENTICATED_ACTIVITY_RETENTION_MARKER.md" in gates[
        "retention_policy"
    ]["evidence"]
    assert "docs/INACTIVE_ACCOUNT_PREVIEW.md" in gates["retention_policy"][
        "evidence"
    ]
    assert "docs/INACTIVE_ACCOUNT_ERASURE_ELIGIBILITY.md" in gates[
        "retention_policy"
    ]["evidence"]
    assert "docs/INACTIVE_ACCOUNT_ERASURE_PREFLIGHT.md" in gates[
        "retention_policy"
    ]["evidence"]
    assert "docs/INACTIVE_ACCOUNT_ERASURE_EXECUTION.md" in gates[
        "retention_policy"
    ]["evidence"]
    assert "docs/AUTH_TRANSIENT_RETENTION_CLEANUP.md" in gates[
        "retention_policy"
    ]["evidence"]
    assert "docs/ACCOUNT_ERASURE_REPLAY_PROOF.md" in gates["retention_policy"][
        "evidence"
    ]
    assert "backend/app/account_erasure_replay_proof.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/auth_transient_retention.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/inactive_account_notice_receipt.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/inactive_account_notice_recording.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/inactive_account_erasure_eligibility.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/inactive_account_erasure_preflight.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/inactive_account_erasure_execution.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/inactive_account_preview.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/inactive_account_preview_cli.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/auth_transient_retention_cli.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/schema_migrations/versions/v20260901_0012.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/schema_migrations/versions/v20260901_0013.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/app/schema_migrations/versions/v20260902_0014.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_identity_endpoints.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_auth_transient_retention.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_account_erasure_replay_proof.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_inactive_account_preview.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_inactive_account_notice.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_inactive_account_notice_receipt.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_inactive_account_notice_recording.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_inactive_account_erasure_eligibility.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_inactive_account_erasure_preflight.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert "backend/tests/test_inactive_account_erasure_execution.py" in gates[
        "retention_policy"
    ]["evidence"]
    assert gates["privacy_notice_alignment"]["status"] == "partial"
    assert "contracts/data-safety/v1/privacy-notice-alignment.json" in gates[
        "privacy_notice_alignment"
    ]["evidence"]
    assert "docs/PRIVACY_NOTICE_ALIGNMENT.md" in gates[
        "privacy_notice_alignment"
    ]["evidence"]
    assert matrix["release_state"] == "blocked"


def test_backup_restore_proof_is_synthetic_partial_and_fail_closed() -> None:
    backup = _load_json("data-safety.json")["backup_and_recovery"]
    drill = backup["synthetic_ci_logical_restore"]

    assert backup["status"] == (
        "synthetic-ci-restore-erasure-replay-configured-staging-exit-and-production-pending"
    )
    assert drill["automated_per_merge_candidate"] is True
    assert drill["loopback_only"] is True
    assert drill["source_database"] == "calorieapp_ci_test"
    assert drill["restore_database"] == "calorieapp_ci_restore"
    assert drill["distinct_restore_database_required"] is True
    assert drill["synthetic_data_only"] is True
    assert drill["schema_head_and_owner_links_verified"] is True
    assert drill[
        "private_account_import_receipts_restored_and_erased_with_owner"
    ] is True
    assert drill["post_backup_synthetic_primary_store_erasure_performed"] is True
    assert drill["replay_proof_location"] == (
        "in-process-memory-outside-backup-archive"
    )
    assert drill["replay_proof_uses_hardcoded_nonsecret_ci_key"] is True
    assert drill["restored_account_reappearance_verified_before_replay"] is True
    assert drill["restored_erasure_reapplied_before_final_verification"] is True
    assert drill["unrelated_synthetic_account_preserved"] is True
    assert drill["inbound_session_reference_cleared_during_replay"] is True
    assert drill["second_replay_is_idempotent_noop"] is True
    assert drill["independent_protected_replay_proof_persistence"] is False
    assert drill["provider_restore_replay_proved"] is False
    assert drill["archive_persisted_or_uploaded"] is False
    assert drill["production_or_staging_data_allowed"] is False
    design = backup["synthetic_neon_staging_design"]
    assert design == {
        "operator_selected": True,
        "selection_date": "2026-09-01",
        "approval_reference": (
            "operator-decision-2026-09-01-github-synthetic-backup-exit"
        ),
        "encrypted_destination": "github_actions_artifact",
        "artifact_retention_days": 30,
        "exit_target": "github_hosted_runner_postgresql_16",
        "target_is_ephemeral_and_outside_neon": True,
        "runbook": "docs/NEON_SYNTHETIC_BACKUP_EXIT_RUNBOOK.md",
        "encryption_recipient_and_private_key_custody_approved": True,
        "key_custody_selection_date": "2026-09-01",
        "key_custody_approval_reference": (
            "operator-decision-2026-09-01-offline-age-key-custody"
        ),
        "encryption_format": "age",
        "key_custody_mode": "passphrase-encrypted-age-identity-offline",
        "public_recipient_configured": True,
        "public_recipient": (
            "age1s3p3hcasyphsp5ph8emrkxx27yh4s0fpru92t5mncj09uu6ny9ts2y6w0m"
        ),
        "private_key_generated_or_configured": True,
        "offline_primary_copy_recovery_verified": True,
        "offline_recovery_copy_recovery_verified": True,
        "offline_custody_completed_on": "2026-09-03",
        "permanent_github_private_key_secret_allowed": False,
        "temporary_review_gated_restore_secret_required": True,
        "restore_environment": "neon-synthetic-restore",
        "restore_environment_must_be_precreated_and_protected": True,
        "restore_environment_precreated_and_protected": True,
        "restore_environment_branch_policy": "main-only",
        "restore_environment_required_reviewer": True,
        "restore_environment_admin_bypass_allowed": False,
        "restore_workflow_trigger": "workflow-dispatch-only",
        "pull_request_workflow_identity_access_allowed": False,
        "restore_identity_secret_deleted_after_every_run": True,
        "synthetic_acceptance_workflow": (
            ".github/workflows/neon-synthetic-acceptance.yml"
        ),
        "workflow_implemented": True,
        "operation_performed": False,
        "real_user_or_production_data_allowed": False,
    }
    assert backup["encrypted_production_backup_selected"] is False
    assert backup["provider_staging_restore_completed"] is False
    assert backup["maximum_encrypted_backup_retention_days"] == 30
    assert backup["restored_backup_must_reapply_erasure_requests"] is True
    replay = backup["erasure_replay_proof"]
    assert replay["implementation_status"] == (
        "pure-builder-verifier-and-loopback-ci-replay-drill-prepared-"
        "independent-storage-and-provider-replay-disabled"
    )
    assert replay["covered_erasure_reasons"] == [
        "authenticated-user-request",
        "inactive-account-retention",
    ]
    assert replay["schema_version"] == (
        "calorieapp-account-erasure-replay-proof-v1"
    )
    assert replay["algorithm"] == "hmac-sha256-v1"
    assert replay["minimum_secret_bytes"] == 32
    assert replay["subject_and_evidence_domain_separated"] is True
    assert replay["maximum_replay_horizon_days"] == 30
    assert replay["timezone_aware_erasure_timestamp_required"] is True
    assert replay["returned_timestamps"] == "naive-utc-with-z-serialization"
    assert replay["raw_user_id_returned"] is False
    assert replay["raw_authorization_reference_returned"] is False
    assert replay["secret_key_returned"] is False
    assert replay["subject_digest_is_pseudonymous_personal_data"] is True
    assert replay["synthetic_loopback_postgresql_replay_drill_implemented"] is True
    assert replay["synthetic_drill_proof_storage"] == "process-memory-only"
    assert replay["synthetic_drill_uses_nonsecret_test_key"] is True
    assert replay[
        "synthetic_drill_replays_authenticated_request_after_older_backup_restore"
    ] is True
    assert replay["synthetic_drill_preserves_unrelated_account"] is True
    assert replay["synthetic_drill_idempotency_verified"] is True
    assert replay["protected_independent_persistence_implemented"] is False
    assert replay["restore_scanning_and_replay_implemented"] is False
    assert replay["constant_time_digest_comparison"] is True
    assert replay["creates_database_file_artifact_provider_or_network_record"] is False
    assert replay["connected_to_logging_cli_endpoint_or_scheduler"] is False
    assert replay["real_data_mutation_migration_or_deployment_performed"] is False
    assert replay["implementation"] == (
        "backend/app/account_erasure_replay_proof.py"
    )
    assert replay["synthetic_drill"] == "backend/app/backup_restore_drill.py"
    assert replay["tests"] == "backend/tests/test_account_erasure_replay_proof.py"
    assert replay["runbook"] == "docs/ACCOUNT_ERASURE_REPLAY_PROOF.md"
    assert backup["restore_replay_mechanism_implemented_and_proved"] is False
    assert backup["retention_and_backup_erasure_schedule_approved"] is True


def test_contract_release_order_ends_with_review_and_explicit_publication_go() -> None:
    contract = _load_json("data-safety.json")
    release_order = contract["release_order"]

    assert release_order[-1] == "showcase-preview-review-explicit-go-scheduled-publish"
    assert release_order.index("automation-and-observability-foundation") < release_order.index(
        "formal-migrations"
    )
    assert release_order.index("abuse-capacity-and-mutation-guardrails") < (
        release_order.index("formal-migrations")
    )
    assert release_order.index("privacy-review") < release_order.index(
        "identity-feature-expansion"
    )
    optional_order = contract["optional_future_order"]
    assert optional_order[0] == "xrpl-schema-compatibility-review"
    assert optional_order[-1] == "adoption-led-scaling"
