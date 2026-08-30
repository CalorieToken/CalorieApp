from __future__ import annotations

import json
import re
import unittest

from tools import sync_identity_contracts as contracts


class IdentityContractTests(unittest.TestCase):
    def test_contracts_validate_and_runtime_copies_are_current(self) -> None:
        self.assertEqual(contracts.synchronize(check=True), [])

    def test_security_ttls_match_the_runtime_defaults(self) -> None:
        security = json.loads(contracts.SECURITY_CONTRACT.read_text(encoding="utf-8"))
        backend = (contracts.ROOT / "backend" / "app" / "main.py").read_text(
            encoding="utf-8"
        )
        plugin = (
            contracts.ROOT
            / "wordpress-plugins"
            / "calorieapp-identity-bridge"
            / "includes"
            / "class-calorieapp-identity-bridge-integrated-login.php"
        ).read_text(encoding="utf-8")
        plugin_root = (
            contracts.ROOT
            / "wordpress-plugins"
            / "calorieapp-identity-bridge"
            / "includes"
            / "class-calorieapp-identity-bridge.php"
        ).read_text(encoding="utf-8")

        self.assertRegex(
            backend,
            re.compile(
                rf'SESSION_ABSOLUTE_LIFETIME_SECONDS\s*=\s*8\s*\*\s*60\s*\*\s*60'
            ),
        )
        self.assertEqual(security["application_session"]["absolute_ttl_seconds"], 28800)
        self.assertRegex(
            backend,
            re.compile(r'SESSION_IDLE_LIFETIME_SECONDS\s*=\s*30\s*\*\s*60'),
        )
        self.assertEqual(security["application_session"]["idle_ttl_seconds"], 1800)
        self.assertIn('os.getenv("LOGIN_STATE_LIFETIME_SECONDS", "300")', backend)
        self.assertEqual(security["login_state"]["ttl_seconds"], 300)
        self.assertIn("FLOW_TTL_SECONDS = 10 * MINUTE_IN_SECONDS", plugin)
        self.assertEqual(security["integrated_login_flow"]["ttl_seconds"], 600)
        self.assertIn("'code_ttl_seconds' => 60", plugin_root)
        self.assertEqual(security["authorization_code"]["default_ttl_seconds"], 60)

    def test_login_matrix_covers_all_locales_and_failure_paths(self) -> None:
        matrix = json.loads(
            (
                contracts.ROOT
                / "contracts"
                / "identity-bridge"
                / "v1"
                / "login-test-matrix.json"
            ).read_text(encoding="utf-8")
        )
        locales = json.loads(contracts.CANONICAL_LOCALES.read_text(encoding="utf-8"))
        expected_tags = [locale["tag"] for locale in locales["locales"]]

        self.assertEqual(matrix["locales"], expected_tags)
        self.assertEqual(matrix["source_locale"], locales["source_locale"])
        self.assertEqual(matrix["fallback_locale"], locales["fallback_locale"])
        self.assertEqual(
            set(matrix["required_context_fields"]),
            {"locale", "state", "request_id"},
        )
        self.assertEqual(
            {scenario["id"] for scenario in matrix["scenarios"]},
            {
                "happy_path",
                "backend_cold_retry",
                "xaman_rejected",
                "flow_expired",
                "wordpress_authenticated_backend_retry",
                "state_or_locale_mismatch",
                "origin_browser_restore",
                "unsupported_locale_fallback",
            },
        )


if __name__ == "__main__":
    unittest.main()
