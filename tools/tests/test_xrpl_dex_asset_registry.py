"""Offline identity checks, not quote, trade or legal-clearance tests."""

import copy
import hashlib
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "contracts/ecosystem/xrpl-dex-assets.v1.json"
EVIDENCE_PATH = ROOT / "contracts/ecosystem/evidence/xrpl-amm-identities-20260908.json"
ALPHABET = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz"


def valid_classic_address(address: str) -> bool:
    """Test-only XRPL Base58Check: type 0, 20-byte ID, four checksum bytes.

    https://xrpl.org/docs/references/protocol/data-types/base58-encodings
    """
    if not isinstance(address, str) or not 25 <= len(address) <= 35:
        return False
    value = 0
    for character in address:
        if character not in ALPHABET:
            return False
        value = value * 58 + ALPHABET.index(character)
    zeros = len(address) - len(address.lstrip(ALPHABET[0]))
    decoded = b"\0" * zeros + value.to_bytes((value.bit_length() + 7) // 8, "big")
    if len(decoded) != 25 or decoded[0] != 0:
        return False
    checksum = hashlib.sha256(hashlib.sha256(decoded[:-4]).digest()).digest()[:4]
    return checksum == decoded[-4:]


def identity(asset: dict) -> tuple[str, str | None]:
    return asset["currency"], asset.get("issuer")


def validate_evidenced_pair(registry: dict, pair: dict, evidence: dict) -> None:
    if not valid_classic_address(pair["amm_account"]):
        raise ValueError("Invalid AMM address/checksum")
    observation = evidence["observations"][pair["id"]]
    if observation["validated"] is not True:
        raise ValueError("Evidence is not validated")
    if type(observation["ledger_index"]) is not int or observation["ledger_index"] <= 0:
        raise ValueError("Missing ledger index")
    if not re.fullmatch(r"[A-F0-9]{64}", observation["ledger_hash"]):
        raise ValueError("Invalid ledger hash")
    if pair["amm_account"] != observation["amm_account"]:
        raise ValueError("Pool address differs from ledger evidence")
    expected = {identity(registry["assets"][pair[key]]) for key in ("base", "quote")}
    actual = {identity(asset) for asset in observation["assets"]}
    if len(expected) != 2 or len(observation["assets"]) != 2 or actual != expected:
        raise ValueError("Asset identities differ from ledger evidence")


class XRPLDexAssetRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        self.evidence = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
        self.pairs = {pair["id"]: pair for pair in self.registry["pairs"]}

    def test_registry_is_non_executing_and_pins_issued_assets(self) -> None:
        self.assertEqual(self.registry["network"], "xrpl-mainnet")
        self.assertEqual(self.registry["status"], "design-only")
        self.assertEqual(self.registry["identity_evidence"], EVIDENCE_PATH.relative_to(ROOT).as_posix())
        self.assertEqual(set(self.registry["assets"]), {"XRP", "CAL", "RLUSD"})
        self.assertEqual(self.registry["assets"]["XRP"], {"kind": "native", "currency": "XRP"})
        self.assertEqual(self.registry["assets"]["CAL"], {
            "kind": "issued", "currency": "43616C6F72696500000000000000000000000000",
            "display_code": "CAL", "issuer": "rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY",
        })
        self.assertEqual(self.registry["assets"]["RLUSD"], {
            "kind": "issued", "currency": "524C555344000000000000000000000000000000",
            "display_code": "RLUSD", "issuer": "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
        })
        for asset in self.registry["assets"].values():
            if asset["kind"] == "issued":
                self.assertTrue(valid_classic_address(asset["issuer"]))
                self.assertRegex(asset["currency"], r"^[0-9A-F]{40}$")

    def test_primary_pairs_support_buying_and_selling_cal(self) -> None:
        self.assertEqual(set(self.pairs), {"CAL_XRP", "CAL_RLUSD", "XRP_RLUSD"})
        self.assertEqual(len(self.registry["pairs"]), len(self.pairs), "No duplicate IDs")
        for pair_id, quote in (("CAL_XRP", "XRP"), ("CAL_RLUSD", "RLUSD")):
            pair = self.pairs[pair_id]
            self.assertEqual((pair["base"], pair["quote"]), ("CAL", quote))
            self.assertEqual(pair["directions"], ["buy_cal", "sell_cal"])
            self.assertEqual(pair["verification"], "validated-ledger")
            validate_evidenced_pair(self.registry, pair, self.evidence)
        self.assertTrue(self.pairs["XRP_RLUSD"]["routing_only"])
        self.assertEqual(self.pairs["XRP_RLUSD"]["directions"], ["both"])
        self.assertEqual(self.pairs["XRP_RLUSD"]["verification"], "asset-identities-only")
        self.assertNotIn("amm_account", self.pairs["XRP_RLUSD"])

    def test_evidence_is_dated_identification_without_personal_positions(self) -> None:
        self.assertEqual(self.evidence["network"], self.registry["network"])
        self.assertEqual(self.evidence["source"], "https://s1.ripple.com:51234/")
        self.assertEqual(self.evidence["method"], "amm_info")
        self.assertEqual(self.evidence["observed_on"], "2026-09-08")
        self.assertEqual(set(self.evidence["observations"]), {"CAL_XRP", "CAL_RLUSD"})
        for observation in self.evidence["observations"].values():
            self.assertEqual(set(observation), {
                "ledger_index", "ledger_hash", "validated", "amm_account", "assets",
            })
            for asset in observation["assets"]:
                self.assertLessEqual(set(asset), {"currency", "issuer"})

    def test_checksum_rejects_previous_typo_and_malformed_addresses(self) -> None:
        self.assertTrue(valid_classic_address("rPN26geCWSD4xPu8LYBM8zqDrYSgNQGHeQ"))
        for address in (None, "", "r", "r" * 35,
                        "rPN26geWz6jzs4TwiwYDmpeF2maJFZBtr",
                        "rPN26geCWSD4xPu8LYBM8zqDrYSgNQGHe0",
                        "xPN26geCWSD4xPu8LYBM8zqDrYSgNQGHeQ"):
            with self.subTest(address=address):
                self.assertFalse(valid_classic_address(address))

    def test_valid_but_wrong_pool_or_issuer_is_rejected(self) -> None:
        pair = copy.deepcopy(self.pairs["CAL_RLUSD"])
        pair["amm_account"] = self.pairs["CAL_XRP"]["amm_account"]
        with self.assertRaisesRegex(ValueError, "Pool address differs"):
            validate_evidenced_pair(self.registry, pair, self.evidence)
        pair["amm_account"] = self.evidence["observations"]["CAL_RLUSD"]["amm_account"]
        registry = copy.deepcopy(self.registry)
        registry["assets"]["RLUSD"]["issuer"] = registry["assets"]["CAL"]["issuer"]
        with self.assertRaisesRegex(ValueError, "Asset identities differ"):
            validate_evidenced_pair(registry, pair, self.evidence)

    def test_pending_ledger_or_missing_reference_is_rejected(self) -> None:
        for field, value in (("validated", False), ("ledger_hash", ""), ("ledger_index", 0)):
            evidence = copy.deepcopy(self.evidence)
            evidence["observations"]["CAL_XRP"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_evidenced_pair(self.registry, self.pairs["CAL_XRP"], evidence)

    def test_unverified_labels_are_not_selectable_pairs(self) -> None:
        self.assertTrue(set(self.pairs).isdisjoint({"CAL_EUR", "CAL_USD", "BTC_CAL"}))
        self.assertEqual(self.registry["excluded_labels_pending_issuer_review"], [
            "CAL/EUR", "CAL/USD", "BTC/CAL",
        ])


if __name__ == "__main__":
    unittest.main()
