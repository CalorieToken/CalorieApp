"""Create a deterministic, content-safe Identity Bridge similarity report.

The report is evidence for a human provenance review. It deliberately cannot
clear the public-distribution gate and never includes source lines or tokens.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
import zipfile
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[1]
PLUGIN_DIR = ROOT / "wordpress-plugins" / "calorieapp-identity-bridge"
PROVENANCE_CONTRACT = (
    ROOT / "contracts" / "identity-bridge" / "v1" / "code-provenance.json"
)
SOURCE_SUFFIXES = frozenset({".css", ".js", ".php"})
MAX_SOURCE_FILES = 1_000
MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_SOURCE_BYTES = 16 * 1024 * 1024
MAX_ARCHIVE_FILE_BYTES = 16 * 1024 * 1024
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
MAX_FINDINGS = 200
MIN_LINE_LENGTH = 24
MAX_NORMALIZED_LINES_PER_FILE = 100_000
TOKEN_SHINGLE_SIZE = 8
MAX_TOKENS_PER_FILE = 250_000
VERSION_PATTERN = re.compile(
    r"^[ \t/*#]*Version:[ \t]*"
    r"(?P<version>[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?)",
    re.MULTILINE,
)
SAFE_VERSION_PATTERN = re.compile(
    r"^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$"
)
SAFE_DATE_PATTERN = re.compile(r"^20[0-9]{2}-[01][0-9]-[0-3][0-9]$")
TOKEN_PATTERN = re.compile(
    r"[A-Za-z_][A-Za-z0-9_]*|[0-9]+(?:\.[0-9]+)?|"
    r"===|!==|==|!=|<=|>=|=>|::|->|&&|\|\||[{}()[\].,;:+*/%!?<>=&|^-]"
)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _validate_reference(value: str) -> str:
    normalized = value.strip()
    if not normalized or len(normalized) > 500 or any(
        character in normalized for character in "\r\n\0"
    ):
        raise ValueError("source reference must be a single non-empty line")
    return normalized


def _validate_version(value: str, label: str) -> str:
    normalized = value.strip()
    if not SAFE_VERSION_PATTERN.fullmatch(normalized):
        raise ValueError(f"{label} must be a semantic version")
    return normalized


def _validate_review_date(value: str) -> str:
    normalized = value.strip()
    if not SAFE_DATE_PATTERN.fullmatch(normalized):
        raise ValueError("review date must use YYYY-MM-DD")
    try:
        date.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError("review date must be a valid calendar date") from exc
    return normalized


def _version_from_file(path: Path, label: str) -> str:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"{label} version file is missing or unsafe: {path.name}")
    match = VERSION_PATTERN.search(path.read_text(encoding="utf-8", errors="replace"))
    if not match:
        raise ValueError(f"{label} version header is missing")
    return _validate_version(match.group("version"), f"{label} version")


def _bridge_code_files() -> list[Path]:
    contract = json.loads(PROVENANCE_CONTRACT.read_text(encoding="utf-8"))
    entries = contract.get("release_files")
    if not isinstance(entries, list):
        raise ValueError("Identity Bridge provenance release_files must be a list")

    files: list[Path] = []
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
            raise ValueError("Identity Bridge provenance has an invalid release file")
        relative = Path(entry["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError(f"Identity Bridge provenance path is unsafe: {relative}")
        if relative.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        source = PLUGIN_DIR / relative
        if not source.is_file() or source.is_symlink():
            raise ValueError(f"Identity Bridge release source is missing or unsafe: {relative}")
        files.append(source)
    if not files:
        raise ValueError("Identity Bridge provenance contains no code files")
    return sorted(files, key=lambda path: path.relative_to(PLUGIN_DIR).as_posix())


def _external_code_files(source_root: Path) -> list[Path]:
    root = source_root.resolve()
    if not root.is_dir() or source_root.is_symlink():
        raise ValueError("XUMM Login source directory is missing or unsafe")

    files: list[Path] = []
    total_bytes = 0
    for current, directory_names, file_names in os.walk(root, followlinks=False):
        current_path = Path(current)
        safe_directories: list[str] = []
        for name in sorted(directory_names):
            candidate = current_path / name
            if candidate.is_symlink():
                raise ValueError(
                    f"XUMM Login source contains a symlink: {candidate.relative_to(root)}"
                )
            if name != ".git":
                safe_directories.append(name)
        directory_names[:] = safe_directories

        for name in sorted(file_names):
            candidate = current_path / name
            relative = candidate.relative_to(root)
            if candidate.is_symlink():
                raise ValueError(f"XUMM Login source contains a symlink: {relative}")
            if candidate.suffix.lower() not in SOURCE_SUFFIXES:
                continue
            size = candidate.stat().st_size
            if size > MAX_SOURCE_FILE_BYTES:
                raise ValueError(f"XUMM Login source file is unexpectedly large: {relative}")
            total_bytes += size
            if total_bytes > MAX_TOTAL_SOURCE_BYTES:
                raise ValueError("XUMM Login source tree is unexpectedly large")
            files.append(candidate)
            if len(files) > MAX_SOURCE_FILES:
                raise ValueError("XUMM Login source contains too many code files")
    if not files:
        raise ValueError("XUMM Login source contains no PHP, JavaScript or CSS files")
    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def _tree_digest(root: Path, files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        relative = path.relative_to(root).as_posix().encode("utf-8")
        content = path.read_bytes()
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def _verified_package_archive(
    package_archive: Path,
    source_root: Path,
    source_files: list[Path],
) -> tuple[str, int]:
    archive = package_archive.resolve()
    if (
        not archive.is_file()
        or package_archive.is_symlink()
        or archive.stat().st_size > MAX_ARCHIVE_BYTES
    ):
        raise ValueError("XUMM Login package archive is missing, unsafe or too large")

    source_content = {
        path.relative_to(source_root).as_posix(): path.read_bytes()
        for path in source_files
    }
    with zipfile.ZipFile(archive) as bundle:
        infos = bundle.infolist()
        if len(infos) != len({info.filename for info in infos}):
            raise ValueError("XUMM Login package archive contains duplicate paths")
        total_size = 0
        code_infos: list[tuple[PurePosixPath, zipfile.ZipInfo]] = []
        for info in infos:
            path = PurePosixPath(info.filename)
            if (
                not path.parts
                or path.is_absolute()
                or ".." in path.parts
                or "\\" in info.filename
            ):
                raise ValueError(
                    f"XUMM Login package archive contains an unsafe path: {info.filename}"
                )
            if info.flag_bits & 0x1:
                raise ValueError("XUMM Login package archive contains encrypted content")
            mode = (info.external_attr >> 16) & 0o170000
            if stat.S_ISLNK(mode):
                raise ValueError(
                    f"XUMM Login package archive contains a symlink: {info.filename}"
                )
            if info.file_size > MAX_ARCHIVE_FILE_BYTES:
                raise ValueError(
                    f"XUMM Login package archive member is unexpectedly large: {info.filename}"
                )
            total_size += info.file_size
            if total_size > MAX_ARCHIVE_BYTES:
                raise ValueError("XUMM Login package archive expands beyond the safe limit")
            if not info.is_dir() and path.suffix.lower() in SOURCE_SUFFIXES:
                code_infos.append((path, info))

        if not code_infos:
            raise ValueError("XUMM Login package archive contains no code files")
        first_parts = {path.parts[0] for path, _ in code_infos if len(path.parts) > 1}
        strip_root = (
            next(iter(first_parts))
            if len(first_parts) == 1
            and all(len(path.parts) > 1 for path, _ in code_infos)
            else None
        )
        archive_content: dict[str, bytes] = {}
        for path, info in code_infos:
            relative = (
                PurePosixPath(*path.parts[1:]).as_posix()
                if strip_root is not None
                else path.as_posix()
            )
            if relative in archive_content:
                raise ValueError(
                    "XUMM Login package archive has duplicate code paths after root normalization"
                )
            archive_content[relative] = bundle.read(info)

    if set(archive_content) != set(source_content):
        raise ValueError(
            "XUMM Login extracted code files differ from the supplied package archive"
        )
    mismatches = [
        path for path in archive_content if archive_content[path] != source_content[path]
    ]
    if mismatches:
        raise ValueError(
            "XUMM Login extracted code content differs from the supplied package archive"
        )
    return _sha256(archive.read_bytes()), len(infos)


def _normalized_line_digests(content: str) -> list[str]:
    digests: list[str] = []
    for raw_line in content.splitlines():
        normalized = re.sub(r"\s+", " ", raw_line.strip())
        if len(normalized) < MIN_LINE_LENGTH or not re.search(r"[A-Za-z0-9]", normalized):
            continue
        digests.append(_sha256(normalized.encode("utf-8")))
        if len(digests) > MAX_NORMALIZED_LINES_PER_FILE:
            raise ValueError("source file contains too many normalized lines")
    return digests


def _token_shingle_digests(content: str) -> set[str]:
    tokens = [token.lower() for token in TOKEN_PATTERN.findall(content)]
    if len(tokens) > MAX_TOKENS_PER_FILE:
        raise ValueError("source file contains too many tokens")
    if len(tokens) < TOKEN_SHINGLE_SIZE:
        return set()
    return {
        _sha256("\0".join(tokens[index : index + TOKEN_SHINGLE_SIZE]).encode("utf-8"))
        for index in range(len(tokens) - TOKEN_SHINGLE_SIZE + 1)
    }


def _fingerprint(path: Path) -> dict[str, object]:
    content = path.read_text(encoding="utf-8", errors="replace")
    line_digests = _normalized_line_digests(content)
    return {
        "line_digests": line_digests,
        "line_digest_set": set(line_digests),
        "token_shingles": _token_shingle_digests(content),
    }


def _compare_pair(
    bridge_path: str,
    bridge_fingerprint: dict[str, object],
    upstream_path: str,
    upstream_fingerprint: dict[str, object],
) -> dict[str, object] | None:
    bridge_lines = bridge_fingerprint["line_digests"]
    upstream_lines = upstream_fingerprint["line_digests"]
    assert isinstance(bridge_lines, list)
    assert isinstance(upstream_lines, list)
    matcher = SequenceMatcher(None, bridge_lines, upstream_lines, autojunk=False)
    longest_line_block = max(
        (block.size for block in matcher.get_matching_blocks()), default=0
    )

    bridge_line_set = bridge_fingerprint["line_digest_set"]
    upstream_line_set = upstream_fingerprint["line_digest_set"]
    bridge_shingles = bridge_fingerprint["token_shingles"]
    upstream_shingles = upstream_fingerprint["token_shingles"]
    assert isinstance(bridge_line_set, set)
    assert isinstance(upstream_line_set, set)
    assert isinstance(bridge_shingles, set)
    assert isinstance(upstream_shingles, set)
    shared_lines = len(bridge_line_set & upstream_line_set)
    shared_shingles = len(bridge_shingles & upstream_shingles)
    shingle_union = len(bridge_shingles | upstream_shingles)
    shingle_jaccard = shared_shingles / shingle_union if shingle_union else 0.0

    if not shared_lines and not shared_shingles and not longest_line_block:
        return None
    smallest_line_set = min(len(bridge_line_set), len(upstream_line_set))
    line_overlap = shared_lines / smallest_line_set if smallest_line_set else 0.0
    score = max(line_overlap, shingle_jaccard)
    return {
        "bridge_path": bridge_path,
        "upstream_path": upstream_path,
        "shared_normalized_line_count": shared_lines,
        "longest_contiguous_normalized_line_block": longest_line_block,
        "shared_token_shingle_count": shared_shingles,
        "token_shingle_jaccard": round(shingle_jaccard, 8),
        "review_priority_score": round(score, 8),
    }


def build_report(
    xummlogin_dir: Path,
    *,
    expected_xummlogin_version: str,
    source_reference: str,
    review_date: str,
    package_archive: Path | None = None,
) -> dict[str, object]:
    expected_version = _validate_version(
        expected_xummlogin_version, "expected XUMM Login version"
    )
    reference = _validate_reference(source_reference)
    reviewed_on = _validate_review_date(review_date)
    bridge_files = _bridge_code_files()
    upstream_root = xummlogin_dir.resolve()
    upstream_files = _external_code_files(xummlogin_dir)
    detected_version = _version_from_file(
        upstream_root / "xummlogin.php", "XUMM Login"
    )
    if detected_version != expected_version:
        raise ValueError(
            "Expected XUMM Login version "
            f"{expected_version}, but source declares {detected_version}"
        )

    package_sha256 = None
    package_member_count = None
    if package_archive is not None:
        package_sha256, package_member_count = _verified_package_archive(
            package_archive,
            upstream_root,
            upstream_files,
        )

    bridge_fingerprints = {path: _fingerprint(path) for path in bridge_files}
    upstream_fingerprints = {path: _fingerprint(path) for path in upstream_files}
    findings: list[dict[str, object]] = []
    for bridge_file, bridge_fingerprint in bridge_fingerprints.items():
        for upstream_file, upstream_fingerprint in upstream_fingerprints.items():
            finding = _compare_pair(
                bridge_file.relative_to(PLUGIN_DIR).as_posix(),
                bridge_fingerprint,
                upstream_file.relative_to(upstream_root).as_posix(),
                upstream_fingerprint,
            )
            if finding is not None:
                findings.append(finding)
    findings.sort(
        key=lambda finding: (
            -float(finding["review_priority_score"]),
            str(finding["bridge_path"]),
            str(finding["upstream_path"]),
        )
    )

    pair_count = len(bridge_files) * len(upstream_files)
    reported_findings = findings[:MAX_FINDINGS]
    return {
        "report_id": "calorieapp.identity-bridge.source-similarity",
        "report_version": "1.0.0",
        "review_date": reviewed_on,
        "bridge": {
            "version": _version_from_file(
                PLUGIN_DIR / "calorieapp-identity-bridge.php", "Identity Bridge"
            ),
            "code_file_count": len(bridge_files),
            "tree_sha256": _tree_digest(PLUGIN_DIR, bridge_files),
        },
        "upstream": {
            "name": "XUMM Login",
            "version": detected_version,
            "source_reference": reference,
            "package_sha256": package_sha256,
            "package_member_count": package_member_count,
            "package_code_matches_scanned_tree": (
                True if package_archive is not None else None
            ),
            "code_file_count": len(upstream_files),
            "tree_sha256": _tree_digest(upstream_root, upstream_files),
        },
        "comparison": {
            "algorithm": {
                "normalized_line_minimum_characters": MIN_LINE_LENGTH,
                "token_shingle_size": TOKEN_SHINGLE_SIZE,
                "source_contents_included_in_report": False,
            },
            "file_pair_count": pair_count,
            "finding_count": len(findings),
            "reported_finding_count": len(reported_findings),
            "findings_truncated": len(findings) > len(reported_findings),
            "findings": reported_findings,
        },
        "review_boundary": {
            "exact_live_package_required_for_clearance": True,
            "human_review_required": True,
            "rights_administrator_approval_required": True,
            "clears_public_distribution": False,
            "automated_similarity_scan_proves_authorship": False,
            "automated_similarity_scan_proves_no_adaptation": False,
        },
    }


def write_report(report: dict[str, object], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with output.open("x", encoding="utf-8", newline="\n") as destination:
            destination.write(json.dumps(report, indent=2, sort_keys=True) + "\n")
    except FileExistsError as exc:
        raise ValueError(
            f"refusing to overwrite existing evidence report: {output}"
        ) from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xummlogin-dir", required=True, type=Path)
    parser.add_argument("--expected-xummlogin-version", required=True)
    parser.add_argument("--source-reference", required=True)
    parser.add_argument("--review-date", required=True)
    parser.add_argument("--package-archive", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        report = build_report(
            args.xummlogin_dir,
            expected_xummlogin_version=args.expected_xummlogin_version,
            source_reference=args.source_reference,
            review_date=args.review_date,
            package_archive=args.package_archive,
        )
        write_report(report, args.output)
    except (OSError, ValueError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        print(f"provenance scan failed: {exc}", file=sys.stderr)
        return 1
    print(output_display_path(args.output))
    return 0


def output_display_path(output: Path) -> Path:
    resolved = output.resolve()
    try:
        return resolved.relative_to(ROOT)
    except ValueError:
        return resolved


if __name__ == "__main__":
    raise SystemExit(main())
