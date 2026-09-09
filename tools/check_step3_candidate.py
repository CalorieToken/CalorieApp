"""Run the shared Step 3 maintenance checks; never grant release clearance.

No service, browser, signing, installation or publication action is performed.
Missing PHP is recorded as NOT_RUN locally and fails the --require-php CI gate.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "wordpress-plugins/calorieapp-identity-bridge"
NODE_SUITES = (
    "wordpress_page_ending", "wordpress_shared_footer", "wordpress_embed_loading",
    "display_language_protocol", "wordpress_display_language",
    "wordpress_cms_language_preview", "calorieapp_embed_readiness",
    "wordpress_site_session", "wordpress_site_layout", "wordpress_site_navigation",
    "wordpress_step3_polish", "wordpress_blog_x", "wordpress_richlist", "wordpress_trustline", "wordpress_tokenomics", "wordpress_buy_guide",
)
PHP_FIXTURES = (
    ("wordpress_site_session_markup",), ("wordpress_legal_footer_post",),
    ("wordpress_donation_return",), ("wordpress_page_ending",),
    ("wordpress_display_language",), ("wordpress_display_language", "preview"),
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-php", action="store_true")
    parser.add_argument("--report-dir", type=Path, default=ROOT / "dist/step3-checks")
    args = parser.parse_args()
    output = args.report_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    checks: list[dict] = []

    def run(name: str, commands: list[list[str]], *, available: bool = True,
            required: bool = True, reason: str = "") -> None:
        started = time.monotonic()
        result = {"name": name, "required": required, "status": "NOT_RUN"}
        if not available:
            result["reason"] = reason
        else:
            logs = []
            failures = []
            for command in commands:
                logs.append("COMMAND " + json.dumps(command) + "\n")
                try:
                    completed = subprocess.run(
                        command, cwd=ROOT, capture_output=True, text=True,
                        encoding="utf-8", errors="replace", timeout=120,
                    )
                    logs.extend((completed.stdout, completed.stderr))
                    if completed.returncode:
                        failures.append({"command": command, "exit_code": completed.returncode})
                except (OSError, subprocess.TimeoutExpired) as error:
                    logs.append(str(error) + "\n")
                    failures.append({"command": command, "error": type(error).__name__})
            log = "".join(logs)
            (output / (name + ".log")).write_text(log, encoding="utf-8")
            result.update(status="FAIL" if failures else "PASS", log=name + ".log")
            if failures:
                result["failures"] = failures
            if name == "node-behavior":
                result["test_counts"] = {
                    label: int(count) for label, count in
                    re.findall(r"^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$", log, re.M)
                }
            if name == "python-package-and-asset-tests":
                match = re.search(r"Ran (\d+) tests? in", log)
                if match:
                    result["tests"] = int(match[1])
        result["seconds"] = round(time.monotonic() - started, 3)
        checks.append(result)
        print(f"{result['status']}: {name}" + (f" — {reason}" if not available else ""), flush=True)

    node = shutil.which("node")
    php = shutil.which("php")
    run("node-behavior", [[node or "node", "--test", "--test-reporter=tap", *[
        f"tools/tests/{suite}.test.mjs" for suite in NODE_SUITES
    ]]], available=bool(node), reason="Node.js unavailable")
    run("javascript-syntax", [[node or "node", "--check", str(path.relative_to(ROOT))]
                             for path in sorted((PLUGIN / "assets").glob("*.js"))],
        available=bool(node), reason="Node.js unavailable")
    run("python-package-and-asset-tests", [[sys.executable, "-m", "unittest",
        "tools.tests.test_build_wordpress_plugin_release",
        "tools.tests.test_xrpl_dex_asset_registry"]])
    run("legal-boundaries", [[sys.executable, "tools/check_legal_boundaries.py"]])
    run("php-syntax", [[php or "php", "-l", str(path.relative_to(ROOT))]
                       for path in sorted(PLUGIN.rglob("*.php"))],
        available=bool(php), required=args.require_php, reason="PHP unavailable")
    for fixture, *extra in PHP_FIXTURES:
        name = "php-" + fixture.removeprefix("wordpress_").replace("_", "-")
        if extra:
            name += "-" + "-".join(extra)
        run(name, [[php or "php", f"tools/tests/{fixture}.test.php", *extra]],
            available=bool(php), required=args.require_php, reason="PHP unavailable")
    run("diff-whitespace", [["git", "diff", "--check"]])

    # Pin the executable sources, fixture inputs and contracts, independently of
    # a later documentation-only edit or local commit of the tested candidate.
    files = sorted(subprocess.check_output([
        "git", "ls-files", "--cached", "--others", "--exclude-standard", "--",
        "tools", "contracts", "wordpress-plugins/calorieapp-identity-bridge", ".github/workflows",
    ], cwd=ROOT, text=True).splitlines())
    inputs = {}
    for relative in files:
        path = ROOT / relative
        if path.is_file() and path.suffix not in (".md", ".txt"):
            inputs[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    fingerprint = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()
    failed = any(check["status"] == "FAIL" for check in checks)
    missing = any(check["status"] == "NOT_RUN" for check in checks)
    required_missing = any(check["status"] == "NOT_RUN" and check["required"] for check in checks)
    exit_code = 1 if failed else 2 if required_missing else 0
    status = "FAILED" if failed else "INCOMPLETE" if missing else "AUTOMATED_CHECKS_PASSED"
    report = {
        "schema_version": 1,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "source_head_at_check": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "working_tree_dirty": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT)),
        "source_fingerprint_sha256": fingerprint,
        "input_sha256": inputs,
        "status": status, "exit_code": exit_code, "require_php": args.require_php,
        "checks": checks,
        "release_approved": False,
        "not_demonstrated": [
            "Hosted CI for this commit", "Installed WordPress/app compatibility",
            "Native browser/mobile/zoom/RTL appearance and accessibility",
            "Native same-tab login/logout, donation and consent acceptance",
            "Full CMS and legal translation coverage or linguistic review",
            "Source/publication clearance, financial-feature or deployment approval",
        ],
    }
    destination = output / "report.json"
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"{status}: {destination}\nRelease approval: false", flush=True)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
