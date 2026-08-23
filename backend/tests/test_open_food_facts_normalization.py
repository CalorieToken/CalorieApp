import asyncio
import math
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.open_food_facts import (
    _extract_nutri_score,
    _to_float,
    search_food_products,
)


@pytest.mark.parametrize("value", [float("inf"), float("-inf"), float("nan"), "Infinity", "NaN"])
def test_to_float_rejects_non_finite_upstream_values(value: object) -> None:
    result = _to_float(value)
    assert result == 0.0
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
