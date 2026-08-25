from app.database import _normalize_database_url


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
