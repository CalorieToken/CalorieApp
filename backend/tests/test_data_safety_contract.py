from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIR = ROOT / "contracts" / "data-safety" / "v1"


def _load_json(name: str) -> dict:
    return json.loads((CONTRACT_DIR / name).read_text(encoding="utf-8"))


def test_data_safety_contract_keeps_live_history_off_sqlite() -> None:
    contract = _load_json("data-safety.json")

    assert contract["contract_id"] == "calorieapp.durable-data-safety"
    assert contract["release_state"] == "blocked"
    assert contract["architecture"]["primary_live_store"] == "postgresql"
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
    assert "encrypted-provider-staging-backup-restoration" in proof["does_not_prove"]
    assert proof["provider_selection_status"] == "pending-separate-evaluation"


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
    assert proof["provider_selected"] is False
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

    assert export["status"] == "v2-backend-implemented-ui-and-notice-pending"
    assert export["format"] == "versioned-json"
    assert export["format_version"] == "calorieapp-account-data-v1"
    assert export["authenticated_user_only"] is True
    assert export["cross_user_records_allowed"] is False
    assert export["private_http_caching_allowed"] is False
    assert export["external_delivery_or_publication_performed"] is False
    assert export["security_token_hashes_codes_and_login_state_included"] is False
    assert export[
        "identity_food_history_and_directly_owned_authentication_activity_included"
    ] is True
    assert export[
        "legacy_authorization_events_without_direct_ownership_included"
    ] is False
    assert export["authorization_events_field_reserved_as_empty_list"] is True
    assert export[
        "direct_ownership_migration_required_before_authorization_event_inclusion"
    ] is True
    assert export["eleven_language_identity_bridge_ui_required"] is True
    assert export["privacy_notice_alignment_required"] is True
    assert export["account_erasure_or_retention_policy_changed"] is False


def test_account_erasure_is_private_fail_closed_and_human_gated() -> None:
    erasure = _load_json("data-safety.json")["account_erasure"]

    assert erasure["status"] == (
        "v2-backend-implemented-disabled-pending-policy-ui-and-notice"
    )
    assert erasure["enabled_by_default"] is False
    assert erasure["authenticated_user_only"] is True
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
    assert erasure["browser_session_cookie_cleared"] is True
    assert erasure["backup_erasure_claimed_complete"] is False
    assert erasure["recovery_window_selected"] is False
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
    assert sources["catalog_assertion_write_service_implemented"] is False
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
    assert safety["complete_contribution_mutation_flow_implemented"] is False
    assert safety["raw_ip_or_search_text_in_long_term_abuse_profile_allowed"] is False
    assert safety["external_integration_default_access"] == "read-only"
    assert safety["direct_ecosystem_database_write_allowed"] is False
    assert safety["silent_catalog_assertion_overwrite_allowed"] is False
    assert safety["unmoderated_public_contribution_activation_allowed"] is False
    assert safety["production_schema_mutation_requires_separate_approval"] is True
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
    assert cost["provider_selected"] is False
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
    assert set(gates) == expected
    assert all(gate["release_blocking"] is True for gate in gates.values())
    assert all(gate["status"] in matrix["statuses"] for gate in gates.values())
    assert gates["owner_isolation"]["status"] == "verified"
    assert gates["production_sqlite_fail_closed"]["status"] == "verified"
    assert gates["formal_schema_migrations"]["status"] == "verified"
    assert gates["v2_deployment_provenance"]["status"] == "partial"
    assert gates["abuse_capacity_and_mutation_controls"]["status"] == "partial"
    assert gates["component_rights_and_contributor_provenance"]["status"] == "partial"
    assert gates["zero_additional_cost_capacity_and_exit_plan"]["status"] == "partial"
    assert gates["ecosystem_operator_succession_and_handover"]["status"] == "partial"
    assert gates["restart_persistence"]["status"] == "partial"
    assert gates["redeploy_persistence"]["status"] == "partial"
    assert "backend/app/redeploy_persistence_drill.py" in gates[
        "redeploy_persistence"
    ]["evidence"]
    assert gates["backup_restore_drill"]["status"] == "partial"
    assert "backend/app/backup_restore_drill.py" in gates["backup_restore_drill"][
        "evidence"
    ]
    assert gates["user_data_export"]["status"] == "partial"
    assert "backend/tests/test_account_data_export.py" in gates["user_data_export"][
        "evidence"
    ]
    assert gates["user_erasure"]["status"] == "partial"
    assert "backend/tests/test_account_erasure.py" in gates["user_erasure"][
        "evidence"
    ]
    assert gates["retention_policy"]["status"] == "decision_required"
    assert matrix["release_state"] == "blocked"


def test_backup_restore_proof_is_synthetic_partial_and_fail_closed() -> None:
    backup = _load_json("data-safety.json")["backup_and_recovery"]
    drill = backup["synthetic_ci_logical_restore"]

    assert backup["status"] == (
        "synthetic-logical-restore-proof-configured-production-design-pending"
    )
    assert drill["automated_per_merge_candidate"] is True
    assert drill["loopback_only"] is True
    assert drill["source_database"] == "calorieapp_ci_test"
    assert drill["restore_database"] == "calorieapp_ci_restore"
    assert drill["distinct_restore_database_required"] is True
    assert drill["synthetic_data_only"] is True
    assert drill["schema_head_and_owner_links_verified"] is True
    assert drill["archive_persisted_or_uploaded"] is False
    assert drill["production_or_staging_data_allowed"] is False
    assert backup["encrypted_production_backup_selected"] is False
    assert backup["provider_staging_restore_completed"] is False
    assert backup["retention_and_backup_erasure_schedule_approved"] is False


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
