"""Guarded PostgreSQL logical backup and restore drill for synthetic CI data only."""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, text, update
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, create_engine, select

from .account_erasure_replay_proof import (
    AccountErasureReplayProof,
    build_account_erasure_replay_proof,
    verify_account_erasure_replay_proof,
)
from .models import (
    AuthSessionDB,
    AuthorizationCodeDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
    utc_now,
)
from .schema_migrations import SCHEMA_HEAD, assert_database_at_head, upgrade_database


SOURCE_URL_ENV = "CALORIEAPP_POSTGRES_BACKUP_SOURCE_URL"
RESTORE_URL_ENV = "CALORIEAPP_POSTGRES_BACKUP_RESTORE_URL"
SOURCE_DATABASE = "calorieapp_ci_test"
RESTORE_DATABASE = "calorieapp_ci_restore"
_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}
SYNTHETIC_USER_IDS = (
    "00000000-0000-0000-0000-000000000061",
    "00000000-0000-0000-0000-000000000062",
)
SYNTHETIC_PRODUCTS = ("Synthetic Restore Apple", "Synthetic Restore Oats")
SYNTHETIC_REPLAY_MAX_USERS = 10
_SYNTHETIC_REPLAY_SECRET = (
    b"calorieapp-ci-restore-replay-key-not-for-production" * 2
)
_SYNTHETIC_ERASURE_APPROVAL = (
    "CI-SYNTHETIC-AUTHENTICATED-ERASURE-AFTER-BACKUP"
)


class SyntheticRestoreReplaySafetyError(RuntimeError):
    """Raised when the isolated synthetic replay proof cannot fail closed."""


@dataclass(frozen=True)
class DrillUrls:
    """Validated source and restore URLs for the isolated synthetic drill."""

    source: URL
    restore: URL


@dataclass(frozen=True)
class SyntheticReplayContext:
    """In-memory-only replay input held outside the synthetic backup archive."""

    proof: AccountErasureReplayProof
    authorization_reference_sha256: str


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


def _seed_synthetic_accounts(session: Session, *, now: datetime) -> None:
    """Create the exact two-account fixture shared by local and PostgreSQL tests."""

    auth_sessions: list[AuthSessionDB] = []
    for index, (user_id, product) in enumerate(
        zip(SYNTHETIC_USER_IDS, SYNTHETIC_PRODUCTS, strict=True),
        start=1,
    ):
        session.add(
            CalorieAppUserDB(
                id=user_id,
                status="active",
                last_authenticated_activity_at=now,
            )
        )
        session.flush()
        auth_session = AuthSessionDB(
            calorieapp_user_id=user_id,
            session_token_hash=str(index) * 64,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(hours=8),
        )
        auth_sessions.append(auth_session)
        session.add_all(
            [
                ExternalIdentityDB(
                    calorieapp_user_id=user_id,
                    provider="synthetic_restore_ci",
                    external_subject=f"synthetic-restore-user-{index}",
                ),
                auth_session,
                FoodLogDB(
                    product_name=product,
                    calories=50.0 * index,
                    owner_id=user_id,
                ),
                OriginLoginHandoffDB(
                    state_hash=str(index + 2) * 64,
                    handoff_token_hash=str(index + 4) * 64,
                    status="claimed",
                    calorieapp_user_id=user_id,
                    created_at=now - timedelta(minutes=10),
                    expires_at=now + timedelta(minutes=5),
                    completed_at=now - timedelta(minutes=8),
                    claimed_at=now - timedelta(minutes=7),
                ),
                InactiveAccountNoticeDB(
                    calorieapp_user_id=user_id,
                    activity_anchor_at=now - timedelta(days=760),
                    notice_window_started_at=now - timedelta(days=31),
                    retention_due_at=now - timedelta(days=1),
                    delivered_at=now - timedelta(days=30),
                    delivery_channel="synthetic-ci",
                    delivery_evidence_digest=str(index + 6) * 64,
                    status="cancelled",
                    cancelled_at=now - timedelta(days=29),
                    cancellation_reason="authenticated-activity",
                    recorded_at=(
                        now - timedelta(days=30) + timedelta(seconds=1)
                    ),
                )
            ]
        )
    session.flush()
    auth_sessions[1].replaced_by_session_id = auth_sessions[0].id
    session.add(auth_sessions[1])


