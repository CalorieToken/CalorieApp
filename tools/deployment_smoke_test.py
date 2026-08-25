#!/usr/bin/env python3
"""Verify a deployed CalorieApp frontend/backend pair without changing data."""

from __future__ import annotations

import argparse
import json
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


def request(url: str, *, method: str = "GET", headers: dict[str, str] | None = None):
    req = Request(url, method=method, headers=headers or {})
    with urlopen(req, timeout=30) as response:  # noqa: S310 - validated HTTPS origins only
        return response.status, dict(response.headers.items()), response.read()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend-url", required=True, type=origin)
    parser.add_argument("--frontend-url", required=True, type=origin)
    args = parser.parse_args()

    checks: list[tuple[str, bool, str]] = []
    try:
        status, _, body = request(f"{args.backend_url}/health")
        payload = json.loads(body)
        checks.append(("backend health", status == 200 and payload.get("status") == "ok", str(payload)))

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
