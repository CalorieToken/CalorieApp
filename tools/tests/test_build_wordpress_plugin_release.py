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

            with zipfile.ZipFile(first_archive) as bundle:
                names = bundle.namelist()
            self.assertTrue(names)
            self.assertTrue(all(name.startswith(f"{release.PLUGIN_SLUG}/") for name in names))
            self.assertFalse(any("tests/" in name for name in names))
            self.assertFalse(any(name.endswith(".zip") for name in names))

    def test_expected_version_must_match(self) -> None:
        with tempfile.TemporaryDirectory() as output:
            with self.assertRaisesRegex(ValueError, "plugin header declares"):
                release.build(Path(output), "9.9.9")


if __name__ == "__main__":
    unittest.main()
