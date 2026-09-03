import argparse
import io
import sys
import unittest
from unittest import mock

from tools import deployment_smoke_test as smoke


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
    def test_build_identifier_accepts_only_safe_bounded_values(self) -> None:
        self.assertEqual(smoke.build_identifier("a" * 40), "a" * 40)
        for candidate in ("", "contains space", "../release", "a" * 65):
            with self.subTest(candidate=candidate):
                with self.assertRaises(argparse.ArgumentTypeError):
                    smoke.build_identifier(candidate)

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
        )
        argv = [
            "deployment_smoke_test.py",
            "--backend-url",
            "https://api.example",
            "--frontend-url",
            "https://app.example",
            "--expected-build-id",
            commit,
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
        )
        argv = [
            "deployment_smoke_test.py",
            "--backend-url",
            "https://api.example",
            "--frontend-url",
            "https://app.example",
            "--expected-build-id",
            expected,
        ]
        with (
            mock.patch.object(smoke, "urlopen", side_effect=responses),
            mock.patch.object(sys, "argv", argv),
            mock.patch("sys.stdout", new_callable=io.StringIO),
        ):
            self.assertEqual(smoke.main(), 1)


if __name__ == "__main__":
    unittest.main()
