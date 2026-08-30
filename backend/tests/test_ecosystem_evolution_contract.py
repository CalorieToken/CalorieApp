from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = (
    ROOT / "contracts" / "ecosystem" / "v2" / "evolution-guardrails.json"
)


def _load_contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_independent_namespaced_evolution_is_free_but_not_official() -> None:
    contract = _load_contract()
    evolution = contract["independent_evolution"]
    boundary = contract["official_state_boundary"]

    assert evolution["allowed"] is True
    assert evolution["official_preapproval_required"] is False
    assert evolution["official_service_credentials_required"] is False
    assert evolution["must_use_own_namespace_and_non_official_branding"] is True
    assert evolution["official_rejection_may_delete_or_technically_block_independent_work"] is False
    assert boundary["direct_external_database_mutation_allowed"] is False
    assert boundary["direct_external_identity_or_session_store_access_allowed"] is False
    assert boundary["community_claim_may_overwrite_official_or_source_assertion"] is False
    assert boundary["community_project_may_claim_official_status_or_brand_authority"] is False
    assert boundary["revoking_official_service_access_revokes_right_to_independent_development"] is False


def test_official_adoption_requires_evidence_and_cannot_bypass_safety() -> None:
    adoption = _load_contract()["official_adoption_process"]

    assert adoption["versioned_proposal_required"] is True
    assert adoption["threat_privacy_and_abuse_analysis_required"] is True
    assert adoption["licence_and_code_provenance_review_required"] is True
    assert adoption["conformance_tests_and_test_vectors_required"] is True
    assert adoption["backward_compatibility_or_major_version_required"] is True
    assert adoption["explicit_operator_approval_required_for_official_release"] is True
    assert adoption["approval_may_bypass_release_privacy_or_security_gates"] is False


def test_governance_cannot_vote_away_privacy_or_create_token_control() -> None:
    contract = _load_contract()
    governance = contract["governance_boundary"]
    direction = contract["direction_not_control"]

    assert governance["official_v2_release_control_remains_with_current_operator"] is True
    assert governance["ecosystem_input_and_proposals_allowed"] is True
    assert governance["external_proposal_auto_accepted"] is False
    assert governance["token_ownership_grants_automatic_vote_or_mutation_rights"] is False
    assert governance["wealth_weighted_governance_required"] is False
    assert governance["governance_may_override_privacy_consent_or_data_rights"] is False
    assert direction["nonconformant_independent_work_is_automatically_illegal_or_forbidden"] is False
    assert direction["official_system_may_refuse_unsafe_or_incompatible_federation"] is True
    assert direction["refusal_to_federate_may_rewrite_or_destroy_remote_state"] is False


def test_v2_allows_only_bounded_voting_tool_preparation() -> None:
    dao = _load_contract()["future_dao_candidate"]

    assert dao["status"] == "v2-limited-tool-preparation-v3-full-dao-only"
    assert dao["design_detail_status"] == (
        "v2-inventory-and-isolated-non-binding-preview-v3-governance-design"
    )
    assert dao["current_v2_dependency"] is False
    assert "isolated-preview-or-simulation-with-synthetic-test-data" in dao[
        "v2_allowed_scope"
    ]
    assert "real-or-live-votes-or-binding-governance" in dao["v2_forbidden_scope"]
    assert dao["earliest_real_governance_mode"] == (
        "v3-advisory-proposals-and-non-binding-signalling"
    )
    assert dao[
        "full_dao_implementation_and_real_voting_earliest_product_version"
    ] == "v3"
    assert dao["v3_activation_is_automatic"] is False
    assert dao["intended_final_mode"] == (
        "distributed-ecosystem-governance-through-project-dao-voting-tool"
    )
    assert dao["intended_voter_constituency"] == "calorie-token-holders"
    assert dao["holder_eligibility_snapshot_and_vote_weight_mechanics"] == (
        "undecided-future-design"
    )
    assert dao["dao_tables_endpoints_smart_contracts_or_live_voting_implemented_in_v2"] is False
    pre_activation = dao["pre_activation_control"]
    assert pre_activation[
        "ecosystem_foundation_designed_and_developed_to_completed_point_by_current_developer_and_team_required"
    ] is True
    assert pre_activation["objective_completion_gates_and_tests_required"] is True
    assert pre_activation["recorded_completion_declaration_by_current_operator_required"] is True
    assert pre_activation["versioned_dao_scope_handover_manifest_required"] is True
    assert pre_activation["handover_manifest_requires_current_operator_approval"] is True
    assert pre_activation[
        "dao_vote_or_follow_on_implementation_before_completion_and_handover_allowed"
    ] is False
    assert pre_activation["implicit_or_retroactive_scope_handover_allowed"] is False
    assert pre_activation["dao_may_expand_its_own_authority_by_vote_alone"] is False
    tool = dao["dao_voting_tool"]
    assert tool["project_tool_selected_as_future_governance_interface"] is True
    assert tool["repository_location"] == "unknown-not-found-in-current-repository"
    assert tool["current_voting_and_eligibility_model"] == (
        "unknown-must-not-be-invented"
    )
    assert tool["production_authority_enabled"] is False
    assert tool["inventory_required_before_integration_design"] is True
    assert tool["v2_partial_integration_limited_to_isolated_non_binding_preview"] is True
    assert tool["v2_preview_uses_synthetic_or_explicit_test_data_only"] is True
    assert tool["v2_preview_may_claim_live_dao_or_holder_vote"] is False
    assert dao["one_token_one_vote_assumed"] is False
    assert dao["token_ownership_grants_automatic_governance_right"] is False
    assert "hybrid-multichamber-model" in dao[
        "governance_model_options_require_comparison"
    ]
    assert dao["may_directly_mutate_production_database"] is False
    assert dao["may_administer_identity_bridge_or_session_store"] is False
    assert dao["may_vote_to_expose_or_repurpose_personal_data"] is False
    assert dao["may_override_user_consent_or_data_rights"] is False
    assert dao["may_block_required_security_or_legal_response"] is False
    assert dao["automatic_treasury_payment_or_xrpl_transaction_allowed"] is False
    assert dao["official_product_change_still_requires_tested_release_process"] is True
    assert dao["scope_expansion_requires_new_versioned_review"] is True


