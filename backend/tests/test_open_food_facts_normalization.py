import asyncio
import math
import subprocess
from email.message import Message
from urllib.error import HTTPError as UrllibHTTPError
from collections.abc import Iterator
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.source_admission import AdapterAdmissionRejected
from app.services.food_search_availability import FoodSearchAvailability, FoodSearchUnavailable
from app.services.open_food_facts import (
    _MAX_UPSTREAM_ATTEMPTS_PER_SEARCH,
    _OPEN_FOOD_FACTS_ADMISSION,
    _OPEN_FOOD_FACTS_RATE_GOVERNOR,
    _OPEN_FOOD_FACTS_AVAILABILITY,
    _PRIMARY_MAX_ATTEMPTS,
    _FALLBACK_MAX_ATTEMPTS,
    _extract_nutri_score,
    _curl_fetch,
    _to_float,
    search_food_products,
)


@pytest.fixture(autouse=True)
def reset_open_food_facts_admission() -> Iterator[None]:
    _OPEN_FOOD_FACTS_ADMISSION._reset_for_tests()
    _OPEN_FOOD_FACTS_AVAILABILITY.reset()
    reset_governor = getattr(_OPEN_FOOD_FACTS_RATE_GOVERNOR, "_reset_for_tests", None)
    if reset_governor is not None:
        reset_governor()
    yield
    _OPEN_FOOD_FACTS_ADMISSION._reset_for_tests()
    _OPEN_FOOD_FACTS_AVAILABILITY.reset()
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
    [None, True, False, [], {}, float("inf"), float("-inf"), float("nan"), "Infinity", "NaN", -1],
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


@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_one_malformed_provider_record_does_not_discard_valid_foods(primary: AsyncMock) -> None:
    good = {"product_name": "Oats", "nutriments": {
        "energy-kcal_100g": 375, "proteins_100g": 13, "fat_100g": 7, "carbohydrates_100g": 60,
    }}
    primary.return_value = {"products": [None, "wrong type", {"product_name": 12},
        {"product_name": "Invalid nutrients", "nutriments": []}, good]}
    results = asyncio.run(search_food_products("oats"))
    assert [result.product_name for result in results] == ["Oats"]


@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_search_results_can_be_saved_without_truncating_provider_identity(primary: AsyncMock) -> None:
    from app.schemas import FoodLogCreate
    good = {"product_name": "Oats", "nutriments": {
        "energy-kcal_100g": 375, "proteins_100g": 13, "fat_100g": 7, "carbohydrates_100g": 60,
    }}
    primary.return_value = {"products": [good, {**good, "product_name": "x" * 121},
        {**good, "brands": "x" * 161}, {**good, "image_url": "https://example.test/" + "x" * 500}]}
    results = asyncio.run(search_food_products("oats"))
    assert [result.product_name for result in results] == ["Oats"]
    assert FoodLogCreate.model_validate(results[0].model_dump()).product_name == "Oats"


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
@pytest.mark.parametrize("status", [429, 503])
def test_upstream_http_status_does_not_bypass_limit_through_fallback(
    primary: AsyncMock,
    fallback: AsyncMock,
    status: int,
) -> None:
    request = httpx.Request("GET", "https://world.openfoodfacts.org/cgi/search.pl")
    response = httpx.Response(status, headers={"Retry-After": "120"}, request=request)
    primary.side_effect = httpx.HTTPStatusError(
        "rate limited",
        request=request,
        response=response,
    )

    with pytest.raises(FoodSearchUnavailable) as first:
        asyncio.run(search_food_products("banana"))
    assert first.value.status_code == status
    assert first.value.retry_after_seconds == 120

    # A different query must not send more source traffic during its pause.
    with pytest.raises(FoodSearchUnavailable) as repeated:
        asyncio.run(search_food_products("apple"))
    assert repeated.value.status_code == status
    assert 119 <= repeated.value.retry_after_seconds <= 120
    primary.assert_awaited_once()

    fallback.assert_not_awaited()


