from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools import check_tracked_secret_patterns as guard


class TrackedSecretPatternTests(unittest.TestCase):
    def _scan(self, files: dict[str, bytes]) -> list[guard.Finding]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative_path, content in files.items():
                path = root / relative_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            return guard.scan_tracked_files(root, files)

    def test_age_private_identity_is_rejected_without_echoing_it(self) -> None:
        identity = b"AGE-" + b"SECRET-KEY-1SYNTHETICFIXTURE"

        findings = self._scan({"notes.txt": identity})

        self.assertEqual(
            findings,
            [guard.Finding("notes.txt", "age-private-identity")],
        )
        self.assertNotIn(identity.decode(), guard.render_findings(findings))

    def test_neon_database_url_is_rejected_without_echoing_it(self) -> None:
        host = b"example.eu-central-1.aws." + b"neon.tech"
        scheme = b"postgres" + b"ql://"
        userinfo = b"fixture-user" + b":" + b"fixture-password" + b"@"
        database_url = scheme + userinfo + host + b"/app"

        findings = self._scan({"config.txt": database_url})

        self.assertEqual(
            findings,
            [guard.Finding("config.txt", "neon-database-url")],
        )
        self.assertNotIn(database_url.decode(), guard.render_findings(findings))

    def test_literal_named_provider_secret_is_rejected(self) -> None:
        variable = b"NEON_" + b"PROJECT_API_KEY"

        findings = self._scan(
            {
                "config.yml": b'"' + variable + b'": literal-fixture-value',
                "shell.txt": b"export " + variable + b"=literal-fixture-value",
            }
        )

        self.assertEqual(
            findings,
            [
                guard.Finding(
                    "config.yml", "literal-provider-secret-assignment"
                ),
                guard.Finding(
                    "shell.txt", "literal-provider-secret-assignment"
                ),
            ],
        )

    def test_secret_references_and_explicit_placeholders_are_allowed(self) -> None:
        neon_variable = b"NEON_" + b"API_KEY"
        age_variable = b"CALORIEAPP_SYNTHETIC_" + b"AGE_IDENTITY"
        content = b"\n".join(
            (
                neon_variable + b": ${{ secrets.NEON_KEY }}",
                age_variable + b"=<temporary-secret>",
                neon_variable + b"=REDACTED",
                neon_variable + b"=os.getenv('NEON_KEY')",
                neon_variable + b"=process.env.NEON_KEY",
            )
        )

        self.assertEqual(self._scan({"workflow.example": content}), [])

    def test_provider_backup_artifact_paths_are_rejected(self) -> None:
        findings = self._scan(
            {
                "backup/export.age": b"encrypted",
                "backup/export.backup": b"archive",
                "backup/export.dump": b"archive",
                "backup/export.pgdump": b"archive",
            }
        )

        self.assertEqual(
            findings,
            [
                guard.Finding(
                    "backup/export.age", "forbidden-secret-artifact-path"
                ),
                guard.Finding(
                    "backup/export.backup", "forbidden-secret-artifact-path"
                ),
                guard.Finding(
                    "backup/export.dump", "forbidden-secret-artifact-path"
                ),
                guard.Finding(
                    "backup/export.pgdump", "forbidden-secret-artifact-path"
                ),
            ],
        )

    def test_duplicate_paths_and_findings_are_deterministic(self) -> None:
        identity = b"AGE-" + b"SECRET-KEY-1SYNTHETICFIXTURE"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "z.txt").write_bytes(identity)

            findings = guard.scan_tracked_files(root, ["z.txt", "z.txt"])

        self.assertEqual(
            findings,
            [guard.Finding("z.txt", "age-private-identity")],
        )

    def test_windows_style_paths_are_normalized_before_read_and_dedup(self) -> None:
        identity = b"AGE-" + b"SECRET-KEY-1SYNTHETICFIXTURE"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "nested" / "secret.txt"
            path.parent.mkdir()
            path.write_bytes(identity)

            findings = guard.scan_tracked_files(
                root,
                ["nested\\secret.txt", "nested/secret.txt"],
            )

        self.assertEqual(
            findings,
            [guard.Finding("nested/secret.txt", "age-private-identity")],
        )


if __name__ == "__main__":
    unittest.main()
