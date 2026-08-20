"""
Automated backend tests for CalorieApp API endpoints.
Run from the backend directory: pytest
"""
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

import app.database as db_module
from app.models import FoodLogDB
from app.schemas import FoodSearchResult


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_response_schema(client: TestClient) -> None:
    data = client.get("/health").json()
    assert data["status"] == "ok"
    assert data["service"] == "calorieapp-backend"


# ---------------------------------------------------------------------------
# /search-food
# ---------------------------------------------------------------------------

@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_search_food_valid_query(mock_search: AsyncMock, client: TestClient) -> None:
    """Valid query returns 200 with results list matching the unified schema."""
    mock_search.return_value = [
        FoodSearchResult(
            product_name="Banana",
            calories=89.0,
            protein=1.1,
            fat=0.3,
            carbohydrates=23.0,
            image_url="https://images.openfoodfacts.org/sample-banana.jpg",
            barcode="1234567890123",
            brand="DemoBrand",
            serving_size="100 g",
            nutri_score="C",
        )
    ]
    response = client.get("/search-food?q=banana")
    assert response.status_code == 200

    data = response.json()
    assert data["query"] == "banana"
    assert len(data["results"]) == 1

    item = data["results"][0]
    assert item["product_name"] == "Banana"
    assert item["calories"] == 89.0
    assert item["protein"] == 1.1
    assert item["fat"] == 0.3
    assert item["carbohydrates"] == 23.0
    assert item["image_url"] == "https://images.openfoodfacts.org/sample-banana.jpg"
    assert item["barcode"] == "1234567890123"
    assert item["brand"] == "DemoBrand"
    assert item["serving_size"] == "100 g"
    assert item["nutri_score"] == "C"


@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_search_food_optional_fields_can_be_missing(mock_search: AsyncMock, client: TestClient) -> None:
    """Optional OFF enrichment fields may be null without breaking the response contract."""
    mock_search.return_value = [
        FoodSearchResult(
            product_name="Plain Oats",
            calories=375.0,
            protein=13.0,
            fat=7.0,
            carbohydrates=60.0,
            image_url=None,
            barcode=None,
            brand=None,
            serving_size=None,
            nutri_score=None,
        )
    ]

    response = client.get("/search-food?q=oats")
    assert response.status_code == 200
    item = response.json()["results"][0]
    assert item["product_name"] == "Plain Oats"
    assert item["image_url"] is None
    assert item["barcode"] is None
    assert item["brand"] is None
    assert item["serving_size"] is None
    assert item["nutri_score"] is None


@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_search_food_empty_results(mock_search: AsyncMock, client: TestClient) -> None:
    """Query that matches nothing returns 200 with empty results list."""
    mock_search.return_value = []
    response = client.get("/search-food?q=xyzzznotafood")
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_search_food_empty_query_returns_422(client: TestClient) -> None:
    """Empty q param fails Pydantic min_length validation."""
    response = client.get("/search-food?q=")
    assert response.status_code == 422


def test_search_food_missing_param_returns_422(client: TestClient) -> None:
    """Missing q param returns 422."""
    response = client.get("/search-food")
    assert response.status_code == 422


def test_search_food_query_too_long_returns_422(client: TestClient) -> None:
    """Query exceeding max_length=120 returns 422."""
    response = client.get(f"/search-food?q={'a' * 121}")
    assert response.status_code == 422


@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_search_food_upstream_failure_returns_502(mock_search: AsyncMock, client: TestClient) -> None:
    """When Open Food Facts is unreachable the endpoint returns 502."""
    import httpx
    mock_search.side_effect = httpx.HTTPError("upstream down")
    response = client.get("/search-food?q=banana")
    assert response.status_code == 502


# ---------------------------------------------------------------------------
# POST /log-food
# ---------------------------------------------------------------------------

def test_log_food_valid_full_schema(client: TestClient) -> None:
    """Valid full payload returns 200 with id and created_at assigned."""
    payload = {
        "product_name": "Banana",
        "calories": 89.0,
        "protein": 1.1,
        "fat": 0.3,
        "carbohydrates": 23.0,
    }
    response = client.post("/log-food", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["product_name"] == "Banana"
    assert data["calories"] == 89.0
    assert data["id"] == 1
    assert "created_at" in data


def test_log_food_valid_minimal_schema(client: TestClient) -> None:
    """Only required fields; macro defaults must be 0."""
    response = client.post("/log-food", json={"product_name": "Rice", "calories": 130.0})
    assert response.status_code == 200

    data = response.json()
    assert data["protein"] == 0
    assert data["fat"] == 0
    assert data["carbohydrates"] == 0


def test_log_food_invalid_negative_calories(client: TestClient) -> None:
    """Negative calories violates ge=0 constraint."""
    response = client.post("/log-food", json={"product_name": "Bad", "calories": -10.0})
    assert response.status_code == 422


def test_log_food_invalid_missing_product_name(client: TestClient) -> None:
    """Missing product_name returns 422."""
    response = client.post("/log-food", json={"calories": 100.0})
    assert response.status_code == 422


def test_log_food_invalid_empty_product_name(client: TestClient) -> None:
    """Empty product_name violates min_length=1 constraint."""
    response = client.post("/log-food", json={"product_name": "", "calories": 100.0})
    assert response.status_code == 422


def test_log_food_increments_id(client: TestClient) -> None:
    """Successive log entries receive sequential auto-increment ids."""
    r1 = client.post("/log-food", json={"product_name": "Apple", "calories": 52.0})
    r2 = client.post("/log-food", json={"product_name": "Orange", "calories": 47.0})
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]
    assert isinstance(id1, int)
    assert isinstance(id2, int)
    assert id2 > id1


