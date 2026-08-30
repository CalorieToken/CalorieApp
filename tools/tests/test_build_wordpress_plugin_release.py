from __future__ import annotations

import hashlib
import re
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools import build_wordpress_plugin_release as release


class WordPressPluginReleaseTests(unittest.TestCase):
    def test_version_matches_plugin_header(self) -> None:
        self.assertRegex(
            release.plugin_version(),
            re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$"),
        )

    def test_build_is_reproducible_and_safe(self) -> None:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            first_archive, first_checksum, first_manifest = release.build(Path(first))
            second_archive, _, _ = release.build(Path(second))

            self.assertEqual(first_archive.read_bytes(), second_archive.read_bytes())
            digest = hashlib.sha256(first_archive.read_bytes()).hexdigest()
            self.assertEqual(
                first_checksum.read_text(encoding="utf-8"),
                f"{digest}  {first_archive.name}\n",
            )
            self.assertIn(f'"sha256": "{digest}"', first_manifest.read_text(encoding="utf-8"))
            self.assertIn(
                '"code_provenance_status": "blocked-pending-source-clearance"',
                first_manifest.read_text(encoding="utf-8"),
            )

            with zipfile.ZipFile(first_archive) as bundle:
                names = bundle.namelist()
            self.assertTrue(names)
            self.assertTrue(all(name.startswith(f"{release.PLUGIN_SLUG}/") for name in names))
            self.assertFalse(any("tests/" in name for name in names))
            self.assertFalse(any(name.endswith(".zip") for name in names))
            self.assertIn(f"{release.PLUGIN_SLUG}/LICENSE", names)
            self.assertIn(f"{release.PLUGIN_SLUG}/THIRD_PARTY_NOTICES.md", names)
            self.assertIn(f"{release.PLUGIN_SLUG}/config/locales.json", names)

    def test_release_allowlist_has_exact_code_provenance_inventory(self) -> None:
        files = release.release_paths()
        contract = release.code_provenance(files)

        self.assertEqual(
            contract["distribution_clearance_status"],
            "blocked-pending-source-clearance",
        )
        self.assertFalse(contract["claims"]["git_history_proves_legal_authorship"])
        self.assertFalse(
            contract["claims"]["current_review_is_a_legal_clearance_conclusion"]
        )

    def test_public_distribution_requires_cleared_code_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as output:
            with self.assertRaisesRegex(ValueError, "code provenance clearance"):
                release.build(
                    Path(output),
                    require_cleared_provenance=True,
                )

    def test_expected_version_must_match(self) -> None:
        with tempfile.TemporaryDirectory() as output:
            with self.assertRaisesRegex(ValueError, "plugin header declares"):
                release.build(Path(output), "9.9.9")

    def test_embed_waits_for_calorieapp_state_before_exposing_xaman(self) -> None:
        source = (
            release.PLUGIN_DIR / "assets" / "calorieapp-embed.js"
        ).read_text(encoding="utf-8")
        gate_start = source.index("function revealXamanWhenReady()")
        gate_end = source.index("function startLogin(message)", gate_start)
        gate = source[gate_start:gate_end]
        outside_gate = source[:gate_start] + source[gate_end:]

        self.assertIn("if (!backendState)", gate)
        self.assertIn("openLink.hidden = false;", gate)
        self.assertIn("connectWebsocket(xamanLaunch.websocketUrl);", gate)
        self.assertNotIn("openLink.hidden = false;", outside_gate)

    def test_embed_checks_signature_only_after_xaman_was_launched(self) -> None:
        source = (
            release.PLUGIN_DIR / "assets" / "calorieapp-embed.js"
        ).read_text(encoding="utf-8")
        return_check_start = source.index("function checkAfterReturn()")
        return_check_end = source.index(
            'document.addEventListener("visibilitychange"', return_check_start
        )
        return_check = source[return_check_start:return_check_end]

        self.assertIn("xamanLaunchStarted", return_check)
        self.assertIn("!flowFailed", return_check)
        self.assertIn("markXamanStarted();", source)
        self.assertIn("scheduleFinishRetry(5000);", source)


if __name__ == "__main__":
    unittest.main()