def _seed_source(url: URL) -> tuple[list[str], list[str]]:
    engine = create_engine(url, pool_pre_ping=True)
    try:
        revision = upgrade_database(
            engine,
            approval_reference="CI-SYNTHETIC-BACKUP-RESTORE-DRILL",
        )
        if revision != SCHEMA_HEAD:
            raise RuntimeError("Synthetic source did not reach the required schema head")

        with Session(engine) as session:
            _seed_synthetic_accounts(session, now=utc_now())
            session.commit()
        return list(SYNTHETIC_USER_IDS), list(SYNTHETIC_PRODUCTS)
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
            handoffs = session.exec(
                select(OriginLoginHandoffDB).order_by(
                    OriginLoginHandoffDB.calorieapp_user_id
                )
            ).all()
            notices = session.exec(
                select(InactiveAccountNoticeDB).order_by(
                    InactiveAccountNoticeDB.calorieapp_user_id
                )
            ).all()

        if [user.id for user in users] != user_ids:
            raise RuntimeError("Restored synthetic account identifiers differ from source")
        if [identity.calorieapp_user_id for identity in identities] != user_ids:
            raise RuntimeError("Restored identity ownership differs from source")
        if [auth.calorieapp_user_id for auth in auth_sessions] != user_ids:
            raise RuntimeError("Restored authentication ownership differs from source")
        if auth_sessions[0].replaced_by_session_id is not None:
            raise RuntimeError("Restored target session replacement state differs")
        if auth_sessions[1].replaced_by_session_id != auth_sessions[0].id:
            raise RuntimeError("Restored inbound session reference differs from source")
        if [(row.product_name, row.owner_id) for row in food_logs] != list(
            zip(products, user_ids, strict=True)
        ):
            raise RuntimeError("Restored food-history ownership differs from source")
        if [handoff.calorieapp_user_id for handoff in handoffs] != user_ids:
            raise RuntimeError("Restored login-handoff ownership differs from source")
        if [notice.calorieapp_user_id for notice in notices] != user_ids:
            raise RuntimeError("Restored inactive-notice ownership differs from source")
    finally:
        engine.dispose()


def _exact_synthetic_rowcount(result: object, *, expected: int, relation: str) -> int:
    rowcount = getattr(result, "rowcount", None)
    try:
        actual = int(rowcount)
    except (TypeError, ValueError, OverflowError):
        actual = -1
    if actual != expected:
        raise SyntheticRestoreReplaySafetyError(
            f"{relation} differs from the exact synthetic replay fixture"
        )
    return actual


def _require_synthetic_replay_url(
    url: URL,
    *,
    expected_databases: set[str],
) -> None:
    if (
        url.get_backend_name() != "postgresql"
        or url.host not in _LOOPBACK_HOSTS
        or url.database not in expected_databases
        or not url.username
        or not url.password
        or url.query
    ):
        raise SyntheticRestoreReplaySafetyError(
            "synthetic replay requires an exact loopback CI database"
        )


