from __future__ import annotations

import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest import mock

from tools import offline_age_custody as custody


PUBLIC_RECIPIENT = "age1" + ("q" * 58)


class OfflineAgeCustodyTests(unittest.TestCase):
    def _locations(self):
        return (
            tempfile.TemporaryDirectory(),
            tempfile.TemporaryDirectory(),
            tempfile.TemporaryDirectory(),
        )

    def _perform(
        self,
        primary: Path,
        recovery: Path,
        repository: Path,
        *,
        derive=None,
    ) -> custody.CeremonyResult:
        def generate(_: custody.AgeCommands, output: Path) -> None:
            output.write_bytes(b"encrypted-identity-fixture")

        return custody.perform_ceremony(
            primary,
            recovery,
            confirm_separate_offline_storage=True,
            confirm_passphrase_separated=True,
            repository_root=repository,
            commands=custody.AgeCommands("age", "age-keygen"),
            generate=generate,
            derive=derive or (lambda _commands, _path: PUBLIC_RECIPIENT),
        )

    def test_success_creates_matching_encrypted_copies(self) -> None:
        primary_temp, recovery_temp, repository_temp = self._locations()
        with primary_temp, recovery_temp, repository_temp:
            primary = Path(primary_temp.name)
            recovery = Path(recovery_temp.name)

            result = self._perform(
                primary,
                recovery,
                Path(repository_temp.name),
            )

            self.assertEqual(result.public_recipient, PUBLIC_RECIPIENT)
            self.assertEqual(
                (primary / custody.ARTIFACT_NAME).read_bytes(),
                (recovery / custody.ARTIFACT_NAME).read_bytes(),
            )
            rendered = custody._render(result.payload())
            self.assertIn(PUBLIC_RECIPIENT, rendered)
            self.assertNotIn(primary_temp.name, rendered)
            self.assertNotIn(recovery_temp.name, rendered)

    def test_both_operator_confirmations_are_required(self) -> None:
        primary_temp, recovery_temp, repository_temp = self._locations()
        with primary_temp, recovery_temp, repository_temp:
            for separate_storage, separate_passphrase, reason in (
                (False, True, "separate-offline-storage-unconfirmed"),
                (True, False, "separate-passphrase-custody-unconfirmed"),
            ):
                with self.subTest(reason=reason), self.assertRaises(
                    custody.CeremonyError
                ) as raised:
                    custody.perform_ceremony(
                        Path(primary_temp.name),
                        Path(recovery_temp.name),
                        confirm_separate_offline_storage=separate_storage,
                        confirm_passphrase_separated=separate_passphrase,
                        repository_root=Path(repository_temp.name),
                    )
                self.assertEqual(raised.exception.reason_code, reason)

    def test_repository_and_non_distinct_locations_are_rejected(self) -> None:
        primary_temp, recovery_temp, repository_temp = self._locations()
        with primary_temp, recovery_temp, repository_temp:
            repository = Path(repository_temp.name)
            inside_repository = repository / "offline"
            inside_repository.mkdir()

            with self.assertRaises(custody.CeremonyError) as inside:
                custody.validate_locations(
                    inside_repository,
                    Path(recovery_temp.name),
                    repository_root=repository,
                )
            self.assertEqual(
                inside.exception.reason_code,
                "offline-location-inside-repository",
            )

            with self.assertRaises(custody.CeremonyError) as same:
                custody.validate_locations(
                    Path(primary_temp.name),
                    Path(primary_temp.name),
                    repository_root=repository,
                )
            self.assertEqual(
                same.exception.reason_code,
                "offline-locations-not-distinct",
            )

    def test_existing_output_is_never_overwritten(self) -> None:
        primary_temp, recovery_temp, repository_temp = self._locations()
        with primary_temp, recovery_temp, repository_temp:
            primary = Path(primary_temp.name)
            existing = primary / custody.ARTIFACT_NAME
            existing.write_bytes(b"existing-encrypted-copy")

            with self.assertRaises(custody.CeremonyError) as raised:
                custody.validate_locations(
                    primary,
                    Path(recovery_temp.name),
                    repository_root=Path(repository_temp.name),
                )

            self.assertEqual(raised.exception.reason_code, "primary-output-exists")
            self.assertEqual(existing.read_bytes(), b"existing-encrypted-copy")

    def test_blocked_cli_result_does_not_disclose_locations(self) -> None:
        private_location_label = "private-offline-location-fixture"
        output = StringIO()

        with redirect_stdout(output):
            status = custody.main(
                [
                    "--primary-directory",
                    private_location_label,
                    "--recovery-directory",
                    "separate-recovery-location-fixture",
                    "--confirm-separate-offline-storage",
                    "--confirm-passphrase-separated",
                ]
            )

        self.assertEqual(status, 1)
        self.assertNotIn(private_location_label, output.getvalue())
        self.assertEqual(
            output.getvalue().strip(),
            custody._render(
                {
                    "reason_code": "primary-directory-invalid",
                    "schema_version": custody.SCHEMA_VERSION,
                    "status": "blocked",
                }
            ),
        )

    def test_verification_mismatch_removes_new_outputs(self) -> None:
        primary_temp, recovery_temp, repository_temp = self._locations()
        with primary_temp, recovery_temp, repository_temp:
            recipients = iter((PUBLIC_RECIPIENT, "age1" + ("p" * 58)))

            with self.assertRaises(custody.CeremonyError) as raised:
                self._perform(
                    Path(primary_temp.name),
                    Path(recovery_temp.name),
                    Path(repository_temp.name),
                    derive=lambda _commands, _path: next(recipients),
                )

            self.assertEqual(
                raised.exception.reason_code,
                "recovered-recipients-differ",
            )
            self.assertFalse(
                (Path(primary_temp.name) / custody.ARTIFACT_NAME).exists()
            )
            self.assertFalse(
                (Path(recovery_temp.name) / custody.ARTIFACT_NAME).exists()
            )

    def test_generation_pipes_identity_without_plaintext_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / custody.ARTIFACT_NAME
            stdout_pipe = mock.Mock()
            keygen = mock.Mock(stdout=stdout_pipe)
            keygen.wait.return_value = 0
            keygen.poll.return_value = 0

            def encrypted_run(*_args, **_kwargs):
                _kwargs["stdout"].write(b"encrypted-identity-fixture")
                _kwargs["stdout"].flush()
                return subprocess.CompletedProcess([], 0)

            with mock.patch.object(
                custody.subprocess,
                "Popen",
                return_value=keygen,
            ) as popen, mock.patch.object(
                custody.subprocess,
                "run",
                side_effect=encrypted_run,
            ) as run:
                custody.generate_encrypted_identity(
                    custody.AgeCommands("age", "age-keygen"),
                    output,
                )

            popen.assert_called_once_with(
                ["age-keygen"],
                cwd=output.parent,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            run.assert_called_once_with(
                ["age", "--passphrase"],
                cwd=output.parent,
                stdin=stdout_pipe,
                stdout=mock.ANY,
                check=False,
            )
            self.assertEqual(
                sorted(path.name for path in output.parent.iterdir()),
                [custody.ARTIFACT_NAME],
            )

    def test_generation_never_overwrites_a_racing_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / custody.ARTIFACT_NAME
            output.write_bytes(b"existing-encrypted-copy")

            with mock.patch.object(custody.subprocess, "Popen") as popen:
                with self.assertRaises(custody.CeremonyError) as raised:
                    custody.generate_encrypted_identity(
                        custody.AgeCommands("age", "age-keygen"),
                        output,
                    )

            self.assertEqual(
                raised.exception.reason_code,
                "output-exists-during-write",
            )
            self.assertEqual(output.read_bytes(), b"existing-encrypted-copy")
            popen.assert_not_called()

    def test_derivation_pipes_plaintext_and_returns_only_public_value(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            encrypted = Path(directory) / custody.ARTIFACT_NAME
            encrypted.write_bytes(b"encrypted-identity-fixture")
            stdout_pipe = mock.Mock()
            decryption = mock.Mock(stdout=stdout_pipe)
            decryption.wait.return_value = 0
            decryption.poll.return_value = 0
            derivation = subprocess.CompletedProcess(
                [],
                0,
                stdout=(PUBLIC_RECIPIENT + "\n").encode("ascii"),
            )

            with mock.patch.object(
                custody.subprocess,
                "Popen",
                return_value=decryption,
            ) as popen, mock.patch.object(
                custody.subprocess,
                "run",
                return_value=derivation,
            ) as run:
                recipient = custody.derive_public_recipient(
                    custody.AgeCommands("age", "age-keygen"),
                    encrypted,
                )

            self.assertEqual(recipient, PUBLIC_RECIPIENT)
            popen.assert_called_once_with(
                ["age", "--decrypt", custody.ARTIFACT_NAME],
                cwd=encrypted.parent,
                stdout=subprocess.PIPE,
            )
            run.assert_called_once_with(
                ["age-keygen", "-y"],
                cwd=encrypted.parent,
                stdin=stdout_pipe,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                check=False,
            )

    def test_derivation_rejects_multiple_output_lines(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            encrypted = Path(directory) / custody.ARTIFACT_NAME
            encrypted.write_bytes(b"encrypted-identity-fixture")
            decryption = mock.Mock(stdout=mock.Mock())
            decryption.wait.return_value = 0
            decryption.poll.return_value = 0
            derivation = subprocess.CompletedProcess(
                [],
                0,
                stdout=(PUBLIC_RECIPIENT + "\n" + PUBLIC_RECIPIENT).encode(
                    "ascii"
                ),
            )

            with mock.patch.object(
                custody.subprocess,
                "Popen",
                return_value=decryption,
            ), mock.patch.object(
                custody.subprocess,
                "run",
                return_value=derivation,
            ):
                with self.assertRaises(custody.CeremonyError) as raised:
                    custody.derive_public_recipient(
                        custody.AgeCommands("age", "age-keygen"),
                        encrypted,
                    )

            self.assertEqual(
                raised.exception.reason_code,
                "public-recipient-invalid",
            )


if __name__ == "__main__":
    unittest.main()
