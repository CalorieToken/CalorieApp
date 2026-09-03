import argparse
import io
import sys
import unittest
from pathlib import Path
from unittest import mock

from tools import deployment_smoke_test as smoke


def _wordpress_html(frontend: str, version: str) -> bytes:
    return (
        '<html><link id="calorieapp-identity-bridge-embed-css" '
        f'href="/wp-content/plugins/calorieapp-identity-bridge/assets/calorieapp-embed.css?ver={version}">'
        '<div data-calorieapp-embed>'
        f'<iframe class="calorieapp-embed-frame" src="{frontend}?embedded=1&amp;locale=en"></iframe>'
        '</div><script id="calorieapp-identity-bridge-embed-js" '
        f'src="/wp-content/plugins/calorieapp-identity-bridge/assets/calorieapp-embed.js?ver={version}"></script>'
        "</html>"
    ).encode()


def _mobile_return_script() -> bytes:
    return b"\n".join(
        (
            b"function suppressLegacySigninSurfaces() {}",
            b'openLink.target = "_self";',
            b'document.addEventListener("visibilitychange", checkAfterReturn);',
            b'window.addEventListener("focus", checkAfterReturn);',
            b'window.addEventListener("pageshow", checkAfterReturn);',
            b'card.setAttribute("data-calorieapp-superseded-login", "1");',
        )
    )


class _Response:
    def __init__(self, status: int, headers: dict[str, str], body: bytes) -> None:
        self.status = status
        self.headers = headers
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        return None

    def read(self) -> bytes:
        return self._body


