from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIR = ROOT / "contracts" / "data-safety" / "v1"


def _load_json(name: str) -> dict:
    return json.loads((CONTRACT_DIR / name).read_text(encoding="utf-8"))


def test_data_safety_contract_keeps_live_history_off_sqlite() -> None:
    contract = _load_json("data-safety.json")

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
    }
    assert data_classes["food_search_query"]["persistent_storage_allowed"] is False
    assert data_classes["food_search_query"]["calorieapp_identity_forwarded"] is False
    assert data_classes["voluntary_profile"]["explicit_choice_required"] is True
    assert data_classes["donation_contact"]["purpose_separation_required"] is True


def test_all_required_durable_data_release_gates_are_explicit_and_blocking() -> None:
    matrix = _load_json("release-test-matrix.json")
    gates = {gate["id"]: gate for gate in matrix["gates"]}
    expected = {
        "provider_neutral_postgresql_configuration",
        "production_sqlite_fail_closed",
        "formal_schema_migrations",
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

    assert set(gates) == expected
    assert all(gate["release_blocking"] is True for gate in gates.values())
    assert all(gate["status"] in matrix["statuses"] for gate in gates.values())
    assert gates["owner_isolation"]["status"] == "verified"
    assert gates["production_sqlite_fail_closed"]["status"] == "not_started"
    assert gates["retention_policy"]["status"] == "decision_required"
    assert matrix["release_state"] == "blocked"


def test_contract_release_order_ends_with_review_and_explicit_publication_go() -> None:
    release_order = _load_json("data-safety.json")["release_order"]

    assert release_order[-1] == "showcase-preview-review-explicit-go-scheduled-publish"
    assert release_order.index("privacy-review") < release_order.index(
        "identity-feature-expansion"
    )
