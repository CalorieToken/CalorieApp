"""Guarded two-process persistence drill for synthetic PostgreSQL CI data only."""

from __future__ import annotations

import hashlib
import os
import socket
import subprocess
import sys
import time
from datetime import timedelta
from pathlib import Path

import httpx
from sqlalchemy.engine import URL, make_url
from sqlmodel import Session, create_engine, select

from .models import (
    AuthSessionDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    utc_now,
)
from .schema_migrations import SCHEMA_HEAD, assert_database_at_head, upgrade_database


DATABASE_URL_ENV = "CALORIEAPP_POSTGRES_REDEPLOY_URL"
EXPECTED_DATABASE = "calorieapp_ci_test"
_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}
_BACKEND_HOST = "127.0.0.1"
_USER_ID = "00000000-0000-0000-0000-000000000071"
_SESSION_TOKEN = "synthetic-redeploy-session-token"
_PRODUCT_NAME = "Synthetic Redeploy Pear"
_BACKEND_ROOT = Path(__file__).resolve().parents[1]


def validate_drill_url(raw_url: str) -> URL:
    """Fail closed unless the URL targets the exact loopback CI database."""
    if not raw_url.strip():
        raise ValueError("Redeploy drill URL is required")

    parsed = make_url(raw_url)
    if parsed.get_backend_name() != "postgresql":
        raise ValueError("Redeploy drill URL must use PostgreSQL")
    if parsed.host not in _LOOPBACK_HOSTS:
        raise ValueError("Redeploy drill URL must target a loopback-only server")
    if parsed.database != EXPECTED_DATABASE:
        raise ValueError(f"Redeploy drill URL must target {EXPECTED_DATABASE}")
    if not parsed.username or not parsed.password:
        raise ValueError("Redeploy drill URL must include synthetic CI credentials")
    if parsed.query:
        raise ValueError("Redeploy drill URL must not contain connection query options")
    return parsed


def _reset_and_seed(database_url: URL) -> None:
    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql("DROP SCHEMA IF EXISTS public CASCADE")
            connection.exec_driver_sql("CREATE SCHEMA public")

        revision = upgrade_database(
            engine,
            approval_reference="CI-SYNTHETIC-REDEPLOY-PERSISTENCE-DRILL",
        )
        if revision != SCHEMA_HEAD:
            raise RuntimeError("Synthetic redeploy database did not reach schema head")

        now = utc_now()
        with Session(engine) as session:
            session.add(CalorieAppUserDB(id=_USER_ID, status="active"))
            session.flush()
            session.add(
                ExternalIdentityDB(
                    calorieapp_user_id=_USER_ID,
                    provider="synthetic_redeploy_ci",
                    external_subject="synthetic-redeploy-user",
                )
            )
            session.add(
                AuthSessionDB(
                    calorieapp_user_id=_USER_ID,
                    session_token_hash=hashlib.sha256(
                        _SESSION_TOKEN.encode("utf-8")
                    ).hexdigest(),
                    created_at=now,
                    last_seen_at=now,
                    expires_at=now + timedelta(hours=1),
                )
            )
            session.commit()
    finally:
        engine.dispose()


def _unused_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind((_BACKEND_HOST, 0))
        return int(listener.getsockname()[1])


def _backend_environment(database_url: URL) -> dict[str, str]:
    environment = os.environ.copy()
    environment.update(
        {
            "DATABASE_URL": database_url.render_as_string(hide_password=False),
            "CALORIEAPP_ENV": "staging",
            "CORS_ORIGINS": "https://synthetic-redeploy.invalid",
            "WORDPRESS_BRIDGE_SECRET": "synthetic-ci-only-not-a-live-secret",
            "SESSION_COOKIE_SECURE": "true",
        }
    )
    return environment


def _start_backend(database_url: URL) -> tuple[subprocess.Popen[bytes], str]:
    port = _unused_loopback_port()
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            _BACKEND_HOST,
            "--port",
            str(port),
        ],
        cwd=_BACKEND_ROOT,
        env=_backend_environment(database_url),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return process, f"http://{_BACKEND_HOST}:{port}"


def _wait_until_ready(process: subprocess.Popen[bytes], base_url: str) -> None:
    deadline = time.monotonic() + 20
    with httpx.Client(timeout=1.0, trust_env=False) as client:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError("Synthetic backend exited before becoming ready")
            try:
                response = client.get(f"{base_url}/ready")
                if response.status_code == 200:
                    payload = response.json()
                    if payload.get("database_revision") != SCHEMA_HEAD:
                        raise RuntimeError("Synthetic backend reported the wrong schema head")
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.2)
    raise RuntimeError("Synthetic backend did not become ready in time")


def _stop_backend(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def _write_through_first_process(database_url: URL) -> int:
    process, base_url = _start_backend(database_url)
    try:
        _wait_until_ready(process, base_url)
        with httpx.Client(timeout=5.0, trust_env=False) as client:
            response = client.post(
                f"{base_url}/log-food",
                headers={"Cookie": f"calorieapp_session={_SESSION_TOKEN}"},
                json={
                    "product_name": _PRODUCT_NAME,
                    "calories": 71.0,
                    "protein": 1.0,
                    "fat": 0.2,
                    "carbohydrates": 18.0,
                },
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("product_name") != _PRODUCT_NAME:
                raise RuntimeError("First backend returned unexpected synthetic history")
            return int(payload["id"])
    finally:
        _stop_backend(process)


def _read_through_replacement_process(database_url: URL, log_id: int) -> None:
    process, base_url = _start_backend(database_url)
    try:
        _wait_until_ready(process, base_url)
        with httpx.Client(timeout=5.0, trust_env=False) as client:
            response = client.get(
                f"{base_url}/logs",
                headers={"Cookie": f"calorieapp_session={_SESSION_TOKEN}"},
            )
            response.raise_for_status()
            payload = response.json()
            if [(item.get("id"), item.get("product_name")) for item in payload] != [
                (log_id, _PRODUCT_NAME)
            ]:
                raise RuntimeError("Replacement backend did not read persisted history")
    finally:
        _stop_backend(process)


def _verify_database(database_url: URL, log_id: int) -> None:
    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        assert_database_at_head(engine)
        with Session(engine) as session:
            rows = session.exec(select(FoodLogDB)).all()
        if [(row.id, row.product_name, row.owner_id) for row in rows] != [
            (log_id, _PRODUCT_NAME, _USER_ID)
        ]:
            raise RuntimeError("Persisted synthetic history ownership is incorrect")
    finally:
        engine.dispose()


def run_drill(raw_url: str) -> None:
    """Write in one backend process and read after full process replacement."""
    database_url = validate_drill_url(raw_url)
    _reset_and_seed(database_url)
    log_id = _write_through_first_process(database_url)
    _read_through_replacement_process(database_url, log_id)
    _verify_database(database_url, log_id)


def main() -> int:
    run_drill(os.getenv(DATABASE_URL_ENV, ""))
    print(f"redeploy_persistence_drill=passed revision={SCHEMA_HEAD} synthetic_logs=1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
