from datetime import UTC, datetime, timedelta
from email.utils import format_datetime

import pytest

from app.schemas import FoodSearchResult
from app.services.food_search_availability import (
    FoodSearchAvailability,
    FoodSearchUnavailable,
    provider_retry_seconds,
)


def food(name: str) -> list[FoodSearchResult]:
    return [FoodSearchResult(product_name=name, calories=100, protein=5, fat=2, carbohydrates=20)]


def test_cache_is_bounded_and_keeps_queries_and_page_sizes_separate() -> None:
    state = FoodSearchAvailability(max_entries=2)
    original = food("Oats")
    state.remember("oats", 10, original)
    original[0].product_name = "changed"
    state.remember("oats", 20, food("More oats"))
    assert state.get("oats", 10)[0].product_name == "Oats"
    state.remember("apple", 10, food("Apple"))
    assert state.get("oats", 20) is None  # least recently used
    assert state.get("oats", 10)[0].product_name == "Oats"
    assert state.get("apple", 10)[0].product_name == "Apple"
    assert state.get("apple", 20) is None


def test_overlapping_failure_cannot_shorten_provider_cooldown() -> None:
    now = [0.0]
    state = FoodSearchAvailability(clock=lambda: now[0])
    state.pause_provider(429, 120)
    now[0] = 10
    state.pause_provider(503, 30)
    with pytest.raises(FoodSearchUnavailable) as error:
        state.check_provider()
    assert error.value.status_code == 429
    assert error.value.retry_after_seconds == 110
    now[0] = 120
    state.check_provider()


@pytest.mark.parametrize("value", [None, "", "invalid", "-1", "NaN", "Infinity", "\r\nbad"])
def test_missing_or_invalid_retry_after_uses_a_safe_default(value: str | None) -> None:
    assert provider_retry_seconds(value) == 30


def test_retry_after_preserves_long_pauses_and_accepts_http_dates() -> None:
    assert provider_retry_seconds(" 7200 ") == 7200
    future = format_datetime(datetime.now(UTC) + timedelta(seconds=180), usegmt=True)
    assert 179 <= provider_retry_seconds(future) <= 180
    past = format_datetime(datetime.now(UTC) - timedelta(seconds=10), usegmt=True)
    assert provider_retry_seconds(past) == 30
