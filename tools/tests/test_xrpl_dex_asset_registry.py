import json
from pathlib import Path


REGISTRY_PATH = (
    Path(__file__).resolve().parents[2]
    / "contracts"
    / "ecosystem"
    / "xrpl-dex-assets.v1.json"
)


def load_registry() -> dict:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def test_registry_is_non_executing_and_pins_issued_assets() -> None:
    registry = load_registry()

    assert registry["network"] == "xrpl-mainnet"
    assert registry["status"] == "design-only"
    assert registry["assets"]["CAL"] == {
        "kind": "issued",
        "currency": "43616C6F72696500000000000000000000000000",
        "display_code": "CAL",
        "issuer": "rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY",
    }
    assert registry["assets"]["RLUSD"] == {
        "kind": "issued",
        "currency": "524C555344000000000000000000000000000000",
        "display_code": "RLUSD",
        "issuer": "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
    }


def test_primary_pairs_support_buying_and_selling_cal() -> None:
    registry = load_registry()
    pairs = {pair["id"]: pair for pair in registry["pairs"]}

    assert set(pairs) == {"CAL_XRP", "CAL_RLUSD", "XRP_RLUSD"}
    for pair_id in ("CAL_XRP", "CAL_RLUSD"):
        assert pairs[pair_id]["directions"] == ["buy_cal", "sell_cal"]
        assert pairs[pair_id]["verification"] == "validated-ledger"
        assert pairs[pair_id]["amm_account"].startswith("r")
    assert pairs["XRP_RLUSD"]["routing_only"] is True


def test_unverified_labels_are_not_selectable_pairs() -> None:
    registry = load_registry()
    selectable = {pair["id"] for pair in registry["pairs"]}

    assert selectable.isdisjoint({"CAL_EUR", "CAL_USD", "BTC_CAL"})
    assert registry["excluded_labels_pending_issuer_review"] == [
        "CAL/EUR",
        "CAL/USD",
        "BTC/CAL",
    ]
