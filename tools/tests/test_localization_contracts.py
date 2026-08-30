from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POLICY_PATH = ROOT / "contracts" / "localization" / "v1" / "asset-localization.json"
LOCALES_PATH = ROOT / "contracts" / "identity-bridge" / "v1" / "locales.json"


class LocalizationContractTests(unittest.TestCase):
    def test_historical_original_and_identity_are_immutable(self) -> None:
        policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
        self.assertTrue(policy["original_asset_policy"]["retain_unchanged_original"])
        self.assertTrue(policy["original_asset_policy"]["original_is_historical_source"])
        self.assertIn("historical_brand_identity", policy["visual_invariants"])
        self.assertIn("composition", policy["visual_invariants"])
        self.assertIn("color_palette", policy["visual_invariants"])
        self.assertIn("typography_character", policy["visual_invariants"])
        self.assertIn("translated_text", policy["allowed_variant_changes"])
        self.assertIn("generic_visual_redesign", policy["forbidden_changes"])

    def test_image_workflow_uses_the_shared_locale_source(self) -> None:
        registry = json.loads(LOCALES_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(registry["locales"]), 11)
        self.assertEqual(registry["source_locale"], "en")
        self.assertEqual(registry["fallback_locale"], "en")

    def test_localized_images_require_the_existing_publication_gate(self) -> None:
        policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
        self.assertEqual(policy["quality_gate"][-3:], ["preview", "review", "explicit_go"])


if __name__ == "__main__":
    unittest.main()
