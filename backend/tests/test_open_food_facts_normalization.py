import asyncio
import math
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.open_food_facts import (
    _MAX_UPSTREAM_ATTEMPTS_PER_SEARCH,
    _PRIMARY_MAX_ATTEMPTS,
    _FALLBACK_MAX_ATTEMPTS,
    _extract_nutri_score,
    _to_float,
    search_food_products,
)


def test_one_search_has_a_two_request_end_to_end_upstream_budget() -> None:
    assert _PRIMARY_MAX_ATTEMPTS == 1
    assert _FALLBACK_MAX_ATTEMPTS == 1
    assert _MAX_UPSTREAM_ATTEMPTS_PER_SEARCH == 2


@pytest.mark.parametrize(
    "value",
    [None, float("inf"), float("-inf"), float("nan"), "Infinity", "NaN", -1],
)
def test_to_float_marks_missing_or_invalid_upstream_values_as_unknown(value: object) -> None:
    assert _to_float(value) is None


@pytest.mark.parametrize("value", [0, "0", 12.345])
def test_to_float_preserves_real_finite_non_negative_values(value: object) -> None:
    result = _to_float(value)
    assert result is not None
    assert math.isfinite(result)


@pytest.mark.parametrize(
    ("value", "expected"),
    [("a", "A"), (" E ", "E"), ("unknown", None), ("not-applicable", None), (None, None)],
)
def test_extract_nutri_score_only_returns_supported_grades(
    value: object,
    expected: str | None,
) -> None:
    assert _extract_nutri_score({"nutriscore_grade": value}) == expected


@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_search_omits_products_with_unknown_nutrition(primary: AsyncMock) -> None:
    primary.return_value = {
        "products": [
            {
                "product_name": "Incomplete oats",
                "nutriments": {
                    "energy-kcal_100g": 375,
                    "proteins_100g": 13,
                    "fat_100g": 7,
                },
            },
            {
                "product_name": "Complete oats",
                "nutriments": {
                    "energy-kcal_100g": 375,
                    "proteins_100g": 13,
                    "fat_100g": 7,
                    "carbohydrates_100g": 60,
                },
            },
        ]
    }

    results = asyncio.run(search_food_products("oats"))

    assert [result.product_name for result in results] == ["Complete oats"]


@patch("app.services.open_food_facts._fetch_fallback", new_callable=AsyncMock)
@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_expected_fallback_failure_becomes_upstream_http_error(
    primary: AsyncMock,
    fallback: AsyncMock,
) -> None:
    primary.side_effect = ValueError("invalid primary payload")
    fallback.side_effect = ValueError("fallback unavailable")

    with pytest.raises(httpx.HTTPError, match="fallback unavailable"):
        asyncio.run(search_food_products("banana"))


@patch("app.services.open_food_facts._fetch_fallback", new_callable=AsyncMock)
@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_unexpected_fallback_programming_error_is_not_hidden(
    primary: AsyncMock,
    fallback: AsyncMock,
) -> None:
    primary.side_effect = ValueError("invalid primary payload")
    fallback.side_effect = RuntimeError("unexpected implementation failure")

    with pytest.raises(RuntimeError, match="unexpected implementation failure"):
        asyncio.run(search_food_products("banana"))


@patch("app.services.open_food_facts._fetch_fallback", new_callable=AsyncMock)
@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_upstream_http_status_does_not_bypass_limit_through_fallback(
    primary: AsyncMock,
    fallback: AsyncMock,
) -> None:
    request = httpx.Request("GET", "https://world.openfoodfacts.org/cgi/search.pl")
    response = httpx.Response(429, request=request)
    primary.side_effect = httpx.HTTPStatusError(
        "rate limited",
        request=request,
        response=response,
    )

    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(search_food_products("banana"))

    fallback.assert_not_awaited()


@patch("app.services.open_food_facts._fetch_fallback", new_callable=AsyncMock)
@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_primary_transport_error_uses_single_fallback_attempt(
    primary: AsyncMock,
    fallback: AsyncMock,
) -> None:
    request = httpx.Request("GET", "https://world.openfoodfacts.org/cgi/search.pl")
    primary.side_effect = httpx.ReadError("connection interrupted", request=request)
    fallback.return_value = {"products": []}

    assert asyncio.run(search_food_products("banana")) == []

    primary.assert_awaited_once()
    fallback.assert_awaited_once()
