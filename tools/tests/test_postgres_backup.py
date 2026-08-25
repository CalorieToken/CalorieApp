from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import postgres_backup


class PostgresBackupTests(unittest.TestCase):
    def test_connection_url_becomes_pg_environment(self) -> None:
        environment = postgres_backup.postgres_environment(
            "postgresql://calorie%20user:secret%2Fvalue@example.test:6543/calorie%20db"
        )
        self.assertEqual(environment["PGHOST"], "example.test")
        self.assertEqual(environment["PGPORT"], "6543")
        self.assertEqual(environment["PGDATABASE"], "calorie db")
        self.assertEqual(environment["PGUSER"], "calorie user")
        self.assertEqual(environment["PGPASSWORD"], "secret/value")

    def test_non_postgres_url_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "PostgreSQL"):
            postgres_backup.postgres_environment("sqlite:///calorieapp.db")

    @patch("tools.postgres_backup.require_program", return_value="pg_restore")
    @patch("tools.postgres_backup.subprocess.run")
    def test_verify_checks_manifest(self, run, _program) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "calorieapp.dump"
            archive.write_bytes(b"portable backup")
            manifest = archive.with_suffix(".dump.manifest.json")
            manifest.write_text(
                json.dumps(
                    {
                        "bytes": archive.stat().st_size,
                        "sha256": postgres_backup.sha256_file(archive),
                    }
                ),
                encoding="utf-8",
            )
            details = postgres_backup.verify(archive, manifest)
        self.assertEqual(details["bytes"], len(b"portable backup"))
        run.assert_called_once()

    @patch("tools.postgres_backup.require_program", return_value="pg_restore")
    @patch("tools.postgres_backup.subprocess.run")
    def test_verify_rejects_changed_archive(self, _run, _program) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "calorieapp.dump"
            archive.write_bytes(b"changed")
            manifest = archive.with_suffix(".dump.manifest.json")
            manifest.write_text('{"bytes": 1, "sha256": "wrong"}', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "checksum"):
                postgres_backup.verify(archive, manifest)


if __name__ == "__main__":
    unittest.main()
