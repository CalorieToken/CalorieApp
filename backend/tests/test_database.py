from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import inspect
from sqlmodel import SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app import models  # noqa: F401
from app.database import (
    _normalize_database_url,
    database_readiness,
    validate_database_environment,
)
from app.schema_migrations import (
    SCHEMA_HEAD,
    MigrationError,
    assert_database_at_head,
    current_revision,
    upgrade_database,
)


def test_normalize_render_postgresql_url_uses_psycopg_v3() -> None:
    assert (
        _normalize_database_url("postgresql://user:password@example.test/calorieapp")
        == "postgresql+psycopg://user:password@example.test/calorieapp"
    )


def test_normalize_legacy_postgres_url_uses_psycopg_v3() -> None:
    assert (
        _normalize_database_url("postgres://user:password@example.test/calorieapp")
        == "postgresql+psycopg://user:password@example.test/calorieapp"
    )


def test_normalize_database_url_preserves_explicit_driver_and_sqlite() -> None:
    assert _normalize_database_url("postgresql+psycopg://example.test/db") == "postgresql+psycopg://example.test/db"
    assert _normalize_database_url("sqlite:///calorieapp.db") == "sqlite:///calorieapp.db"


@pytest.mark.parametrize("environment", ["local", "test"])
def test_sqlite_is_allowed_only_for_explicit_local_or_test(environment: str) -> None:
    assert (
        validate_database_environment(
            "sqlite:///calorieapp.db",
            environment,
        )
        == environment
    )


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_sqlite_fails_closed_outside_local_and_test(environment: str) -> None:
    with pytest.raises(RuntimeError, match="SQLite is only allowed"):
        validate_database_environment("sqlite:///calorieapp.db", environment)


def test_explicit_database_url_requires_explicit_environment() -> None:
    with pytest.raises(RuntimeError, match="CALORIEAPP_ENV must be set"):
        validate_database_environment(
            "postgresql://user:password@example.test/calorieapp",
            None,
        )


def test_postgresql_is_accepted_for_staging_and_production() -> None:
    for environment in ("staging", "production"):
        assert (
            validate_database_environment(
                "postgresql://user:password@example.test/calorieapp",
                environment,
            )
            == environment
        )


def _memory_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def _schema_signature(target_engine) -> dict[str, dict[str, object]]:
    inspector = inspect(target_engine)
    ignored_tables = {"calorie_schema_revision"}
    signature: dict[str, dict[str, object]] = {}
    for table_name in sorted(set(inspector.get_table_names()) - ignored_tables):
        unique_sets = {
            tuple(item["column_names"])
            for item in inspector.get_unique_constraints(table_name)
            if item.get("column_names")
        }
        unique_sets.update(
            tuple(item["column_names"])
            for item in inspector.get_indexes(table_name)
            if item.get("unique") and item.get("column_names")
        )
        signature[table_name] = {
            "columns": tuple(
                (
                    column["name"],
                    str(column["type"]),
                    bool(column["nullable"]),
                )
                for column in inspector.get_columns(table_name)
            ),
            "foreign_keys": {
                (
                    tuple(item["constrained_columns"]),
                    item["referred_table"],
                    tuple(item["referred_columns"]),
                )
                for item in inspector.get_foreign_keys(table_name)
            },
            "indexes": {
                (item["name"], tuple(item["column_names"]), bool(item["unique"]))
                for item in inspector.get_indexes(table_name)
            },
            "unique_sets": unique_sets,
        }
    return signature


def test_versioned_baseline_matches_current_sqlmodel_schema() -> None:
    model_engine = _memory_engine()
    migration_engine = _memory_engine()
    try:
        SQLModel.metadata.create_all(model_engine)
        assert upgrade_database(migration_engine) == SCHEMA_HEAD
        assert _schema_signature(migration_engine) == _schema_signature(model_engine)
    finally:
        model_engine.dispose()
        migration_engine.dispose()


def test_migration_is_idempotent_and_records_one_revision() -> None:
    test_engine = _memory_engine()
    try:
        assert upgrade_database(test_engine) == SCHEMA_HEAD
        assert upgrade_database(test_engine) == SCHEMA_HEAD
        assert current_revision(test_engine) == SCHEMA_HEAD
        with test_engine.connect() as connection:
            count = connection.exec_driver_sql(
                "SELECT COUNT(*) FROM calorie_schema_revision"
            ).scalar_one()
        assert count == 1
    finally:
        test_engine.dispose()


