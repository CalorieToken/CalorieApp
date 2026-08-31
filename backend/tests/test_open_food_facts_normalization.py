import asyncio
import math
from collections.abc import Iterator
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.source_admission import AdapterAdmissionRejected
from app.services.open_food_facts import (
    _MAX_UPSTREAM_ATTEMPTS_PER_SEARCH,
    _OPEN_FOOD_FACTS_ADMISSION,
    _OPEN_FOOD_FACTS_RATE_GOVERNOR,
    _PRIMARY_MAX_ATTEMPTS,
    _FALLBACK_MAX_ATTEMPTS,
    _extract_nutri_score,
    _to_float,
    search_food_products,
)


@pytest.fixture(autouse=True)
def reset_open_food_facts_admission() -> Iterator[None]:
    _OPEN_FOOD_FACTS_ADMISSION._reset_for_tests()
    reset_governor = getattr(_OPEN_FOOD_FACTS_RATE_GOVERNOR, "_reset_for_tests", None)
    if reset_governor is not None:
        reset_governor()
    yield
    _OPEN_FOOD_FACTS_ADMISSION._reset_for_tests()
    if reset_governor is not None:
        reset_governor()


def test_one_search_has_a_two_request_end_to_end_upstream_budget() -> None:
    assert _PRIMARY_MAX_ATTEMPTS == 1
    assert _FALLBACK_MAX_ATTEMPTS == 1
    assert _MAX_UPSTREAM_ATTEMPTS_PER_SEARCH == 2


def test_open_food_facts_admission_configuration_is_bounded() -> None:
    assert _OPEN_FOOD_FACTS_ADMISSION.max_concurrency == 2
    assert _OPEN_FOOD_FACTS_ADMISSION.max_queue == 4
    assert _OPEN_FOOD_FACTS_ADMISSION.queue_timeout_seconds == 2.0
    assert _OPEN_FOOD_FACTS_ADMISSION.failure_threshold == 3
    assert _OPEN_FOOD_FACTS_ADMISSION.recovery_timeout_seconds == 30.0
    assert _OPEN_FOOD_FACTS_RATE_GOVERNOR.limit == 8
    assert _OPEN_FOOD_FACTS_RATE_GOVERNOR.window_seconds == 60


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
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class CountingGovernor:
        limit = 8
        window_seconds = 60

        def __init__(self) -> None:
            self.acquire_count = 0

        async def acquire(self) -> None:
            self.acquire_count += 1

    governor = CountingGovernor()
    monkeypatch.setattr(
        "app.services.open_food_facts._OPEN_FOOD_FACTS_RATE_GOVERNOR",
        governor,
    )
    request = httpx.Request("GET", "https://world.openfoodfacts.org/cgi/search.pl")
    primary.side_effect = httpx.ReadError("connection interrupted", request=request)
    fallback.return_value = {"products": []}

    assert asyncio.run(search_food_products("banana")) == []

    primary.assert_awaited_once()
    fallback.assert_awaited_once()
    assert governor.acquire_count == 2


@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_shared_rate_rejection_happens_before_upstream_network_access(
    primary: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class RejectingGovernor:
        limit = 8
        window_seconds = 60

        async def acquire(self) -> None:
            raise AdapterAdmissionRejected(
                "shared_provider_rate_limit",
                7,
                status_code=429,
            )

    monkeypatch.setattr(
        "app.services.open_food_facts._OPEN_FOOD_FACTS_RATE_GOVERNOR",
        RejectingGovernor(),
    )

    with pytest.raises(AdapterAdmissionRejected) as rejected:
        asyncio.run(search_food_products("banana"))
    assert rejected.value.status_code == 429
    assert rejected.value.retry_after_seconds == 7
    primary.assert_not_awaited()


@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_identical_concurrent_searches_make_one_upstream_attempt(
    primary: AsyncMock,
) -> None:
    async def scenario() -> None:
        started = asyncio.Event()
        release = asyncio.Event()

        async def fetch_once(params: dict) -> dict:
            started.set()
            await release.wait()
            return {"products": []}

        primary.side_effect = fetch_once
        first = asyncio.create_task(search_food_products("banana"))
        await started.wait()
        second = asyncio.create_task(search_food_products("banana"))
        await asyncio.sleep(0)
        release.set()

        assert await asyncio.gather(first, second) == [[], []]

    asyncio.run(scenario())
    primary.assert_awaited_once()
