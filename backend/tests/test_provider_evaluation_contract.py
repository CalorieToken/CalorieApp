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


def test_provider_evidence_and_synthetic_selection_are_time_bounded() -> None:
    contract = _load_contract()
    reviewed_on = date.fromisoformat(contract["evidence_reviewed_on"])
    revalidate_by = date.fromisoformat(contract["evidence_revalidate_by"])

    assert contract["contract_id"] == (
        "calorieapp.zero-additional-cost-provider-evaluation"
    )
    assert contract["contract_version"] == "1.5.0"
    assert contract["decision_state"] == (
        "neon-synthetic-staging-project-created-use-blocked"
    )
    assert 1 <= (revalidate_by - reviewed_on).days <= 92
    assert date.today() <= revalidate_by, (
        "provider evidence expired; recheck official terms before merging"
    )
    assert contract["provider_selected"] is True
    assert contract["provider_selection_scope"] == "isolated-synthetic-staging-only"
    assert contract["provider_selected_for_public_release"] is False
    assert contract["provider_account_created"] is True
    assert contract["provider_project_created"] is True
    assert contract["payment_method_added"] is False
    assert contract["deployment_or_live_data_mutation_performed"] is False
    assert contract["third_party_terms_may_change"] is True
    assert contract["unchanged_free_tier_forever_claim_allowed"] is False
    selection = contract["selection_record"]
    assert selection == {
        "selected_candidate": "neon_free",
        "selected_on": "2026-09-01",
        "approval_reference": "operator-decision-2026-09-02-neon-free-frankfurt-synthetic-staging",
        "approved_scope": "one-free-frankfurt-project-for-isolated-synthetic-staging-only",
        "account_or_project_creation_approved": True,
        "payment_method_or_paid_upgrade_approved": False,
        "real_user_or_production_data_approved": False,
        "external_schema_migration_approved": False,
        "production_deployment_approved": False,
    }


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
    assert capacity["free_console_usage_metrics_confirmed_live"] is True
    assert capacity["persistent_provider_api_key_created"] is False
    assert capacity[
        "existing_user_read_export_and_erasure_access_preserved_while_paused"
    ] is True
    assert capacity[
        "provider_quota_values_must_be_confirmed_before_provider_use"
    ] is True
    assert capacity["provider_dashboard_only_monitoring_counts_as_complete"] is False


