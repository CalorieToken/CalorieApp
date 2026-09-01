from __future__ import annotations

import json
from pathlib import Path

from app.source_assertion_policy import (
    SOURCE_ASSERTION_CONTENT_POLICY_VERSION,
    source_assertion_policy_snapshot,
)


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "contracts" / "food-data" / "v1" / "source-registry.json"


def _load_contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_food_data_model_is_source_independent_and_extensible() -> None:
    contract = _load_contract()
    principles = contract["principles"]

    assert contract["contract_version"] == "1.7.0"
    assert contract["status"] == (
        "retained-source-assertion-correction-implemented-no-public-source-enabled"
    )
    assert principles["open_food_facts_is_one_adapter_not_canonical_model"] is True
    assert principles["single_source_database_design_allowed"] is False
    assert principles["new_source_requires_core_schema_rewrite"] is False
    assert principles["source_assertions_preserved_separately"] is True
    assert principles["silent_cross_source_overwrite_allowed"] is False

    assert set(contract["source_categories"]) == {
        "open-dataset",
        "producer-or-farm",
        "processor-or-manufacturer",
        "supplier-or-distributor",
        "retailer-or-restaurant",
        "laboratory-or-certifier",
        "government-or-public-authority",
        "community-contribution",
        "explicit-user-import",
        "ecosystem-adapter",
    }


def test_every_source_record_and_assertion_remains_traceable() -> None:
    contract = _load_contract()
    entities = contract["entities"]
    source_record_fields = set(entities["food_source_record"]["required_fields"])
    assertion_fields = set(entities["food_attribute_assertion"]["required_fields"])
    link_fields = set(entities["food_product_source_link"]["required_fields"])

    assert {
        "source_id",
        "external_record_id",
        "source_version_or_content_digest",
        "retrieved_or_submitted_at",
        "verification_status",
        "verification_version",
    } <= source_record_fields
    assert {
        "source_record_id",
        "idempotency_key",
        "expected_version",
        "resulting_version",
        "previous_status",
        "new_status",
        "moderator_reference",
        "authorization_scope",
        "reason_code",
        "created_at",
    } <= set(entities["food_source_moderation_audit"]["required_fields"])
    assert {
        "link_id",
        "food_product_id",
        "source_record_id",
        "match_method",
        "match_confidence",
        "review_status",
        "created_at",
    } <= link_fields
    assert {
        "source_record_id",
        "attribute_key",
        "value",
        "verification_status",
        "verification_version",
        "created_at",
    } <= assertion_fields
    assert entities["food_attribute_assertion"]["optional_fields"] == [
        "supersedes_assertion_id"
    ]
    assert "assertion_limit" in entities["food_source"]["required_fields"]
    assert {
        "assertion_id",
        "food_product_id",
        "source_record_id",
        "idempotency_key",
        "expected_source_record_version",
        "resulting_assertion_version",
        "submitter_reference",
        "authorization_scope",
        "created_at",
    } <= set(
        entities["food_attribute_assertion_ingest_audit"]["required_fields"]
    )
    assert {
        "assertion_id",
        "idempotency_key",
        "expected_version",
        "resulting_version",
        "previous_status",
        "new_status",
        "moderator_reference",
        "authorization_scope",
        "reason_code",
        "created_at",
    } <= set(
        entities["food_attribute_assertion_moderation_audit"]["required_fields"]
    )
    assert {
        "predecessor_assertion_id",
        "correction_assertion_id",
        "idempotency_key",
        "expected_predecessor_version",
        "resulting_correction_version",
        "corrector_reference",
        "authorization_scope",
        "reason_code",
        "created_at",
    } <= set(
        entities["food_attribute_assertion_correction_audit"]["required_fields"]
    )
    assert contract["adapter_contract"]["idempotency_key"] == [
        "source_id",
        "external_record_id",
        "source_version_or_content_digest",
    ]
    assert contract["adapter_contract"]["max_upstream_attempts_per_user_action"] == 2
    assert contract["adapter_contract"]["nested_retry_layers_allowed"] is False
    assert contract["adapter_contract"]["upstream_write_enabled_by_default"] is False
    assert contract["adapter_contract"][
        "per_source_persisted_record_budget_implemented"
    ] is True
    assert contract["adapter_contract"][
        "duplicate_idempotency_key_consumes_budget"
    ] is False
    assert contract["adapter_contract"][
        "per_source_persisted_assertion_budget_implemented"
    ] is True
    assert contract["adapter_contract"][
        "duplicate_assertion_idempotency_key_consumes_budget"
    ] is False
    assert contract["conflict_policy"]["retain_each_source_assertion"] is True
    assert (
        contract["conflict_policy"]["silent_overwrite_or_destructive_merge_allowed"]
        is False
    )
    assert contract["conflict_policy"][
        "assertion_must_reference_reviewable_product_source_pair"
    ] is True
    assert contract["conflict_policy"]["correction_keeps_prior_assertion_row"] is True
    assert contract["conflict_policy"][
        "correction_must_keep_product_and_source_record_lineage"
    ] is True


