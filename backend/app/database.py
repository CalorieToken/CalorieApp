"""Database configuration, startup guards and readiness for CalorieApp."""
import os
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine, make_url
from sqlmodel import Session, create_engine

from .schema_migrations import (
    SCHEMA_HEAD,
    assert_database_at_head,
    current_revision,
    upgrade_database,
)


def _normalize_database_url(database_url: str) -> str:
    """Select the installed psycopg v3 driver for provider-style PostgreSQL URLs."""
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


_DATABASE_URL_FROM_ENV = os.getenv("DATABASE_URL")
if _DATABASE_URL_FROM_ENV:
    DATABASE_URL = _DATABASE_URL_FROM_ENV
    _DATABASE_URL_WAS_EXPLICIT = True
else:
    # Local development default: SQLite file one directory above this file (backend/calorieapp.db).
    _DB_PATH = Path(__file__).parent.parent / "calorieapp.db"
    DATABASE_URL = f"sqlite:///{_DB_PATH}"
    _DATABASE_URL_WAS_EXPLICIT = False

DATABASE_URL = _normalize_database_url(DATABASE_URL)

_IS_SQLITE = DATABASE_URL.startswith("sqlite:")
_ENGINE_OPTIONS = {"connect_args": {"check_same_thread": False}} if _IS_SQLITE else {"pool_pre_ping": True}
engine = create_engine(DATABASE_URL, **_ENGINE_OPTIONS)

_ALLOWED_ENVIRONMENTS = {"local", "test", "staging", "production"}


def validate_database_environment(
    database_url: str,
    environment: str | None,
    *,
    database_url_was_explicit: bool = True,
) -> str:
    """Validate the environment/database pairing and return the resolved environment."""
    normalized_environment = environment.strip().lower() if environment and environment.strip() else None
    if normalized_environment is None:
        if database_url_was_explicit:
            raise RuntimeError(
                "CALORIEAPP_ENV must be set when DATABASE_URL is explicitly configured"
            )
        normalized_environment = "local"

    if normalized_environment not in _ALLOWED_ENVIRONMENTS:
        allowed = ", ".join(sorted(_ALLOWED_ENVIRONMENTS))
        raise RuntimeError(f"CALORIEAPP_ENV must be one of: {allowed}")

    backend_name = make_url(_normalize_database_url(database_url)).get_backend_name()
    if backend_name not in {"sqlite", "postgresql"}:
        raise RuntimeError("DATABASE_URL must use SQLite or PostgreSQL")
    if backend_name == "sqlite" and normalized_environment not in {"local", "test"}:
        raise RuntimeError(
            "SQLite is only allowed when CALORIEAPP_ENV is local or test; "
            f"current environment is {normalized_environment}"
        )
    if normalized_environment in {"staging", "production"} and backend_name != "postgresql":
        raise RuntimeError(
            f"{normalized_environment} requires a PostgreSQL DATABASE_URL"
        )
    return normalized_environment


def _configured_environment() -> str:
    return validate_database_environment(
        str(engine.url),
        os.getenv("CALORIEAPP_ENV"),
        database_url_was_explicit=_DATABASE_URL_WAS_EXPLICIT,
    )


def init_db() -> None:
    """Upgrade local/test databases and require pre-approved migrations elsewhere."""
    environment = _configured_environment()
    if environment in {"local", "test"}:
        upgrade_database(engine)
    else:
        assert_database_at_head(engine)


def database_readiness(target_engine: Engine | None = None) -> dict[str, str]:
    """Perform a read-only connectivity and migration-head check."""
    selected_engine = target_engine or engine
    validate_database_environment(
        str(selected_engine.url),
        os.getenv("CALORIEAPP_ENV"),
        database_url_was_explicit=(
            _DATABASE_URL_WAS_EXPLICIT if target_engine is None else False
        ),
    )
    with selected_engine.connect() as connection:
        connection.execute(text("SELECT 1")).scalar_one()
    assert_database_at_head(selected_engine)
    return {"status": "ready", "database_revision": current_revision(selected_engine) or SCHEMA_HEAD}


def get_session():
    """FastAPI dependency that yields a database session per request."""
    with Session(engine) as session:
        yield session
