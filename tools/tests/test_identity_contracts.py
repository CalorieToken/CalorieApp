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
        admission = security["login_start_admission"]
        self.assertEqual(
            admission["registered_client_id_source"],
            "fixed-server-configuration",
        )
        self.assertEqual(admission["start_limit"], 20)
        self.assertEqual(admission["start_window_seconds"], 60)
        self.assertEqual(
            admission["outstanding_unexpired_transaction_limit"],
            50,
        )
        self.assertTrue(admission["outstanding_limit_counts_all_retained_statuses"])
        self.assertTrue(admission["state_locale_and_origin_handoff_atomic"])
        self.assertFalse(admission["raw_ip_or_network_signal_stored"])
        self.assertFalse(
            admission["short_lived_network_signal_limit_implemented"]
        )
        self.assertTrue(admission["adaptive_status_poll_slowdown_implemented"])
        self.assertEqual(
            admission["status_poll_elapsed_schedule_seconds"], [5, 10, 20]
        )
        self.assertEqual(
            admission["status_poll_phase_boundaries_seconds"], [30, 90]
        )
        self.assertEqual(
            admission["status_poll_transient_failure_delays_seconds"],
            [10, 20, 30],
        )
        self.assertEqual(admission["status_poll_retry_after_max_seconds"], 60)
        self.assertFalse(
            admission["focus_or_pageshow_may_bypass_scheduled_poll_delay"]
        )
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

        self.assertEqual(
            matrix["contract_id"],
            "calorieapp.identity-bridge-login-test-matrix",
        )
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
                "registered_client_start_limited",
                "outstanding_state_limit",
                "admission_store_unavailable",
                "adaptive_status_polling",
            },
        )

    def test_xaman_return_is_state_bound_and_atomically_serialized(self) -> None:
        plugin = (
            contracts.ROOT
            / "wordpress-plugins"
            / "calorieapp-identity-bridge"
            / "includes"
            / "class-calorieapp-identity-bridge-integrated-login.php"
        ).read_text(encoding="utf-8")
        return_handler = plugin[
            plugin.index("public function return_from_xaman") :
            plugin.index("public function authorize_calorieapp")
        ]

        self.assertIn(
            "'backend_state_hash' => hash('sha256', $backend_state)",
            plugin,
        )
        self.assertIn("$this->acquire_return_lock($flow_id)", return_handler)
        self.assertIn("finally", return_handler)
        self.assertIn("$this->release_return_lock($lock_name)", return_handler)
        self.assertIn("SELECT GET_LOCK(%s, 0)", plugin)
        self.assertIn("SELECT RELEASE_LOCK(%s)", plugin)
        complete_return = return_handler[
            return_handler.index("private function complete_xaman_return") :
        ]
        self.assertLess(
            complete_return.index("$flow['return_consumed'] = true"),
            complete_return.index("$this->rest_api->authorize_current_user"),
        )
        self.assertIn("$flow['return_consumed'] = false", complete_return)

    def test_xaman_site_return_is_a_plain_same_origin_permalink(self) -> None:
        plugin = (
            contracts.ROOT
            / "wordpress-plugins"
            / "calorieapp-identity-bridge"
            / "includes"
            / "class-calorieapp-identity-bridge-integrated-login.php"
        ).read_text(encoding="utf-8")
        sanitizer = plugin[
            plugin.index("private function sanitize_site_return_url") :
            plugin.index("private function sanitize_frontend_url")
        ]

        self.assertIn("isset($parts['query'])", sanitizer)
        self.assertIn("isset($parts['fragment'])", sanitizer)
        self.assertIn("$this->url_origin(home_url('/'))", sanitizer)


if __name__ == "__main__":
    unittest.main()
