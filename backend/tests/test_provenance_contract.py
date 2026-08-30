from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contracts" / "provenance" / "v1" / "traceability.json"


def _contract() -> dict:
    return json.loads(CONTRACT.read_text(encoding="utf-8"))


def test_provenance_is_future_ready_without_becoming_a_launch_feature() -> None:
    contract = _contract()
    rollout = contract["rollout"]

    assert contract["contract_id"] == "caloriedb.xrpl-linked-provenance"
    assert rollout["core_public_release_dependency"] is False
    assert rollout["initial_user_facing_feature"] is False
    assert rollout["initial_wallet_or_ledger_scan"] is False
    assert rollout["initial_transaction_or_memo_ui"] is False
    assert "disabled feature flag" in rollout["phase_1"]
    assert "testnet or synthetic-data" in rollout["phase_2"]

    platform = contract["platform_boundary"]
    assert platform["stored_in_primary_postgresql"] is True
    assert platform["separate_graph_database_required"] is False
    assert platform["additional_blockchain_required"] is False
    assert platform["ipfs_required"] is False


def test_provenance_automation_is_scoped_idempotent_and_disabled_by_default() -> None:
    automation = _contract()["automation_boundary"]

    assert automation["feature_flag_default"] == "disabled"
    assert automation["explicit_purpose_scoped_link_request_required"] is True
    assert automation["automatic_complete_wallet_scan_allowed"] is False
    assert automation["automatic_cross_purpose_linking_allowed"] is False
    assert automation["single_requested_transaction_verification_may_be_automated"] is True
    assert automation["idempotent_ingestion_key"] == ["network", "transaction_hash"]
    assert automation["retry_safe_processing_required"] is True
    assert automation["production_enablement_requires_human_approval"] is True
    assert automation["jurisdiction_gate_enforced_before_processing"] is True


def test_top_anchor_is_one_to_one_from_xrpl_hash_to_caloriedb_hash() -> None:
    anchor = _contract()["top_anchor"]

    assert anchor["xrpl_key"] == ["network", "transaction_hash"]
    assert anchor["caloriedb_key"] == "calorie_anchor_hash"
    assert anchor["cardinality"] == "one-to-one"
    assert anchor["hashes_are_equal"] is False
    assert ["network", "transaction_hash"] in anchor["unique_constraints"]
    assert ["calorie_anchor_hash"] in anchor["unique_constraints"]
    assert "HMAC-SHA-256" in anchor["calorie_anchor_derivation"]


def test_calorie_transaction_match_uses_exact_asset_identity_not_label_or_memo() -> None:
    scope = _contract()["calorie_asset_scope"]

    assert scope["exact_asset_registry_required"] is True
    assert scope["registry_key"] == ["network", "issuer", "currency_code"]
    assert scope["symbol_or_memo_only_match_allowed"] is False
    assert scope["validated_transaction_and_metadata_required"] is True
    assert scope["anchor_requires_calorie_relevance_evidence"] is True
    assert scope["initial_pilot_transaction_types"] == ["Payment"]
    assert scope["rule_version_stored_per_anchor"] is True


def test_traceability_layers_start_at_hash_pair_before_events_and_lots() -> None:
    layers = _contract()["layers_top_down"]

    assert [layer["level"] for layer in layers] == [0, 1, 2, 3, 4]
    assert [layer["entity"] for layer in layers] == [
        "validated_xrpl_transaction",
        "calorie_transaction_anchor",
        "provenance_event",
        "product_lot_or_batch",
        "trace_view",
    ]
    assert layers[1]["relation_to_parent"] == "exactly-one"


def test_supply_trace_is_a_gap_preserving_dag() -> None:
    graph = _contract()["graph_rules"]

    assert graph["shape"] == "directed-acyclic-graph"
    assert graph["simple_linear_chain_assumed"] is False
    assert graph["splits_supported"] is True
    assert graph["merges_supported"] is True
    assert graph["cycles_allowed"] is False
    assert graph["missing_edges_reported_as_gaps"] is True
    assert graph["missing_edges_inferred_or_fabricated"] is False


def test_ledger_hash_does_not_claim_to_prove_physical_food_truth() -> None:
    contract = _contract()
    truth = contract["truth_boundary"]
    privacy = contract["privacy_and_visibility"]

    assert truth["physical_claim_requires_separate_evidence"] is True
    assert "does not prove" not in truth["transaction_proves"]
    assert "physical food product" in truth["transaction_does_not_prove"]
    assert privacy["consumer_events_private_by_default"] is True
    assert privacy["personal_food_history_public_by_default"] is False
    assert privacy["public_transaction_lookup_may_return_private_record"] is False
    assert privacy["cross_purpose_auto_linking_allowed"] is False
