from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "contracts" / "food-data" / "v1" / "source-registry.json"


def _load_contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_food_data_model_is_source_independent_and_extensible() -> None:
    contract = _load_contract()
    principles = contract["principles"]

    assert contract["contract_version"] == "1.2.0"
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
    assert {"source_record_id", "attribute_key", "value", "verification_status"} <= (
        assertion_fields
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
    assert contract["conflict_policy"]["retain_each_source_assertion"] is True
    assert (
        contract["conflict_policy"]["silent_overwrite_or_destructive_merge_allowed"]
        is False
    )


def test_source_expansion_preserves_licensing_privacy_and_history() -> None:
    contract = _load_contract()
    principles = contract["principles"]
    licensing = contract["licensing"]
    privacy = contract["privacy_and_identity"]

    assert licensing["licence_review_required_before_source_enablement"] is True
    assert licensing["attribution_preserved_per_source"] is True
    assert licensing["incompatible_sources_may_be_flattened_into_one_export"] is False
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
    assert mutation["complete_source_assertion_mutation_flow_implemented"] is False
    assert mutation["silent_history_or_source_record_rewrite_allowed"] is False
    assert mutation["correction_preserves_superseded_assertion"] is True


def test_multi_source_schema_is_v2_work_without_forcing_a_second_source() -> None:
    implementation = _load_contract()["implementation"]

    assert implementation["current_adapter"] == "open_food_facts"
    assert implementation["current_adapter_catalog_persistence_enabled"] is False
    assert implementation["implemented_catalog_tables"] == [
        "food_source",
        "food_source_record",
        "food_source_moderation_audit",
    ]
    assert implementation["remaining_catalog_tables"] == [
        "food_product",
        "food_product_source_link",
        "food_attribute_assertion",
    ]
    assert implementation["internal_source_record_ingest_service_implemented"] is True
    assert implementation[
        "internal_source_record_terminal_moderation_service_implemented"
    ] is True
    assert implementation[
        "general_source_record_update_or_delete_service_implemented"
    ] is False
    assert implementation["public_source_record_moderation_endpoint_enabled"] is False
    assert implementation["ingest_defaults_to_quarantine"] is True
    assert implementation["raw_source_payload_column_created"] is False
    assert implementation["source_independent_schema_compatibility_required_for_v2"] is True
    assert implementation["additional_source_activation_required_for_v2"] is False
    assert implementation["v2_forward_migration_required"] is True
    assert implementation["current_release_dependency"] is True
    assert implementation["public_source_onboarding_enabled"] is False
