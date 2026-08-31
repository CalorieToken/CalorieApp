from __future__ import annotations

from decimal import Decimal
from types import MappingProxyType

import pytest

import app.source_assertion_policy as source_assertion_policy
from app.source_assertion_policy import (
    SOURCE_ASSERTION_CONTENT_POLICY_VERSION,
    NumericAssertionPolicy,
    normalize_source_assertion_value,
    source_assertion_policy_snapshot,
)


def test_initial_policy_is_bounded_source_neutral_and_nutrition_only() -> None:
    policy = source_assertion_policy_snapshot()

    assert SOURCE_ASSERTION_CONTENT_POLICY_VERSION == "1.0.0"
    assert policy == {
        "nutrition.energy": {
            "unit": "kcal-per-100g",
            "minimum": "0",
            "maximum": "1000",
            "max_fractional_digits": 6,
        },
        "nutrition.energy-kj": {
            "unit": "kj-per-100g",
            "minimum": "0",
            "maximum": "5000",
            "max_fractional_digits": 6,
        },
        **{
            key: {
                "unit": "g-per-100g",
                "minimum": "0",
                "maximum": "100",
                "max_fractional_digits": 6,
            }
            for key in (
                "nutrition.protein",
                "nutrition.fat",
                "nutrition.saturated-fat",
                "nutrition.carbohydrates",
                "nutrition.sugars",
                "nutrition.fiber",
                "nutrition.salt",
                "nutrition.sodium",
            )
        },
    }
    assert all(key.startswith("nutrition.") for key in policy)


@pytest.mark.parametrize(
    ("attribute_key", "value", "unit", "expected"),
    [
        ("nutrition.energy", "0.000000", "kcal-per-100g", "0"),
        ("nutrition.energy", "123.450000", "kcal-per-100g", "123.45"),
        ("nutrition.energy-kj", "5000", "kj-per-100g", "5000"),
        ("nutrition.protein", "7.5", "g-per-100g", "7.5"),
        ("nutrition.sodium", "0.001", "g-per-100g", "0.001"),
    ],
)
def test_policy_normalizes_reviewed_numeric_values(
    attribute_key: str,
    value: str,
    unit: str,
    expected: str,
) -> None:
    assert (
        normalize_source_assertion_value(
            attribute_key=attribute_key,
            value=value,
            unit_or_value_type=unit,
        )
        == expected
    )


def test_policy_enforces_attribute_specific_fractional_digit_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        source_assertion_policy,
        "SOURCE_ASSERTION_NUMERIC_POLICIES",
        MappingProxyType(
            {
                "nutrition.energy": NumericAssertionPolicy(
                    unit="kcal-per-100g",
                    minimum=Decimal("0"),
                    maximum=Decimal("1000"),
                    max_fractional_digits=2,
                )
            }
        ),
    )

    assert (
        normalize_source_assertion_value(
            attribute_key="nutrition.energy",
            value="12.30",
            unit_or_value_type="kcal-per-100g",
        )
        == "12.3"
    )
    with pytest.raises(ValueError, match="at most 2 fractional digits"):
        normalize_source_assertion_value(
            attribute_key="nutrition.energy",
            value="12.345",
            unit_or_value_type="kcal-per-100g",
        )


@pytest.mark.parametrize(
    ("attribute_key", "value", "unit"),
    [
        ("product.name", "100", "text"),
        ("nutrition.energy", "100", "g-per-100g"),
        ("nutrition.protein", "101", "g-per-100g"),
        ("nutrition.energy", "1000.000001", "kcal-per-100g"),
        ("nutrition.energy", "-1", "kcal-per-100g"),
        ("nutrition.energy", "+1", "kcal-per-100g"),
        ("nutrition.energy", "1e2", "kcal-per-100g"),
        ("nutrition.energy", "01", "kcal-per-100g"),
        ("nutrition.energy", "1.0000000", "kcal-per-100g"),
        ("nutrition.energy", "person@example.test", "kcal-per-100g"),
        ("nutrition.energy", "https://example.test/raw", "kcal-per-100g"),
    ],
)
def test_policy_rejects_unknown_units_ranges_and_arbitrary_text(
    attribute_key: str,
    value: str,
    unit: str,
) -> None:
    with pytest.raises(ValueError):
        normalize_source_assertion_value(
            attribute_key=attribute_key,
            value=value,
            unit_or_value_type=unit,
        )
