from __future__ import annotations

import json
from pathlib import Path

from app.main import app


ROOT = Path(__file__).resolve().parents[2]
VERSION_CONTRACT = ROOT / "contracts" / "release" / "v2" / "completion-boundary.json"
BASELINE_CONTRACT = ROOT / "contracts" / "release" / "v2" / "baseline-evidence.json"


def _load_contract() -> dict:
    return json.loads(VERSION_CONTRACT.read_text(encoding="utf-8"))


def _load_baseline() -> dict:
    return json.loads(BASELINE_CONTRACT.read_text(encoding="utf-8"))


def test_v2_completion_builds_on_proven_baseline_without_readiness_claim() -> None:
    v2 = _load_contract()["v2"]

    assert v2["status"] == "active-completion-from-functionally-proven-baseline"
    assert v2["production_readiness_certified"] is False
    assert v2["privacy_or_regulatory_certification_claimed"] is False
    assert v2["source_independent_schema_required"] is True
    assert v2["second_food_data_source_required_for_completion"] is False
    assert v2["public_user_onboarding_blocked_until_release_gates_pass"] is True
    assert v2["automatic_publication_allowed"] is False
    assert v2["ordered_completion_workstreams"][-1] == (
        "showcase-preview-review-explicit-go-and-scheduled-publication"
    )


def test_v2_live_baseline_is_evidence_without_guessing_deployed_commit() -> None:
    baseline = _load_baseline()
    refs = baseline["repository_references"]

    assert baseline["observation_kind"] == "read-only-and-non-authenticated-live-smoke"
    assert refs["known_working_checkpoint"] == {
        "commit": "c6cdf49e23e93d227667ef179c8832e9e2b23e20",
        "date": "2026-08-27T21:03:47+02:00",
        "description": (
            "Merge pull request #8: keep Render backend wakeup alive long enough "
            "for Xaman login"
        ),
    }
    assert refs["latest_integrated_v2_main_at_observation"]["commit"] == (
        "58dd4b828cd49459890af9fc904621f24421773d"
    )
    assert refs["known_working_checkpoint_is_ancestor_of_latest_main"] is True
    assert refs["exact_commit_currently_deployed"] == "unknown-not-exposed-by-runtime"
    assert refs["latest_main_may_be_claimed_as_exact_deployment"] is False
    assert "xaman-login-completion" in baseline["not_proven_by_this_observation"]
    assert "exact-deployed-source-commit-or-build-artifact" in baseline[
        "not_proven_by_this_observation"
    ]
    assert baseline["release_gate_status"] == "partial"


def test_v3_is_reserved_without_premature_bigchaindb_selection() -> None:
    v3 = _load_contract()["v3"]

    assert v3["status"] == "reserved-future-web3-generation-not-designed"
    assert v3["architecture_selected"] is False
    assert v3["bigchaindb_selected"] is False
    assert v3["bigchaindb_may_be_reassessed_later"] is True
    assert v3["full_dao_implementation_and_real_voting_reserved_for_v3"] is True
    assert v3["dao_activation_is_automatic_in_v3"] is False
    assert "comparison-with-postgresql-plus-xrpl" in v3["reassessment_requires"]
    assert v3["v2_may_claim_v3_web3_completion"] is False


def test_runtime_versions_are_aligned_to_v2() -> None:
    versioning = _load_contract()["versioning"]
    frontend_package = json.loads(
        (ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
    )
    frontend_lock = json.loads(
        (ROOT / "frontend" / "package-lock.json").read_text(encoding="utf-8")
    )

    assert app.version == versioning["backend_api_version"] == "0.2.0"
    assert frontend_package["version"] == versioning["frontend_package_version"]
    assert frontend_lock["version"] == versioning["frontend_package_version"]
    assert frontend_lock["packages"][""]["version"] == (
        versioning["frontend_package_version"]
    )
    assert versioning["ds_3_means_data_safety_step_3_not_product_v3"] is True
    assert versioning["contract_directory_v1_means_contract_schema_version_not_product_v1"] is True


def test_data_safety_contract_points_to_v2_completion_boundary() -> None:
    data_safety = json.loads(
        (ROOT / "contracts" / "data-safety" / "v1" / "data-safety.json").read_text(
            encoding="utf-8"
        )
    )
    track = data_safety["product_version_track"]

    assert track["contract"] == "contracts/release/v2/completion-boundary.json"
    assert track["baseline_evidence_contract"] == (
        "contracts/release/v2/baseline-evidence.json"
    )
    assert track["v2_status"] == "active-completion-from-functionally-proven-baseline"
    assert track["current_foundation_work_belongs_to"] == "v2"
    assert track["v3_status"] == "reserved-future-web3-generation-not-designed"
    assert track["bigchaindb_selected_for_v3"] is False
    assert track["public_user_onboarding_release_gates_apply_to"] == "v2"
