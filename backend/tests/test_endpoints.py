"""
Automated backend tests for CalorieApp API endpoints.
Run from the backend directory: pytest
"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

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