def test_source_expansion_preserves_licensing_privacy_and_history() -> None:
    contract = _load_contract()
    principles = contract["principles"]
    licensing = contract["licensing"]
    privacy = contract["privacy_and_identity"]

    assert licensing["licence_review_required_before_source_enablement"] is True
    assert licensing["attribution_preserved_per_source"] is True
    assert licensing["incompatible_sources_may_be_flattened_into_one_export"] is False
    assert licensing[
        "assertion_evidence_export_preserves_source_licence_and_attribution"
    ] is True
    assert principles["private_food_history_is_point_in_time_snapshot"] is True
    assert principles["later_source_change_may_rewrite_private_history"] is False
    assert principles["private_history_auto_published_as_catalog_source"] is False
    assert privacy["community_submission_requires_explicit_action"] is True
    assert privacy["community_submission_requires_moderation"] is True
    assert privacy["public_contributor_reference_must_be_pseudonymous"] is True
    assert privacy["private_identity_fields_allowed_in_catalog"] is False

    mutation = contract["mutation_policy"]
    assert mutation["external_client_default_access"] == "read-only"
    assert mutation["direct_catalog_table_write_allowed"] is False
    assert mutation["contribution_creates_new_assertion"] is True
    assert mutation["contribution_quarantined_until_validation_and_moderation"] is True
    assert mutation["source_record_terminal_moderation_implemented"] is True
    assert mutation["source_record_moderation_requires_expected_version"] is True
    assert mutation["source_record_moderation_requires_idempotency_key"] is True
    assert mutation["source_record_moderation_audit_is_insert_only_in_service"] is True
    assert mutation["source_record_moderation_audit_allows_free_text_or_payload"] is False
    assert mutation["catalog_entity_tables_implemented"] is True
    assert mutation["catalog_assertion_write_service_implemented"] is True
    assert mutation["source_assertion_ingest_implemented"] is True
    assert mutation["source_assertion_ingest_authorization_scope"] == (
        "catalog:source-assertion:ingest"
    )
    assert mutation[
        "source_assertion_ingest_requires_validated_record_and_link"
    ] is True
    assert mutation["source_assertion_ingest_requires_expected_record_version"] is True
    assert mutation["source_assertion_ingest_requires_idempotency_key"] is True
    assert mutation["source_assertion_ingest_content_policy_version"] == "1.0.0"
    assert mutation["source_assertion_ingest_unknown_attribute_allowed"] is False
    assert mutation["source_assertion_ingest_arbitrary_text_value_allowed"] is False
    assert mutation["source_assertion_ingest_unit_must_match_attribute_policy"] is True
    assert mutation[
        "source_assertion_ingest_equivalent_decimal_forms_canonicalized"
    ] is True
    assert mutation[
        "source_assertion_content_policy_extension_requires_human_review"
    ] is True
    assert mutation["source_assertion_ingest_defaults_to_quarantine"] is True
    assert mutation["source_assertion_ingest_audit_inserted_atomically"] is True
    assert mutation["source_assertion_ingest_audit_is_insert_only_in_service"] is True
    assert mutation[
        "source_assertion_ingest_audit_allows_free_text_payload_email_or_ip"
    ] is False
    assert mutation["source_assertion_moderation_service_implemented"] is True
    assert mutation["source_assertion_moderation_authorization_scope"] == (
        "catalog:source-assertion:moderate"
    )
    assert mutation["source_assertion_moderation_requires_expected_version"] is True
    assert mutation["source_assertion_moderation_requires_idempotency_key"] is True
    assert mutation["source_assertion_validation_rechecks_content_policy"] is True
    assert mutation[
        "source_assertion_validation_requires_current_active_reviewed_lineage"
    ] is True
    assert mutation["source_assertion_moderation_transitions"] == [
        "quarantined-to-validated",
        "quarantined-to-rejected",
    ]
    assert mutation[
        "source_assertion_moderation_terminal_status_rewrite_allowed"
    ] is False
    assert mutation["source_assertion_moderation_audit_inserted_atomically"] is True
    assert mutation[
        "source_assertion_moderation_audit_is_insert_only_in_service"
    ] is True
    assert mutation[
        "source_assertion_moderation_audit_allows_free_text_payload_email_or_ip"
    ] is False
    assert mutation["source_assertion_moderation_public_endpoint_enabled"] is False
    assert mutation["source_assertion_correction_service_implemented"] is True
    assert mutation["source_assertion_correction_authorization_scope"] == (
        "catalog:source-assertion:correct"
    )
    assert mutation[
        "source_assertion_correction_requires_expected_predecessor_version"
    ] is True
    assert mutation["source_assertion_correction_requires_idempotency_key"] is True
    assert mutation["source_assertion_correction_predecessor_statuses"] == [
        "validated",
        "rejected",
    ]
    assert mutation["source_assertion_correction_rechecks_content_policy"] is True
    assert mutation[
        "source_assertion_correction_requires_current_active_reviewed_lineage"
    ] is True
    assert mutation[
        "source_assertion_correction_preserves_product_and_source_record"
    ] is True
    assert mutation["source_assertion_correction_default_status"] == "quarantined"
    assert mutation["source_assertion_correction_resulting_version"] == 1
    assert mutation[
        "source_assertion_correction_shares_source_assertion_budget"
    ] is True
    assert mutation[
        "source_assertion_correction_allows_multiple_children_per_predecessor"
    ] is False
    assert mutation["source_assertion_correction_audit_table"] == (
        "food_attribute_assertion_correction_audit"
    )
    assert mutation["source_assertion_correction_audit_inserted_atomically"] is True
    assert mutation[
        "source_assertion_correction_audit_is_insert_only_in_service"
    ] is True
    assert mutation[
        "source_assertion_correction_audit_allows_free_text_payload_email_or_ip"
    ] is False
    assert mutation[
        "source_assertion_correction_authenticated_caller_enforced"
    ] is False
    assert mutation["source_assertion_correction_public_endpoint_enabled"] is False
    assert mutation["public_source_assertion_ingest_endpoint_enabled"] is False
    assert mutation[
        "read_only_licensed_assertion_evidence_export_implemented"
    ] is True
    assert mutation["complete_source_assertion_mutation_flow_implemented"] is False
    assert mutation["silent_history_or_source_record_rewrite_allowed"] is False
    assert mutation["correction_preserves_superseded_assertion"] is True


