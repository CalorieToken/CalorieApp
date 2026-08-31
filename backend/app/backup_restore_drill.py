"""Guarded PostgreSQL logical backup and restore drill for synthetic CI data only."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from sqlalchemy import text
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


SOURCE_URL_ENV = "CALORIEAPP_POSTGRES_BACKUP_SOURCE_URL"
RESTORE_URL_ENV = "CALORIEAPP_POSTGRES_BACKUP_RESTORE_URL"
SOURCE_DATABASE = "calorieapp_ci_test"
RESTORE_DATABASE = "calorieapp_ci_restore"
_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


@dataclass(frozen=True)
class DrillUrls:
    """Validated source and restore URLs for the isolated synthetic drill."""

    source: URL
    restore: URL


def _validate_url(raw_url: str, *, expected_database: str, label: str) -> URL:
    if not raw_url.strip():
        raise ValueError(f"{label} URL is required")

    parsed = make_url(raw_url)
    if parsed.get_backend_name() != "postgresql":
        raise ValueError(f"{label} URL must use PostgreSQL")
    if parsed.host not in _LOOPBACK_HOSTS:
        raise ValueError(f"{label} URL must target a loopback-only server")
    if parsed.database != expected_database:
        raise ValueError(f"{label} URL must target {expected_database}")
    if not parsed.username or not parsed.password:
        raise ValueError(f"{label} URL must include synthetic CI credentials")
    if parsed.query:
        raise ValueError(f"{label} URL must not contain connection query options")
    return parsed


def validate_drill_urls(source_url: str, restore_url: str) -> DrillUrls:
    """Fail closed unless both URLs describe the exact loopback CI boundary."""
    source = _validate_url(
        source_url,
        expected_database=SOURCE_DATABASE,
        label="Source",
    )
    restore = _validate_url(
        restore_url,
        expected_database=RESTORE_DATABASE,
        label="Restore",
    )
    if (source.host, source.port, source.username) != (
        restore.host,
        restore.port,
        restore.username,
    ):
        raise ValueError("Source and restore URLs must use the same isolated CI server")
    return DrillUrls(source=source, restore=restore)


def _connection_args(url: URL) -> list[str]:
    args = ["--host", str(url.host), "--username", str(url.username)]
    if url.port is not None:
        args.extend(["--port", str(url.port)])
    args.extend(["--dbname", str(url.database)])
    return args


def _command_environment(url: URL) -> dict[str, str]:
    environment = os.environ.copy()
    environment["PGPASSWORD"] = str(url.password)
    environment["PGCONNECT_TIMEOUT"] = "5"
    return environment


def _run_postgresql_command(command: list[str], *, url: URL) -> None:
    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
            env=_command_environment(url),
        )
    except subprocess.CalledProcessError as exc:
        executable = Path(command[0]).name
        raise RuntimeError(f"{executable} failed during the synthetic restore drill") from exc


def _reset_schema(url: URL) -> None:
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql("DROP SCHEMA IF EXISTS public CASCADE")
            connection.exec_driver_sql("CREATE SCHEMA public")
    finally:
        engine.dispose()


def _ensure_restore_database(url: URL) -> None:
    admin_engine = create_engine(
        url.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
        pool_pre_ping=True,
    )
    try:
        with admin_engine.connect() as connection:
            exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :database"),
                {"database": RESTORE_DATABASE},
            ).scalar_one_or_none()
            if exists is None:
                connection.exec_driver_sql(f'CREATE DATABASE "{RESTORE_DATABASE}"')
    finally:
        admin_engine.dispose()


def _seed_source(url: URL) -> tuple[list[str], list[str]]:
    engine = create_engine(url, pool_pre_ping=True)
    try:
        revision = upgrade_database(
            engine,
            approval_reference="CI-SYNTHETIC-BACKUP-RESTORE-DRILL",
        )
        if revision != SCHEMA_HEAD:
            raise RuntimeError("Synthetic source did not reach the required schema head")

        user_ids = [
            "00000000-0000-0000-0000-000000000061",
            "00000000-0000-0000-0000-000000000062",
        ]
        products = ["Synthetic Restore Apple", "Synthetic Restore Oats"]
        now = utc_now()
        with Session(engine) as session:
            for index, (user_id, product) in enumerate(
                zip(user_ids, products, strict=True),
                start=1,
            ):
                session.add(CalorieAppUserDB(id=user_id, status="active"))
                session.flush()
                session.add(
                    ExternalIdentityDB(
                        calorieapp_user_id=user_id,
                        provider="synthetic_restore_ci",
                        external_subject=f"synthetic-restore-user-{index}",
                    )
                )
                session.add(
                    AuthSessionDB(
                        calorieapp_user_id=user_id,
                        session_token_hash=str(index) * 64,
                        created_at=now,
                        last_seen_at=now,
                        expires_at=now + timedelta(hours=8),
                    )
                )
                session.add(
                    FoodLogDB(
                        product_name=product,
                        calories=50.0 * index,
                        owner_id=user_id,
                    )
                )
            session.commit()
        return user_ids, products
    finally:
        engine.dispose()


def _verify_restore(url: URL, user_ids: list[str], products: list[str]) -> None:
    engine = create_engine(url, pool_pre_ping=True)
    try:
        assert_database_at_head(engine)
        with Session(engine) as session:
            users = session.exec(
                select(CalorieAppUserDB).order_by(CalorieAppUserDB.id)
            ).all()
            identities = session.exec(
                select(ExternalIdentityDB).order_by(ExternalIdentityDB.external_subject)
            ).all()
            auth_sessions = session.exec(
                select(AuthSessionDB).order_by(AuthSessionDB.calorieapp_user_id)
            ).all()
            food_logs = session.exec(select(FoodLogDB).order_by(FoodLogDB.id)).all()

        if [user.id for user in users] != user_ids:
            raise RuntimeError("Restored synthetic account identifiers differ from source")
        if [identity.calorieapp_user_id for identity in identities] != user_ids:
            raise RuntimeError("Restored identity ownership differs from source")
        if [auth.calorieapp_user_id for auth in auth_sessions] != user_ids:
            raise RuntimeError("Restored authentication ownership differs from source")
        if [(row.product_name, row.owner_id) for row in food_logs] != list(
            zip(products, user_ids, strict=True)
        ):
            raise RuntimeError("Restored food-history ownership differs from source")
    finally:
        engine.dispose()


def run_drill(source_url: str, restore_url: str) -> None:
    """Create, restore and verify one disposable custom-format PostgreSQL archive."""
    urls = validate_drill_urls(source_url, restore_url)
    pg_dump = shutil.which("pg_dump")
    pg_restore = shutil.which("pg_restore")
    if pg_dump is None or pg_restore is None:
        raise RuntimeError("pg_dump and pg_restore are required for the restore drill")

    _reset_schema(urls.source)
    _ensure_restore_database(urls.restore)
    _reset_schema(urls.restore)
    user_ids, products = _seed_source(urls.source)

    with tempfile.TemporaryDirectory(prefix="calorieapp-synthetic-restore-") as directory:
        archive = Path(directory) / "calorieapp-ci.backup"
        _run_postgresql_command(
            [
                pg_dump,
                "--format=custom",
                "--no-owner",
                "--no-privileges",
                "--file",
                str(archive),
                *_connection_args(urls.source),
            ],
            url=urls.source,
        )
        if not archive.is_file() or archive.stat().st_size == 0:
            raise RuntimeError("Synthetic backup archive was not created")

        _run_postgresql_command(
            [
                pg_restore,
                "--clean",
                "--if-exists",
                "--no-owner",
                "--no-privileges",
                "--single-transaction",
                *_connection_args(urls.restore),
                str(archive),
            ],
            url=urls.restore,
        )

    _verify_restore(urls.restore, user_ids, products)


def main() -> int:
    source_url = os.getenv(SOURCE_URL_ENV, "")
    restore_url = os.getenv(RESTORE_URL_ENV, "")
    run_drill(source_url, restore_url)
    print(f"backup_restore_drill=passed revision={SCHEMA_HEAD} synthetic_users=2")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