def _stage_synthetic_replay_target(session: Session, user_id: str) -> None:
    """Stage the exact synthetic target shape without committing the caller's work."""

    if user_id != SYNTHETIC_USER_IDS[0]:
        raise SyntheticRestoreReplaySafetyError(
            "synthetic replay erasure requires the fixed target"
        )

    subjects = session.exec(
        select(ExternalIdentityDB.external_subject).where(
            ExternalIdentityDB.calorieapp_user_id == user_id
        )
    ).all()
    if len(subjects) != 1:
        raise SyntheticRestoreReplaySafetyError(
            "synthetic target identity fixture differs"
        )
    ambiguous_identity = session.exec(
        select(ExternalIdentityDB.id).where(
            ExternalIdentityDB.external_subject.in_(subjects),
            ExternalIdentityDB.calorieapp_user_id != user_id,
        )
    ).first()
    legacy_authorization = session.exec(
        select(AuthorizationCodeDB.id).where(
            AuthorizationCodeDB.external_subject.in_(subjects)
        )
    ).first()
    if ambiguous_identity is not None or legacy_authorization is not None:
        raise SyntheticRestoreReplaySafetyError(
            "synthetic replay identity requires review"
        )

    owned_session_ids = select(AuthSessionDB.id).where(
        AuthSessionDB.calorieapp_user_id == user_id
    )
    _exact_synthetic_rowcount(
        session.exec(delete(FoodLogDB).where(FoodLogDB.owner_id == user_id)),
        expected=1,
        relation="food_log",
    )
    _exact_synthetic_rowcount(
        session.exec(
            delete(InactiveAccountNoticeDB).where(
                InactiveAccountNoticeDB.calorieapp_user_id == user_id
            )
        ),
        expected=1,
        relation="inactive_account_notice",
    )
    _exact_synthetic_rowcount(
        session.exec(
            delete(OriginLoginHandoffDB).where(
                OriginLoginHandoffDB.calorieapp_user_id == user_id
            )
        ),
        expected=1,
        relation="originloginhandoff",
    )
    _exact_synthetic_rowcount(
        session.exec(
            update(AuthSessionDB)
            .where(AuthSessionDB.replaced_by_session_id.in_(owned_session_ids))
            .values(replaced_by_session_id=None)
        ),
        expected=1,
        relation="inbound_authsession_reference",
    )
    _exact_synthetic_rowcount(
        session.exec(
            delete(AuthSessionDB).where(
                AuthSessionDB.calorieapp_user_id == user_id
            )
        ),
        expected=1,
        relation="authsession",
    )
    _exact_synthetic_rowcount(
        session.exec(
            delete(ExternalIdentityDB).where(
                ExternalIdentityDB.calorieapp_user_id == user_id
            )
        ),
        expected=1,
        relation="externalidentity",
    )
    _exact_synthetic_rowcount(
        session.exec(delete(CalorieAppUserDB).where(CalorieAppUserDB.id == user_id)),
        expected=1,
        relation="calorieappuser",
    )


def _erase_synthetic_replay_target(url: URL, user_id: str) -> None:
    """Commit the fixed erasure only in an exact disposable CI database."""

    _require_synthetic_replay_url(
        url,
        expected_databases={SOURCE_DATABASE, RESTORE_DATABASE},
    )
    if user_id != SYNTHETIC_USER_IDS[0]:
        raise SyntheticRestoreReplaySafetyError(
            "synthetic replay erasure requires the fixed target"
        )
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with Session(engine) as session:
            try:
                _stage_synthetic_replay_target(session, user_id)
                session.commit()
            except SyntheticRestoreReplaySafetyError:
                session.rollback()
                raise
            except SQLAlchemyError as exc:
                session.rollback()
                raise SyntheticRestoreReplaySafetyError(
                    "synthetic replay erasure transaction failed"
                ) from exc
    finally:
        engine.dispose()


def _verify_synthetic_target_erased(
    url: URL,
    *,
    retained_user_id: str,
    retained_product: str,
) -> None:
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with Session(engine) as session:
            users = session.exec(select(CalorieAppUserDB)).all()
            identities = session.exec(select(ExternalIdentityDB)).all()
            auth_sessions = session.exec(select(AuthSessionDB)).all()
            food_logs = session.exec(select(FoodLogDB)).all()
            handoffs = session.exec(select(OriginLoginHandoffDB)).all()
            notices = session.exec(select(InactiveAccountNoticeDB)).all()

        if [user.id for user in users] != [retained_user_id]:
            raise RuntimeError("Synthetic post-erasure account set differs")
        if [identity.calorieapp_user_id for identity in identities] != [
            retained_user_id
        ]:
            raise RuntimeError("Synthetic post-erasure identity set differs")
        if len(auth_sessions) != 1 or (
            auth_sessions[0].calorieapp_user_id != retained_user_id
            or auth_sessions[0].replaced_by_session_id is not None
        ):
            raise RuntimeError("Synthetic post-erasure authentication set differs")
        if [(row.product_name, row.owner_id) for row in food_logs] != [
            (retained_product, retained_user_id)
        ]:
            raise RuntimeError("Synthetic post-erasure food-history set differs")
        if [handoff.calorieapp_user_id for handoff in handoffs] != [retained_user_id]:
            raise RuntimeError("Synthetic post-erasure login-handoff set differs")
        if [notice.calorieapp_user_id for notice in notices] != [retained_user_id]:
            raise RuntimeError("Synthetic post-erasure notice set differs")
    finally:
        engine.dispose()