def test_dao_authority_grows_in_stages_through_bounded_executor() -> None:
    authority = _load_contract()["dao_authority_growth"]

    assert authority["stages"][0] == (
        "inventory-source-version-licence-and-existing-deployment"
    )
    assert authority["stages"][-1] == (
        "broader-distributed-ecosystem-management-after-separate-approval"
    )
    assert authority["stage_may_be_skipped"] is False
    assert authority[
        "v2_tool_inventory_and_isolated_preview_may_precede_governance_handover"
    ] is True
    assert authority[
        "all_real_governance_stages_begin_in_v3_after_developer_completion_and_scope_handover"
    ] is True
    assert authority["voting_tool_may_execute_arbitrary_code_or_sql"] is False
    assert authority["voting_tool_may_hold_identity_bridge_or_database_credentials"] is False
    assert authority["separate_governance_executor_required_for_binding_actions"] is True
    assert authority["executor_accepts_allowlisted_versioned_action_types_only"] is True
    assert authority["executor_requires_replay_protection_and_idempotency"] is True
    assert authority["executor_enforces_timelock_and_public_audit_record"] is True
    assert authority["executor_may_bypass_privacy_security_licence_or_legal_policy"] is False
    assert authority["binding_action_dry_run_and_bounded_rollback_or_correction_required"] is True


def test_v2_prepares_tool_without_real_dao_voting() -> None:
    awareness = _load_contract()["dao_architecture_awareness_for_v2"]

    assert awareness["stable_versioned_entity_ids_required"] is True
    assert awareness["namespaced_extension_and_capability_boundaries_required"] is True
    assert awareness[
        "append_only_proposal_decision_and_supersedes_references_supported_by_future_formats"
    ] is True
    assert awareness["verifiable_external_decision_reference_may_be_added_later"] is True
    assert awareness["dao_specific_database_tables_required_in_v2"] is False
    assert awareness["dao_api_endpoint_required_in_v2"] is False
    assert awareness["dao_smart_contract_required_in_v2"] is False
    assert awareness["holder_balance_snapshot_or_wallet_profiling_required_in_v2"] is False
    assert awareness["live_vote_or_governance_executor_required_in_v2"] is False
    assert awareness["existing_voting_tool_inventory_allowed_in_v2"] is True
    assert awareness[
        "isolated_non_binding_preview_with_synthetic_test_data_allowed_in_v2"
    ] is True
    assert awareness["real_holder_vote_or_governance_authority_allowed_in_v2"] is False
    assert awareness["full_dao_implementation_and_real_voting_reserved_for_v3"] is True


