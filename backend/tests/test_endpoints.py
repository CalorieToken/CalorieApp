"""
Automated backend tests for CalorieApp API endpoints.
Run from the backend directory: pytest
"""
import hashlib
import re
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

import app.database as db_module
from app.database import init_db
from app.main import _ROUTE_RATE_LIMITER, _build_identifier, app
from app.models import AuthSessionDB, CalorieAppUserDB, FoodLogDB
from app.schemas import FoodSearchResult
from app.route_rate_limiter import RouteRateLimitRejected
from app.source_admission import AdapterAdmissionRejected


SESSION_COOKIE_NAME = "calorieapp_session"
SESSION_TOKEN_BYTES = 48
SESSION_ABSOLUTE_LIFETIME_SECONDS = 8 * 60 * 60


def _create_session_for_user(user_id: str) -> str:
    token = token_urlsafe(SESSION_TOKEN_BYTES)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(UTC)

    session_row = AuthSessionDB(
        session_token_hash=token_hash,
        calorieapp_user_id=user_id,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(seconds=SESSION_ABSOLUTE_LIFETIME_SECONDS),
    )
    with Session(db_module.engine) as session:
        session.add(session_row)
        session.commit()

    return token


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
    assert re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", data["build_id"])


@pytest.mark.parametrize("value", [None, "", "   "])
def test_blank_build_identifier_uses_local_default(value: str | None) -> None:
    assert _build_identifier(value) == "development"


def test_invalid_build_identifier_fails_closed() -> None:
    with pytest.raises(RuntimeError, match="CALORIEAPP_BUILD_ID"):
        _build_identifier("invalid build id")


def test_readiness_checks_database_revision(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "database_revision": "20260902_0016",
        "service": "calorieapp-backend",
    }


def test_health_is_not_marked_as_private_session_data(client: TestClient) -> None:
    response = client.get("/health")
    assert response.headers.get("cache-control") != "no-store"


def test_api_responses_include_baseline_security_headers(client: TestClient) -> None:
    response = client.get("/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["permissions-policy"] == (
        "camera=(), microphone=(), geolocation=(), payment=()"
    )


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


def test_search_food_whitespace_only_query_returns_422(client: TestClient) -> None:
    response = client.get("/search-food?q=%20%20%20")
    assert response.status_code == 422


@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_search_food_normalizes_surrounding_whitespace(
    mock_search: AsyncMock,
    client: TestClient,
) -> None:
    mock_search.return_value = []
    response = client.get("/search-food?q=%20banana%20")
    assert response.status_code == 200
    assert response.json()["query"] == "banana"
    mock_search.assert_awaited_once_with("banana")


@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_search_food_upstream_failure_returns_502(mock_search: AsyncMock, client: TestClient) -> None:
    """When Open Food Facts is unreachable the endpoint returns 502."""
    import httpx
    mock_search.side_effect = httpx.HTTPError("upstream down")
    response = client.get("/search-food?q=banana")
    assert response.status_code == 502


@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_search_food_admission_rejection_returns_bounded_503(
    mock_search: AsyncMock,
    client: TestClient,
) -> None:
    mock_search.side_effect = AdapterAdmissionRejected("adapter_queue_full", 2)

    response = client.get("/search-food?q=banana")

    assert response.status_code == 503
    assert response.json() == {"detail": "Food search temporarily unavailable"}
    assert response.headers["retry-after"] == "2"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_search_food_shared_rate_rejection_returns_bounded_429(
    mock_search: AsyncMock,
    client: TestClient,
) -> None:
    mock_search.side_effect = AdapterAdmissionRejected(
        "shared_provider_rate_limit",
        7,
        status_code=429,
    )

    response = client.get("/search-food?q=banana")

    assert response.status_code == 429
    assert response.json() == {"detail": "Food search rate limit reached"}
    assert response.headers["retry-after"] == "7"
    assert response.headers["cache-control"] == "no-store"


