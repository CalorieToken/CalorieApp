from __future__ import annotations

import asyncio
import hashlib
import multiprocessing
import os
from concurrent.futures import ProcessPoolExecutor
from datetime import timedelta
from secrets import token_urlsafe
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from sqlalchemy.engine import Engine, make_url
from sqlmodel import Session, create_engine, select

import app.database as db_module
import app.main as main_module
from app.capacity import database_capacity_snapshot, database_used_bytes
from app.capacity_probe import EXIT_PAUSE, capacity_probe_from_session
from app.main import SESSION_COOKIE_NAME, app
from app.models import (
    AuthSessionDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    utc_now,
)
from app.provider_rate_governor import PostgreSQLSlidingWindowRateGovernor
from app.route_rate_limiter import (
    PostgreSQLRouteRateLimiter,
    RouteRateLimitRejected,
    RouteRatePolicy,
)
from app.schema_migrations import SCHEMA_HEAD, current_revision, upgrade_database
from app.schema_migrations.versions.v20260830_0001 import food_log as migration_food_log
from app.source_admission import AdapterAdmissionRejected


POSTGRES_TEST_URL_ENV = "CALORIEAPP_POSTGRES_TEST_DATABASE_URL"


def _shared_rate_governor_process_attempt(
    args: tuple[str, str, int],
) -> tuple[str, int | None, int | None]:
    raw_url, provider_key, limit = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    governor = PostgreSQLSlidingWindowRateGovernor(
        worker_engine,
        provider_key=provider_key,
        limit=limit,
        window_seconds=60,
    )
    try:
        asyncio.run(governor.acquire())
    except AdapterAdmissionRejected as exc:
        return ("rejected", exc.status_code, exc.retry_after_seconds)
    finally:
        worker_engine.dispose()
    return ("admitted", None, None)


def _shared_route_limiter_process_attempt(
    args: tuple[str, str, int],
) -> tuple[str, int | None, int | None]:
    raw_url, route_key, limit = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    limiter = PostgreSQLRouteRateLimiter(worker_engine)
    policy = RouteRatePolicy(route_key, limit)
    try:
        asyncio.run(limiter.acquire(policy))
    except RouteRateLimitRejected as exc:
        return ("rejected", exc.status_code, exc.retry_after_seconds)
    finally:
        worker_engine.dispose()
    return ("admitted", None, None)


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


def _create_user_session(engine: Engine, subject: str) -> tuple[str, str]:
    now = utc_now()
    token = token_urlsafe(48)
    user = CalorieAppUserDB(status="active")
    with Session(engine) as session:
        session.add(user)
        session.flush()
        session.add(
            ExternalIdentityDB(
                calorieapp_user_id=user.id,
                provider="synthetic_ci",
                external_subject=subject,
                created_at=now,
                last_verified_at=now,
            )
        )
        session.add(
            AuthSessionDB(
                session_token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
                calorieapp_user_id=user.id,
                created_at=now,
                last_seen_at=now,
                expires_at=now + timedelta(hours=8),
            )
        )
        session.commit()
        return user.id, token


def _client(engine: Engine, token: str) -> TestClient:
    db_module.engine = engine
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, token)
    return client


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
    assert db_module.database_readiness(postgres_engine) == {
        "status": "ready",
        "database_revision": SCHEMA_HEAD,
    }
    assert "food_log" in inspect(postgres_engine).get_table_names()
    assert "provider_rate_event" in inspect(postgres_engine).get_table_names()
    assert "route_rate_event" in inspect(postgres_engine).get_table_names()


def test_postgresql_shared_rate_window_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SHARED-RATE-GOVERNOR",
    )
    raw_url = _required_postgresql_test_url()
    provider_key = f"synthetic_ci_{uuid4().hex}"
    arguments = [(raw_url, provider_key, 8)] * 12

    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(executor.map(_shared_rate_governor_process_attempt, arguments))

    assert [result[0] for result in results].count("admitted") == 8
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == 4
    assert all(status_code == 429 for _, status_code, _ in rejected)
    assert all(1 <= retry_after <= 60 for _, _, retry_after in rejected)

    with postgres_engine.connect() as connection:
        count = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM provider_rate_event WHERE provider_key = %s",
            (provider_key,),
        ).scalar_one()
    assert count == 8


def test_postgresql_missing_governor_table_fails_closed(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SHARED-RATE-FAIL-CLOSED",
    )
    with postgres_engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE provider_rate_event")

    governor = PostgreSQLSlidingWindowRateGovernor(
        postgres_engine,
        provider_key=f"synthetic_ci_{uuid4().hex}",
        limit=8,
        window_seconds=60,
    )
    with pytest.raises(AdapterAdmissionRejected) as rejected:
        asyncio.run(governor.acquire())
    assert rejected.value.reason == "shared_rate_governor_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5


def test_postgresql_shared_route_window_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SHARED-ROUTE-LIMITER",
    )
    raw_url = _required_postgresql_test_url()
    route_key = f"synthetic_route_{uuid4().hex}"
    arguments = [(raw_url, route_key, 8)] * 12

    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(executor.map(_shared_route_limiter_process_attempt, arguments))

    assert [result[0] for result in results].count("admitted") == 8
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == 4
    assert all(status_code == 429 for _, status_code, _ in rejected)
    assert all(1 <= retry_after <= 60 for _, _, retry_after in rejected)

    with postgres_engine.connect() as connection:
        count = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM route_rate_event WHERE route_key = %s",
            (route_key,),
        ).scalar_one()
    assert count == 8


