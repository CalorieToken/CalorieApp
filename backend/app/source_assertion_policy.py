"""Versioned, source-neutral content policy for durable food assertions."""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from types import MappingProxyType


SOURCE_ASSERTION_CONTENT_POLICY_VERSION = "1.0.0"
SOURCE_ASSERTION_VALUE_MAX_LENGTH = 255
_PLAIN_NON_NEGATIVE_DECIMAL_PATTERN = re.compile(
    r"(?:0|[1-9][0-9]*)(?:\.(?P<fractional_digits>[0-9]+))?"
)


@dataclass(frozen=True)
class NumericAssertionPolicy:
    """One reviewed numeric assertion boundary."""

    unit: str
    minimum: Decimal
    maximum: Decimal
    max_fractional_digits: int = 6


SOURCE_ASSERTION_NUMERIC_POLICIES = MappingProxyType(
    {
        "nutrition.energy": NumericAssertionPolicy(
            unit="kcal-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("1000"),
        ),
        "nutrition.energy-kj": NumericAssertionPolicy(
            unit="kj-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("5000"),
        ),
        "nutrition.protein": NumericAssertionPolicy(
            unit="g-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("100"),
        ),
        "nutrition.fat": NumericAssertionPolicy(
            unit="g-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("100"),
        ),
        "nutrition.saturated-fat": NumericAssertionPolicy(
            unit="g-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("100"),
        ),
        "nutrition.carbohydrates": NumericAssertionPolicy(
            unit="g-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("100"),
        ),
        "nutrition.sugars": NumericAssertionPolicy(
            unit="g-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("100"),
        ),
        "nutrition.fiber": NumericAssertionPolicy(
            unit="g-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("100"),
        ),
        "nutrition.salt": NumericAssertionPolicy(
            unit="g-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("100"),
        ),
        "nutrition.sodium": NumericAssertionPolicy(
            unit="g-per-100g",
            minimum=Decimal("0"),
            maximum=Decimal("100"),
        ),
    }
)


def normalize_source_assertion_value(
    *,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
) -> str:
    """Validate and canonicalize one value before any durable database work."""

    policy = SOURCE_ASSERTION_NUMERIC_POLICIES.get(attribute_key)
    if policy is None:
        raise ValueError("attribute_key is not in the reviewed assertion policy")
    if unit_or_value_type != policy.unit:
        raise ValueError("unit_or_value_type does not match the attribute policy")
    if not isinstance(value, str) or len(value) > SOURCE_ASSERTION_VALUE_MAX_LENGTH:
        raise ValueError(
            "value must be a string with at most "
            f"{SOURCE_ASSERTION_VALUE_MAX_LENGTH} characters"
        )
    value_match = _PLAIN_NON_NEGATIVE_DECIMAL_PATTERN.fullmatch(value)
    fractional_digits = (
        value_match.group("fractional_digits") if value_match is not None else None
    )
    if value_match is None or len(fractional_digits or "") > policy.max_fractional_digits:
        raise ValueError(
            "value must be a non-negative decimal with at most "
            f"{policy.max_fractional_digits} fractional digits"
        )
    try:
        numeric_value = Decimal(value)
    except InvalidOperation as exc:  # pragma: no cover - guarded by the pattern
        raise ValueError("value is not a valid decimal") from exc
    if not policy.minimum <= numeric_value <= policy.maximum:
        raise ValueError("value is outside the reviewed attribute range")

    canonical = format(numeric_value.normalize(), "f")
    return "0" if numeric_value == 0 else canonical


def source_assertion_policy_snapshot() -> dict[str, dict[str, str | int]]:
    """Return deterministic public evidence for contract drift tests."""

    return {
        attribute_key: {
            "unit": policy.unit,
            "minimum": format(policy.minimum, "f"),
            "maximum": format(policy.maximum, "f"),
            "max_fractional_digits": policy.max_fractional_digits,
        }
        for attribute_key, policy in SOURCE_ASSERTION_NUMERIC_POLICIES.items()
    }