@patch("app.main.search_food_products", new_callable=AsyncMock)
def test_shared_route_rejection_happens_before_search_endpoint_execution(
    mock_search: AsyncMock,
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def reject_route(policy) -> None:
        raise RouteRateLimitRejected(
            "shared_route_rate_limit",
            9,
            status_code=429,
        )

    monkeypatch.setattr(_ROUTE_RATE_LIMITER, "acquire", reject_route)

    response = client.get("/search-food?q=banana")

    assert response.status_code == 429
    assert response.json() == {"detail": "Request rate limit reached"}
    assert response.headers["retry-after"] == "9"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    mock_search.assert_not_awaited()


# ---------------------------------------------------------------------------
# POST /log-food
# ---------------------------------------------------------------------------

def test_log_food_valid_full_schema(authenticated_client: TestClient) -> None:
    """Valid full payload returns 200 with id and created_at assigned."""
    payload = {
        "product_name": "Banana",
        "calories": 89.0,
        "protein": 1.1,
        "fat": 0.3,
        "carbohydrates": 23.0,
    }
    response = authenticated_client.post("/log-food", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["product_name"] == "Banana"
    assert data["calories"] == 89.0
    assert data["id"] == 1
    assert "created_at" in data
    assert data["created_at"].endswith("Z")


def test_log_food_rejects_oversize_body_before_mutation(
    authenticated_client: TestClient,
) -> None:
    payload = b'{"product_name":"' + (b"x" * (16 * 1024)) + b'","calories":1}'

    response = authenticated_client.post(
        "/log-food",
        content=payload,
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json() == {"detail": "Request body too large"}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "retry-after" not in response.headers
    with Session(db_module.engine) as session:
        assert session.exec(select(FoodLogDB)).all() == []


def test_log_food_valid_minimal_schema(authenticated_client: TestClient) -> None:
    """Only required fields; macro defaults must be 0."""
    response = authenticated_client.post("/log-food", json={"product_name": "Rice", "calories": 130.0})
    assert response.status_code == 200

    data = response.json()
    assert data["protein"] == 0
    assert data["fat"] == 0
    assert data["carbohydrates"] == 0


def test_log_food_invalid_negative_calories(authenticated_client: TestClient) -> None:
    """Negative calories violates ge=0 constraint."""
    response = authenticated_client.post("/log-food", json={"product_name": "Bad", "calories": -10.0})
    assert response.status_code == 422


def test_log_food_invalid_missing_product_name(authenticated_client: TestClient) -> None:
    """Missing product_name returns 422."""
    response = authenticated_client.post("/log-food", json={"calories": 100.0})
    assert response.status_code == 422


def test_log_food_invalid_empty_product_name(authenticated_client: TestClient) -> None:
    """Empty product_name violates min_length=1 constraint."""
    response = authenticated_client.post("/log-food", json={"product_name": "", "calories": 100.0})
    assert response.status_code == 422


def test_log_food_rejects_whitespace_only_product_name(
    authenticated_client: TestClient,
) -> None:
    response = authenticated_client.post(
        "/log-food",
        json={"product_name": "   ", "calories": 100.0},
    )
    assert response.status_code == 422


def test_log_food_normalizes_text_fields(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(
        "/log-food",
        json={
            "product_name": "  Apple  ",
            "calories": 52.0,
            "brand": "  Demo Brand  ",
            "serving_size": "   ",
            "nutri_score": " b ",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["product_name"] == "Apple"
    assert data["brand"] == "Demo Brand"
    assert data["serving_size"] is None
    assert data["nutri_score"] == "B"


@pytest.mark.parametrize("nutri_score", ["F", "Z", "unknown"])
def test_log_food_rejects_invalid_nutri_score(
    authenticated_client: TestClient,
    nutri_score: str,
) -> None:
    response = authenticated_client.post(
        "/log-food",
        json={"product_name": "Apple", "calories": 52.0, "nutri_score": nutri_score},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("field", ["calories", "protein", "fat", "carbohydrates"])
def test_log_food_rejects_non_finite_nutrition_values(
    authenticated_client: TestClient,
    field: str,
) -> None:
    payload = {"product_name": "Invalid", "calories": 10.0, field: "Infinity"}
    response = authenticated_client.post("/log-food", json=payload)
    assert response.status_code == 422


def test_log_food_increments_id(authenticated_client: TestClient) -> None:
    """Successive log entries receive sequential auto-increment ids."""
    r1 = authenticated_client.post("/log-food", json={"product_name": "Apple", "calories": 52.0})
    r2 = authenticated_client.post("/log-food", json={"product_name": "Orange", "calories": 47.0})
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]
    assert isinstance(id1, int)
    assert isinstance(id2, int)
    assert id2 > id1


# ---------------------------------------------------------------------------
# GET /logs
# ---------------------------------------------------------------------------

def test_get_logs_empty(authenticated_client: TestClient) -> None:
    """No logged items returns 200 with empty list."""
    response = authenticated_client.get("/logs")
    assert response.status_code == 200
    assert response.json() == []


def test_private_food_log_responses_disable_http_caching(
    authenticated_client: TestClient,
) -> None:
    response = authenticated_client.get("/logs")
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"


def test_get_logs_returns_logged_items(authenticated_client: TestClient) -> None:
    """Items logged via POST /log-food appear in GET /logs (newest first)."""
    authenticated_client.post("/log-food", json={"product_name": "Apple", "calories": 52.0})
    authenticated_client.post("/log-food", json={"product_name": "Oats", "calories": 389.0})

    response = authenticated_client.get("/logs")
    assert response.status_code == 200

    logs = response.json()
    assert len(logs) == 2
    names = {item["product_name"] for item in logs}
    assert names == {"Apple", "Oats"}


def test_get_logs_schema(authenticated_client: TestClient) -> None:
    """Each log entry contains all expected fields."""
    authenticated_client.post("/log-food", json={"product_name": "Egg", "calories": 78.0})
    logs = authenticated_client.get("/logs").json()
    entry = logs[0]
    for field in ("id", "created_at", "product_name", "calories", "protein", "fat", "carbohydrates"):
        assert field in entry, f"Missing field: {field}"


def test_get_logs_supports_deterministic_summary_totals(authenticated_client: TestClient) -> None:
    """Logged food records can be summed deterministically for frontend daily summary."""
    authenticated_client.post(
        "/log-food",
        json={
            "product_name": "Food A",
            "calories": 100.0,
            "protein": 10.0,
            "fat": 5.0,
            "carbohydrates": 20.0,
        },
    )
    authenticated_client.post(
        "/log-food",
        json={
            "product_name": "Food B",
            "calories": 200.0,
            "protein": 20.0,
            "fat": 10.0,
            "carbohydrates": 30.0,
        },
    )

    logs = authenticated_client.get("/logs").json()
    assert len(logs) == 2

    total_calories = sum(item["calories"] for item in logs)
    total_protein = sum(item["protein"] for item in logs)
    total_fat = sum(item["fat"] for item in logs)
    total_carbohydrates = sum(item["carbohydrates"] for item in logs)

    assert total_calories == 300.0
    assert total_protein == 30.0
    assert total_fat == 15.0
    assert total_carbohydrates == 50.0


def test_log_food_persists_optional_fields(authenticated_client: TestClient) -> None:
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

    response = authenticated_client.post("/log-food", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["barcode"] == "8076809513753"
    assert data["image_url"] == "https://images.openfoodfacts.org/pesto.jpg"
    assert data["brand"] == "Barilla"
    assert data["serving_size"] == "100 g"
    assert data["nutri_score"] == "C"


def test_log_food_with_portion_100_persists(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(
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


def test_log_food_with_portion_50_persists(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(
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


def test_log_food_with_portion_25_persists(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(
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


def test_log_food_without_portion_defaults_to_100(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(
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
def test_log_food_invalid_portion_values_rejected(authenticated_client: TestClient, invalid_portion: int) -> None:
    response = authenticated_client.post(
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


def test_log_food_existing_style_record_still_works(authenticated_client: TestClient) -> None:
    """Records without optional fields remain valid and retrievable."""
    response = authenticated_client.post(
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


def test_legacy_record_without_portion_percentage_still_loads(authenticated_client: TestClient) -> None:
    """Legacy unowned records remain in storage but are not exposed to normal authenticated queries."""
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

    response = authenticated_client.get("/logs")
    assert response.status_code == 200
    logs = response.json()
    assert all(item["product_name"] != "Legacy Null Portion" for item in logs)


def test_legacy_null_owner_record_cannot_be_deleted_by_authenticated_user(authenticated_client: TestClient) -> None:
    """Legacy rows with unknown ownership must not be claimable/deletable by authenticated users."""
    with Session(db_module.engine) as session:
        entry = FoodLogDB(
            product_name="Legacy Null Owner",
            calories=50.0,
            protein=1.0,
            fat=1.0,
            carbohydrates=10.0,
            owner_id=None,
            created_at=datetime.now(UTC),
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        log_id = entry.id

    response = authenticated_client.delete(f"/logs/{log_id}")
    assert response.status_code == 403


def test_init_db_adds_missing_owner_id_column_to_legacy_food_log_table() -> None:
    """Legacy SQLite databases must be migrated to include owner_id before authenticated writes."""
    legacy_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    with legacy_engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE food_log (
                id INTEGER PRIMARY KEY,
                product_name VARCHAR(120),
                calories FLOAT,
                protein FLOAT,
                fat FLOAT,
                carbohydrates FLOAT,
                created_at DATETIME
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO food_log (id, product_name, calories, protein, fat, carbohydrates, created_at)
            VALUES (1, 'Legacy Preserved', 123.0, 4.0, 5.0, 6.0, '2026-01-01 00:00:00')
            """
        )

    original_engine = db_module.engine
    db_module.engine = legacy_engine
    try:
        init_db()

        with legacy_engine.connect() as connection:
            columns = connection.exec_driver_sql("PRAGMA table_info(food_log)").fetchall()
            names = {row[1] for row in columns}
            assert "owner_id" in names

            rows = connection.exec_driver_sql(
                "SELECT id, product_name, owner_id FROM food_log WHERE id = 1"
            ).fetchall()
            assert len(rows) == 1
            assert rows[0][0] == 1
            assert rows[0][1] == "Legacy Preserved"
            assert rows[0][2] is None
    finally:
        db_module.engine = original_engine
        legacy_engine.dispose()


def test_food_logs_are_isolated_between_users_and_delete_all_is_scoped() -> None:
    """User ownership must isolate reads and scoped deletes across authenticated sessions."""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    original_engine = db_module.engine
    db_module.engine = test_engine
    try:
        with Session(test_engine) as session:
            user_a = CalorieAppUserDB(status="active")
            user_b = CalorieAppUserDB(status="active")
            session.add_all([user_a, user_b])
            session.commit()
            user_a_id = user_a.id
            user_b_id = user_b.id

        with TestClient(app) as client_a, TestClient(app) as client_b:
            client_a.cookies.set(SESSION_COOKIE_NAME, _create_session_for_user(user_a_id))
            client_b.cookies.set(SESSION_COOKIE_NAME, _create_session_for_user(user_b_id))

            create_a = client_a.post(
                "/log-food",
                json={
                    "product_name": "A only",
                    "calories": 101.0,
                    "protein": 1.0,
                    "fat": 1.0,
                    "carbohydrates": 1.0,
                },
            )
            assert create_a.status_code == 200
            a_log_id = create_a.json()["id"]

            # User B must not see User A logs.
            logs_b_initial = client_b.get("/logs")
            assert logs_b_initial.status_code == 200
            assert all(item["id"] != a_log_id for item in logs_b_initial.json())

            # User B must not be able to delete User A logs.
            delete_a_by_b = client_b.delete(f"/logs/{a_log_id}")
            assert delete_a_by_b.status_code == 403

            create_b1 = client_b.post(
                "/log-food",
                json={
                    "product_name": "B1",
                    "calories": 201.0,
                    "protein": 2.0,
                    "fat": 2.0,
                    "carbohydrates": 2.0,
                },
            )
            create_b2 = client_b.post(
                "/log-food",
                json={
                    "product_name": "B2",
                    "calories": 202.0,
                    "protein": 2.0,
                    "fat": 2.0,
                    "carbohydrates": 2.0,
                },
            )
            assert create_b1.status_code == 200
            assert create_b2.status_code == 200

            # User B delete-all must only delete their own records.
            delete_all_b = client_b.delete("/logs")
            assert delete_all_b.status_code == 200
            assert delete_all_b.json()["deleted_count"] == 2

            logs_b_after = client_b.get("/logs")
            assert logs_b_after.status_code == 200
            assert logs_b_after.json() == []

            # User A records must remain intact after User B delete-all.
            logs_a_after = client_a.get("/logs")
            assert logs_a_after.status_code == 200
            assert any(item["id"] == a_log_id for item in logs_a_after.json())
    finally:
        db_module.engine = original_engine
        test_engine.dispose()


def test_init_db_creates_pending_login_state_table() -> None:
    """Startup DB init must create the persistent pending login state table."""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    original_engine = db_module.engine
    db_module.engine = test_engine
    try:
        init_db()
        with test_engine.connect() as connection:
            tables = connection.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
            table_names = {row[0] for row in tables}
            assert "pendingloginstate" in table_names
    finally:
        db_module.engine = original_engine
        test_engine.dispose()


def test_delete_single_log_entry(authenticated_client: TestClient) -> None:
    created = authenticated_client.post("/log-food", json={"product_name": "Delete Me", "calories": 10.0}).json()
    log_id = created["id"]

    response = authenticated_client.delete(f"/logs/{log_id}")
    assert response.status_code == 200
    assert response.json()["deleted_id"] == log_id

    logs = authenticated_client.get("/logs").json()
    assert all(item["id"] != log_id for item in logs)


def test_delete_single_log_entry_not_found(authenticated_client: TestClient) -> None:
    response = authenticated_client.delete("/logs/9999")
    assert response.status_code == 404


def test_delete_all_logs(authenticated_client: TestClient) -> None:
    authenticated_client.post("/log-food", json={"product_name": "A", "calories": 100.0})
    authenticated_client.post("/log-food", json={"product_name": "B", "calories": 200.0})

    response = authenticated_client.delete("/logs")
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 2

    logs = authenticated_client.get("/logs").json()
    assert logs == []


def test_totals_after_deleting_one_log(authenticated_client: TestClient) -> None:
    a = authenticated_client.post(
        "/log-food",
        json={
            "product_name": "Food A",
            "calories": 100.0,
            "protein": 10.0,
            "fat": 5.0,
            "carbohydrates": 20.0,
        },
    ).json()
    authenticated_client.post(
        "/log-food",
        json={
            "product_name": "Food B",
            "calories": 200.0,
            "protein": 20.0,
            "fat": 10.0,
            "carbohydrates": 30.0,
        },
    )

    authenticated_client.delete(f"/logs/{a['id']}")
    logs = authenticated_client.get("/logs").json()
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