def test_assertion_content_policy_contract_matches_runtime() -> None:
    policy = _load_contract()["assertion_content_policy"]

    assert policy["policy_version"] == SOURCE_ASSERTION_CONTENT_POLICY_VERSION
    assert policy["applied_before_database_work"] is True
    assert policy["initial_scope"] == "source-neutral-nutrition-per-100g"
    assert policy["unknown_attribute_allowed"] is False
    assert policy["arbitrary_text_value_allowed"] is False
    assert policy["unit_must_match_attribute_policy"] is True
    assert policy["numeric_format"] == (
        "finite-non-negative-decimal-with-at-most-6-fractional-digits"
    )
    assert policy[
        "equivalent_decimal_forms_canonicalized_before_idempotency_check"
    ] is True
    assert policy["policy_extension_requires_human_review"] is True
    assert policy["allowed_numeric_attributes"] == source_assertion_policy_snapshot()


def test_multi_source_schema_is_v2_work_without_forcing_a_second_source() -> None:
    implementation = _load_contract()["implementation"]

    assert implementation["current_adapter"] == "open_food_facts"
    assert implementation["current_adapter_catalog_persistence_enabled"] is False
    assert implementation["implemented_catalog_tables"] == [
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
    assert implementation["remaining_catalog_tables"] == []
    assert implementation["internal_source_record_ingest_service_implemented"] is True
    assert implementation[
        "internal_source_record_terminal_moderation_service_implemented"
    ] is True
    assert implementation[
        "source_neutral_catalog_entity_foundation_implemented"
    ] is True
    assert implementation[
        "read_only_licensed_assertion_evidence_export_implemented"
    ] is True
    assert implementation["catalog_assertion_write_service_implemented"] is True
    assert implementation[
        "internal_source_assertion_ingest_service_implemented"
    ] is True
    assert implementation["source_assertion_content_policy_implemented"] is True
    assert implementation["source_assertion_ingest_defaults_to_quarantine"] is True
    assert implementation["source_assertion_moderation_service_implemented"] is True
    assert implementation["source_assertion_correction_service_implemented"] is True
    assert implementation[
        "internal_source_assertion_correction_service_implemented"
    ] is True
    assert implementation[
        "source_assertion_correction_authenticated_caller_enforced"
    ] is False
    assert implementation[
        "source_assertion_correction_public_endpoint_enabled"
    ] is False
    assert implementation["public_source_assertion_ingest_endpoint_enabled"] is False
    assert implementation["public_catalog_read_endpoint_enabled"] is False
    assert implementation[
        "general_source_record_update_or_delete_service_implemented"
    ] is False
    assert implementation["public_source_record_moderation_endpoint_enabled"] is False
    assert implementation["ingest_defaults_to_quarantine"] is True
    assert implementation["raw_source_payload_column_created"] is False
    assert implementation["source_independent_schema_compatibility_required_for_v2"] is True
    assert implementation["additional_source_activation_required_for_v2"] is False
    assert implementation["v2_forward_migration_required"] is False
    assert implementation["current_release_dependency"] is True
    assert implementation["public_source_onboarding_enabled"] is False
