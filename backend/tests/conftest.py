"""
Shared pytest fixtures for CalorieApp backend tests.
Each test gets an isolated in-memory SQLite database so the
production calorieapp.db is never touched during the test run.
"""
import hashlib
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlmodel.pool import StaticPool

import app.database as db_module
from app.main import _ROUTE_RATE_LIMITER, app
from app.models import AuthSessionDB, CalorieAppUserDB

SESSION_COOKIE_NAME = "calorieapp_session"
SESSION_TOKEN_BYTES = 48
SESSION_ABSOLUTE_LIFETIME_SECONDS = 8 * 60 * 60


@pytest.fixture(autouse=True)
def reset_local_route_rate_limiter():
    """Keep the process-local test equivalent isolated between test cases."""
    _ROUTE_RATE_LIMITER.reset_for_tests()
    yield
    _ROUTE_RATE_LIMITER.reset_for_tests()


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


@pytest.fixture()
def authenticated_client() -> TestClient:
    """
    Return a TestClient with an authenticated user session.
    Simulates a logged-in user by setting the session cookie.
    """
    # Create a test engine
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    # Create a user in the test database
    with Session(test_engine) as session:
        user = CalorieAppUserDB(status="active")
        session.add(user)
        session.commit()
        user_id = user.id

        session_token = token_urlsafe(SESSION_TOKEN_BYTES)
        token_hash = hashlib.sha256(session_token.encode("utf-8")).hexdigest()
        now = datetime.now(UTC)
        auth_session = AuthSessionDB(
            session_token_hash=token_hash,
            calorieapp_user_id=user_id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(seconds=SESSION_ABSOLUTE_LIFETIME_SECONDS),
        )
        session.add(auth_session)
        session.commit()

    # Replace the engine
    original_engine = db_module.engine
    db_module.engine = test_engine

    # Create the client with the replaced engine
    with TestClient(app) as test_client:
        # Set the session cookie
        test_client.cookies.set(SESSION_COOKIE_NAME, session_token)
        yield test_client

    # Restore the original engine
    db_module.engine = original_engine
    test_engine.dispose()
