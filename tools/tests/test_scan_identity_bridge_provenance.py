from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

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

    def test_source_reference_rejects_obvious_credentials(self) -> None:
        unsafe_references = {
            "authorization header": "Authorization: Bearer not-a-real-token",
            "api key header": "X-Api-Key: not-a-real-token",
            "cookie header": "Cookie: session=not-a-real-token",
            "URL credentials": (
                "https://user:not-a-real-token@example.test/xummlogin.zip"
            ),
            "token query parameter": (
                "https://example.test/xummlogin.zip?access_token=not-a-real-token"
            ),
            "encoded token query parameter": (
                "https://example.test/xummlogin.zip?"
                "access%255Ftoken=not-a-real-token"
            ),
            "prefixed token": "github_pat_not-a-real-token",
        }
        for label, reference in unsafe_references.items():
            with self.subTest(label=label):
                with self.assertRaisesRegex(
                    ValueError,
                    "must not contain credentials or secret-bearing parameters",
                ) as raised:
                    scan._validate_reference(reference)
                self.assertNotIn("not-a-real-token", str(raised.exception))

    def test_bridge_contract_root_must_be_an_object(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            contract = Path(temporary) / "code-provenance.json"
            for malformed in (None, []):
                with self.subTest(malformed=malformed):
                    contract.write_text(
                        json.dumps(malformed) + "\n",
                        encoding="utf-8",
                    )
                    with mock.patch.object(scan, "PROVENANCE_CONTRACT", contract):
                        with self.assertRaisesRegex(
                            ValueError,
                            "provenance root must be a JSON object",
                        ):
                            scan._bridge_code_files()

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
            with self.assertRaisesRegex(
                ValueError,
                "package archive code content differs from the scanned source tree",
            ):
                scan.build_report(
                    source,
                    expected_xummlogin_version="1.3.1",
                    source_reference="live-export:test-fixture",
                    review_date="2026-09-03",
                    package_archive=archive,
                )

    def test_package_archive_code_paths_must_match_scanned_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self._source_tree(root)
            archive = self._package_archive(root, source)
            (source / "added-after-packaging.js").write_text(
                "function addedAfterPackaging() {}\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                ValueError,
                "package archive code paths differ from the scanned source tree",
            ):
                scan.build_report(
                    source,
                    expected_xummlogin_version="1.3.1",
                    source_reference="live-export:test-fixture",
                    review_date="2026-09-03",
                    package_archive=archive,
                )

    def test_package_archive_member_count_is_bounded(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self._source_tree(root)
            archive = root / "too-many-members.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                for index in range(3):
                    bundle.writestr(f"member-{index}.txt", b"")

            with mock.patch.object(scan, "MAX_ARCHIVE_MEMBERS", 2):
                with self.assertRaisesRegex(ValueError, "contains too many members"):
                    scan._verified_package_archive(
                        archive,
                        source,
                        scan._external_code_files(source),
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

    def test_compare_pair_skips_sequence_matcher_without_shared_lines(self) -> None:
        bridge_fingerprint = {
            "line_digests": ["bridge-line"],
            "line_digest_set": {"bridge-line"},
            "token_shingles": {"shared-shingle"},
        }
        upstream_fingerprint = {
            "line_digests": ["upstream-line"],
            "line_digest_set": {"upstream-line"},
            "token_shingles": {"shared-shingle"},
        }
        with mock.patch.object(
            scan,
            "SequenceMatcher",
            side_effect=AssertionError("SequenceMatcher must not be constructed"),
        ):
            finding = scan._compare_pair(
                "bridge.js",
                bridge_fingerprint,
                "upstream.js",
                upstream_fingerprint,
            )
            no_overlap = scan._compare_pair(
                "bridge.js",
                bridge_fingerprint,
                "unrelated.js",
                {
                    **upstream_fingerprint,
                    "token_shingles": {"unrelated-shingle"},
                },
            )

        self.assertIsNotNone(finding)
        self.assertIsNone(no_overlap)
        assert finding is not None
        self.assertEqual(finding["shared_normalized_line_count"], 0)
        self.assertEqual(finding["longest_contiguous_normalized_line_block"], 0)
        self.assertEqual(finding["shared_token_shingle_count"], 1)

    def test_committed_preliminary_report_preserves_reviewed_bridge_snapshot(self) -> None:
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
        self.assertEqual(
            report["bridge"]["tree_sha256"],
            "bae55a3c00955493fddf3deceb2e17c1adf4668ce82aeaaa3d9b2b156b0fb8f4",
        )
        self.assertEqual(report["bridge"]["version"], "0.3.2")
        self.assertEqual(report["upstream"]["version"], "1.3.0")
        self.assertIsNone(report["upstream"]["package_sha256"])
        self.assertFalse(report["review_boundary"]["clears_public_distribution"])

    def test_committed_exact_live_report_preserves_reviewed_snapshot_and_is_content_safe(self) -> None:
        report = json.loads(
            (
                scan.ROOT
                / "contracts"
                / "identity-bridge"
                / "v1"
                / "evidence"
                / "xummlogin-live-1.3.1-similarity.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            report["bridge"]["tree_sha256"],
            "bae55a3c00955493fddf3deceb2e17c1adf4668ce82aeaaa3d9b2b156b0fb8f4",
        )
        self.assertEqual(report["bridge"]["version"], "0.3.2")
        self.assertEqual(report["upstream"]["version"], "1.3.1")
        self.assertEqual(
            report["upstream"]["package_sha256"],
            "8a0ec7531f536033a403196e934680882"
            "e7cde53a66dd4df453e81927b203806",
        )
        self.assertEqual(report["upstream"]["package_member_count"], 105)
        self.assertTrue(report["upstream"]["package_code_matches_scanned_tree"])
        self.assertFalse(
            report["comparison"]["algorithm"]["source_contents_included_in_report"]
        )
        self.assertFalse(report["review_boundary"]["clears_public_distribution"])
        self.assertTrue(report["review_boundary"]["human_review_required"])


if __name__ == "__main__":
    unittest.main()