# ---------------------------------------------------------------------------
# GET /logs
# ---------------------------------------------------------------------------

def test_get_logs_empty(client: TestClient) -> None:
    """No logged items returns 200 with empty list."""
    response = client.get("/logs")
    assert response.status_code == 200
    assert response.json() == []


def test_get_logs_returns_logged_items(client: TestClient) -> None:
    """Items logged via POST /log-food appear in GET /logs (newest first)."""
    client.post("/log-food", json={"product_name": "Apple", "calories": 52.0})
    client.post("/log-food", json={"product_name": "Oats", "calories": 389.0})

    response = client.get("/logs")
    assert response.status_code == 200

    logs = response.json()
    assert len(logs) == 2
    names = {item["product_name"] for item in logs}
    assert names == {"Apple", "Oats"}


def test_get_logs_schema(client: TestClient) -> None:
    """Each log entry contains all expected fields."""
    client.post("/log-food", json={"product_name": "Egg", "calories": 78.0})
    logs = client.get("/logs").json()
    entry = logs[0]
    for field in ("id", "created_at", "product_name", "calories", "protein", "fat", "carbohydrates"):
        assert field in entry, f"Missing field: {field}"


def test_get_logs_supports_deterministic_summary_totals(client: TestClient) -> None:
    """Logged food records can be summed deterministically for frontend daily summary."""
    client.post(
        "/log-food",
        json={
            "product_name": "Food A",
            "calories": 100.0,
            "protein": 10.0,
            "fat": 5.0,
            "carbohydrates": 20.0,
        },
    )
    client.post(
        "/log-food",
        json={
            "product_name": "Food B",
            "calories": 200.0,
            "protein": 20.0,
            "fat": 10.0,
            "carbohydrates": 30.0,
        },
    )

    logs = client.get("/logs").json()
    assert len(logs) == 2

    total_calories = sum(item["calories"] for item in logs)
    total_protein = sum(item["protein"] for item in logs)
    total_fat = sum(item["fat"] for item in logs)
    total_carbohydrates = sum(item["carbohydrates"] for item in logs)

    assert total_calories == 300.0
    assert total_protein == 30.0
    assert total_fat == 15.0
    assert total_carbohydrates == 50.0


