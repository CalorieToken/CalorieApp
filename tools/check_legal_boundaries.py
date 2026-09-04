"""Fail release checks when repository rights boundaries drift."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def require_json_object(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise SystemExit(f"{label} must be a JSON object")
    return value


def require_text(path: str, fragments: tuple[str, ...]) -> None:
    content = (ROOT / path).read_text(encoding="utf-8")
    missing = [fragment for fragment in fragments if fragment not in content]
    if missing:
        raise SystemExit(f"{path} is missing required legal boundary text: {missing}")


def require_non_clearing_similarity(
    report: dict[str, object], label: str
) -> None:
    review_boundary = require_json_object(
        report.get("review_boundary"), f"{label} review_boundary"
    )
    if review_boundary.get("clears_public_distribution") is not False:
        raise SystemExit(f"{label} must not claim distribution clearance")
    if review_boundary.get("exact_live_package_required_for_clearance") is not True:
        raise SystemExit(f"{label} must retain the exact-package requirement")
    if review_boundary.get("human_review_required") is not True:
        raise SystemExit(f"{label} must retain human review")
    algorithm = require_json_object(
        require_json_object(report.get("comparison"), f"{label} comparison").get(
            "algorithm"
        ),
        f"{label} comparison algorithm",
    )
    if algorithm.get("source_contents_included_in_report") is not False:
        raise SystemExit(f"{label} must remain content-safe")


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
        "contracts/identity-bridge/v1/evidence/xummlogin-public-1.3.0-similarity.json",
        "contracts/identity-bridge/v1/evidence/xummlogin-live-1.3.1-similarity.json",
        "docs/IDENTITY_BRIDGE_CODE_PROVENANCE.md",
        "docs/IDENTITY_BRIDGE_SOURCE_DECLARATION_TEMPLATE.md",
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
    provenance = require_json_object(
        json.loads(
            (
                ROOT
                / "contracts"
                / "identity-bridge"
                / "v1"
                / "code-provenance.json"
            ).read_text(encoding="utf-8")
        ),
        "Identity Bridge provenance",
    )
    if provenance.get("distribution_clearance_status") != "blocked-pending-source-clearance":
        raise SystemExit(
            "Identity Bridge provenance status may change only through its reviewed clearance workflow"
        )
    if provenance.get("release_expansion_allowed") is not False:
        raise SystemExit("Identity Bridge release expansion must remain blocked")
    similarity_report = require_json_object(
        json.loads(
            (
                ROOT
                / "contracts"
                / "identity-bridge"
                / "v1"
                / "evidence"
                / "xummlogin-public-1.3.0-similarity.json"
            ).read_text(encoding="utf-8")
        ),
        "Identity Bridge similarity evidence",
    )
    require_non_clearing_similarity(
        similarity_report, "Identity Bridge preliminary similarity evidence"
    )
    exact_similarity_report = require_json_object(
        json.loads(
            (
                ROOT
                / "contracts"
                / "identity-bridge"
                / "v1"
                / "evidence"
                / "xummlogin-live-1.3.1-similarity.json"
            ).read_text(encoding="utf-8")
        ),
        "Identity Bridge exact-package similarity evidence",
    )
    require_non_clearing_similarity(
        exact_similarity_report, "Identity Bridge exact-package similarity evidence"
    )
    exact_upstream = require_json_object(
        exact_similarity_report.get("upstream"),
        "Identity Bridge exact-package similarity evidence upstream",
    )
    expected_package_sha256 = (
        "8a0ec7531f536033a403196e934680882"
        "e7cde53a66dd4df453e81927b203806"
    )
    if exact_upstream.get("version") != "1.3.1":
        raise SystemExit("Exact-package similarity evidence must identify version 1.3.1")
    if exact_upstream.get("package_sha256") != expected_package_sha256:
        raise SystemExit("Exact-package similarity evidence package hash drifted")
    if exact_upstream.get("package_member_count") != 105:
        raise SystemExit("Exact-package similarity evidence member count drifted")
    if exact_upstream.get("package_code_matches_scanned_tree") is not True:
        raise SystemExit("Exact-package similarity evidence must bind archive and tree")
    external_interfaces = provenance.get("known_external_interfaces")
    if not isinstance(external_interfaces, list):
        raise SystemExit("Identity Bridge external interfaces must be a JSON array")
    installed_plugin = next(
        (
            item
            for item in external_interfaces
            if isinstance(item, dict)
            and item.get("id") == "installed-xumm-login-plugin"
        ),
        None,
    )
    if installed_plugin is None:
        raise SystemExit("Installed XUMM Login provenance boundary is missing")
    if installed_plugin.get("exact_package_sha256") != expected_package_sha256:
        raise SystemExit("Installed XUMM Login package hash differs from exact evidence")
    if installed_plugin.get("exact_package_code_tree_sha256") != exact_upstream.get(
        "tree_sha256"
    ):
        raise SystemExit("Installed XUMM Login tree hash differs from exact evidence")
    similarity_entries = provenance.get("preliminary_similarity_evidence")
    if not isinstance(similarity_entries, list):
        raise SystemExit("Identity Bridge similarity evidence must be a JSON array")
    exact_entries = []
    for index, value in enumerate(similarity_entries):
        entry = require_json_object(
            value, f"Identity Bridge similarity evidence entry {index}"
        )
        if not isinstance(entry.get("is_exact_live_package"), bool):
            raise SystemExit("Similarity evidence must identify exact-package status")
        if entry.get("satisfies_exact_live_package_clearance") is not False:
            raise SystemExit("Similarity evidence must not claim exact-package clearance")
        if entry["is_exact_live_package"]:
            exact_entries.append(entry)
    if len(exact_entries) != 1:
        raise SystemExit("Exactly one exact live-package evidence entry is required")
    exact_entry = exact_entries[0]
    if exact_entry.get("package_sha256") != expected_package_sha256:
        raise SystemExit("Exact live-package evidence entry hash drifted")
    if exact_entry.get("report") != (
        "contracts/identity-bridge/v1/evidence/"
        "xummlogin-live-1.3.1-similarity.json"
    ):
        raise SystemExit("Exact live-package evidence entry report path drifted")

    package = json.loads((ROOT / "frontend/package.json").read_text(encoding="utf-8"))
    lock = json.loads((ROOT / "frontend/package-lock.json").read_text(encoding="utf-8"))
    if package.get("license") != "UNLICENSED":
        raise SystemExit("frontend/package.json must retain license=UNLICENSED")
    if lock.get("packages", {}).get("", {}).get("license") != "UNLICENSED":
        raise SystemExit("frontend/package-lock.json must retain root license=UNLICENSED")

    print("Legal boundary checks passed")


if __name__ == "__main__":
    main()