@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_cached_success_survives_provider_outage_then_expires(
    primary: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = [0.0]
    availability = FoodSearchAvailability(ttl_seconds=300, clock=lambda: now[0])
    monkeypatch.setattr("app.services.open_food_facts._OPEN_FOOD_FACTS_AVAILABILITY", availability)
    product = {"product_name": "Oats", "nutriments": {
        "energy-kcal_100g": 375, "proteins_100g": 13,
        "fat_100g": 7, "carbohydrates_100g": 60,
    }}
    primary.return_value = {"products": [product]}
    first = asyncio.run(search_food_products("oats"))
    first[0].product_name = "caller mutation"

    assert asyncio.run(search_food_products(" oats "))[0].product_name == "Oats"
    primary.assert_awaited_once()

    request = httpx.Request("GET", "https://world.openfoodfacts.org/cgi/search.pl")
    primary.side_effect = httpx.HTTPStatusError(
        "down", request=request,
        response=httpx.Response(503, headers={"Retry-After": "600"}, request=request),
    )
    with pytest.raises(FoodSearchUnavailable):
        asyncio.run(search_food_products("apple"))
    assert asyncio.run(search_food_products("oats"))[0].product_name == "Oats"
    assert primary.await_count == 2

    now[0] = 301
    with pytest.raises(FoodSearchUnavailable):
        asyncio.run(search_food_products("oats"))
    assert primary.await_count == 2

    now[0] = 601
    primary.side_effect = None
    assert asyncio.run(search_food_products("oats"))[0].product_name == "Oats"
    assert primary.await_count == 3


@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_empty_results_are_not_cached(primary: AsyncMock) -> None:
    primary.return_value = {"products": []}
    assert asyncio.run(search_food_products("oats")) == []
    assert asyncio.run(search_food_products("oats")) == []
    assert primary.await_count == 2


@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_pause_started_during_rate_reservation_stops_the_pending_transfer(
    primary: AsyncMock, monkeypatch: pytest.MonkeyPatch,
) -> None:
    primary.return_value = {"products": []}
    class Governor:
        async def acquire(self) -> None:
            # Another in-flight search can report 503 while this reservation
            # waits for the shared database governor.
            _OPEN_FOOD_FACTS_AVAILABILITY.pause_provider(503, 120)

    monkeypatch.setattr("app.services.open_food_facts._OPEN_FOOD_FACTS_RATE_GOVERNOR", Governor())
    with pytest.raises(FoodSearchUnavailable):
        asyncio.run(search_food_products("oats"))
    primary.assert_not_awaited()


@pytest.mark.parametrize("exit_code", [6, 7, 28, 60])
def test_curl_transport_failure_keeps_exit_code_without_logging_private_stderr(
    exit_code: int, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr("app.services.open_food_facts._resolve_curl_command", lambda: "curl")
    transfer = subprocess.CompletedProcess(
        ["curl"], exit_code, stdout=b"", stderr=b"error mentioning private-search-term",
    )
    monkeypatch.setattr("app.services.open_food_facts.subprocess.run", lambda *a, **k: transfer)
    with pytest.raises(ValueError, match=f"curl transport failed \\(exit {exit_code}\\)"):
        _curl_fetch({"search_terms": "private-search-term"})
    messages = [r.getMessage() for r in caplog.records]
    assert any(f"exit={exit_code}" in message for message in messages)
    assert all("private-search-term" not in message for message in messages)


@pytest.mark.parametrize("transport", ["curl", "urllib"])
@pytest.mark.parametrize("status", [429, 503])
@patch("app.services.open_food_facts._fetch_primary", new_callable=AsyncMock)
def test_fallback_provider_pause_is_preserved_without_a_third_attempt(
    primary: AsyncMock, transport: str, status: int, monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import Mock

    primary.side_effect = httpx.ReadTimeout("primary timed out")
    monkeypatch.setattr(
        "app.services.open_food_facts._resolve_curl_command",
        lambda: "curl" if transport == "curl" else None,
    )
    if transport == "curl":
        transfer = Mock(return_value=subprocess.CompletedProcess(
            ["curl"], 22,
            stdout=(f"HTTP/1.1 200 Connection established\r\n\r\n"
                    f"HTTP/2 {status}\r\nRetry-After: 120\r\n\r\n\n{status}").encode(),
            stderr=b"provider unavailable",
        ))
        monkeypatch.setattr("app.services.open_food_facts.subprocess.run", transfer)
    else:
        headers = Message()
        headers["Retry-After"] = "120"
        transfer = Mock(side_effect=UrllibHTTPError(
            "https://world.openfoodfacts.org/cgi/search.pl", status, "unavailable", headers, None,
        ))
        monkeypatch.setattr("app.services.open_food_facts.urlopen", transfer)

    with pytest.raises(FoodSearchUnavailable) as failure:
        asyncio.run(search_food_products("banana"))
    assert failure.value.status_code == status
    assert failure.value.retry_after_seconds == 120
    with pytest.raises(FoodSearchUnavailable):
        asyncio.run(search_food_products("apple"))
    primary.assert_awaited_once()
    transfer.assert_called_once()


def test_curl_success_strips_transfer_headers_but_preserves_utf8_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.open_food_facts._resolve_curl_command", lambda: "curl")
    transfer = subprocess.CompletedProcess(
        ["curl"], 0,
        stdout=(b"HTTP/1.1 200 Connection established\r\n\r\n"
                b"HTTP/2 301\r\nLocation: https://world.openfoodfacts.org/\r\n\r\n"
                b'HTTP/2 200\r\nContent-Type: application/json\r\n\r\n'
                + '{"products":[{"product_name":"Crème"}]}\n200'.encode()),
        stderr=b"",
    )
    monkeypatch.setattr("app.services.open_food_facts.subprocess.run", lambda *a, **k: transfer)
    assert _curl_fetch({"search_terms": "cream"}) == {"products": [{"product_name": "Crème"}]}


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


def test_indexed_search_uses_literal_multilingual_query_and_preserves_food_data(monkeypatch: pytest.MonkeyPatch) -> None:
    import json
    from app.services.open_food_facts import _fetch_primary, _normalize_products
    seen = []
    product = {'code': '7622210410900', 'product_name': 'Evergreen Krenten',
               'brands': ['Liga', 'Other brand'], 'image_front_url': 'https://images.openfoodfacts.org/example.jpg',
               'nutriments': {'energy-kcal_100g': 383, 'proteins_100g': 6.9, 'fat_100g': 9.1, 'carbohydrates_100g': 65}}
    def respond(request):
        seen.append(request)
        return httpx.Response(200, json={'hits': [product], 'timed_out': False})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(respond), trust_env=False, **kwargs))
    payload = asyncio.run(_fetch_primary({'search_terms': 'liga (milk) OR *:*', 'page_size': 10}))
    request = seen[0]
    assert request.method == 'POST'
    assert str(request.url) == 'https://search.openfoodfacts.org/search'
    body = json.loads(request.content)
    assert body['q'] == r'liga \(milk\) or \*\:\*'
    assert {'nl', 'en', 'ar', 'zh'} <= set(body['langs'])
    assert {'nutriments', 'images', 'lc', 'image_front_url'} <= set(body['fields'])
    foods = _normalize_products(payload)
    assert len(foods) == 1
    assert foods[0].brand == 'Liga'
    assert foods[0].barcode == product['code']
    assert foods[0].calories == 383
    assert foods[0].image_url == product['image_front_url']
    assert foods[0].serving_size == '100 g / 100 ml (source reference)'


@pytest.mark.parametrize('payload', [None, {}, {'hits': []}, {'hits': [], 'timed_out': True},
    {'hits': {}, 'timed_out': False}, {'hits': [], 'timed_out': False, 'errors': [{'status': 500}]}])
def test_incomplete_index_response_is_never_reported_as_product_not_found(payload, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.open_food_facts import _fetch_primary
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=payload)), trust_env=False, **kwargs))
    with pytest.raises(ValueError):
        asyncio.run(_fetch_primary({'search_terms': 'liga', 'page_size': 10}))


@patch('app.services.open_food_facts._fetch_primary', new_callable=AsyncMock)
def test_query_variants_reuse_success_during_provider_pause(primary, monkeypatch: pytest.MonkeyPatch) -> None:
    now = [0.0]
    state = FoodSearchAvailability(clock=lambda: now[0])
    monkeypatch.setattr('app.services.open_food_facts._OPEN_FOOD_FACTS_AVAILABILITY', state)
    primary.return_value = {'products': [{'product_name': 'Liga Milkbreak', 'brands': ['Liga'],
        'nutriments': {'energy-kcal_100g': 447, 'proteins_100g': 9.2, 'fat_100g': 17, 'carbohydrates_100g': 63}}]}
    first = asyncio.run(search_food_products('Liga  MILKBREAK'))
    now[0] = 600  # Previously the five-minute cache had already discarded it.
    state.pause_provider(503, 1800)
    cached = asyncio.run(search_food_products('  liga milkbreak  '))
    assert cached == first
    primary.assert_awaited_once()
    with pytest.raises(FoodSearchUnavailable):
        asyncio.run(search_food_products('different product'))
    primary.assert_awaited_once()
    now[0] = 3601
    asyncio.run(search_food_products('liga milkbreak'))
    assert primary.await_count == 2
