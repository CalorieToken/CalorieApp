"""Shared locale resolution for CalorieApp identity and UI surfaces."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator, Optional


REGISTRY_PATH = Path(__file__).with_name("data") / "locales.json"


@lru_cache(maxsize=1)
def locale_registry() -> dict[str, Any]:
    """Load the deployable copy of the frozen v1 locale registry."""
    try:
        value = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("CalorieApp locale registry is unavailable") from exc
    if not isinstance(value, dict) or not isinstance(value.get("locales"), list):
        raise RuntimeError("CalorieApp locale registry is malformed")
    return value


def supported_locale_tags() -> tuple[str, ...]:
    return tuple(locale["tag"] for locale in locale_registry()["locales"])


@lru_cache(maxsize=1)
def _locale_identifier_map() -> dict[str, str]:
    identifiers: dict[str, str] = {}
    for locale in locale_registry()["locales"]:
        tag = locale["tag"]
        for identifier in [tag, *locale.get("aliases", [])]:
            identifiers[_normalize_identifier(identifier)] = tag
    return identifiers


def _normalize_identifier(value: str) -> str:
    return value.strip().replace("_", "-").lower()


def _requested_candidates(value: Optional[str]) -> Iterator[str]:
    if not value:
        return
    for part in value.split(","):
        candidate = part.split(";", 1)[0].strip()
        if candidate and candidate != "*":
            yield _normalize_identifier(candidate)


def resolve_locale(value: Optional[str]) -> str:
    """Resolve a locale tag or Accept-Language-like value with English fallback."""
    registry = locale_registry()
    identifiers = _locale_identifier_map()
    canonical_primary_tags = {
        locale["tag"].lower(): locale["tag"]
        for locale in registry["locales"]
        if "-" not in locale["tag"]
    }

    for candidate in _requested_candidates(value):
        exact = identifiers.get(candidate)
        if exact:
            return exact
        primary = candidate.split("-", 1)[0]
        if primary in canonical_primary_tags:
            return canonical_primary_tags[primary]
    return registry["fallback_locale"]


def locale_direction(value: Optional[str]) -> str:
    resolved = resolve_locale(value)
    for locale in locale_registry()["locales"]:
        if locale["tag"] == resolved:
            return locale["direction"]
    return "ltr"
