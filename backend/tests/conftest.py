"""
Shared pytest fixtures for CalorieApp backend tests.
Each test gets an isolated in-memory SQLite database so the
production calorieapp.db is never touched during the test run.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
from sqlmodel.pool import StaticPool

import app.database as db_module
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    """
    Return a TestClient backed by a fresh in-memory SQLite database.
    The engine is swapped before each test and restored after,
    so every test starts with a clean slate.
    """
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    original_engine = db_module.engine
    db_module.engine = test_engine

    with TestClient(app) as test_client:
        yield test_client

    db_module.engine = original_engine
    test_engine.dispose()
