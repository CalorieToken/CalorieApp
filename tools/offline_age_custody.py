"""Create and verify two encrypted offline copies of one age identity.

The private identity moves only through operating-system pipes. This helper
never writes it to a plaintext file and reports only stable status codes plus
the public recipient.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Callable, Sequence


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_NAME = "calorieapp-synthetic-age-identity.age"
SCHEMA_VERSION = "calorieapp.offline-age-custody.v1"

_RECIPIENT = re.compile(r"age1[023456789acdefghjklmnpqrstuvwxyz]+")


class CeremonyError(Exception):
    """A fail-closed ceremony result with a safe, stable reason code."""

    def __init__(self, reason_code: str) -> None:
        super().__init__(reason_code)
        self.reason_code = reason_code


@dataclass(frozen=True)
class AgeCommands:
    age: str
    age_keygen: str


@dataclass(frozen=True)
class CeremonyResult:
    public_recipient: str

    def payload(self) -> dict[str, object]:
        return {
            "copies_match": True,
            "public_recipient": self.public_recipient,
            "schema_version": SCHEMA_VERSION,
            "status": "verified",
        }


GenerateIdentity = Callable[[AgeCommands, Path], None]
DeriveRecipient = Callable[[AgeCommands, Path], str]


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _resolve_directory(path: Path, reason_code: str) -> Path:
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise CeremonyError(reason_code) from exc
    if not resolved.is_dir():
        raise CeremonyError(reason_code)
    return resolved


def validate_locations(
    primary_directory: Path,
    recovery_directory: Path,
    *,
    repository_root: Path = ROOT,
) -> tuple[Path, Path]:
    """Return validated paths; validation errors contain only stable codes."""
    primary = _resolve_directory(primary_directory, "primary-directory-invalid")
    recovery = _resolve_directory(
        recovery_directory,
        "recovery-directory-invalid",
    )
    repository = repository_root.resolve(strict=True)

    if primary == recovery or _is_within(primary, recovery) or _is_within(
        recovery, primary
    ):
        raise CeremonyError("offline-locations-not-distinct")
    if _is_within(primary, repository) or _is_within(recovery, repository):
        raise CeremonyError("offline-location-inside-repository")

    primary_output = primary / ARTIFACT_NAME
    recovery_output = recovery / ARTIFACT_NAME
    if primary_output.exists():
        raise CeremonyError("primary-output-exists")
    if recovery_output.exists():
        raise CeremonyError("recovery-output-exists")
    return primary_output, recovery_output


def locate_age_commands() -> AgeCommands:
    age = shutil.which("age")
    age_keygen = shutil.which("age-keygen")
    if not age or not age_keygen:
        raise CeremonyError("age-tools-unavailable")
    return AgeCommands(age=age, age_keygen=age_keygen)


def _open_exclusive_binary(path: Path) -> BinaryIO:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0)
    try:
        descriptor = os.open(path, flags, 0o600)
    except FileExistsError as exc:
        raise CeremonyError("output-exists-during-write") from exc
    except OSError as exc:
        raise CeremonyError("encrypted-output-unavailable") from exc
    try:
        return os.fdopen(descriptor, "wb")
    except BaseException:
        os.close(descriptor)
        path.unlink(missing_ok=True)
        raise


def _terminate_process_best_effort(process: subprocess.Popen[bytes]) -> None:
    """Stop an unfinished child without masking the operation's first error."""
    try:
        if process.poll() is not None:
            return
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    except (OSError, subprocess.SubprocessError):
        pass


