"""Fail release checks when repository rights boundaries drift."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def require_text(path: str, fragments: tuple[str, ...]) -> None:
    content = (ROOT / path).read_text(encoding="utf-8")
    missing = [fragment for fragment in fragments if fragment not in content]
    if missing:
        raise SystemExit(f"{path} is missing required legal boundary text: {missing}")


def main() -> None:
    required_files = (
        "LICENSE",
        "COPYRIGHT.md",
        "NOTICE",
        "TRADEMARKS.md",
        "CONTRIBUTING.md",
        "SECURITY.md",
        "DATA_LICENSING.md",
        "THIRD_PARTY_NOTICES.md",
        "ASSET_PROVENANCE.md",
        "IP_CLEARANCE.md",
        "contracts/identity-bridge/v1/code-provenance.json",
        "docs/IDENTITY_BRIDGE_CODE_PROVENANCE.md",
        "wordpress-plugins/calorieapp-identity-bridge/THIRD_PARTY_NOTICES.md",
    )
    missing = [path for path in required_files if not (ROOT / path).is_file()]
    if missing:
        raise SystemExit(f"Missing legal boundary files: {missing}")

    require_text(
        "LICENSE",
        ("NO GENERAL LICENCE GRANTED", "GPL-2.0-or-later", "no permission is granted", "PATENTS AND PUBLIC DISCLOSURE"),
    )
    require_text("COPYRIGHT.md", ("ICTHendrikse", "technical provenance", "GPL-2.0-or-later"))
    require_text("TRADEMARKS.md", ("Pieter Hendrikse", "019137415", "019125433", "No repository licence grants"))
    require_text("DATA_LICENSING.md", ("Open Database License", "share-alike"))
    require_text("THIRD_PARTY_NOTICES.md", ("software bill of materials", "GPL-2.0-or-later"))
    require_text("IP_CLEARANCE.md", ("general ideas such as calorie tracking", "freedom-to-operate"))
    require_text(
        "wordpress-plugins/calorieapp-identity-bridge/calorieapp-identity-bridge.php",
        ("License: GPL-2.0-or-later",),
    )
    provenance = json.loads(
        (
            ROOT / "contracts" / "identity-bridge" / "v1" / "code-provenance.json"
        ).read_text(encoding="utf-8")
    )
    if provenance.get("distribution_clearance_status") != "blocked-pending-source-clearance":
        raise SystemExit(
            "Identity Bridge provenance status may change only through its reviewed clearance workflow"
        )
    if provenance.get("release_expansion_allowed") is not False:
        raise SystemExit("Identity Bridge release expansion must remain blocked")

    package = json.loads((ROOT / "frontend/package.json").read_text(encoding="utf-8"))
    lock = json.loads((ROOT / "frontend/package-lock.json").read_text(encoding="utf-8"))
    if package.get("license") != "UNLICENSED":
        raise SystemExit("frontend/package.json must retain license=UNLICENSED")
    if lock.get("packages", {}).get("", {}).get("license") != "UNLICENSED":
        raise SystemExit("frontend/package-lock.json must retain root license=UNLICENSED")

    print("Legal boundary checks passed")


if __name__ == "__main__":
    main()