def test_future_dao_gets_only_explicit_versioned_handover_scope() -> None:
    handover = _load_contract()["future_dao_scope_handover_manifest"]

    assert handover["status"] == "future-format-requirement-no-manifest-created"
    assert "foundation_version_and_source_commit" in handover["required_fields"]
    assert "objective_completion_evidence" in handover["required_fields"]
    assert "developer_or_operator_completion_declaration" in handover["required_fields"]
    assert "included_ecosystem_namespaces-capabilities-and-parameters" in handover[
        "required_fields"
    ]
    assert "excluded-official-product-identity-data-brand-and-rights-boundaries" in handover[
        "required_fields"
    ]
    assert handover["empty_or_ambiguous_scope_means_no_dao_authority"] is True
    assert handover["official_product_or_developer_component_rights_transfer_by_implication"] is False
    assert handover["scope_change_requires_new_manifest_and_same_approval_gates"] is True


def test_human_governance_remains_after_dao_activation() -> None:
    human = _load_contract()["permanent_human_governance_boundary"]

    assert human["fully_autonomous_ecosystem_governance_allowed"] is False
    assert human["human_managed_layer_required_after_dao_activation"] is True
    assert "values-purpose-and-constitutional-direction" in human[
        "human_responsibilities"
    ]
    assert "security-incident-command-emergency-pause-and-recovery" in human[
        "human_responsibilities"
    ]
    assert human[
        "dao_or_automation_may_self_modify_its_code_scope_policy_or_approval_rules"
    ] is False
    assert human[
        "dao_may_vote_to_remove_human_safety_accountability_or_emergency_controls"
    ] is False
    assert human["binding_executor_requires_human_managed_allowlist_and_pause"] is True
    assert human["irreversible_high_impact_action_requires_fresh_human_approval"] is True
    assert human["emergency_pause_time_bounded_audited_and_post_reviewed"] is True
    assert human[
        "human_override_may_bypass_law_consent_privacy_security_or_rights_invariants"
    ] is False


def test_data_safety_contract_links_free_evolution_boundary() -> None:
    safety = json.loads(
        (ROOT / "contracts" / "data-safety" / "v1" / "data-safety.json").read_text(
            encoding="utf-8"
        )
    )["ecosystem_evolution_guardrails"]

    assert safety["independent_namespaced_evolution_allowed"] is True
    assert safety["official_rejection_may_delete_or_block_independent_work"] is False
    assert safety["community_extension_may_mutate_official_state_directly"] is False
    assert safety["official_adoption_requires_versioned_proposal_and_conformance_review"] is True
    assert safety["token_ownership_grants_automatic_governance_or_mutation_rights"] is False
    assert safety["current_release_dependency"] is True

    data_safety = json.loads(
        (ROOT / "contracts" / "data-safety" / "v1" / "data-safety.json").read_text(
            encoding="utf-8"
        )
    )["future_dao_governance"]
    assert data_safety["status"] == "v2-limited-tool-preparation-v3-full-dao-only"
    assert data_safety["design_detail_status"] == (
        "v2-inventory-and-isolated-non-binding-preview-v3-governance-design"
    )
    assert data_safety["current_release_dependency"] is False
    assert data_safety["v2_partial_scope"] == (
        "inventory-review-and-isolated-non-binding-preview-with-synthetic-test-data"
    )
    assert data_safety["v2_real_holder_voting_or_governance_authority_allowed"] is False
    assert data_safety[
        "full_dao_implementation_and_real_voting_earliest_product_version"
    ] == "v3"
    assert data_safety["v3_activation_is_automatic"] is False
    assert data_safety["intended_final_mode"] == (
        "distributed-ecosystem-governance-through-project-dao-voting-tool"
    )
    assert data_safety["intended_voter_constituency"] == "calorie-token-holders"
    assert data_safety["voting_weight_and_eligibility_mechanics_decided"] is False
    assert data_safety["dao_tables_endpoints_smart_contracts_or_live_voting_in_v2"] is False
    assert data_safety[
        "developer_completed_foundation_and_recorded_completion_declaration_required"
    ] is True
    assert data_safety[
        "versioned_governance_scope_handover_approved_by_current_operator_required"
    ] is True
    assert data_safety["dao_voting_or_implementation_before_both_gates_allowed"] is False
    assert data_safety["may_vote_to_remove_permanent_human_governance_boundary"] is False
    assert data_safety[
        "binding_execution_without_human_managed_safety_and_accountability_layer_allowed"
    ] is False
    assert data_safety["dao_voting_tool_inventory_status"] == (
        "not-located-in-current-repository-or-documented-context"
    )
    assert data_safety["token_ownership_equals_automatic_vote_weight"] is False
    assert data_safety["direct_database_identity_or_personal_data_mutation_allowed"] is False
    assert data_safety["automatic_treasury_or_xrpl_execution_allowed"] is False
    assert data_safety["may_override_law_privacy_consent_or_security_response"] is False