def generate_encrypted_identity(commands: AgeCommands, output: Path) -> None:
    """Pipe a new identity directly into passphrase encryption."""
    keygen: subprocess.Popen[bytes] | None = None
    output_created = False
    try:
        with _open_exclusive_binary(output) as encrypted_output:
            output_created = True
            keygen = subprocess.Popen(
                [commands.age_keygen],
                cwd=output.parent,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            if keygen.stdout is None:
                raise CeremonyError("identity-generation-failed")
            encryption = subprocess.run(
                [commands.age, "--passphrase"],
                cwd=output.parent,
                stdin=keygen.stdout,
                stdout=encrypted_output,
                check=False,
            )
        keygen.stdout.close()
        keygen_status = keygen.wait()
        if encryption.returncode != 0 or keygen_status != 0:
            raise CeremonyError("identity-generation-failed")
        if output.stat().st_size == 0:
            raise CeremonyError("encrypted-output-empty")
        output.chmod(0o600)
    except CeremonyError:
        if output_created:
            output.unlink(missing_ok=True)
        raise
    except (OSError, subprocess.SubprocessError) as exc:
        if output_created:
            output.unlink(missing_ok=True)
        raise CeremonyError("identity-generation-failed") from exc
    except BaseException:
        if output_created:
            output.unlink(missing_ok=True)
        raise
    finally:
        if keygen is not None and keygen.stdout is not None:
            keygen.stdout.close()
        if keygen is not None:
            _terminate_process_best_effort(keygen)


def derive_public_recipient(commands: AgeCommands, encrypted: Path) -> str:
    """Decrypt through a pipe and retain only the public recipient."""
    decryption: subprocess.Popen[bytes] | None = None
    try:
        decryption = subprocess.Popen(
            [commands.age, "--decrypt", encrypted.name],
            cwd=encrypted.parent,
            stdout=subprocess.PIPE,
        )
        if decryption.stdout is None:
            raise CeremonyError("copy-recovery-verification-failed")
        derivation = subprocess.run(
            [commands.age_keygen, "-y"],
            cwd=encrypted.parent,
            stdin=decryption.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        decryption.stdout.close()
        decryption_status = decryption.wait()
    except OSError as exc:
        raise CeremonyError("copy-recovery-verification-failed") from exc
    finally:
        if decryption is not None and decryption.stdout is not None:
            decryption.stdout.close()
        if decryption is not None:
            _terminate_process_best_effort(decryption)

    if derivation.returncode != 0 or decryption_status != 0:
        raise CeremonyError("copy-recovery-verification-failed")
    try:
        recipients = [
            line
            for line in derivation.stdout.decode("ascii", errors="strict").splitlines()
            if line
        ]
    except UnicodeDecodeError as exc:
        raise CeremonyError("public-recipient-invalid") from exc
    if (
        len(recipients) != 1
        or len(recipients[0]) > 4096
        or _RECIPIENT.fullmatch(recipients[0]) is None
    ):
        raise CeremonyError("public-recipient-invalid")
    return recipients[0]


def _sha256(path: Path) -> bytes:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as exc:
        raise CeremonyError("encrypted-copy-unreadable") from exc
    return digest.digest()


def _copy_encrypted_identity(source: Path, destination: Path) -> None:
    destination_created = False
    try:
        with source.open("rb") as source_handle, _open_exclusive_binary(
            destination
        ) as destination_handle:
            destination_created = True
            shutil.copyfileobj(source_handle, destination_handle)
        destination.chmod(0o600)
    except CeremonyError as exc:
        if destination_created:
            destination.unlink(missing_ok=True)
        if exc.reason_code == "output-exists-during-write":
            raise CeremonyError("recovery-output-exists") from exc
        raise CeremonyError("recovery-copy-failed") from exc
    except OSError as exc:
        if destination_created:
            destination.unlink(missing_ok=True)
        raise CeremonyError("recovery-copy-failed") from exc
    except BaseException:
        if destination_created:
            destination.unlink(missing_ok=True)
        raise


def perform_ceremony(
    primary_directory: Path,
    recovery_directory: Path,
    *,
    confirm_separate_offline_storage: bool,
    confirm_passphrase_separated: bool,
    repository_root: Path = ROOT,
    commands: AgeCommands | None = None,
    generate: GenerateIdentity = generate_encrypted_identity,
    derive: DeriveRecipient = derive_public_recipient,
) -> CeremonyResult:
    """Generate, copy and independently recover one offline identity."""
    if not confirm_separate_offline_storage:
        raise CeremonyError("separate-offline-storage-unconfirmed")
    if not confirm_passphrase_separated:
        raise CeremonyError("separate-passphrase-custody-unconfirmed")

    primary_output, recovery_output = validate_locations(
        primary_directory,
        recovery_directory,
        repository_root=repository_root,
    )
    resolved_commands = commands or locate_age_commands()

    primary_created = False
    recovery_created = False
    try:
        generate(resolved_commands, primary_output)
        primary_created = primary_output.exists()
        if not primary_created:
            raise CeremonyError("encrypted-output-missing")

        _copy_encrypted_identity(primary_output, recovery_output)
        recovery_created = True

        if _sha256(primary_output) != _sha256(recovery_output):
            raise CeremonyError("encrypted-copies-differ")

        primary_recipient = derive(resolved_commands, primary_output)
        recovery_recipient = derive(resolved_commands, recovery_output)
        if primary_recipient != recovery_recipient:
            raise CeremonyError("recovered-recipients-differ")
        return CeremonyResult(public_recipient=primary_recipient)
    except BaseException:
        if recovery_created:
            recovery_output.unlink(missing_ok=True)
        if primary_created:
            primary_output.unlink(missing_ok=True)
        raise


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Create two verified passphrase-encrypted offline copies of one "
            "age identity. Run only on the operator's local offline system."
        )
    )
    parser.add_argument("--primary-directory", required=True, type=Path)
    parser.add_argument("--recovery-directory", required=True, type=Path)
    parser.add_argument(
        "--confirm-separate-offline-storage",
        action="store_true",
        help="confirm that the directories are on separately stored offline media",
    )
    parser.add_argument(
        "--confirm-passphrase-separated",
        action="store_true",
        help="confirm that the passphrase will be stored apart from both copies",
    )
    return parser


def _render(payload: dict[str, object]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        result = perform_ceremony(
            args.primary_directory,
            args.recovery_directory,
            confirm_separate_offline_storage=(
                args.confirm_separate_offline_storage
            ),
            confirm_passphrase_separated=args.confirm_passphrase_separated,
        )
    except CeremonyError as exc:
        print(
            _render(
                {
                    "reason_code": exc.reason_code,
                    "schema_version": SCHEMA_VERSION,
                    "status": "blocked",
                }
            )
        )
        return 1
    except Exception:
        print(
            _render(
                {
                    "reason_code": "unexpected-local-error",
                    "schema_version": SCHEMA_VERSION,
                    "status": "blocked",
                }
            )
        )
        return 2

    print(_render(result.payload()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
