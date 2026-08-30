from __future__ import annotations

import os

import pytest
from sqlalchemy import inspect
from sqlalchemy.engine import Engine, make_url
from sqlmodel import create_engine

from app.database import database_readiness
from app.schema_migrations import SCHEMA_HEAD, current_revision, upgrade_database
from app.schema_migrations.versions.v20260830_0001 import food_log as migration_food_log


POSTGRES_TEST_URL_ENV = "CALORIEAPP_POSTGRES_TEST_DATABASE_URL"


def _required_postgresql_test_url() -> str:
    raw_url = os.getenv(POSTGRES_TEST_URL_ENV, "").strip()
    if not raw_url:
        pytest.skip(f"{POSTGRES_TEST_URL_ENV} is not configured")

    parsed = make_url(raw_url)
    if parsed.get_backend_name() != "postgresql":
        pytest.fail(f"{POSTGRES_TEST_URL_ENV} must use PostgreSQL")
    if parsed.host not in {"127.0.0.1", "localhost", "::1"}:
        pytest.fail(f"{POSTGRES_TEST_URL_ENV} must target a loopback-only test server")
    if parsed.database != "calorieapp_ci_test":
        pytest.fail(f"{POSTGRES_TEST_URL_ENV} must target calorieapp_ci_test")
    return raw_url


def _reset_synthetic_database(engine: Engine) -> None:
    """Reset only the hard-coded loopback CI database guarded above."""
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP SCHEMA IF EXISTS public CASCADE")
        connection.exec_driver_sql("CREATE SCHEMA public")


@pytest.fixture()
def postgres_engine() -> Engine:
    raw_url = _required_postgresql_test_url()
    engine = create_engine(raw_url, pool_pre_ping=True)
    _reset_synthetic_database(engine)
    try:
        yield engine
    finally:
        engine.dispose()
        cleanup_engine = create_engine(raw_url, pool_pre_ping=True)
        try:
            _reset_synthetic_database(cleanup_engine)
        finally:
            cleanup_engine.dispose()


def test_postgresql_empty_database_migrates_and_is_ready(
    postgres_engine: Engine,
) -> None:
    assert (
        upgrade_database(
            postgres_engine,
            approval_reference="CI-POSTGRES-EMPTY-DATABASE",
        )
        == SCHEMA_HEAD
    )
    assert current_revision(postgres_engine) == SCHEMA_HEAD
    assert database_readiness(postgres_engine) == {
        "status": "ready",
        "database_revision": SCHEMA_HEAD,
    }
    assert "food_log" in inspect(postgres_engine).get_table_names()


def test_postgresql_legacy_food_log_is_preserved(
    postgres_engine: Engine,
) -> None:
    with postgres_engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE food_log (
                id INTEGER PRIMARY KEY,
                product_name VARCHAR(120) NOT NULL,
                calories DOUBLE PRECISION NOT NULL,
                protein DOUBLE PRECISION NOT NULL,
                fat DOUBLE PRECISION NOT NULL,
                carbohydrates DOUBLE PRECISION NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO food_log
                (id, product_name, calories, protein, fat, carbohydrates, created_at)
            VALUES
                (1, 'Synthetic Legacy Record', 123, 4, 5, 6, '2026-01-01 00:00:00')
            """
        )

    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-LEGACY-DATABASE",
    )

    inspector = inspect(postgres_engine)
    actual_columns = {
        str(column["name"]) for column in inspector.get_columns("food_log")
    }
    expected_columns = {column.name for column in migration_food_log.columns}
    assert actual_columns == expected_columns

    with postgres_engine.connect() as connection:
        row = connection.exec_driver_sql(
            "SELECT id, product_name, owner_id FROM food_log WHERE id = 1"
        ).one()
    assert tuple(row) == (1, "Synthetic Legacy Record", None)
    assert any(
        foreign_key["constrained_columns"] == ["owner_id"]
        and foreign_key["referred_table"] == "calorieappuser"
        for foreign_key in inspector.get_foreign_keys("food_log")
    )
