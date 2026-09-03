#!/usr/bin/env python3
"""Verify a deployed CalorieApp frontend/backend pair without changing data."""

from __future__ import annotations

import argparse
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def origin(value: str) -> str:
    parsed = urlsplit(value.rstrip("/"))
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise argparse.ArgumentTypeError("deployment URLs must be public HTTPS origins")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise argparse.ArgumentTypeError("deployment URLs must not include a path, query, or fragment")
    return f"https://{parsed.netloc}"


def build_identifier(value: str) -> str:
    candidate = value.strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", candidate):
        raise argparse.ArgumentTypeError(
            "build id must be 1-64 letters, digits, dots, underscores or hyphens"
        )
    return candidate


def frontend_build_identifier_matches(html: str, expected: str) -> bool:
    escaped = re.escape(expected)
    attribute = re.compile(
        rf"\b(?i:data-calorieapp-build-id)\s*=\s*"
        rf"(?:(?P<quote>[\"']){escaped}(?P=quote)|{escaped}(?=[\s>]))"
    )
    return attribute.search(html) is not None


def request(url: str, *, method: str = "GET", headers: dict[str, str] | None = None):
    req = Request(url, method=method, headers=headers or {})
    with urlopen(req, timeout=30) as response:  # noqa: S310 - validated HTTPS origins only
        return response.status, dict(response.headers.items()), response.read()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend-url", required=True, type=origin)
    parser.add_argument("--frontend-url", required=True, type=origin)
    parser.add_argument("--expected-build-id", type=build_identifier)
    args = parser.parse_args()

    checks: list[tuple[str, bool, str]] = []
    try:
        status, _, body = request(f"{args.backend_url}/health")
        payload = json.loads(body)
        backend_ready = status == 200 and payload.get("status") == "ok"
        if args.expected_build_id:
            backend_ready = backend_ready and payload.get("build_id") == args.expected_build_id
        checks.append(("backend health", backend_ready, str(payload)))

        status, headers, _ = request(
            f"{args.backend_url}/health",
            method="OPTIONS",
            headers={
                "Origin": args.frontend_url,
                "Access-Control-Request-Method": "GET",
            },
        )
        normalized_headers = {name.lower(): value for name, value in headers.items()}
        allowed_origin = normalized_headers.get("access-control-allow-origin")
        checks.append(("credentialed CORS", status == 200 and allowed_origin == args.frontend_url, allowed_origin or "missing header"))

        status, _, body = request(args.frontend_url)
        html = body.decode("utf-8", errors="replace")
        checks.append(("frontend page", status == 200 and "Calorie" in html, f"HTTP {status}, {len(body)} bytes"))
        if args.expected_build_id:
            checks.append(
                (
                    "frontend build id",
                    frontend_build_identifier_matches(
                        html,
                        args.expected_build_id,
                    ),
                    args.expected_build_id,
                )
            )
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"[FAIL] deployment request failed: {exc}", file=sys.stderr)
        return 1

    failed = False
    for name, passed, detail in checks:
        print(f"[{'PASS' if passed else 'FAIL'}] {name}: {detail}")
        failed = failed or not passed
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
