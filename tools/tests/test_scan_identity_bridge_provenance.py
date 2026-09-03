from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools import check_legal_boundaries as legal_boundaries
from tools import scan_identity_bridge_provenance as scan


class IdentityBridgeProvenanceScanTests(unittest.TestCase):
    def _source_tree(self, root: Path, version: str = "1.3.1") -> Path:
        source = root / "xummlogin"
        source.mkdir()
        (source / "xummlogin.php").write_text(
            """<?php
/**
 * Plugin Name: XUMM Login
 * Version:     %s
 */
$credential_that_must_not_be_reported = 'private-test-value';
add_action('init', 'xummlogin_start_session', 1);
"""
            % version,
            encoding="utf-8",
        )
        public = source / "public"
        public.mkdir()
        bridge_tokens = scan.TOKEN_PATTERN.findall(
            (scan.PLUGIN_DIR / "assets" / "calorieapp-embed.js").read_text(
                encoding="utf-8"
            )
        )
        self.assertGreaterEqual(len(bridge_tokens), scan.TOKEN_SHINGLE_SIZE)
        bridge_shingle = " ".join(bridge_tokens[: scan.TOKEN_SHINGLE_SIZE])
        (public / "xummlogin-public.js").write_text(
            f"{bridge_shingle}\nfunction upstreamExample() {{}}\n",
            encoding="utf-8",
        )
        return source

    def _package_archive(self, root: Path, source: Path) -> Path:
        archive = root / "xummlogin-1.3.1.zip"
        with zipfile.ZipFile(archive, "w") as bundle:
            for path in sorted(source.rglob("*")):
                if path.is_file():
                    bundle.write(path, f"xummlogin/{path.relative_to(source).as_posix()}")
        return archive

    def test_report_is_deterministic_content_safe_and_non_clearing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = self._source_tree(Path(temporary))
            archive = self._package_archive(Path(temporary), source)
            arguments = {
                "expected_xummlogin_version": "1.3.1",
                "source_reference": "live-export:test-fixture",
                "review_date": "2026-09-03",
                "package_archive": archive,
            }
            first = scan.build_report(source, **arguments)
            second = scan.build_report(source, **arguments)

            self.assertEqual(first, second)
            self.assertEqual(first["upstream"]["version"], "1.3.1")
            self.assertEqual(
                first["upstream"]["package_sha256"],
                hashlib.sha256(archive.read_bytes()).hexdigest(),
            )
            self.assertTrue(
                first["upstream"]["package_code_matches_scanned_tree"]
            )
            self.assertGreater(first["comparison"]["finding_count"], 0)
            self.assertFalse(
                first["comparison"]["algorithm"]["source_contents_included_in_report"]
            )
            self.assertFalse(
                first["review_boundary"]["clears_public_distribution"]
            )
            self.assertTrue(first["review_boundary"]["human_review_required"])
            rendered = json.dumps(first, sort_keys=True)
            self.assertNotIn("private-test-value", rendered)
            self.assertNotIn("credential_that_must_not_be_reported", rendered)

    def test_declared_version_must_match_expected_version(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = self._source_tree(Path(temporary), version="1.3.0")
            with self.assertRaisesRegex(ValueError, "source declares 1.3.0"):
                scan.build_report(
                    source,
                    expected_xummlogin_version="1.3.1",
                    source_reference="live-export:test-fixture",
                    review_date="2026-09-03",
                )

    def test_review_date_must_be_a_real_calendar_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = self._source_tree(Path(temporary))
            with self.assertRaisesRegex(ValueError, "valid calendar date"):
                scan.build_report(
                    source,
                    expected_xummlogin_version="1.3.1",
                    source_reference="live-export:test-fixture",
                    review_date="2026-02-31",
                )

    def test_symlinked_source_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self._source_tree(root)
            try:
                (source / "unsafe.php").symlink_to(source / "xummlogin.php")
            except OSError:
                self.skipTest("symlinks are unavailable")
            with self.assertRaisesRegex(ValueError, "contains a symlink"):
                scan.build_report(
                    source,
                    expected_xummlogin_version="1.3.1",
                    source_reference="live-export:test-fixture",
                    review_date="2026-09-03",
                )

    def test_package_archive_must_match_scanned_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self._source_tree(root)
            archive = self._package_archive(root, source)
            (source / "public" / "xummlogin-public.js").write_text(
                "changed after packaging\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(ValueError, "content differs"):
                scan.build_report(
                    source,
                    expected_xummlogin_version="1.3.1",
                    source_reference="live-export:test-fixture",
                    review_date="2026-09-03",
                    package_archive=archive,
                )

    def test_evidence_writer_refuses_to_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "report.json"
            scan.write_report({"first": True}, output)
            with self.assertRaisesRegex(ValueError, "refusing to overwrite"):
                scan.write_report({"second": True}, output)

    def test_legal_boundary_json_objects_fail_closed(self) -> None:
        malformed_values = (None, [], "not-an-object", 1)
        for malformed in malformed_values:
            with self.subTest(malformed=malformed):
                with self.assertRaisesRegex(
                    SystemExit,
                    "Similarity evidence review_boundary must be a JSON object",
                ):
                    legal_boundaries.require_json_object(
                        malformed,
                        "Similarity evidence review_boundary",
                    )

    def test_committed_preliminary_report_is_bound_to_current_bridge(self) -> None:
        report = json.loads(
            (
                scan.ROOT
                / "contracts"
                / "identity-bridge"
                / "v1"
                / "evidence"
                / "xummlogin-public-1.3.0-similarity.json"
            ).read_text(encoding="utf-8")
        )
        bridge_files = scan._bridge_code_files()

        self.assertEqual(
            report["bridge"]["tree_sha256"],
            scan._tree_digest(scan.PLUGIN_DIR, bridge_files),
        )
        self.assertEqual(report["bridge"]["version"], "0.3.1")
        self.assertEqual(report["upstream"]["version"], "1.3.0")
        self.assertIsNone(report["upstream"]["package_sha256"])
        self.assertFalse(report["review_boundary"]["clears_public_distribution"])


if __name__ == "__main__":
    unittest.main()