class DeploymentSmokeTests(unittest.TestCase):
    def test_documented_command_includes_every_required_argument(self) -> None:
        root = Path(__file__).resolve().parents[2]
        guide = (root / "docs" / "public" / "deployment.md").read_text(
            encoding="utf-8"
        )
        command = next(
            line
            for line in guide.splitlines()
            if "tools/deployment_smoke_test.py" in line
        )
        self.assertIn("--backend-url", command)
        self.assertIn("--frontend-url", command)
        self.assertIn("--wordpress-url", command)
        self.assertIn("--expected-build-id", command)
        self.assertIn("--expected-plugin-version", command)

    def test_workflow_requires_and_passes_expected_build_id(self) -> None:
        root = Path(__file__).resolve().parents[2]
        workflow = (root / ".github" / "workflows" / "deployment-smoke.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("expected_build_id:", workflow)
        self.assertIn("wordpress_url:", workflow)
        self.assertIn("expected_plugin_version:", workflow)
        self.assertIn("CALORIEAPP_SMOKE_EXPECTED_BUILD_ID", workflow)
        self.assertIn("CALORIEAPP_SMOKE_WORDPRESS_URL", workflow)
        self.assertIn("CALORIEAPP_SMOKE_EXPECTED_PLUGIN_VERSION", workflow)
        self.assertIn(
            '--expected-build-id "$CALORIEAPP_SMOKE_EXPECTED_BUILD_ID"',
            workflow,
        )

    def test_cli_requires_expected_build_id(self) -> None:
        argv = [
            "deployment_smoke_test.py",
            "--backend-url",
            "https://api.example",
            "--frontend-url",
            "https://app.example",
        ]
        with (
            mock.patch.object(sys, "argv", argv),
            mock.patch("sys.stderr", new_callable=io.StringIO),
            self.assertRaises(SystemExit) as raised,
        ):
            smoke.main()
        self.assertEqual(raised.exception.code, 2)

    def test_build_identifier_accepts_only_safe_bounded_values(self) -> None:
        self.assertEqual(smoke.build_identifier("a" * 40), "a" * 40)
        for candidate in ("", "contains space", "../release", "a" * 65):
            with self.subTest(candidate=candidate):
                with self.assertRaises(argparse.ArgumentTypeError):
                    smoke.build_identifier(candidate)

    def test_wordpress_inputs_accept_only_safe_shapes(self) -> None:
        self.assertEqual(
            smoke.public_https_url("https://www.example.test/index.php/app/"),
            "https://www.example.test/index.php/app/",
        )
        self.assertEqual(smoke.plugin_version("0.3.1"), "0.3.1")
        for candidate in (
            "http://example.test/app",
            "https://user:pass@example.test/app",
            "https://example.test/app?preview=true",
            "https://example.test/app#fragment",
        ):
            with self.subTest(candidate=candidate):
                with self.assertRaises(argparse.ArgumentTypeError):
                    smoke.public_https_url(candidate)
        for candidate in ("v0.3.1", "0.3", "../0.3.1"):
            with self.subTest(candidate=candidate):
                with self.assertRaises(argparse.ArgumentTypeError):
                    smoke.plugin_version(candidate)

    def test_wordpress_embed_requires_exact_version_and_mobile_contract(self) -> None:
        html = _wordpress_html("https://app.example", "0.3.1").decode()
        passed, script_url, _ = smoke.inspect_wordpress_embed(
            html,
            "https://www.example.test/index.php/calorieapp/",
            "https://app.example",
            "0.3.1",
        )
        self.assertTrue(passed)
        self.assertEqual(
            script_url,
            "https://www.example.test/wp-content/plugins/"
            "calorieapp-identity-bridge/assets/calorieapp-embed.js?ver=0.3.1",
        )
        self.assertTrue(
            smoke.mobile_return_contract_matches(_mobile_return_script().decode())
        )
        self.assertFalse(
            smoke.mobile_return_contract_matches(
                _mobile_return_script().decode() + "\nreturn_url"
            )
        )

        wrong_version, wrong_version_script_url, _ = (
            smoke.inspect_wordpress_embed(
                html,
                "https://www.example.test/index.php/calorieapp/",
                "https://app.example",
                "0.3.2",
            )
        )
        self.assertFalse(wrong_version)
        self.assertIsNone(wrong_version_script_url)

        off_origin_html = html.replace(
            "/wp-content/plugins/calorieapp-identity-bridge/assets/"
            "calorieapp-embed.js?ver=0.3.1",
            "https://untrusted.example/calorieapp-embed.js?ver=0.3.1",
        )
        off_origin, off_origin_script_url, _ = smoke.inspect_wordpress_embed(
            off_origin_html,
            "https://www.example.test/index.php/calorieapp/",
            "https://app.example",
            "0.3.1",
        )
        self.assertFalse(off_origin)
        self.assertIsNone(off_origin_script_url)

    def test_frontend_build_identifier_match_accepts_valid_html_quoting(self) -> None:
        commit = "a" * 40
        for attribute in (
            f'data-calorieapp-build-id="{commit}"',
            f"data-calorieapp-build-id='{commit}'",
            f"DATA-CALORIEAPP-BUILD-ID={commit}",
        ):
            with self.subTest(attribute=attribute):
                self.assertTrue(
                    smoke.frontend_build_identifier_matches(
                        f"<html {attribute}>",
                        commit,
                    )
                )

        self.assertFalse(
            smoke.frontend_build_identifier_matches(
                f'<html data-calorieapp-build-id="{commit}extra">',
                commit,
            )
        )
        self.assertFalse(
            smoke.frontend_build_identifier_matches(
                f"<html data-calorieapp-build-id='{commit}\">",
                commit,
            )
        )

    def test_smoke_requires_matching_backend_and_frontend_build_ids(self) -> None:
        commit = "a" * 40
        responses = (
            _Response(
                200,
                {},
                ('{"status":"ok","build_id":"' + commit + '"}').encode(),
            ),
            _Response(
                200,
                {"Access-Control-Allow-Origin": "https://app.example"},
                b"",
            ),
            _Response(
                200,
                {},
                (
                    '<html data-calorieapp-build-id="'
                    + commit
                    + '"><title>CalorieApp</title></html>'
                ).encode(),
            ),
            _Response(
                200,
                {},
                _wordpress_html("https://app.example", "0.3.1"),
            ),
            _Response(200, {}, _mobile_return_script()),
        )
        argv = [
            "deployment_smoke_test.py",
            "--backend-url",
            "https://api.example",
            "--frontend-url",
            "https://app.example",
            "--wordpress-url",
            "https://www.example.test/index.php/calorieapp/",
            "--expected-build-id",
            commit,
            "--expected-plugin-version",
            "0.3.1",
        ]
        with (
            mock.patch.object(smoke, "urlopen", side_effect=responses),
            mock.patch.object(sys, "argv", argv),
            mock.patch("sys.stdout", new_callable=io.StringIO),
        ):
            self.assertEqual(smoke.main(), 0)

    def test_smoke_fails_when_a_runtime_does_not_match(self) -> None:
        expected = "a" * 40
        deployed = "b" * 40
        responses = (
            _Response(
                200,
                {},
                ('{"status":"ok","build_id":"' + deployed + '"}').encode(),
            ),
            _Response(
                200,
                {"Access-Control-Allow-Origin": "https://app.example"},
                b"",
            ),
            _Response(
                200,
                {},
                (
                    '<html data-calorieapp-build-id="'
                    + deployed
                    + '"><title>CalorieApp</title></html>'
                ).encode(),
            ),
            _Response(
                200,
                {},
                _wordpress_html("https://app.example", "0.3.1"),
            ),
            _Response(200, {}, _mobile_return_script()),
        )
        argv = [
            "deployment_smoke_test.py",
            "--backend-url",
            "https://api.example",
            "--frontend-url",
            "https://app.example",
            "--wordpress-url",
            "https://www.example.test/index.php/calorieapp/",
            "--expected-build-id",
            expected,
            "--expected-plugin-version",
            "0.3.1",
        ]
        with (
            mock.patch.object(smoke, "urlopen", side_effect=responses),
            mock.patch.object(sys, "argv", argv),
            mock.patch("sys.stdout", new_callable=io.StringIO),
        ):
            self.assertEqual(smoke.main(), 1)

    def test_smoke_never_fetches_an_unvalidated_wordpress_script(self) -> None:
        commit = "a" * 40
        wordpress_html = _wordpress_html(
            "https://app.example", "0.3.1"
        ).replace(
            b"/wp-content/plugins/calorieapp-identity-bridge/assets/"
            b"calorieapp-embed.js?ver=0.3.1",
            b'https://untrusted.example/calorieapp-embed.js?ver=0.3.1',
        )
        responses = (
            _Response(
                200,
                {},
                ('{"status":"ok","build_id":"' + commit + '"}').encode(),
            ),
            _Response(
                200,
                {"Access-Control-Allow-Origin": "https://app.example"},
                b"",
            ),
            _Response(
                200,
                {},
                (
                    '<html data-calorieapp-build-id="'
                    + commit
                    + '"><title>CalorieApp</title></html>'
                ).encode(),
            ),
            _Response(200, {}, wordpress_html),
        )
        argv = [
            "deployment_smoke_test.py",
            "--backend-url",
            "https://api.example",
            "--frontend-url",
            "https://app.example",
            "--wordpress-url",
            "https://www.example.test/index.php/calorieapp/",
            "--expected-build-id",
            commit,
            "--expected-plugin-version",
            "0.3.1",
        ]
        with (
            mock.patch.object(smoke, "urlopen", side_effect=responses) as mocked_open,
            mock.patch.object(sys, "argv", argv),
            mock.patch("sys.stdout", new_callable=io.StringIO),
        ):
            self.assertEqual(smoke.main(), 1)

        self.assertEqual(mocked_open.call_count, 4)


if __name__ == "__main__":
    unittest.main()
