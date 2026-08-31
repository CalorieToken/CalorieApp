"""Contract checks for the time-bounded zero-additional-cost provider shortlist."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = (
    ROOT / "contracts" / "data-safety" / "v1" / "provider-evaluation.json"
)


def _load_contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_provider_evidence_is_time_bounded_and_not_a_selection() -> None:
    contract = _load_contract()
    reviewed_on = date.fromisoformat(contract["evidence_reviewed_on"])
    revalidate_by = date.fromisoformat(contract["evidence_revalidate_by"])

    assert contract["contract_id"] == (
        "calorieapp.zero-additional-cost-provider-evaluation"
    )
    assert contract["decision_state"] == (
        "shortlist-ready-human-selection-and-live-proof-required"
    )
    assert 1 <= (revalidate_by - reviewed_on).days <= 92
    assert date.today() <= revalidate_by, (
        "provider evidence expired; recheck official terms before merging"
    )
    assert contract["provider_selected"] is False
    assert contract["provider_account_created"] is False
    assert contract["payment_method_added"] is False
    assert contract["deployment_or_live_data_mutation_performed"] is False
    assert contract["third_party_terms_may_change"] is True
    assert contract["unchanged_free_tier_forever_claim_allowed"] is False


def test_non_negotiable_cost_durability_and_privacy_boundaries_remain() -> None:
    contract = _load_contract()
    requirements = contract["non_negotiable_requirements"]
    capacity = contract["capacity_policy"]

    assert requirements == {
        "zero_additional_recurring_subscription_at_initial_release": True,
        "standard_postgresql_connection_and_portable_schema": True,
        "provider_expiry_may_define_user_history_retention": False,
        "automatic_paid_upgrade_allowed": False,
        "automatic_existing_history_deletion_allowed": False,
        "new_onboarding_pauses_before_capacity_failure": True,
        "encrypted_off_provider_backup_required": True,
        "provider_exit_restore_proof_required": True,
        "eu_data_region_and_data_processing_terms_review_required": True,
        "synthetic_staging_proof_before_real_user_data": True,
    }
    assert capacity["alert_threshold_percent"] == [70, 85, 95]
    assert capacity["new_onboarding_pause_at_or_before_percent"] == 95
    assert capacity["provider_neutral_database_size_signal_implemented"] is True
    assert capacity["provider_neutral_onboarding_guard_implemented"] is True
    assert capacity["provider_neutral_alert_adapter_interface_implemented"] is True
    assert capacity["alert_adapter_schema_version"] == "calorieapp.capacity-probe.v1"
    assert capacity["capacity_incident_runbook"] == (
        "docs/CAPACITY_ALERT_INCIDENT_RUNBOOK.md"
    )
    assert capacity["configured_measurement_failure_pauses_new_onboarding"] is True
    assert capacity["exact_provider_quota_configured"] is False
    assert capacity["alert_delivery_configured"] is False
    assert capacity[
        "existing_user_read_export_and_erasure_access_preserved_while_paused"
    ] is True
    assert capacity[
        "provider_quota_values_must_be_confirmed_at_account_creation"
    ] is True
    assert capacity["provider_dashboard_only_monitoring_counts_as_complete"] is False


def test_shortlist_recommends_only_a_synthetic_experiment() -> None:
    contract = _load_contract()
    candidates = {item["id"]: item for item in contract["database_candidates"]}
    experiment = contract["recommended_next_experiment"]

    assert set(candidates) == {
        "neon_free",
        "supabase_free",
        "render_free_postgresql",
    }
    assert all(candidate["selected"] is False for candidate in candidates.values())
    assert candidates["neon_free"]["evaluation"] == (
        "recommended-for-synthetic-staging-evaluation-only"
    )
    assert candidates["neon_free"]["reported_monthly_price_usd"] == 0
    assert candidates["neon_free"]["reported_storage_gb_per_project"] == 0.5
    assert candidates["neon_free"]["reported_compute_cu_hours_per_month"] == 100
    assert candidates["neon_free"]["reported_egress_gb_per_month"] == 5
    assert candidates["neon_free"]["reported_restore_window_hours"] == 6
    assert candidates["neon_free"]["scale_to_zero"] is True
    assert candidates["supabase_free"]["evaluation"] == "conditional-alternative"
    assert candidates["supabase_free"]["automatic_pause_after_low_activity_days"] == 7
    assert candidates["supabase_free"]["automatic_backups_in_free_plan"] is False
    assert candidates["render_free_postgresql"]["evaluation"] == (
        "rejected-as-durable-primary-history-store"
    )
    assert candidates["render_free_postgresql"]["fixed_expiry_days"] == 30
    assert candidates["render_free_postgresql"][
        "data_deleted_after_grace_without_upgrade"
    ] is True
    assert candidates["render_free_postgresql"]["managed_backups_supported"] is False
    assert experiment["database_candidate"] == "neon_free"
    assert experiment["scope"] == "isolated-synthetic-staging-only"
    assert experiment[
        "human_approval_required_before_account_or_provider_configuration"
    ] is True
    assert experiment["real_user_or_production_data_allowed"] is False
    assert experiment["production_deployment_allowed"] is False
    runtime = contract["runtime_candidate"]
    assert runtime["id"] == "existing_render_free_web_service"
    assert runtime["reported_monthly_workspace_instance_hours"] == 750
    assert runtime["idle_spin_down_minutes"] == 15
    assert runtime["local_filesystem_is_ephemeral"] is True


def test_provider_facts_use_official_https_sources_only() -> None:
    contract = _load_contract()
    allowed_hosts = {"neon.com", "supabase.com", "render.com"}
    source_groups = [
        candidate["official_sources"]
        for candidate in contract["database_candidates"]
    ]
    source_groups.append(contract["runtime_candidate"]["official_sources"])

    sources = [source for group in source_groups for source in group]
    assert sources
    for source in sources:
        parsed = urlsplit(source)
        assert parsed.scheme == "https"
        assert parsed.hostname in allowed_hosts


def test_real_provider_work_remains_release_blocked() -> None:
    contract = _load_contract()

    assert contract["release_blocking_before_provider_selection"]
    assert contract["release_blocking_after_provider_selection"]
    assert "fresh official terms recheck" in contract[
        "release_blocking_before_provider_selection"
    ]
    assert "human review before any real user data" in contract[
        "release_blocking_after_provider_selection"
    ]


def test_release_matrix_and_central_contract_reference_the_shortlist() -> None:
    contract = _load_contract()
    matrix = json.loads(
        (
            ROOT
            / "contracts"
            / "data-safety"
            / "v1"
            / "release-test-matrix.json"
        ).read_text(encoding="utf-8")
    )
    safety = json.loads(
        (
            ROOT / "contracts" / "data-safety" / "v1" / "data-safety.json"
        ).read_text(encoding="utf-8")
    )
    gates = {gate["id"]: gate for gate in matrix["gates"]}
    evidence = gates["zero_additional_cost_capacity_and_exit_plan"]["evidence"]
    cost = safety["cost_sustainability"]

    assert "contracts/data-safety/v1/provider-evaluation.json" in evidence
    assert "docs/ZERO_COST_PROVIDER_EVALUATION.md" in evidence
    assert cost["provider_evaluation_contract"] == (
        "contracts/data-safety/v1/provider-evaluation.json"
    )
    assert cost["provider_shortlist_status"] == (
        "time-bounded-evidence-recorded-human-selection-required"
    )
    assert cost["provider_evidence_reviewed_on"] == contract[
        "evidence_reviewed_on"
    ]
    assert cost["provider_evidence_revalidate_by"] == contract[
        "evidence_revalidate_by"
    ]
    assert cost["provider_selected"] is False