def test_live_configuration_authorizes_no_provider_use_or_real_data() -> None:
    contract = _load_contract()
    review = contract["preconfiguration_review"]

    assert review["status"] == (
        "free-frankfurt-project-created-provider-use-and-recipient-configuration-blocked"
    )
    live_evidence = ROOT / review["live_evidence_document"]
    assert live_evidence.is_file()
    assert "No key was created" in live_evidence.read_text(encoding="utf-8")
    assert review["eu_region"] == {
        "documented_candidate": "aws-eu-central-1",
        "region_is_fixed_at_project_creation": True,
        "account_console_confirmation_required": False,
        "confirmed_in_live_project": True,
        "project_postgres_version": 16,
        "approved_for_account_creation": True,
    }
    assert review["data_processing"]["published_dpa_reviewed"] is True
    assert review["data_processing"]["global_access_or_processing_may_occur"] is True
    assert review["data_processing"][
        "dpa_execution_or_account_acceptance_confirmed"
    ] is False
    assert review["data_processing"]["approved_for_real_personal_data"] is False
    assert review["billing_and_quota"]["free_plan_listed_price_usd_per_month"] == 0
    assert review["billing_and_quota"][
        "payment_method_absence_confirmed_in_live_account"
    ] is True
    assert review["billing_and_quota"][
        "automatic_paid_upgrade_disabled_in_live_account"
    ] is True
    billing = review["billing_and_quota"]
    assert billing["live_plan"] == "Free"
    assert billing["live_price_usd_per_month"] == 0
    assert billing["live_project_count"] == 1
    assert billing["live_synthetic_project_name"] == "calorieapp-synthetic-staging"
    assert billing["live_neon_auth_enabled"] is False
    assert billing["live_compute_defaults_cu"] == {"minimum": 0.25, "maximum": 2}
    assert billing["live_scale_to_zero_minutes"] == 5
    assert billing["free_console_usage_metrics_confirmed"] == [
        "compute_cu_hours",
        "storage_gb",
        "history_gb",
        "network_transfer_gb",
    ]
    assert billing["free_console_usage_was_zero_at_review"] is True
    assert billing["usage_based_consumption_api_documented_for_free_plan"] is False
    assert billing["configurable_hard_quota_requires_api_key"] is True
    assert billing["project_scoped_api_key_is_least_privilege_available"] is True
    assert billing["organization_api_key_present"] is False
    assert billing["personal_api_key_present"] is False
    assert billing["project_scoped_api_key_created"] is False
    assert billing["free_plan_quota_api_availability_confirmed_in_live_account"] is False
    backup = review["portable_backup"]
    assert backup["off_provider_destination_selected"] is True
    assert backup["selected_destination"] == "github_actions_artifact"
    assert backup["selection_scope"] == "isolated-synthetic-neon-staging-only"
    assert backup["artifact_retention_days"] == 30
    assert backup["client_side_encryption_recipient_configured"] is False
    assert backup["private_decryption_key_custody_approved"] is True
    assert backup["key_custody_selection_date"] == "2026-09-01"
    assert backup["key_custody_approval_reference"] == (
        "operator-decision-2026-09-01-offline-age-key-custody"
    )
    assert backup["encryption_format"] == "age"
    assert backup["private_key_custody_mode"] == (
        "passphrase-encrypted-age-identity-offline"
    )
    assert backup["offline_primary_and_recovery_copies_required"] is True
    assert backup["offline_copy_locations_recorded_in_public_repository"] is False
    assert backup["identity_passphrase_stored_separately_from_encrypted_identity"] is True
    assert backup["public_recipient_may_be_committed"] is True
    assert backup["private_key_generated_or_configured"] is False
    assert backup["permanent_github_private_key_secret_allowed"] is False
    assert backup["restore_identity_transfer"] == (
        "temporary-github-environment-secret-after-required-review"
    )
    assert backup["restore_environment"] == "neon-synthetic-restore"
    assert backup["restore_environment_must_be_precreated_and_protected"] is True
    assert backup["restore_environment_branch_policy"] == "main-only"
    assert backup["restore_environment_required_reviewer"] is True
    assert backup["restore_environment_admin_bypass_allowed"] is False
    assert backup["restore_workflow_trigger"] == "workflow-dispatch-only"
    assert backup["pull_request_workflow_identity_access_allowed"] is False
    assert backup["restore_identity_secret_name"] == (
        "CALORIEAPP_SYNTHETIC_AGE_IDENTITY"
    )
    assert backup["restore_identity_secret_created_only_for_approved_run"] is True
    assert backup["restore_identity_secret_deleted_after_every_run"] is True
    assert backup["unreviewed_workflow_input_for_identity_allowed"] is False
    assert backup["plaintext_artifact_upload_allowed"] is False
    assert backup["artifact_upload_implemented_or_performed"] is False
    assert backup["real_user_or_production_data_allowed"] is False
    assert backup["production_backup_destination_selected"] is False
    assert review["portable_backup"]["credentials_or_keys_may_be_committed"] is False
    provider_exit = review["provider_exit"]
    assert provider_exit["distinct_postgresql_target_selected"] is True
    assert provider_exit["selected_target"] == "github_hosted_runner_postgresql_16"
    assert provider_exit["target_is_outside_neon"] is True
    assert provider_exit["target_is_ephemeral"] is True
    assert provider_exit["synthetic_restore_runbook_approved"] is True
    assert provider_exit["provider_exit_restore_implemented_or_performed"] is False
    assert provider_exit["real_user_or_production_data_allowed"] is False
    assert provider_exit["production_exit_target_selected"] is False