def test_log_food_persists_optional_fields(client: TestClient) -> None:
    payload = {
        "product_name": "Pesto",
        "calories": 492.0,
        "protein": 4.7,
        "fat": 47.0,
        "carbohydrates": 11.0,
        "barcode": "8076809513753",
        "image_url": "https://images.openfoodfacts.org/pesto.jpg",
        "brand": "Barilla",
        "serving_size": "100 g",
        "nutri_score": "c",
    }

    response = client.post("/log-food", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["barcode"] == "8076809513753"
    assert data["image_url"] == "https://images.openfoodfacts.org/pesto.jpg"
    assert data["brand"] == "Barilla"
    assert data["serving_size"] == "100 g"
    assert data["nutri_score"] == "C"


def test_log_food_with_portion_100_persists(client: TestClient) -> None:
    response = client.post(
        "/log-food",
        json={
            "product_name": "Whole Entry",
            "calories": 100.0,
            "protein": 10.0,
            "fat": 5.0,
            "carbohydrates": 20.0,
            "portion_percentage": 100,
        },
    )
    assert response.status_code == 200
    assert response.json()["portion_percentage"] == 100


def test_log_food_with_portion_50_persists(client: TestClient) -> None:
    response = client.post(
        "/log-food",
        json={
            "product_name": "Half Entry",
            "calories": 50.0,
            "protein": 5.0,
            "fat": 2.5,
            "carbohydrates": 10.0,
            "portion_percentage": 50,
        },
    )
    assert response.status_code == 200
    assert response.json()["portion_percentage"] == 50


def test_log_food_with_portion_25_persists(client: TestClient) -> None:
    response = client.post(
        "/log-food",
        json={
            "product_name": "Quarter Entry",
            "calories": 25.0,
            "protein": 2.5,
            "fat": 1.25,
            "carbohydrates": 5.0,
            "portion_percentage": 25,
        },
    )
    assert response.status_code == 200
    assert response.json()["portion_percentage"] == 25


def test_log_food_without_portion_defaults_to_100(client: TestClient) -> None:
    response = client.post(
        "/log-food",
        json={
            "product_name": "Default Portion",
            "calories": 120.0,
            "protein": 6.0,
            "fat": 2.0,
            "carbohydrates": 18.0,
        },
    )
    assert response.status_code == 200
    assert response.json()["portion_percentage"] == 100.0


@pytest.mark.parametrize("invalid_portion", [0, -5, 101])
def test_log_food_invalid_portion_values_rejected(client: TestClient, invalid_portion: int) -> None:
    response = client.post(
        "/log-food",
        json={
            "product_name": "Invalid Portion",
            "calories": 10.0,
            "protein": 1.0,
            "fat": 1.0,
            "carbohydrates": 1.0,
            "portion_percentage": invalid_portion,
        },
    )
    assert response.status_code == 422


def test_log_food_existing_style_record_still_works(client: TestClient) -> None:
    """Records without optional fields remain valid and retrievable."""
    response = client.post(
        "/log-food",
        json={
            "product_name": "Legacy Entry",
            "calories": 120.0,
            "protein": 3.0,
            "fat": 1.0,
            "carbohydrates": 25.0,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["barcode"] is None
    assert data["image_url"] is None
    assert data["brand"] is None
    assert data["serving_size"] is None
    assert data["nutri_score"] is None


def test_legacy_record_without_portion_percentage_still_loads(client: TestClient) -> None:
    with Session(db_module.engine) as session:
        entry = FoodLogDB(
            product_name="Legacy Null Portion",
            calories=90.0,
            protein=3.0,
            fat=1.0,
            carbohydrates=15.0,
            portion_percentage=None,
            created_at=datetime.now(UTC),
        )
        session.add(entry)
        session.commit()

    response = client.get("/logs")
    assert response.status_code == 200
    logs = response.json()
    legacy = next(item for item in logs if item["product_name"] == "Legacy Null Portion")
    assert legacy["portion_percentage"] is None


def test_delete_single_log_entry(client: TestClient) -> None:
    created = client.post("/log-food", json={"product_name": "Delete Me", "calories": 10.0}).json()
    log_id = created["id"]

    response = client.delete(f"/logs/{log_id}")
    assert response.status_code == 200
    assert response.json()["deleted_id"] == log_id

    logs = client.get("/logs").json()
    assert all(item["id"] != log_id for item in logs)


def test_delete_single_log_entry_not_found(client: TestClient) -> None:
    response = client.delete("/logs/9999")
    assert response.status_code == 404


def test_delete_all_logs(client: TestClient) -> None:
    client.post("/log-food", json={"product_name": "A", "calories": 100.0})
    client.post("/log-food", json={"product_name": "B", "calories": 200.0})

    response = client.delete("/logs")
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 2

    logs = client.get("/logs").json()
    assert logs == []


def test_totals_after_deleting_one_log(client: TestClient) -> None:
    a = client.post(
        "/log-food",
        json={
            "product_name": "Food A",
            "calories": 100.0,
            "protein": 10.0,
            "fat": 5.0,
            "carbohydrates": 20.0,
        },
    ).json()
    client.post(
        "/log-food",
        json={
            "product_name": "Food B",
            "calories": 200.0,
            "protein": 20.0,
            "fat": 10.0,
            "carbohydrates": 30.0,
        },
    )

    client.delete(f"/logs/{a['id']}")
    logs = client.get("/logs").json()
    assert len(logs) == 1

    total_calories = sum(item["calories"] for item in logs)
    total_protein = sum(item["protein"] for item in logs)
    total_fat = sum(item["fat"] for item in logs)
    total_carbohydrates = sum(item["carbohydrates"] for item in logs)

    assert total_calories == 200.0
    assert total_protein == 20.0
    assert total_fat == 10.0
    assert total_carbohydrates == 30.0


def _avg_nutri_grade(grades: list[str | None]) -> str | None:
    mapping = {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1}
    values = [mapping[g] for g in grades if g in mapping]
    if not values:
        return None

    avg = sum(values) / len(values)
    rounded = max(1, min(5, round(avg)))
    reverse = {5: "A", 4: "B", 3: "C", 2: "D", 1: "E"}
    return reverse[rounded]


def test_nutri_score_average_a_b_c_returns_b() -> None:
    assert _avg_nutri_grade(["A", "B", "C"]) == "B"


def test_nutri_score_average_a_only_returns_a() -> None:
    assert _avg_nutri_grade(["A"]) == "A"


def test_nutri_score_average_e_only_returns_e() -> None:
    assert _avg_nutri_grade(["E"]) == "E"


def test_nutri_score_average_none_available_returns_none() -> None:
    assert _avg_nutri_grade([None, None]) is None


def test_nutri_score_average_ignores_missing_values() -> None:
    assert _avg_nutri_grade(["A", None, "C", "X"]) == "B"
