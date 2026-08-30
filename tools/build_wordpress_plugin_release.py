#!/usr/bin/env python3
"""Build and verify a deterministic CalorieApp Identity Bridge release archive."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[1]
PLUGIN_SLUG = "calorieapp-identity-bridge"
PLUGIN_DIR = ROOT / "wordpress-plugins" / PLUGIN_SLUG
MAIN_FILE = PLUGIN_DIR / f"{PLUGIN_SLUG}.php"
PROVENANCE_CONTRACT = (
    ROOT / "contracts" / "identity-bridge" / "v1" / "code-provenance.json"
)
RELEASE_FILES = (
    "CONFIGURATION.md",
    "LICENSE",
    "README.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
    f"{PLUGIN_SLUG}.php",
)
RELEASE_GLOBS = ("includes/*.php", "assets/*.css", "assets/*.js", "config/*.json")
FORBIDDEN_SUFFIXES = (
    ".bak",
    ".db",
    ".env",
    ".log",
    ".pem",
    ".sqlite",
    ".sqlite3",
    ".zip",
)
FORBIDDEN_PARTS = {
    ".git",
    ".github",
    ".idea",
    ".vscode",
    "__pycache__",
    "node_modules",
    "tests",
    "vendor",
}
FIXED_ZIP_TIME = (2021, 9, 16, 0, 0, 0)


def plugin_version() -> str:
    match = re.search(
        r"^\s*\*\s*Version:\s*([^\s]+)\s*$",
        MAIN_FILE.read_text(encoding="utf-8"),
        flags=re.MULTILINE,
    )
    if not match:
        raise ValueError(f"Plugin Version header not found in {MAIN_FILE}")
    version = match.group(1)
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", version):
        raise ValueError(f"Unsupported plugin version: {version}")
    return version


def release_paths() -> list[Path]:
    paths = {PLUGIN_DIR / relative for relative in RELEASE_FILES}
    for pattern in RELEASE_GLOBS:
        paths.update(PLUGIN_DIR.glob(pattern))

    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        raise ValueError(f"Missing release files: {', '.join(sorted(missing))}")

    validated: list[Path] = []
    for path in sorted(paths):
        relative = path.relative_to(PLUGIN_DIR)
        if path.is_symlink():
            raise ValueError(f"Symlinks are not permitted: {relative}")
        if FORBIDDEN_PARTS.intersection(relative.parts):
            raise ValueError(f"Forbidden release path: {relative}")
        if path.name.startswith(".env") or path.suffix.lower() in FORBIDDEN_SUFFIXES:
            raise ValueError(f"Forbidden release file: {relative}")
        validated.append(path)
    return validated


def archive_name(version: str) -> str:
    return f"{PLUGIN_SLUG}-{version}.zip"


def code_provenance(release_files: list[Path]) -> dict:
    contract = json.loads(PROVENANCE_CONTRACT.read_text(encoding="utf-8"))
    if contract.get("contract_id") != "calorieapp.identity-bridge.code-provenance":
        raise ValueError("Identity Bridge code-provenance contract id is invalid")

    entries = contract.get("release_files")
    if not isinstance(entries, list):
        raise ValueError("Identity Bridge code-provenance release_files must be a list")
    documented = {
        str(entry.get("path")): entry
        for entry in entries
        if isinstance(entry, dict) and entry.get("path")
    }
    expected = {path.relative_to(PLUGIN_DIR).as_posix() for path in release_files}
    if set(documented) != expected:
        missing = sorted(expected - set(documented))
        extra = sorted(set(documented) - expected)
        raise ValueError(
            "Identity Bridge code-provenance inventory differs from the release "
            f"allowlist; missing={missing}, extra={extra}"
        )
    for path, entry in documented.items():
        required = {
            "origin_class",
            "repository_first_add_commit",
            "declared_distribution_licence",
            "clearance_status",
        }
        absent = sorted(required - set(entry))
        if absent:
            raise ValueError(f"Code-provenance entry {path} is missing {absent}")
    return contract


def build(
    output_dir: Path,
    expected_version: str | None = None,
    *,
    require_cleared_provenance: bool = False,
) -> tuple[Path, Path, Path]:
    version = plugin_version()
    if expected_version and expected_version != version:
        raise ValueError(
            f"Expected version {expected_version}, but plugin header declares {version}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / archive_name(version)
    checksum = archive.with_suffix(".zip.sha256")
    manifest = archive.with_suffix(".zip.manifest.json")

    files = release_paths()
    provenance = code_provenance(files)
    provenance_status = str(provenance.get("distribution_clearance_status", ""))
    if require_cleared_provenance and provenance_status != "cleared":
        raise ValueError(
            "Identity Bridge code provenance clearance is required for public "
            f"distribution; current status is {provenance_status or 'missing'}"
        )
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for source in files:
            relative = source.relative_to(PLUGIN_DIR).as_posix()
            destination = f"{PLUGIN_SLUG}/{relative}"
            info = zipfile.ZipInfo(destination, date_time=FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            bundle.writestr(info, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    verify_archive(archive, files)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum.write_text(f"{digest}  {archive.name}\n", encoding="utf-8", newline="\n")
    manifest.write_text(
        json.dumps(
            {
                "plugin": PLUGIN_SLUG,
                "version": version,
                "archive": archive.name,
                "sha256": digest,
                "code_provenance_contract": str(
                    PROVENANCE_CONTRACT.relative_to(ROOT).as_posix()
                ),
                "code_provenance_status": provenance_status,
                "files": [
                    f"{PLUGIN_SLUG}/{path.relative_to(PLUGIN_DIR).as_posix()}"
                    for path in files
                ],
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return archive, checksum, manifest


def verify_archive(archive: Path, expected_files: list[Path]) -> None:
    expected = {
        f"{PLUGIN_SLUG}/{path.relative_to(PLUGIN_DIR).as_posix()}" for path in expected_files
    }
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Archive contains duplicate paths")
        if set(names) != expected:
            raise ValueError("Archive contents differ from the release allowlist")
        for info in bundle.infolist():
            path = PurePosixPath(info.filename)
            if path.is_absolute() or ".." in path.parts:
                raise ValueError(f"Unsafe archive path: {info.filename}")
            if not path.parts or path.parts[0] != PLUGIN_SLUG:
                raise ValueError(f"Unexpected archive root: {info.filename}")
            if info.file_size > 2 * 1024 * 1024:
                raise ValueError(f"Unexpectedly large release file: {info.filename}")
            if info.date_time != FIXED_ZIP_TIME:
                raise ValueError(f"Non-reproducible timestamp: {info.filename}")
        bad_member = bundle.testzip()
        if bad_member:
            raise ValueError(f"Corrupt archive member: {bad_member}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    parser.add_argument("--expected-version")
    parser.add_argument(
        "--require-cleared-provenance",
        action="store_true",
        help="Refuse public distribution while code provenance has blockers.",
    )
    args = parser.parse_args()
    try:
        artifacts = build(
            args.output_dir,
            args.expected_version,
            require_cleared_provenance=args.require_cleared_provenance,
        )
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        print(f"release build failed: {exc}", file=sys.stderr)
        return 1
    for artifact in artifacts:
        try:
            display_path = artifact.relative_to(ROOT)
        except ValueError:
            display_path = artifact
        print(display_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