def test_shortlist_recommends_only_a_synthetic_experiment() -> None:
    contract = _load_contract()
    candidates = {item["id"]: item for item in contract["database_candidates"]}
    experiment = contract["recommended_next_experiment"]

    assert set(candidates) == {
        "neon_free",
        "supabase_free",
        "render_free_postgresql",
    }
    assert candidates["neon_free"]["selected"] is True
    assert candidates["neon_free"]["selection_scope"] == (
        "isolated-synthetic-staging-only"
    )
    assert candidates["neon_free"]["selected_for_public_release"] is False
    assert candidates["supabase_free"]["selected"] is False
    assert candidates["render_free_postgresql"]["selected"] is False
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
    assert experiment["candidate_selection_human_approved"] is True
    assert experiment[
        "human_approval_required_before_account_or_provider_configuration"
    ] is True
    assert experiment["account_or_project_creation_approved"] is True
    assert experiment["provider_project_created"] is True
    assert experiment["real_user_or_production_data_allowed"] is False
    assert experiment["production_deployment_allowed"] is False
    runtime = contract["runtime_candidate"]
    assert runtime["id"] == "existing_render_free_web_service"
    assert runtime["reported_monthly_workspace_instance_hours"] == 750
    assert runtime["idle_spin_down_minutes"] == 15
    assert runtime["local_filesystem_is_ephemeral"] is True


def test_provider_facts_use_official_https_sources_only() -> None:
    contract = _load_contract()
    allowed_hosts = {"docs.github.com", "neon.com", "supabase.com", "render.com"}
    source_groups = [
        candidate["official_sources"]
        for candidate in contract["database_candidates"]
    ]
    source_groups.append(contract["runtime_candidate"]["official_sources"])
    source_groups.append(contract["preconfiguration_review"]["official_sources"])

    sources = [source for group in source_groups for source in group]
    assert sources
    for source in sources:
        parsed = urlsplit(source)
        assert parsed.scheme == "https"
        if parsed.hostname == "github.com":
            assert source == "https://github.com/FiloSottile/age"
        else:
            assert parsed.hostname in allowed_hosts


def test_real_provider_work_remains_release_blocked() -> None:
    contract = _load_contract()

    assert contract["release_blocking_before_provider_selection"] == []
    assert contract["release_blocking_before_provider_configuration"] == []
    assert contract["release_blocking_before_synthetic_provider_use"]
    assert contract["release_blocking_after_provider_selection"]
    blockers = contract["release_blocking_before_synthetic_provider_use"]
    assert (
        "confirm DPA execution or account acceptance and subscribe to subprocessor changes"
        in blockers
    )
    assert (
        "generate the offline age identity, record only its public recipient, and verify the encrypted recovery copy without committing key material"
        in blockers
    )
    assert (
        "approve and configure a least-privilege provider measurement path without exposing a persistent API key"
        in blockers
    )
    assert not any("approve an encrypted off-provider backup destination" in item for item in blockers)
    assert not any("approve a distinct PostgreSQL provider-exit target" in item for item in blockers)
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
        "neon-free-frankfurt-synthetic-staging-project-created-use-blocked"
    )
    assert cost["provider_evidence_reviewed_on"] == contract[
        "evidence_reviewed_on"
    ]
    assert cost["provider_evidence_revalidate_by"] == contract[
        "evidence_revalidate_by"
    ]
    assert cost["provider_selected"] is True
    assert cost["selected_provider"] == "neon_free"
    assert cost["provider_selection_scope"] == "isolated-synthetic-staging-only"
    assert cost["provider_selected_for_public_release"] is False
    assert cost["provider_account_created"] is True
    assert cost["provider_project_created"] is True