def test_legacy_food_log_is_preserved_and_receives_owner_foreign_key() -> None:
    test_engine = _memory_engine()
    try:
        with test_engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE food_log (
                    id INTEGER PRIMARY KEY,
                    product_name VARCHAR(120) NOT NULL,
                    calories FLOAT NOT NULL,
                    protein FLOAT NOT NULL,
                    fat FLOAT NOT NULL,
                    carbohydrates FLOAT NOT NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                """
                INSERT INTO food_log
                    (id, product_name, calories, protein, fat, carbohydrates, created_at)
                VALUES
                    (1, 'Legacy Preserved', 123, 4, 5, 6, '2026-01-01 00:00:00')
                """
            )

        upgrade_database(test_engine)

        with test_engine.connect() as connection:
            row = connection.exec_driver_sql(
                "SELECT id, product_name, owner_id FROM food_log WHERE id = 1"
            ).one()
        assert tuple(row) == (1, "Legacy Preserved", None)
        owner_foreign_keys = [
            item
            for item in inspect(test_engine).get_foreign_keys("food_log")
            if item["constrained_columns"] == ["owner_id"]
        ]
        assert len(owner_foreign_keys) == 1
        assert owner_foreign_keys[0]["referred_table"] == "calorieappuser"
    finally:
        test_engine.dispose()


def test_legacy_food_log_with_unknown_column_fails_closed_without_data_loss() -> None:
    test_engine = _memory_engine()
    try:
        with test_engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE food_log (
                    id INTEGER PRIMARY KEY,
                    product_name VARCHAR(120) NOT NULL,
                    calories FLOAT NOT NULL,
                    protein FLOAT NOT NULL,
                    fat FLOAT NOT NULL,
                    carbohydrates FLOAT NOT NULL,
                    created_at DATETIME NOT NULL,
                    legacy_note TEXT
                )
                """
            )
            connection.exec_driver_sql(
                """
                INSERT INTO food_log
                    (id, product_name, calories, protein, fat, carbohydrates,
                     created_at, legacy_note)
                VALUES
                    (1, 'Legacy Preserved', 123, 4, 5, 6,
                     '2026-01-01 00:00:00', 'must-not-disappear')
                """
            )

        with pytest.raises(RuntimeError, match="unsupported columns.*legacy_note"):
            upgrade_database(test_engine)

        with test_engine.connect() as connection:
            columns = {
                str(column["name"])
                for column in inspect(connection).get_columns("food_log")
            }
            row = connection.exec_driver_sql(
                "SELECT id, product_name, legacy_note FROM food_log WHERE id = 1"
            ).one()
        assert "legacy_note" in columns
        assert tuple(row) == (1, "Legacy Preserved", "must-not-disappear")
        assert current_revision(test_engine) is None
    finally:
        test_engine.dispose()


def test_readiness_is_read_only_and_requires_schema_head() -> None:
    test_engine = _memory_engine()
    try:
        with pytest.raises(MigrationError, match="not at required head"):
            assert_database_at_head(test_engine)
        upgrade_database(test_engine)
        assert database_readiness(test_engine) == {
            "status": "ready",
            "database_revision": SCHEMA_HEAD,
        }
    finally:
        test_engine.dispose()


def test_migration_history_stores_approved_reference_without_secret_data() -> None:
    test_engine = _memory_engine()
    try:
        upgrade_database(test_engine, approval_reference="CHANGE-2026-001")
        with test_engine.connect() as connection:
            applied_at, reference = connection.exec_driver_sql(
                "SELECT applied_at, approval_reference FROM calorie_schema_revision"
            ).one()
        applied_at_utc = datetime.fromisoformat(str(applied_at)).replace(tzinfo=UTC)
        age_seconds = (datetime.now(UTC) - applied_at_utc).total_seconds()
        assert 0 <= age_seconds < 5
        assert reference == "CHANGE-2026-001"
    finally:
        test_engine.dispose()
