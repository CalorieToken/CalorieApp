from datetime import datetime

from sqlmodel import Session, select

import app.database as db
from app.models import CalorieAppUserDB, FoodLogDB


def seed_entries():
    with Session(db.engine) as session:
        owner = session.exec(select(CalorieAppUserDB)).first()
        other = CalorieAppUserDB(status="active")
        session.add(other)
        session.flush()
        for index in range(105):
            session.add(FoodLogDB(owner_id=owner.id, product_name=f"Test food {index}",
                calories=10, protein=2, fat=1, carbohydrates=3, nutri_score="A",
                barcode=f"{10000000 + index}",
                created_at=datetime(2026, 9, 10, 22)))
        for who, when in [(owner.id, datetime(2026, 9, 11, 22)),
                          (owner.id, datetime(2026, 9, 10, 21, 59)),
                          (other.id, datetime(2026, 9, 11)),
                          (None, datetime(2026, 9, 11))]:
            session.add(FoodLogDB(owner_id=who, product_name="Outside selected period or owner",
                calories=900, created_at=when))
        session.commit()


def test_period_totals_include_all_pages_and_isolate_owner(authenticated_client):
    seed_entries()
    params = {"start": "2026-09-11T00:00:00+02:00", "end": "2026-09-12T00:00:00+02:00"}
    response = authenticated_client.get("/logs/overview", params=params)
    assert response.status_code == 200
    assert "no-store" in response.headers["cache-control"]
    first = response.json()
    assert len(first["entries"]) == 100
    assert first["count"] == 105
    assert first["calories"] == 1050
    assert first["protein"] == 210
    assert first["grades"] == {"A": 105, "B": 0, "C": 0, "D": 0, "E": 0}
    assert first["sources"] == {"open_food_facts": 105, "usda": 0, "other": 0}
    second = authenticated_client.get("/logs/overview", params={**params, "before": first["next_before"]}).json()
    assert len(second["entries"]) == 5
    assert second["count"] == 105
    assert second["next_before"] is None
    assert not {x["id"] for x in first["entries"]} & {x["id"] for x in second["entries"]}
    # An ordinary old client still receives the original list contract.
    assert isinstance(authenticated_client.get("/logs").json(), list)
    assert authenticated_client.get("/logs/overview").json()["count"] == 107


def test_period_empty_and_invalid_boundaries(authenticated_client):
    valid = {"start": "2026-03-28T23:00:00Z", "end": "2026-03-29T22:00:00Z"}
    response = authenticated_client.get("/logs/overview", params=valid)
    assert response.status_code == 200
    assert response.json()["count"] == 0
    assert response.json()["calories"] == 0
    assert response.json()["sources"] == {"open_food_facts": 0, "usda": 0, "other": 0}
    for params in [{"start": valid["start"]}, {**valid, "end": valid["start"]},
                   {**valid, "end": "2027-01-01T00:00:00Z"},
                   {"start": "2026-09-11", "end": "2026-09-12"}, {"limit": 201}, {"before": 0}]:
        assert authenticated_client.get("/logs/overview", params=params).status_code == 422


def test_diary_overview_requires_authentication(client):
    assert client.get("/logs/overview").status_code == 401


def test_source_counts_cover_off_usda_and_unknown_without_inventing_usda_grades(authenticated_client):
    with Session(db.engine) as session:
        owner = session.exec(select(CalorieAppUserDB)).first()
        session.add(FoodLogDB(
            owner_id=owner.id, product_name="OFF product", calories=100,
            barcode="0012345678905", nutri_score="B",
        ))
        session.add(FoodLogDB(
            owner_id=owner.id, product_name="USDA oats", calories=200,
            brand="USDA FoodData Central · FDC 2346396",
            serving_size="100 g edible · 2026-04-30", nutri_score=None,
        ))
        # Imported or historical rows without established provenance stay
        # visible in totals, but are not attributed to OFF or USDA.
        session.add(FoodLogDB(
            owner_id=owner.id, product_name="Historical item", calories=50,
            nutri_score="A",
        ))
        session.commit()

    overview = authenticated_client.get("/logs/overview").json()
    assert overview["count"] == 3
    assert overview["calories"] == 350
    assert overview["sources"] == {"open_food_facts": 1, "usda": 1, "other": 1}
    assert overview["grades"] == {"A": 0, "B": 1, "C": 0, "D": 0, "E": 0}
