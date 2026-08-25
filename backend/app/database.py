"""
Database setup for CalorieApp backend.
Uses SQLModel with local SQLite by default and PostgreSQL in hosted environments.
"""
import os
from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

# Read DATABASE_URL from environment; default to local SQLite file.
# Format: sqlite:///path/to/db.sqlite or sqlite+pysqlite:///path
if DATABASE_URL := os.getenv("DATABASE_URL"):
    pass  # Use environment configuration
else:
    # Local development default: SQLite file one directory above this file (backend/calorieapp.db).
    _DB_PATH = Path(__file__).parent.parent / "calorieapp.db"
    DATABASE_URL = f"sqlite:///{_DB_PATH}"

_IS_SQLITE = DATABASE_URL.startswith("sqlite:")
_ENGINE_OPTIONS = {"connect_args": {"check_same_thread": False}} if _IS_SQLITE else {"pool_pre_ping": True}
engine = create_engine(DATABASE_URL, **_ENGINE_OPTIONS)

_OPTIONAL_LOG_COLUMNS: dict[str, tuple[str, str]] = {
    "owner_id": ("TEXT", "TEXT"),
    "portion_percentage": ("REAL", "DOUBLE PRECISION"),
    "barcode": ("TEXT", "TEXT"),
    "image_url": ("TEXT", "TEXT"),
    "brand": ("TEXT", "TEXT"),
    "serving_size": ("TEXT", "TEXT"),
    "nutri_score": ("TEXT", "TEXT"),
}


def _ensure_food_log_optional_columns() -> None:
    """Add known nullable columns without resetting existing SQLite/PostgreSQL data."""
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not inspector.has_table("food_log"):
            return
        existing = {str(column["name"]) for column in inspector.get_columns("food_log")}
        dialect_index = 0 if connection.dialect.name == "sqlite" else 1
        quote = connection.dialect.identifier_preparer.quote

        for column_name, column_types in _OPTIONAL_LOG_COLUMNS.items():
            if column_name in existing:
                continue
            column_type = column_types[dialect_index]
            connection.execute(text(f"ALTER TABLE {quote('food_log')} ADD COLUMN {quote(column_name)} {column_type}"))


def init_db() -> None:
    """Create all SQLModel tables if they do not already exist."""
    SQLModel.metadata.create_all(engine)
    _ensure_food_log_optional_columns()


def get_session():
    """FastAPI dependency that yields a database session per request."""
    with Session(engine) as session:
        yield session
