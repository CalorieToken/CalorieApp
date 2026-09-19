import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contracts" / "participation" / "v1" / "network.json"


def _contract() -> dict:
    return json.loads(CONTRACT.read_text(encoding="utf-8"))


def test_participation_network_is_disabled_and_provider_neutral() -> None:
    contract = _contract()
    assert contract["status"] == "local-synthetic-simulator-disabled-by-default"
    assert contract["bigchaindb"]["selected"] is False
    assert contract["bigchaindb"]["protocol_provider_neutral"] is True


def test_private_user_data_remains_in_protected_store() -> None:
    contract = _contract()
    primary = contract["primary_storage"]
    assert primary["private_user_data"] == "postgresql"
    assert primary["forced_private_data_decentralization"] is False
    forbidden = set(contract["forbidden_participant_inputs"])
    assert "session-secrets" in forbidden
    assert "private-keys" in forbidden
    assert "raw-private-food-history" in forbidden
    assert "private-identity-records" in forbidden


def test_participation_is_explicit_and_reversible() -> None:
    consent = _contract()["consent"]
    assert consent["opt_in_required"] is True
    assert consent["reversible"] is True
    assert consent["one_click_pause_required"] is True
    assert consent["automatic_silent_participation_forbidden"] is True
    assert consent["user_selected_storage_limit"] is True
    assert consent["user_selected_bandwidth_limit"] is True
    assert consent["user_selected_cpu_limit"] is True


def test_calt_rewards_require_verified_useful_work() -> None:
    rewards = _contract()["rewards"]
    assert rewards["asset"] == "CALT"
    assert rewards["network"] == "xrpl-testnet"
    assert rewards["enabled"] is False
    assert rewards["offchain_simulation_first"] is True
    assert rewards["verified_useful_work_required"] is True
    assert rewards["raw_uptime_reward_forbidden"] is True
    assert rewards["private_data_volume_reward_forbidden"] is True


def test_rollout_keeps_private_data_separate_from_public_decentralization() -> None:
    rollout = _contract()["rollout"]
    assert [item["phase"] for item in rollout] == [0, 1, 2, 3, 4, 5]
    assert rollout[0]["public_source_of_record"] == "postgresql"
    assert rollout[4]["public_source_of_record"] == "signed-content-protocol"
    promotion = _contract()["promotion"]
    assert promotion["automatic"] is False
    assert promotion["private_rights_must_remain_exportable_correctable_erasable"] is True
