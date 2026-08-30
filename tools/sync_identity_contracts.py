#!/usr/bin/env python3
"""Validate and synchronize deployable Identity Bridge contract copies."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_DIR = ROOT / "contracts" / "identity-bridge" / "v1"
CANONICAL_LOCALES = CONTRACT_DIR / "locales.json"
SECURITY_CONTRACT = CONTRACT_DIR / "security.json"
LOCALE_TARGETS = (
    ROOT / "backend" / "app" / "data" / "locales.json",
    ROOT / "frontend" / "config" / "locales.json",
    ROOT
    / "wordpress-plugins"
    / "calorieapp-identity-bridge"
    / "config"
    / "locales.json",
)
EXPECTED_LOCALE_ORDER = (
    "en",
    "zh-Hans",
    "hi",
    "es",
    "ar",
    "fr",
    "bn",
    "pt",
    "id",
    "ur",
    "nl",
)
EXPECTED_RTL_LOCALES = {"ar", "ur"}


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Unable to read valid JSON from {path.relative_to(ROOT)}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path.relative_to(ROOT)}")
    return value


def validate_locale_registry(registry: dict[str, Any]) -> None:
    if registry.get("contract_id") != "gallery-token.locale-registry":
        raise ValueError("Unexpected locale contract_id")
    if registry.get("source_locale") != "en" or registry.get("fallback_locale") != "en":
        raise ValueError("English must remain the source and fallback locale")

    locales = registry.get("locales")
    if not isinstance(locales, list):
        raise ValueError("locales must be a list")
    tags = tuple(locale.get("tag") for locale in locales if isinstance(locale, dict))
    if tags != EXPECTED_LOCALE_ORDER:
        raise ValueError(
            "Locale order or membership changed; update the frozen v1 decision explicitly"
        )
    if len(set(tags)) != len(tags):
        raise ValueError("Locale tags must be unique")

    sources = [locale for locale in locales if locale.get("source") is True]
    if len(sources) != 1 or sources[0].get("tag") != "en":
        raise ValueError("English must be the sole source locale")

    rtl_tags = {locale["tag"] for locale in locales if locale.get("direction") == "rtl"}
    if rtl_tags != EXPECTED_RTL_LOCALES:
        raise ValueError("Arabic and Urdu must be the only v1 RTL locales")

    identifiers: dict[str, str] = {}
    for locale in locales:
        tag = locale["tag"]
        if locale.get("direction") not in {"ltr", "rtl"}:
            raise ValueError(f"Invalid direction for {tag}")
        for field in ("english_name", "native_name"):
            if not isinstance(locale.get(field), str) or not locale[field].strip():
                raise ValueError(f"{field} is required for {tag}")
        aliases = locale.get("aliases")
        if not isinstance(aliases, list):
            raise ValueError(f"aliases must be a list for {tag}")
        for identifier in [tag, *aliases]:
            normalized = identifier.replace("_", "-").lower()
            previous = identifiers.get(normalized)
            if previous is not None and previous != tag:
                raise ValueError(f"Locale identifier {identifier} is ambiguous")
            identifiers[normalized] = tag


def validate_security_contract(contract: dict[str, Any]) -> None:
    if contract.get("contract_id") != "calorieapp.identity-bridge.security":
        raise ValueError("Unexpected security contract_id")
    if contract.get("protocol_version") != "v1":
        raise ValueError("IB-1 freezes protocol_version at v1")
    if contract.get("login_state", {}).get("ttl_seconds") != 300:
        raise ValueError("Login-state TTL must remain 300 seconds in v1")
    if contract.get("authorization_code", {}).get("default_ttl_seconds") != 60:
        raise ValueError("Authorization-code default TTL must remain 60 seconds in v1")
    if contract.get("integrated_login_flow", {}).get("ttl_seconds") != 600:
        raise ValueError("Integrated-login flow TTL must remain 600 seconds in v1")
    if contract.get("application_session", {}).get("absolute_ttl_seconds") != 28800:
        raise ValueError("Application-session absolute TTL must remain 28800 seconds in v1")
    if contract.get("application_session", {}).get("idle_ttl_seconds") != 1800:
        raise ValueError("Application-session idle TTL must remain 1800 seconds in v1")
    if contract.get("identity_claims", {}).get("personal_profile_fields_enabled_by_default") != []:
        raise ValueError("Personal profile fields must remain opt-in and disabled by default")
    localization = contract.get("localization", {})
    if localization.get("source_locale") != "en" or localization.get("fallback_locale") != "en":
        raise ValueError("Security and locale contracts disagree about English fallback")
    if set(localization.get("rtl_locales", [])) != EXPECTED_RTL_LOCALES:
        raise ValueError("Security and locale contracts disagree about RTL locales")


def synchronize(*, check: bool) -> list[Path]:
    registry = _read_json(CANONICAL_LOCALES)
    validate_locale_registry(registry)
    validate_security_contract(_read_json(SECURITY_CONTRACT))
    source = CANONICAL_LOCALES.read_bytes()
    stale: list[Path] = []

    for target in LOCALE_TARGETS:
        if target.is_file() and target.read_bytes() == source:
            continue
        stale.append(target)
        if not check:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source)
    return stale


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate contracts and fail instead of updating stale runtime copies.",
    )
    args = parser.parse_args()

    try:
        stale = synchronize(check=args.check)
    except ValueError as exc:
        print(f"identity contract validation failed: {exc}", file=sys.stderr)
        return 1

    if args.check and stale:
        print("Identity contract copies are stale:", file=sys.stderr)
        for path in stale:
            print(f"- {path.relative_to(ROOT)}", file=sys.stderr)
        print("Run: python tools/sync_identity_contracts.py", file=sys.stderr)
        return 1

    action = "validated" if args.check else "synchronized"
    print(f"Identity contracts {action}; {len(LOCALE_TARGETS)} runtime copies are current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
