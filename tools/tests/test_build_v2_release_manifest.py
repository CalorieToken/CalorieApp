import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from tools import build_v2_release_manifest as release


class V2ReleaseManifestTests(unittest.TestCase):
    def _fixture(self, directory: str) -> tuple[Path, Path]:
        root = Path(directory) / "repository"
        (root / "backend").mkdir(parents=True)
        (root / "frontend").mkdir()
        (root / "backend" / "requirements.txt").write_bytes(b"fastapi==1\n")
        (root / "frontend" / "package-lock.json").write_bytes(b"{}\n")
        archive = Path(directory) / "calorieapp-identity-bridge-0.3.0.zip"
        archive.write_bytes(b"plugin archive fixture")
        return root, archive

    def test_manifest_binds_build_locks_plugin_and_deployment_time(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, archive = self._fixture(directory)
            commit = "a" * 40

            payload = release.build_manifest(
                root,
                commit=commit,
                deployment_time="2026-09-03T12:34:56Z",
                plugin_archive=archive,
            )

            self.assertEqual(payload["schema_version"], release.SCHEMA_VERSION)
            self.assertEqual(payload["source_commit"], commit)
            self.assertEqual(payload["build_id"], commit)
            self.assertEqual(payload["deployed_at_utc"], "2026-09-03T12:34:56Z")
            self.assertEqual(
                payload["wordpress_plugin"],
                {
                    "archive": archive.name,
                    "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                },
            )
            self.assertEqual(
                [entry["path"] for entry in payload["dependency_locks"]],
                [path.as_posix() for path in release.LOCK_PATHS],
            )

    def test_manifest_rejects_invalid_release_identity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, archive = self._fixture(directory)
            cases = (
                ("A" * 40, "2026-09-03T12:34:56Z"),
                ("a" * 40, "2026-09-03 12:34:56"),
                ("a" * 40, "2026-02-30T12:34:56Z"),
            )
            for commit, deployment_time in cases:
                with self.subTest(commit=commit, deployment_time=deployment_time):
                    with self.assertRaises(release.ReleaseManifestError):
                        release.build_manifest(
                            root,
                            commit=commit,
                            deployment_time=deployment_time,
                            plugin_archive=archive,
                        )

    def test_manifest_rejects_missing_or_non_zip_plugin_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, archive = self._fixture(directory)
            archive.rename(archive.with_suffix(".bin"))
            with self.assertRaisesRegex(
                release.ReleaseManifestError,
                "plugin archive is unavailable",
            ):
                release.build_manifest(
                    root,
                    commit="a" * 40,
                    deployment_time="2026-09-03T12:34:56Z",
                    plugin_archive=archive,
                )

    def test_manifest_normalizes_missing_repository_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, archive = self._fixture(directory)
            missing_root = root / "missing"
            with self.assertRaisesRegex(
                release.ReleaseManifestError,
                "repository root is unavailable",
            ):
                release.build_manifest(
                    missing_root,
                    commit="a" * 40,
                    deployment_time="2026-09-03T12:34:56Z",
                    plugin_archive=archive,
                )

    def test_manifest_write_is_exclusive(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "release.json"
            payload = {"schema_version": release.SCHEMA_VERSION}
            release.write_manifest(output, payload)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), payload)
            with self.assertRaisesRegex(
                release.ReleaseManifestError,
                "already exists",
            ):
                release.write_manifest(output, payload)


if __name__ == "__main__":
    unittest.main()
