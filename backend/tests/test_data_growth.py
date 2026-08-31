from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel, Session, create_engine, select

import app.data_growth as growth_module
import app.database as db_module
import app.main as main_module
from app.data_growth import (
    DataGrowthAdmissionRejected,
    create_food_log_with_subject_budget,
)
from app.models import CalorieAppUserDB, FoodLogDB


def test_reviewed_subject_budget_default_remains_ten_thousand() -> None:
    assert growth_module.FOOD_LOG_SUBJECT_ENTRY_LIMIT == 10_000


def _entry(owner_id: str, label: str) -> FoodLogDB:
    return FoodLogDB(
        product_name=label,
        calories=1,
        owner_id=owner_id,
    )


def test_subject_budget_rejects_without_deleting_history_and_delete_frees_space(
    tmp_path,
) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'growth.db'}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            user = CalorieAppUserDB(status="active")
            session.add(user)
            session.commit()
            owner_id = user.id

        with Session(engine) as session:
            create_food_log_with_subject_budget(
                session,
                _entry(owner_id, "one"),
                limit=2,
            )
            create_food_log_with_subject_budget(
                session,
                _entry(owner_id, "two"),
                limit=2,
            )
            with pytest.raises(DataGrowthAdmissionRejected) as rejected:
                create_food_log_with_subject_budget(
                    session,
                    _entry(owner_id, "blocked"),
                    limit=2,
                )
            assert rejected.value.reason == "food_log_subject_budget_reached"
            assert rejected.value.status_code == 409
            assert rejected.value.retry_after_seconds is None
            entries = session.exec(
                select(FoodLogDB).where(FoodLogDB.owner_id == owner_id)
            ).all()
            assert [entry.product_name for entry in entries] == ["one", "two"]

            session.delete(entries[0])
            session.commit()
            created = create_food_log_with_subject_budget(
                session,
                _entry(owner_id, "after-delete"),
                limit=2,
            )
            assert created.product_name == "after-delete"
            assert len(
                session.exec(
                    select(FoodLogDB).where(FoodLogDB.owner_id == owner_id)
                ).all()
            ) == 2
    finally:
        engine.dispose()


def test_sqlite_subject_budget_serializes_concurrent_local_writers(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'concurrent-growth.db'}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            user = CalorieAppUserDB(status="active")
            session.add(user)
            session.commit()
            owner_id = user.id

        def attempt(index: int) -> str:
            with Session(engine) as session:
                try:
                    create_food_log_with_subject_budget(
                        session,
                        _entry(owner_id, f"entry-{index}"),
                        limit=3,
                    )
                except DataGrowthAdmissionRejected as exc:
                    return exc.reason
            return "admitted"

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(attempt, range(8)))

        assert results.count("admitted") == 3
        assert results.count("food_log_subject_budget_reached") == 5
        with Session(engine) as session:
            assert len(
                session.exec(
                    select(FoodLogDB).where(FoodLogDB.owner_id == owner_id)
                ).all()
            ) == 3
    finally:
        engine.dispose()


def test_growth_admission_database_failure_fails_closed() -> None:
    class BrokenSession:
        rolled_back = False

        def get_bind(self):
            raise SQLAlchemyError("synthetic database failure")

        def rollback(self) -> None:
            self.rolled_back = True

    session = BrokenSession()
    with pytest.raises(DataGrowthAdmissionRejected) as rejected:
        create_food_log_with_subject_budget(  # type: ignore[arg-type]
            session,
            _entry("owner-id", "blocked"),
        )

    assert rejected.value.reason == "data_growth_admission_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5
    assert session.rolled_back is True


def test_log_food_endpoint_returns_persistent_budget_conflict(
    authenticated_client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(growth_module, "FOOD_LOG_SUBJECT_ENTRY_LIMIT", 2)

    assert authenticated_client.post(
        "/log-food", json={"product_name": "one", "calories": 1}
    ).status_code == 200
    assert authenticated_client.post(
        "/log-food", json={"product_name": "two", "calories": 2}
    ).status_code == 200

    rejected = authenticated_client.post(
        "/log-food", json={"product_name": "blocked", "calories": 3}
    )

    assert rejected.status_code == 409
    assert rejected.json() == {"detail": "Food log storage budget reached"}
    assert rejected.headers["cache-control"] == "no-store"
    assert "retry-after" not in rejected.headers
    assert [item["product_name"] for item in authenticated_client.get("/logs").json()] == [
        "two",
        "one",
    ]

    deleted = authenticated_client.delete("/logs/1")
    assert deleted.status_code == 200
    assert authenticated_client.post(
        "/log-food", json={"product_name": "after-delete", "calories": 4}
    ).status_code == 200


def test_log_food_endpoint_returns_bounded_unavailable_response(
    authenticated_client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def reject(*_args, **_kwargs):
        raise DataGrowthAdmissionRejected(
            "data_growth_admission_unavailable",
            status_code=503,
            retry_after_seconds=5,
        )

    monkeypatch.setattr(main_module, "create_food_log_with_subject_budget", reject)

    response = authenticated_client.post(
        "/log-food", json={"product_name": "blocked", "calories": 1}
    )

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Food log storage admission temporarily unavailable"
    }
    assert response.headers["retry-after"] == "5"
    with Session(db_module.engine) as session:
        assert session.exec(select(FoodLogDB)).all() == []
