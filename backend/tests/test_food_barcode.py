import asyncio
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services import open_food_facts as off
from app.services.food_search_availability import FoodSearchUnavailable


@pytest.fixture(autouse=True)
def reset_provider():
    off._OPEN_FOOD_FACTS_ADMISSION._reset_for_tests()
    off._OPEN_FOOD_FACTS_AVAILABILITY.reset()
    off._OPEN_FOOD_FACTS_RATE_GOVERNOR._reset_for_tests()
    yield
    off._OPEN_FOOD_FACTS_ADMISSION._reset_for_tests()
    off._OPEN_FOOD_FACTS_AVAILABILITY.reset()
    off._OPEN_FOOD_FACTS_RATE_GOVERNOR._reset_for_tests()


@pytest.mark.parametrize("code", ["3017620422003", "034000470693", "0034000470693", "96385074", "10012345000017"])
def test_valid_gtin_preserves_digits(code):
    assert off.valid_food_barcode(" " + code + " ") == code


@pytest.mark.parametrize("code", ["", "00000000", "3017620422004", "123", "1e12", "../3017620422003", "https://example.com", "３０１７６２０４２２００３"])
def test_invalid_codes_never_make_provider_requests(code):
    with patch.object(off, "_fetch_product", new_callable=AsyncMock) as fetch:
        with pytest.raises(ValueError):
            asyncio.run(off.search_food_products(code, barcode=True))
        fetch.assert_not_called()


def product(code="0034000470693"):
    return {"code": code, "product_type": "food", "product_name": "Fixture food", "nutriscore_grade": "b",
            "nutriments": {"energy-kcal_100g": 200, "proteins_100g": 4, "fat_100g": 0, "carbohydrates_100g": 40}}


def fetch_response(payload, *, status=200, requested="034000470693"):
    response = httpx.Response(status, json=payload,
                              request=httpx.Request("GET", "https://world.openfoodfacts.org/api/v3/product/" + requested))
    with patch.object(httpx, "AsyncClient") as factory:
        get = AsyncMock(return_value=response)
        factory.return_value.__aenter__.return_value.get = get
        result = asyncio.run(off.search_food_products(requested, barcode=True))
        assert factory.call_args.kwargs["follow_redirects"] is False
        assert get.await_count == 1
        args, kwargs = get.call_args
        assert args[0].endswith("/api/v3/product/" + requested)
        assert kwargs["params"]["product_type"] == "food"
        assert kwargs["headers"]["User-Agent"].startswith("CalorieApp/")
        return result


def test_exact_lookup_accepts_off_leading_zero_normalization_and_retains_nutrition_basis():
    result = fetch_response({"status": "success", "product": product()})
    assert len(result) == 1
    assert result[0].barcode == "0034000470693"
    assert result[0].nutri_score == "B"
    assert result[0].fat == 0
    assert result[0].serving_size == "100 g / 100 ml (source reference)"


@pytest.mark.parametrize("item", [product("3017620422003"), {**product(), "product_type": "beauty"}, {**product(), "code": 34000470693}])
def test_unrelated_or_invalid_product_identity_is_rejected(item):
    with pytest.raises(httpx.HTTPError):
        fetch_response({"status": "success", "product": item})


def test_absent_and_incomplete_products_do_not_become_zero_nutrition_foods():
    assert fetch_response({"status": "failure"}, status=404) == []
    item = product()
    del item["nutriments"]["fat_100g"]
    assert fetch_response({"status": "success", "product": item}) == []


def test_barcode_and_name_searches_have_separate_cache_and_duplicate_request_keys():
    async def run():
        with patch.object(off, "_fetch_product", new_callable=AsyncMock, return_value={"products": [product()]}) as lookup, \
                patch.object(off, "_fetch_primary", new_callable=AsyncMock, return_value={"products": [product("3017620422003")]}) as search:
            results = await asyncio.gather(*(off.search_food_products("034000470693", barcode=True) for _ in range(2)))
            await off.search_food_products("034000470693", barcode=True)
            by_name = await off.search_food_products("034000470693")
            assert results[0][0].barcode == "0034000470693"
            assert by_name[0].barcode == "3017620422003"
            assert lookup.await_count == search.await_count == 1
    asyncio.run(run())


def test_rate_limit_pauses_both_routes_without_transport_fallback():
    response = httpx.Response(429, headers={"Retry-After": "120"}, request=httpx.Request("GET", "https://world.openfoodfacts.org/"))
    with patch.object(off, "_fetch_product", new_callable=AsyncMock, side_effect=httpx.HTTPStatusError("busy", request=response.request, response=response)) as lookup, \
            patch.object(off, "_fetch_fallback", new_callable=AsyncMock) as fallback:
        for barcode in (True, False):
            with pytest.raises(FoodSearchUnavailable) as error:
                asyncio.run(off.search_food_products("034000470693", barcode=barcode))
            assert error.value.status_code == 429
            assert error.value.retry_after_seconds >= 119
        assert lookup.await_count == 1
        fallback.assert_not_called()


def test_public_endpoint_requires_explicit_valid_barcode_mode(client):
    with patch("app.main.search_food_products", new_callable=AsyncMock, return_value=[]) as search:
        assert client.get("/search-food", params={"q": "3017620422004", "mode": "barcode"}).status_code == 422
        search.assert_not_called()
        response = client.get("/search-food", params={"q": "034000470693", "mode": "barcode"})
        assert response.status_code == 200
        assert response.json() == {"query": "034000470693", "results": []}
        search.assert_awaited_once_with("034000470693", barcode=True)


def test_public_endpoint_keeps_existing_name_search_behavior(client):
    with patch("app.main.search_food_products", new_callable=AsyncMock, return_value=[]) as search:
        assert client.get("/search-food", params={"q": "oats"}).status_code == 200
        search.assert_awaited_once_with("oats")
