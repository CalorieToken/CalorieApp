"""Reject tracked provider credentials and private backup-key material."""

from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]

_BLOCKED_SUFFIXES = (".age", ".backup", ".dump", ".pgdump")
_AGE_IDENTITY_MARKER = b"AGE-" + b"SECRET-KEY-1"
_NEON_HOST_SUFFIX = b".neon." + b"tech"
_AGE_IDENTITY_ENV = b"CALORIEAPP_SYNTHETIC_" + b"AGE_IDENTITY"

_AGE_IDENTITY = re.compile(re.escape(_AGE_IDENTITY_MARKER), re.IGNORECASE)

_NEON_DSN = re.compile(
    rb"postgres(?:ql)?(?:\+[a-z0-9_]+)?://"
    rb"[^\s\"'<>]+@"
    rb"[a-z0-9.-]+"
    + re.escape(_NEON_HOST_SUFFIX)
    + rb"(?::[0-9]+)?/[^\s\"'<>]+",
    re.IGNORECASE,
)
_SECRET_ASSIGNMENT = re.compile(
    rb"^[ \t]*(?:export[ \t]+)?[\"']?(?:"
    rb"[A-Z0-9_]*NEON[A-Z0-9_]*API[A-Z0-9_]*KEY[A-Z0-9_]*"
    rb"|"
    + re.escape(_AGE_IDENTITY_ENV)
    + rb")[\"']?[ \t]*[:=][ \t]*[\"']?(?P<value>[^\s\"'#]+)",
    re.MULTILINE,
)
_SAFE_ASSIGNMENT_PREFIXES = (
    b"$",
    b"<",
    b"env(",
    b"os.environ[",
    b"os.getenv(",
    b"process.env.",
)
_SAFE_ASSIGNMENT_VALUES = frozenset(
    {
        b"redacted",
        b"not-configured",
        b"not_configured",
        b"unset",
    }
)


@dataclass(frozen=True, order=True)
class Finding:
    """One low-cardinality finding that never carries matched content."""

    path: str
    rule: str


def _assignment_contains_literal_secret(match: re.Match[bytes]) -> bool:
    value = match.group("value").lower()
    if value.startswith(_SAFE_ASSIGNMENT_PREFIXES):
        return False
    return value not in _SAFE_ASSIGNMENT_VALUES


def _content_findings(relative_path: str, content: bytes) -> list[Finding]:
    findings: list[Finding] = []
    if _AGE_IDENTITY.search(content):
        findings.append(Finding(relative_path, "age-private-identity"))
    if _NEON_DSN.search(content):
        findings.append(Finding(relative_path, "neon-database-url"))
    if any(
        _assignment_contains_literal_secret(match)
        for match in _SECRET_ASSIGNMENT.finditer(content)
    ):
        findings.append(Finding(relative_path, "literal-provider-secret-assignment"))
    return findings


def _is_blocked_artifact_path(relative_path: str) -> bool:
    filename = relative_path.rsplit("/", 1)[-1].lower()
    return filename.endswith(_BLOCKED_SUFFIXES) or ".dump." in filename


def scan_tracked_files(root: Path, relative_paths: Iterable[str]) -> list[Finding]:
    """Scan the supplied tracked paths without revealing matched bytes."""
    findings: list[Finding] = []
    normalized_paths = sorted(
        {relative_path.replace("\\", "/") for relative_path in relative_paths}
    )
    for normalized in normalized_paths:
        if _is_blocked_artifact_path(normalized):
            findings.append(Finding(normalized, "forbidden-secret-artifact-path"))
            continue

        path = root / normalized
        try:
            if path.is_symlink():
                content = os.readlink(path).encode("utf-8", errors="surrogateescape")
            else:
                content = path.read_bytes()
        except OSError:
            findings.append(Finding(normalized, "tracked-file-unreadable"))
            continue
        findings.extend(_content_findings(normalized, content))
    return sorted(set(findings))


def tracked_paths(root: Path) -> list[str]:
    """Return the exact Git index paths without consulting untracked files."""
    result = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--"],
        check=True,
        capture_output=True,
    )
    return [
        item.decode("utf-8", errors="surrogateescape")
        for item in result.stdout.split(b"\0")
        if item
    ]


def render_findings(findings: Iterable[Finding]) -> str:
    """Render only file paths and stable rule names."""
    return "\n".join(
        f"path={json.dumps(finding.path, ensure_ascii=True)} rule={finding.rule}"
        for finding in findings
    )


def main() -> int:
    try:
        findings = scan_tracked_files(ROOT, tracked_paths(ROOT))
    except (OSError, subprocess.SubprocessError):
        print("Tracked provider-secret boundary could not inspect the Git index")
        return 2

    if findings:
        print("Tracked provider-secret boundary failed:")
        print(render_findings(findings))
        return 1
    print("Tracked provider-secret boundary passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
