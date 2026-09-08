"""Keep the displayed reference amount aligned with all four nutrient values."""

import pytest

from app.services.open_food_facts import _normalize_products


REFERENCE_AMOUNT = "100 g / 100 ml (source reference)"


def product_with_two_bases() -> dict:
    return {
        "product_name": "Sample cocoa drink",
        "serving_size": "250 ml",
        "nutriments": {
            "energy-kcal_100g": 87.2,
            "proteins_100g": 3.2,
            "fat_100g": 2.7,
            "carbohydrates_100g": 12,
            "energy-kcal_serving": 218,
            "proteins_serving": 8,
            "fat_serving": 6.75,
            "carbohydrates_serving": 30,
        },
    }


def test_named_serving_uses_source_serving_values_instead_of_100g_values() -> None:
    item, = _normalize_products({"products": [product_with_two_bases()]})
    assert item.serving_size == "250 ml"
    assert (item.calories, item.protein, item.fat, item.carbohydrates) == (218, 8, 6.75, 30)


def test_complete_source_serving_can_be_used_without_100g_values() -> None:
    product = product_with_two_bases()
    product["nutriments"] = {
        key: value for key, value in product["nutriments"].items() if key.endswith("_serving")
    }
    item, = _normalize_products({"products": [product]})
    assert item.calories == 218
    assert item.serving_size == "250 ml"


@pytest.mark.parametrize("missing", ["energy-kcal", "proteins", "fat", "carbohydrates"])
def test_partial_serving_data_falls_back_as_one_complete_reference_set(missing: str) -> None:
    product = product_with_two_bases()
    del product["nutriments"][f"{missing}_serving"]
    item, = _normalize_products({"products": [product]})
    assert item.serving_size == REFERENCE_AMOUNT
    assert (item.calories, item.protein, item.fat, item.carbohydrates) == (87.2, 3.2, 2.7, 12)


@pytest.mark.parametrize("invalid", [None, -1, float("nan"), float("inf"), "unknown"])
def test_invalid_serving_value_does_not_mix_reference_amounts(invalid: object) -> None:
    product = product_with_two_bases()
    product["nutriments"]["proteins_serving"] = invalid
    item, = _normalize_products({"products": [product]})
    assert item.serving_size == REFERENCE_AMOUNT
    assert item.calories == 87.2
    assert item.protein == 3.2


@pytest.mark.parametrize("label", [None, "", "   ", "x" * 81])
def test_unusable_serving_label_keeps_the_explicit_100g_reference(label: object) -> None:
    product = product_with_two_bases()
    product["serving_size"] = label
    item, = _normalize_products({"products": [product]})
    assert item.serving_size == REFERENCE_AMOUNT
    assert item.calories == 87.2


def test_real_zero_serving_nutrients_are_preserved() -> None:
    product = product_with_two_bases()
    product["product_name"] = "Sample drink"
    product["serving_size"] = "1 can (330 ml)"
    product["nutriments"].update({
        "energy-kcal_serving": 135.3,
        "proteins_serving": 0,
        "fat_serving": 0,
        "carbohydrates_serving": 10.23,
    })
    item, = _normalize_products({"products": [product]})
    assert item.serving_size == "1 can (330 ml)"
    assert (item.calories, item.protein, item.fat, item.carbohydrates) == (135.3, 0, 0, 10.23)


def test_product_is_omitted_if_neither_basis_has_complete_nutrition() -> None:
    product = product_with_two_bases()
    del product["nutriments"]["proteins_serving"]
    del product["nutriments"]["fat_100g"]
    assert _normalize_products({"products": [product]}) == []


def test_reference_values_do_not_require_or_infer_a_packaging_serving() -> None:
    product = product_with_two_bases()
    product["nutriments"] = {
        key: value for key, value in product["nutriments"].items() if key.endswith("_100g")
    }
    product["serving_size"] = "1 large glass"
    item, = _normalize_products({"products": [product]})
    assert item.serving_size == REFERENCE_AMOUNT
    assert item.calories == 87.2
