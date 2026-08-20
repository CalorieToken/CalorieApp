"""
Database setup for CalorieApp backend.
Uses SQLite via SQLModel. No migrations needed — tables are created on startup.
"""
import os
from pathlib import Path

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


def init_db() -> None:
    """Create all SQLModel tables if they do not already exist."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency that yields a database session per request."""
    with Session(engine) as session:
        yield session
