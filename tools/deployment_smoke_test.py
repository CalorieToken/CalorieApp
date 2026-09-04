#!/usr/bin/env python3
"""Verify a deployed CalorieApp frontend/backend pair without changing data."""

from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urljoin, urlsplit
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


def public_https_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise argparse.ArgumentTypeError(
            "URL must be public HTTPS without credentials, query, or fragment"
        )
    return value.strip()


def plugin_version(value: str) -> str:
    candidate = value.strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", candidate):
        raise argparse.ArgumentTypeError("plugin version must be semantic")
    return candidate


class WordPressEmbedInspection(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.embed_count = 0
        self.iframe_sources: list[str] = []
        self.script_sources: list[str] = []
        self.style_sources: list[str] = []
        self.site_return_urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = set((values.get("class") or "").split())
        if "data-calorieapp-embed" in values:
            self.embed_count += 1
            self.site_return_urls.append(values.get("data-site-return-url") or "")
        if tag == "iframe" and "calorieapp-embed-frame" in classes:
            self.iframe_sources.append(values.get("src") or "")
        if tag == "script" and values.get("id") == "calorieapp-identity-bridge-embed-js":
            self.script_sources.append(values.get("src") or "")
        if tag == "link" and values.get("id") == "calorieapp-identity-bridge-embed-css":
            self.style_sources.append(values.get("href") or "")


def same_origin(left: str, right: str) -> bool:
    left_url = urlsplit(left)
    right_url = urlsplit(right)
    return (left_url.scheme, left_url.netloc) == (right_url.scheme, right_url.netloc)


def versioned_plugin_asset(
    asset_url: str,
    wordpress_url: str,
    expected_path: str,
    expected_version: str,
) -> bool:
    resolved = urljoin(wordpress_url, asset_url)
    parsed = urlsplit(resolved)
    return (
        same_origin(resolved, wordpress_url)
        and parsed.path.endswith(expected_path)
        and parse_qs(parsed.query).get("ver") == [expected_version]
    )


def inspect_wordpress_embed(
    html: str,
    wordpress_url: str,
    frontend_url: str,
    expected_plugin_version: str,
) -> tuple[bool, str | None, str]:
    inspection = WordPressEmbedInspection()
    inspection.feed(html)

    iframe_ok = False
    if len(inspection.iframe_sources) == 1:
        iframe_url = urlsplit(urljoin(wordpress_url, inspection.iframe_sources[0]))
        expected_frontend = urlsplit(frontend_url)
        iframe_ok = (
            (iframe_url.scheme, iframe_url.netloc)
            == (expected_frontend.scheme, expected_frontend.netloc)
            and iframe_url.path in {"", "/"}
            and parse_qs(iframe_url.query).get("embedded") == ["1"]
        )

    script_ok = (
        len(inspection.script_sources) == 1
        and versioned_plugin_asset(
            inspection.script_sources[0],
            wordpress_url,
            "/calorieapp-identity-bridge/assets/calorieapp-embed.js",
            expected_plugin_version,
        )
    )
    style_ok = (
        len(inspection.style_sources) == 1
        and versioned_plugin_asset(
            inspection.style_sources[0],
            wordpress_url,
            "/calorieapp-identity-bridge/assets/calorieapp-embed.css",
            expected_plugin_version,
        )
    )
    site_return_ok = False
    if len(inspection.site_return_urls) == 1:
        resolved_return = urlsplit(
            urljoin(wordpress_url, inspection.site_return_urls[0])
        )
        expected_return = urlsplit(wordpress_url)
        site_return_ok = (
            (resolved_return.scheme, resolved_return.netloc, resolved_return.path)
            == (expected_return.scheme, expected_return.netloc, expected_return.path)
            and not resolved_return.query
            and not resolved_return.fragment
            and not resolved_return.username
            and not resolved_return.password
        )
    passed = (
        inspection.embed_count == 1
        and iframe_ok
        and script_ok
        and style_ok
        and site_return_ok
    )
    script_url = (
        urljoin(wordpress_url, inspection.script_sources[0])
        if script_ok
        else None
    )
    detail = (
        f"embeds={inspection.embed_count}, iframes={len(inspection.iframe_sources)}, "
        f"script_version={script_ok}, style_version={style_ok}, "
        f"site_return={site_return_ok}"
    )
    return passed, script_url, detail


def mobile_return_contract_matches(script: str) -> bool:
    required_patterns = (
        re.compile(
            r"\bfunction\s+unifyLegacySigninSurfaces\s*\(\s*"
            r"triggerLogin\s*,\s*sessionActions\s*\)"
        ),
        re.compile(r"\bopenLink\s*\.\s*target\s*=\s*([\"'])_self\1\s*;?"),
        re.compile(
            r"\bdocument\s*\.\s*addEventListener\s*\(\s*([\"'])"
            r"visibilitychange\1\s*,\s*trackXamanVisibility\s*\)\s*;?"
        ),
        re.compile(
            r"\bwindow\s*\.\s*addEventListener\s*\(\s*([\"'])"
            r"focus\1\s*,\s*checkAfterReturn\s*\)\s*;?"
        ),
        re.compile(
            r"\bwindow\s*\.\s*addEventListener\s*\(\s*([\"'])"
            r"pageshow\1\s*,\s*checkAfterReturn\s*\)\s*;?"
        ),
        re.compile(
            r"\bsigninLink\s*\.\s*setAttribute\s*\(\s*([\"'])"
            r"data-calorieapp-unified-login\1\s*,\s*([\"'])1\2\s*\)\s*;?"
        ),
        re.compile(r"Sign once, then tap Close or use Back to return to this browser"),
        re.compile(r"\bevent\s*\.\s*preventDefault\s*\(\s*\)\s*;?"),
        re.compile(
            r"\bMESSAGE_PREFIX\s*\+\s*([\"'])bridge:initialized\1"
        ),
        re.compile(r"\bMESSAGE_PREFIX\s*\+\s*([\"'])logout\1"),
        re.compile(r"\bMESSAGE_PREFIX\s*\+\s*([\"'])logout:request\1"),
        re.compile(
            r"\bidentityCard\s*\.\s*appendChild\s*\(\s*sessionActions\s*\)"
        ),
        re.compile(r"\bwindow\s*\.\s*location\s*\.\s*reload\s*\(\s*\)"),
        re.compile(
            r"\blogoutTimeoutTimer\s*=\s*window\s*\.\s*setTimeout\s*\("
        ),
        re.compile(
            r"\bwindow\s*\.\s*location\s*\.\s*assign\s*\(\s*"
            r"siteLogoutButton\s*\.\s*dataset\s*\.\s*logoutUrl\s*\)"
        ),
    )
    forbidden_return_url = re.compile(r"\breturn_url\s*:")
    return (
        all(pattern.search(script) for pattern in required_patterns)
        and forbidden_return_url.search(script) is None
    )


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
    parser.add_argument("--wordpress-url", required=True, type=public_https_url)
    parser.add_argument("--expected-build-id", required=True, type=build_identifier)
    parser.add_argument(
        "--expected-plugin-version", required=True, type=plugin_version
    )
    args = parser.parse_args()

    checks: list[tuple[str, bool, str]] = []
    try:
        status, _, body = request(f"{args.backend_url}/health")
        payload = json.loads(body)
        backend_ready = (
            status == 200
            and payload.get("status") == "ok"
            and payload.get("build_id") == args.expected_build_id
        )
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

        status, _, body = request(args.wordpress_url)
        wordpress_html = body.decode("utf-8", errors="replace")
        wordpress_ready, script_url, detail = inspect_wordpress_embed(
            wordpress_html,
            args.wordpress_url,
            args.frontend_url,
            args.expected_plugin_version,
        )
        checks.append(
            ("WordPress integrated entry", status == 200 and wordpress_ready, detail)
        )

        if script_url is None:
            checks.append(("mobile Xaman return contract", False, "script missing"))
        else:
            status, _, body = request(script_url)
            script = body.decode("utf-8", errors="replace")
            checks.append(
                (
                    "mobile Xaman return contract",
                    status == 200 and mobile_return_contract_matches(script),
                    f"HTTP {status}, plugin {args.expected_plugin_version}",
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