def _build_synthetic_replay_context(
    *,
    user_id: str,
    erased_at: datetime,
) -> SyntheticReplayContext:
    authorization_digest = hashlib.sha256(
        _SYNTHETIC_ERASURE_APPROVAL.encode("utf-8")
    ).hexdigest()
    proof = build_account_erasure_replay_proof(
        secret_key=_SYNTHETIC_REPLAY_SECRET,
        user_id=user_id,
        erasure_reason="authenticated-user-request",
        erased_at=erased_at,
        authorization_reference_sha256=authorization_digest,
    )
    return SyntheticReplayContext(
        proof=proof,
        authorization_reference_sha256=authorization_digest,
    )


def _match_synthetic_replay_candidate(
    candidate_user_ids: list[str],
    context: SyntheticReplayContext,
) -> str | None:
    """Match one bounded candidate in memory without logging an identifier."""

    if len(candidate_user_ids) > SYNTHETIC_REPLAY_MAX_USERS:
        raise SyntheticRestoreReplaySafetyError(
            "synthetic replay candidate batch exceeds its fixed limit"
        )
    if len(set(candidate_user_ids)) != len(candidate_user_ids):
        raise SyntheticRestoreReplaySafetyError(
            "synthetic replay candidates must be unique"
        )
    matches: list[str] = []
    try:
        for user_id in candidate_user_ids:
            if verify_account_erasure_replay_proof(
                expected_subject_digest=context.proof.subject_digest,
                expected_evidence_digest=context.proof.evidence_digest,
                secret_key=_SYNTHETIC_REPLAY_SECRET,
                user_id=user_id,
                erasure_reason=context.proof.erasure_reason,
                erased_at=context.proof.erased_at.replace(tzinfo=UTC),
                authorization_reference_sha256=(
                    context.authorization_reference_sha256
                ),
            ):
                matches.append(user_id)
    except ValueError as exc:
        raise SyntheticRestoreReplaySafetyError(
            "synthetic replay proof input is invalid"
        ) from exc
    if len(matches) > 1:
        raise SyntheticRestoreReplaySafetyError(
            "synthetic replay proof matched multiple candidates"
        )
    return matches[0] if matches else None


def _replay_synthetic_erasure(url: URL, context: SyntheticReplayContext) -> bool:
    _require_synthetic_replay_url(
        url,
        expected_databases={RESTORE_DATABASE},
    )
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with Session(engine) as session:
            candidate_user_ids = session.exec(
                select(CalorieAppUserDB.id)
                .order_by(CalorieAppUserDB.id)
                .limit(SYNTHETIC_REPLAY_MAX_USERS + 1)
            ).all()
    finally:
        engine.dispose()

    matched_user_id = _match_synthetic_replay_candidate(
        candidate_user_ids,
        context,
    )
    if matched_user_id is None:
        return False
    _erase_synthetic_replay_target(url, matched_user_id)
    return True


def run_drill(source_url: str, restore_url: str) -> None:
    """Restore an older archive and reapply one later synthetic erasure."""
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

        erased_at = utc_now().replace(tzinfo=UTC)
        _erase_synthetic_replay_target(urls.source, user_ids[0])
        replay_context = _build_synthetic_replay_context(
            user_id=user_ids[0],
            erased_at=erased_at,
        )
        _verify_synthetic_target_erased(
            urls.source,
            retained_user_id=user_ids[1],
            retained_product=products[1],
        )

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
    if not _replay_synthetic_erasure(urls.restore, replay_context):
        raise SyntheticRestoreReplaySafetyError(
            "restored synthetic erasure proof did not match"
        )
    if _replay_synthetic_erasure(urls.restore, replay_context):
        raise SyntheticRestoreReplaySafetyError(
            "restored synthetic erasure replay was not idempotent"
        )
    _verify_synthetic_target_erased(
        urls.restore,
        retained_user_id=user_ids[1],
        retained_product=products[1],
    )


def main() -> int:
    source_url = os.getenv(SOURCE_URL_ENV, "")
    restore_url = os.getenv(RESTORE_URL_ENV, "")
    run_drill(source_url, restore_url)
    print(
        f"backup_restore_drill=passed revision={SCHEMA_HEAD} "
        "synthetic_users_before_restore=2 erasures_replayed=1 "
        "synthetic_users_after_replay=1"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