def test_postgresql_missing_route_rate_table_fails_closed(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SHARED-ROUTE-FAIL-CLOSED",
    )
    with postgres_engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE route_rate_event")

    limiter = PostgreSQLRouteRateLimiter(postgres_engine)
    with pytest.raises(RouteRateLimitRejected) as rejected:
        asyncio.run(
            limiter.acquire(RouteRatePolicy(f"synthetic_route_{uuid4().hex}", 8))
        )
    assert rejected.value.reason == "shared_route_limiter_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5


def test_postgresql_capacity_signal_enforces_exact_configured_budget(
    postgres_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-CAPACITY-SIGNAL",
    )
    with Session(postgres_engine) as session:
        used_bytes = database_used_bytes(session)
        assert used_bytes > 0
        monkeypatch.setenv(
            "CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES",
            str(used_bytes),
        )
        snapshot = database_capacity_snapshot(session)
        probe = capacity_probe_from_session(
            session,
            {"CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES": str(used_bytes)},
        )

    assert snapshot is not None
    assert snapshot.used_bytes >= used_bytes
    assert snapshot.onboarding_paused is True
    assert probe.exit_code == EXIT_PAUSE
    assert probe.payload["level"] == "pause"
    assert probe.payload["threshold_percent"] == 95
    assert "used_bytes" not in probe.payload
    assert "limit_bytes" not in probe.payload


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


def test_postgresql_identity_history_survives_application_engine_restart(
    postgres_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw_url = _required_postgresql_test_url()
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-IDENTITY-PERSISTENCE",
    )
    user_a_id, token_a = _create_user_session(postgres_engine, "synthetic-user-a")
    user_b_id, token_b = _create_user_session(postgres_engine, "synthetic-user-b")

    original_engine = db_module.engine
    monkeypatch.setenv("CALORIEAPP_ENV", "staging")
    try:
        with _client(postgres_engine, token_a) as client_a:
            response_a = client_a.post(
                "/log-food",
                json={"product_name": "Synthetic Apple", "calories": 52},
            )
            assert response_a.status_code == 200
            log_a_id = response_a.json()["id"]

        with _client(postgres_engine, token_b) as client_b:
            response_b = client_b.post(
                "/log-food",
                json={"product_name": "Synthetic Oats", "calories": 389},
            )
            assert response_b.status_code == 200
            log_b_id = response_b.json()["id"]

        postgres_engine.dispose()
        restarted_engine = create_engine(raw_url, pool_pre_ping=True)
        try:
            with _client(restarted_engine, token_a) as restarted_a:
                assert restarted_a.get("/ready").json()["database_revision"] == SCHEMA_HEAD
                logs_a = restarted_a.get("/logs")
                assert logs_a.status_code == 200
                assert [item["product_name"] for item in logs_a.json()] == [
                    "Synthetic Apple"
                ]
                assert restarted_a.delete(f"/logs/{log_b_id}").status_code == 403

            with _client(restarted_engine, token_b) as restarted_b:
                logs_b = restarted_b.get("/logs")
                assert logs_b.status_code == 200
                assert [item["product_name"] for item in logs_b.json()] == [
                    "Synthetic Oats"
                ]
        finally:
            restarted_engine.dispose()

        verification_engine = create_engine(raw_url, pool_pre_ping=True)
        try:
            with Session(verification_engine) as session:
                persisted = session.exec(select(FoodLogDB).order_by(FoodLogDB.id)).all()
                assert [(entry.id, entry.owner_id) for entry in persisted] == [
                    (log_a_id, user_a_id),
                    (log_b_id, user_b_id),
                ]
        finally:
            verification_engine.dispose()
    finally:
        db_module.engine = original_engine


def test_postgresql_account_erasure_clears_cross_account_session_reference(
    postgres_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-ACCOUNT-ERASURE-REFERENCES",
    )
    other_user_id, _ = _create_user_session(
        postgres_engine,
        "synthetic-erasure-reference-owner",
    )
    target_user_id, target_token = _create_user_session(
        postgres_engine,
        "synthetic-erasure-target",
    )

    with Session(postgres_engine) as session:
        target_session = session.exec(
            select(AuthSessionDB).where(
                AuthSessionDB.calorieapp_user_id == target_user_id
            )
        ).one()
        other_session = session.exec(
            select(AuthSessionDB).where(
                AuthSessionDB.calorieapp_user_id == other_user_id
            )
        ).one()
        other_session.replaced_by_session_id = target_session.id
        session.add(other_session)
        session.commit()
        other_session_id = other_session.id

    original_engine = db_module.engine
    monkeypatch.setattr(main_module, "_ACCOUNT_ERASURE_ENABLED", True)
    try:
        with _client(postgres_engine, target_token) as client:
            response = client.request(
                "DELETE",
                "/api/identity/account",
                json={
                    "confirm_user_id": target_user_id,
                    "acknowledgement": "delete-my-calorieapp-account",
                },
            )
            assert response.status_code == 200

        with Session(postgres_engine) as session:
            assert session.get(CalorieAppUserDB, target_user_id) is None
            assert session.get(CalorieAppUserDB, other_user_id) is not None
            preserved_session = session.get(AuthSessionDB, other_session_id)
            assert preserved_session is not None
            assert preserved_session.replaced_by_session_id is None
    finally:
        db_module.engine = original_engine
