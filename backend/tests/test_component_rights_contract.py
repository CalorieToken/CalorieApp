from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = (
    ROOT / "contracts" / "governance" / "v2" / "component-rights-registry.json"
)


def _load_contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_developer_claim_is_component_specific_and_evidence_based() -> None:
    contract = _load_contract()
    separation = contract["separation_rules"]

    assert "official-product-component" in contract["layer_values"]
    assert "ecosystem-interface-or-specification" in contract["layer_values"]
    assert "independent-ecosystem-implementation" in contract["layer_values"]
    assert separation["credit_is_legal_ownership"] is False
    assert separation["authorship_is_assignment"] is False
    assert separation["copyright_is_maintenance_authority"] is False
    assert separation["ecosystem_contribution_grants_control_of_official_product"] is False
    assert separation["official_adoption_transfers_all_contributor_rights_automatically"] is False
    assert separation["developer_may_claim_entire_product_or_ecosystem_from_partial_contribution"] is False
    assert separation["developer_may_record_evidence_based_claim_to_own_original_component_or_contribution"] is True


def test_user_source_and_third_party_rights_stay_separate() -> None:
    rights = _load_contract()["special_rights_boundaries"]

    assert rights["private_user_identity_session_or_food_history_is_developer_ip"] is False
    assert rights["public_food_fact_is_owned_by_importing_developer"] is False
    assert rights["external_source_data_keeps_source_specific_licence"] is True
    assert rights["historical_brand_and_visual_assets_keep_recorded_rights_status"] is True
    assert rights["mixed_component_requires_per_part_rights_and_licence_mapping"] is True
    assert rights["unknown_or_disputed_status_may_be_silently_changed_to_owned"] is False


def test_dao_cannot_vote_away_existing_rights_or_user_data() -> None:
    dao = _load_contract()["dao_boundary"]

    assert dao["dao_may_set_direction_for_ecosystem_interfaces_within_its_future_scope"] is True
    assert dao["dao_may_claim_developer_authorship"] is False
    assert dao["dao_may_reassign_existing_component_rights_without_rightsholder_authority"] is False
    assert dao["dao_may_relicense_component_or_third_party_material_without_authority"] is False
    assert dao["dao_may_vote_private_user_data_into_public_or_collective_ownership"] is False
    assert dao["licence_or_assignment_change_requires_documented_authority_outside_vote_result"] is True
