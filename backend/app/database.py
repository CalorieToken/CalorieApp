"""
Database setup for CalorieApp backend.
Uses SQLite via SQLModel. No migrations needed — tables are created on startup.
"""
import os
from pathlib import Path

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

# Read DATABASE_URL from environment; default to local SQLite file.
# Format: sqlite:///path/to/db.sqlite or sqlite+pysqlite:///path
if DATABASE_URL := os.getenv("DATABASE_URL"):
    pass  # Use environment configuration
else:
    # Local development default: SQLite file one directory above this file (backend/calorieapp.db).
    _DB_PATH = Path(__file__).parent.parent / "calorieapp.db"
    DATABASE_URL = f"sqlite:///{_DB_PATH}"

# check_same_thread=False is required for SQLite with FastAPI's async workers.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

_OPTIONAL_LOG_COLUMNS: dict[str, str] = {
    "portion_percentage": "REAL",
    "barcode": "TEXT",
    "image_url": "TEXT",
    "brand": "TEXT",
    "serving_size": "TEXT",
    "nutri_score": "TEXT",
}


def _ensure_food_log_optional_columns() -> None:
    """Add nullable columns to existing SQLite table without resetting current data."""
    with engine.begin() as connection:
        rows = connection.execute(text("PRAGMA table_info(food_log)"))
        existing = {str(row[1]) for row in rows}

        for column_name, column_type in _OPTIONAL_LOG_COLUMNS.items():
            if column_name in existing:
                continue
            connection.execute(text(f"ALTER TABLE food_log ADD COLUMN {column_name} {column_type}"))


def init_db() -> None:
    """Create all SQLModel tables if they do not already exist."""
    SQLModel.metadata.create_all(engine)
    _ensure_food_log_optional_columns()


def get_session():
    """FastAPI dependency that yields a database session per request."""
    with Session(engine) as session:
        yield session
