"""Fail-closed acceptance helpers for one isolated Neon synthetic database."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Sequence

import httpx
from sqlalchemy import func, inspect
from sqlalchemy.engine import Engine, URL, make_url
from sqlmodel import SQLModel, Session, create_engine, select

from .database import _normalize_database_url
from .models import (
    AuthSessionDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    RouteRateEventDB,
)
from .schema_migrations import SCHEMA_HEAD, assert_database_at_head, upgrade_database


SCHEMA_VERSION = "calorieapp.synthetic-staging-acceptance.v1"
DATABASE_URL_ENV = "CALORIEAPP_SYNTHETIC_NEON_DATABASE_URL"
RESTORE_URL_ENV = "CALORIEAPP_SYNTHETIC_EXIT_RESTORE_URL"
RESTORE_DATABASE = "calorieapp_synthetic_exit"
SYNTHETIC_USER_ID = "00000000-0000-0000-0000-000000000092"
SYNTHETIC_IDENTITY_PROVIDER = "synthetic_neon_acceptance"
SYNTHETIC_EXTERNAL_SUBJECT = "synthetic-step1-only"
SYNTHETIC_PRODUCT = "Synthetic Step 1 Pear"
SYNTHETIC_REDEPLOY_PRODUCT = "Synthetic Step 1 Redeploy Pear"
SYNTHETIC_SESSION_ID = "00000000-0000-0000-0000-000000000093"
SYNTHETIC_SESSION_TOKEN = "synthetic-step1-redeploy-session-token"

_NEON_HOST_SUFFIX = ".neon.tech"
_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})
_BACKEND_HOST = "127.0.0.1"
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_STARTUP_TIMEOUT_SECONDS = 180.0
_BACKEND_HEALTH_REQUEST_TIMEOUT_SECONDS = 1.0
_BACKEND_READY_REQUEST_TIMEOUT_SECONDS = 180.0
_BACKEND_HEALTH_POLL_INTERVAL_SECONDS = 0.5
_APPROVAL_REFERENCE = re.compile(
    r"STEP1-SYNTHETIC-ACCEPTANCE-20[0-9]{2}-[0-9]{2}-[0-9]{2}"
)
_ALLOWED_NEON_QUERY_KEYS = frozenset({"channel_binding", "sslmode"})


class SyntheticStagingSafetyError(RuntimeError):
    """Raised when the target or its contents exceed the synthetic boundary."""


@dataclass(frozen=True)
class SyntheticSnapshot:
    user_count: int
    identity_count: int
    auth_session_count: int
    food_log_count: int

    def payload(self, status: str) -> dict[str, object]:
        return {
            "auth_session_count": self.auth_session_count,
            "food_log_count": self.food_log_count,
            "identity_count": self.identity_count,
            "schema_version": SCHEMA_VERSION,
            "status": status,
            "user_count": self.user_count,
        }


def validate_source_url(raw_url: str) -> URL:
    """Accept only a credential-bearing TLS Neon PostgreSQL URL."""
    if not raw_url.strip():
        raise SyntheticStagingSafetyError("synthetic source URL is required")
    try:
        parsed = make_url(raw_url)
    except Exception as exc:
        raise SyntheticStagingSafetyError("synthetic source URL is invalid") from exc
    if parsed.get_backend_name() != "postgresql":
        raise SyntheticStagingSafetyError("synthetic source must use PostgreSQL")
    host = (parsed.host or "").lower().rstrip(".")
    if not host.endswith(_NEON_HOST_SUFFIX):
        raise SyntheticStagingSafetyError("synthetic source must be a Neon host")
    if parsed.port not in {None, 5432}:
        raise SyntheticStagingSafetyError("synthetic source must use PostgreSQL port")
    if not parsed.username or not parsed.password or not parsed.database:
        raise SyntheticStagingSafetyError("synthetic source credentials are incomplete")
    if set(parsed.query) - _ALLOWED_NEON_QUERY_KEYS:
        raise SyntheticStagingSafetyError("synthetic source URL has unexpected options")
    if parsed.query.get("sslmode") != "require":
        raise SyntheticStagingSafetyError("synthetic source must require TLS")
    if parsed.query.get("channel_binding") != "require":
        raise SyntheticStagingSafetyError(
            "synthetic source must require channel binding"
        )
    return parsed


def validate_restore_url(raw_url: str) -> URL:
    """Accept only the exact disposable loopback PostgreSQL restore target."""
    if not raw_url.strip():
        raise SyntheticStagingSafetyError("synthetic restore URL is required")
    try:
        parsed = make_url(raw_url)
    except Exception as exc:
        raise SyntheticStagingSafetyError("synthetic restore URL is invalid") from exc
    if parsed.get_backend_name() != "postgresql":
        raise SyntheticStagingSafetyError("synthetic restore must use PostgreSQL")
    if (parsed.host or "").lower() not in _LOOPBACK_HOSTS:
        raise SyntheticStagingSafetyError("synthetic restore must be loopback-only")
    if parsed.database != RESTORE_DATABASE:
        raise SyntheticStagingSafetyError(
            f"synthetic restore database must be {RESTORE_DATABASE}"
        )
    if not parsed.username or not parsed.password:
        raise SyntheticStagingSafetyError("synthetic restore credentials are incomplete")
    if parsed.query:
        raise SyntheticStagingSafetyError("synthetic restore URL has unexpected options")
    return parsed


def validate_approval_reference(reference: str) -> str:
    """Return the exact low-cardinality operation approval reference."""
    normalized = reference.strip()
    if _APPROVAL_REFERENCE.fullmatch(normalized) is None:
        raise SyntheticStagingSafetyError("synthetic operation approval is invalid")
    return normalized


def assert_source_is_empty(engine: Engine) -> None:
    """Refuse to migrate a source that already contains public-schema tables."""
    schema = "public" if engine.dialect.name == "postgresql" else None
    tables = inspect(engine).get_table_names(schema=schema)
    if tables:
        raise SyntheticStagingSafetyError("synthetic source is not empty")


def _application_table_counts(engine: Engine) -> dict[str, int]:
    with engine.connect() as connection:
        return {
            table.name: int(
                connection.execute(
                    select(func.count()).select_from(table)
                ).scalar_one()
            )
            for table in SQLModel.metadata.sorted_tables
        }


def _assert_only_expected_rows(
    engine: Engine,
    *,
    expected_food_log_count: int,
) -> SyntheticSnapshot:
    counts = _application_table_counts(engine)
    expected_route_keys = (
        ["food_log_create", "food_log_list"]
        if expected_food_log_count == 2
        else []
    )
    expected_nonzero = {
        CalorieAppUserDB.__tablename__: 1,
        ExternalIdentityDB.__tablename__: 1,
        AuthSessionDB.__tablename__: 1,
        FoodLogDB.__tablename__: expected_food_log_count,
        RouteRateEventDB.__tablename__: len(expected_route_keys),
    }
    unexpected = {
        table: count
        for table, count in counts.items()
        if count != expected_nonzero.get(table, 0)
    }
    if unexpected:
        raise SyntheticStagingSafetyError("unexpected synthetic application rows")

    with Session(engine) as session:
        users = session.exec(select(CalorieAppUserDB)).all()
        identities = session.exec(select(ExternalIdentityDB)).all()
        auth_sessions = session.exec(select(AuthSessionDB)).all()
        food_logs = session.exec(select(FoodLogDB)).all()
        route_events = session.exec(select(RouteRateEventDB)).all()
    if len(users) != 1 or users[0].id != SYNTHETIC_USER_ID:
        raise SyntheticStagingSafetyError("unexpected synthetic user")
    if len(identities) != 1:
        raise SyntheticStagingSafetyError("unexpected synthetic identity")
    identity = identities[0]
    if (
        identity.calorieapp_user_id != SYNTHETIC_USER_ID
        or identity.provider != SYNTHETIC_IDENTITY_PROVIDER
        or identity.external_subject != SYNTHETIC_EXTERNAL_SUBJECT
        or identity.xrpl_address is not None
    ):
        raise SyntheticStagingSafetyError("unexpected synthetic identity")
    if len(food_logs) != expected_food_log_count:
        raise SyntheticStagingSafetyError("unexpected synthetic food history")
    if len(auth_sessions) != 1:
        raise SyntheticStagingSafetyError("unexpected synthetic session")
    auth_session = auth_sessions[0]
    if (
        auth_session.id != SYNTHETIC_SESSION_ID
        or auth_session.calorieapp_user_id != SYNTHETIC_USER_ID
        or auth_session.session_token_hash
        != hashlib.sha256(SYNTHETIC_SESSION_TOKEN.encode("utf-8")).hexdigest()
        or auth_session.revoked_at is not None
        or auth_session.replaced_by_session_id is not None
    ):
        raise SyntheticStagingSafetyError("unexpected synthetic session")
    expected_food = {
        SYNTHETIC_PRODUCT: (92.0, 1.0, 0.2, 24.0),
    }
    if expected_food_log_count == 2:
        expected_food[SYNTHETIC_REDEPLOY_PRODUCT] = (71.0, 1.0, 0.2, 18.0)
    actual_food = {
        row.product_name: (
            row.calories,
            row.protein,
            row.fat,
            row.carbohydrates,
        )
        for row in food_logs
        if row.owner_id == SYNTHETIC_USER_ID
    }
    if actual_food != expected_food:
        raise SyntheticStagingSafetyError("unexpected synthetic food history")
    if sorted(event.route_key for event in route_events) != sorted(expected_route_keys):
        raise SyntheticStagingSafetyError(
            "unexpected synthetic route admission history"
        )
    return SyntheticSnapshot(
        user_count=1,
        identity_count=1,
        auth_session_count=1,
        food_log_count=expected_food_log_count,
    )


def migrate_and_seed(engine: Engine, approval_reference: str) -> SyntheticSnapshot:
    """Migrate one empty target and write the fixed non-personal acceptance rows."""
    reference = validate_approval_reference(approval_reference)
    assert_source_is_empty(engine)
    revision = upgrade_database(engine, approval_reference=reference)
    if revision != SCHEMA_HEAD:
        raise SyntheticStagingSafetyError("synthetic migration missed schema head")
    if any(_application_table_counts(engine).values()):
        raise SyntheticStagingSafetyError("synthetic schema contains pre-existing rows")

    fixed_time = datetime(2026, 9, 3, 12, 0, 0)
    session_time = datetime.now(UTC).replace(tzinfo=None)
    with Session(engine) as session:
        session.add(
            CalorieAppUserDB(
                id=SYNTHETIC_USER_ID,
                created_at=fixed_time,
                updated_at=fixed_time,
                last_authenticated_activity_at=fixed_time,
                status="active",
            )
        )
        session.flush()
        session.add(
            ExternalIdentityDB(
                calorieapp_user_id=SYNTHETIC_USER_ID,
                provider=SYNTHETIC_IDENTITY_PROVIDER,
                external_subject=SYNTHETIC_EXTERNAL_SUBJECT,
                created_at=fixed_time,
                last_verified_at=fixed_time,
            )
        )
        session.add(
            AuthSessionDB(
                id=SYNTHETIC_SESSION_ID,
                calorieapp_user_id=SYNTHETIC_USER_ID,
                session_token_hash=hashlib.sha256(
                    SYNTHETIC_SESSION_TOKEN.encode("utf-8")
                ).hexdigest(),
                created_at=fixed_time,
                last_seen_at=session_time,
                expires_at=fixed_time + timedelta(days=36500),
            )
        )
        session.add(
            FoodLogDB(
                owner_id=SYNTHETIC_USER_ID,
                product_name=SYNTHETIC_PRODUCT,
                calories=92.0,
                protein=1.0,
                fat=0.2,
                carbohydrates=24.0,
                created_at=fixed_time,
            )
        )
        session.commit()
    return _assert_only_expected_rows(engine, expected_food_log_count=1)


def verify_synthetic_snapshot(
    engine: Engine,
    *,
    expected_food_log_count: int = 2,
) -> SyntheticSnapshot:
    """Verify schema head, exact row counts, ownership and synthetic markers."""
    assert_database_at_head(engine)
    return _assert_only_expected_rows(
        engine,
        expected_food_log_count=expected_food_log_count,
    )


def _unused_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind((_BACKEND_HOST, 0))
        return int(listener.getsockname()[1])


def _start_backend(raw_url: str) -> tuple[subprocess.Popen[bytes], str]:
    port = _unused_loopback_port()
    environment = os.environ.copy()
    environment.update(
        {
            "CALORIEAPP_ENV": "staging",
            "CORS_ORIGINS": "https://synthetic-step1.invalid",
            "DATABASE_URL": raw_url,
            "SESSION_COOKIE_SECURE": "true",
            "WORDPRESS_BRIDGE_SECRET": "synthetic-step1-only-not-a-live-secret",
        }
    )
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
        env=environment,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return process, f"http://{_BACKEND_HOST}:{port}"


def _wait_until_ready(process: subprocess.Popen[bytes], base_url: str) -> None:
    deadline = time.monotonic() + _BACKEND_STARTUP_TIMEOUT_SECONDS
    with httpx.Client(
        timeout=_BACKEND_HEALTH_REQUEST_TIMEOUT_SECONDS,
        trust_env=False,
    ) as client:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise SyntheticStagingSafetyError(
                    "synthetic backend stopped before readiness"
                )
            try:
                response = client.get(f"{base_url}/health")
                if response.status_code == 200:
                    payload = response.json()
                    if (
                        payload.get("status") == "ok"
                        and payload.get("service") == "calorieapp-backend"
                    ):
                        break
            except (httpx.HTTPError, ValueError):
                pass
            time.sleep(_BACKEND_HEALTH_POLL_INTERVAL_SECONDS)
        else:
            raise SyntheticStagingSafetyError(
                "synthetic backend did not start before deadline"
            )

        if process.poll() is not None:
            raise SyntheticStagingSafetyError(
                "synthetic backend stopped before readiness"
            )
        try:
            response = client.get(
                f"{base_url}/ready",
                timeout=_BACKEND_READY_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise SyntheticStagingSafetyError(
                "synthetic backend readiness check failed"
            ) from exc
        if (
            payload.get("status") != "ready"
            or payload.get("service") != "calorieapp-backend"
            or payload.get("database_revision") != SCHEMA_HEAD
        ):
            raise SyntheticStagingSafetyError(
                "synthetic backend reported unexpected readiness state"
            )


def _stop_backend(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def run_process_replacement(raw_url: str) -> SyntheticSnapshot:
    """Write through one backend process and read through its replacement."""
    validate_source_url(raw_url)
    engine = _engine(raw_url)
    try:
        verify_synthetic_snapshot(engine, expected_food_log_count=1)
    finally:
        engine.dispose()

    first_process, first_url = _start_backend(raw_url)
    try:
        _wait_until_ready(first_process, first_url)
        with httpx.Client(timeout=5.0, trust_env=False) as client:
            response = client.post(
                f"{first_url}/log-food",
                headers={
                    "Cookie": f"calorieapp_session={SYNTHETIC_SESSION_TOKEN}"
                },
                json={
                    "product_name": SYNTHETIC_REDEPLOY_PRODUCT,
                    "calories": 71.0,
                    "protein": 1.0,
                    "fat": 0.2,
                    "carbohydrates": 18.0,
                },
            )
            response.raise_for_status()
    finally:
        _stop_backend(first_process)

    replacement_process, replacement_url = _start_backend(raw_url)
    try:
        _wait_until_ready(replacement_process, replacement_url)
        with httpx.Client(timeout=5.0, trust_env=False) as client:
            response = client.get(
                f"{replacement_url}/logs",
                headers={
                    "Cookie": f"calorieapp_session={SYNTHETIC_SESSION_TOKEN}"
                },
            )
            response.raise_for_status()
            products = {item.get("product_name") for item in response.json()}
            if products != {SYNTHETIC_PRODUCT, SYNTHETIC_REDEPLOY_PRODUCT}:
                raise SyntheticStagingSafetyError(
                    "replacement backend returned unexpected synthetic history"
                )
    finally:
        _stop_backend(replacement_process)

    engine = _engine(raw_url)
    try:
        return verify_synthetic_snapshot(engine)
    finally:
        engine.dispose()


def _engine(raw_url: str) -> Engine:
    return create_engine(_normalize_database_url(raw_url), pool_pre_ping=True)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run one fail-closed synthetic staging acceptance operation"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    migrate = subparsers.add_parser("migrate-seed")
    migrate.add_argument("--approval-reference", required=True)
    subparsers.add_parser("process-replacement")
    subparsers.add_parser("verify-source")
    subparsers.add_parser("verify-restore")
    return parser


def _render(payload: dict[str, object]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "verify-restore":
        raw_url = os.getenv(RESTORE_URL_ENV, "")
        validate_restore_url(raw_url)
        status = "restore-verified"
        operation = verify_synthetic_snapshot
    else:
        raw_url = os.getenv(DATABASE_URL_ENV, "")
        validate_source_url(raw_url)
        if args.command == "migrate-seed":
            status = "migrated-seeded-and-verified"
            operation = lambda engine: migrate_and_seed(
                engine,
                args.approval_reference,
            )
        elif args.command == "process-replacement":
            snapshot = run_process_replacement(raw_url)
            print(_render(snapshot.payload("process-replacement-verified")))
            return 0
        else:
            status = "source-verified"
            operation = verify_synthetic_snapshot

    engine = _engine(raw_url)
    try:
        snapshot = operation(engine)
    finally:
        engine.dispose()
    print(_render(snapshot.payload(status)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
