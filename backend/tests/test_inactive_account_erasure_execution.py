"""Safety tests for transaction-owned inactive-account erasure staging."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import event
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

import app.inactive_account_erasure_execution as execution_module
from app.inactive_account_erasure_execution import (
    InactiveAccountErasureExecutionSafetyError,
    execute_inactive_account_erasure,
)
from app.inactive_account_erasure_preflight import (
    InactiveAccountErasurePreflight,
    InactiveAccountErasurePreflightSafetyError,
)
from app.models import (
    AuthSessionDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
)


ANCHOR = datetime(2024, 1, 1)
NOTICE_START = datetime(2025, 12, 2)
DELIVERED = datetime(2025, 12, 5)
RETENTION_DUE = datetime(2026, 1, 1)
AS_OF = datetime(2026, 1, 2, tzinfo=UTC)


@pytest.fixture()
def erasure_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


def _seed_candidate(session: Session, *, include_relations: bool = True) -> dict[str, str]:
    user = CalorieAppUserDB(
        id="execution-user",
        status="active",
        last_authenticated_activity_at=ANCHOR,
    )
    notice = InactiveAccountNoticeDB(
        id="execution-notice",
        calorieapp_user_id=user.id,
        activity_anchor_at=ANCHOR,
        notice_window_started_at=NOTICE_START,
        retention_due_at=RETENTION_DUE,
        delivered_at=DELIVERED,
        delivery_channel="synthetic-email",
        delivery_evidence_digest="a" * 64,
        status="delivered",
        recorded_at=DELIVERED + timedelta(seconds=1),
    )
    other_user = CalorieAppUserDB(id="execution-other-user")
    session.add_all([user, notice, other_user])
    session.flush()

    if not include_relations:
        session.commit()
        return {
            "user_id": user.id,
            "notice_id": notice.id,
            "other_user_id": other_user.id,
        }

    replacement = AuthSessionDB(
        id="execution-owned-replacement",
        session_token_hash="1" * 64,
        calorieapp_user_id=user.id,
        created_at=ANCHOR,
        last_seen_at=ANCHOR,
        expires_at=RETENTION_DUE,
    )
    session.add(replacement)
    session.flush()
    owned_session = AuthSessionDB(
        id="execution-owned-session",
        session_token_hash="2" * 64,
        calorieapp_user_id=user.id,
        created_at=ANCHOR,
        last_seen_at=ANCHOR,
        expires_at=RETENTION_DUE,
        replaced_by_session_id=replacement.id,
    )
    session.add(owned_session)
    session.flush()
    inbound_session = AuthSessionDB(
        id="execution-inbound-session",
        session_token_hash="3" * 64,
        calorieapp_user_id=other_user.id,
        created_at=ANCHOR,
        last_seen_at=ANCHOR,
        expires_at=RETENTION_DUE,
        replaced_by_session_id=owned_session.id,
    )
    session.add_all(
        [
            FoodLogDB(
                product_name="Private execution apple",
                calories=52,
                owner_id=user.id,
            ),
            ExternalIdentityDB(
                calorieapp_user_id=user.id,
                provider="wordpress_xumm",
                external_subject="execution-private-subject",
            ),
            OriginLoginHandoffDB(
                state_hash="4" * 64,
                handoff_token_hash="5" * 64,
                status="claimed",
                calorieapp_user_id=user.id,
                created_at=ANCHOR,
                expires_at=RETENTION_DUE,
            ),
            inbound_session,
        ]
    )
    session.commit()
    return {
        "user_id": user.id,
        "notice_id": notice.id,
        "other_user_id": other_user.id,
        "inbound_session_id": inbound_session.id,
        "owned_session_id": owned_session.id,
        "replacement_session_id": replacement.id,
    }


def test_execution_stages_exact_minimized_shape_and_caller_can_roll_back(
    erasure_engine,
) -> None:
    with Session(erasure_engine) as session:
        identifiers = _seed_candidate(session)

    approval_reference = "synthetic-review-2026-09-02"
    with Session(erasure_engine) as session:
        result = execute_inactive_account_erasure(
            session,
            notice_id=identifiers["notice_id"],
            as_of=AS_OF,
            environment="test",
            execute=True,
            approval_reference=f"  {approval_reference}  ",
        )

        assert result is not None
        assert result.evaluated_at == AS_OF.replace(tzinfo=None)
        assert result.approval_reference_sha256 == hashlib.sha256(
            approval_reference.encode("utf-8")
        ).hexdigest()
        assert result.food_log_rows_deleted == 1
        assert result.external_identity_rows_deleted == 1
        assert result.origin_login_handoff_rows_deleted == 1
        assert result.auth_session_rows_deleted == 2
        assert result.inactive_account_notice_rows_deleted == 1
        assert result.inbound_session_references_cleared == 2
        assert result.user_rows_deleted == 1
        assert result.total_delete_rows == 7
        assert session.get(CalorieAppUserDB, identifiers["user_id"]) is None
        assert session.get(InactiveAccountNoticeDB, identifiers["notice_id"]) is None
        preserved = session.get(AuthSessionDB, identifiers["inbound_session_id"])
        assert preserved is not None
        assert preserved.replaced_by_session_id is None

        payload = result.as_payload()
        assert payload["schema_version"] == (
            "calorieapp-inactive-account-erasure-execution-v1"
        )
        assert payload["status"] == "staged-pending-caller-commit"
        assert payload["caller_commit_required"] is True
        assert payload["total_delete_rows"] == 7
        serialized = json.dumps(payload)
        assert approval_reference not in serialized
        assert identifiers["user_id"] not in serialized
        assert identifiers["notice_id"] not in serialized
        assert "execution-private-subject" not in serialized
        assert "Private execution apple" not in serialized

        session.rollback()

    with Session(erasure_engine) as session:
        assert session.get(CalorieAppUserDB, identifiers["user_id"]) is not None
        assert session.get(InactiveAccountNoticeDB, identifiers["notice_id"]) is not None
        assert len(
            session.exec(
                select(FoodLogDB).where(FoodLogDB.owner_id == identifiers["user_id"])
            ).all()
        ) == 1
        restored = session.get(AuthSessionDB, identifiers["inbound_session_id"])
        assert restored is not None
        assert restored.replaced_by_session_id == identifiers["owned_session_id"]


def test_caller_can_commit_one_erasure_and_missing_notice_retry_is_noop(
    erasure_engine,
) -> None:
    with Session(erasure_engine) as session:
        identifiers = _seed_candidate(session, include_relations=False)

    with Session(erasure_engine) as session:
        result = execute_inactive_account_erasure(
            session,
            notice_id=identifiers["notice_id"],
            as_of=AS_OF,
            environment="staging",
            execute=True,
            approval_reference="synthetic-commit-proof",
        )
        assert result is not None
        assert result.total_delete_rows == 2
        session.commit()

    with Session(erasure_engine) as session:
        assert session.get(CalorieAppUserDB, identifiers["user_id"]) is None
        assert session.get(InactiveAccountNoticeDB, identifiers["notice_id"]) is None
        assert session.get(CalorieAppUserDB, identifiers["other_user_id"]) is not None
        repeated = execute_inactive_account_erasure(
            session,
            notice_id=identifiers["notice_id"],
            as_of=AS_OF,
            environment="staging",
            execute=True,
            approval_reference="synthetic-commit-proof-retry",
        )
        assert repeated is None
        session.rollback()


@pytest.mark.parametrize(
    ("environment", "execute", "approval_reference", "message"),
    [
        ("test", False, "reviewed", "disabled by default"),
        ("production", True, "reviewed", "validated local, staging or test"),
        ("development", True, "reviewed", "validated local, staging or test"),
        ("TEST", True, "reviewed", "validated local, staging or test"),
        ("test", True, None, "1 to 120 bytes"),
        ("test", True, "   ", "1 to 120 bytes"),
        ("test", True, "a" * 121, "1 to 120 bytes"),
        ("test", True, "é" * 61, "1 to 120 bytes"),
    ],
)
def test_authorization_rejections_happen_before_database_access(
    erasure_engine,
    monkeypatch: pytest.MonkeyPatch,
    environment: str,
    execute: bool,
    approval_reference: str | None,
    message: str,
) -> None:
    def unexpected_preflight(*_args, **_kwargs):
        raise AssertionError("preflight must not run")

    monkeypatch.setattr(
        execution_module,
        "preflight_inactive_account_erasure",
        unexpected_preflight,
    )
    with Session(erasure_engine) as session:
        with pytest.raises(InactiveAccountErasureExecutionSafetyError, match=message):
            execute_inactive_account_erasure(
                session,
                notice_id="unused-notice",
                as_of=AS_OF,
                environment=environment,
                execute=execute,
                approval_reference=approval_reference,
            )
        assert session.in_transaction() is False


def test_changed_row_count_rolls_back_the_inner_savepoint(
    erasure_engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with Session(erasure_engine) as session:
        identifiers = _seed_candidate(session)

    stale_preflight = InactiveAccountErasurePreflight(
        notice_id=identifiers["notice_id"],
        user_id=identifiers["user_id"],
        evaluated_at=AS_OF.replace(tzinfo=None),
        food_log_rows=0,
        external_identity_rows=1,
        origin_login_handoff_rows=1,
        auth_session_rows=2,
        inactive_account_notice_rows=1,
        inbound_session_reference_rows=2,
    )
    monkeypatch.setattr(
        execution_module,
        "preflight_inactive_account_erasure",
        lambda *_args, **_kwargs: stale_preflight,
    )

    with Session(erasure_engine) as session:
        with pytest.raises(
            InactiveAccountErasureExecutionSafetyError,
            match="food_log changed after its locked preflight",
        ):
            execute_inactive_account_erasure(
                session,
                notice_id=identifiers["notice_id"],
                as_of=AS_OF,
                environment="local",
                execute=True,
                approval_reference="synthetic-stale-count",
            )

        session.expire_all()
        assert session.get(CalorieAppUserDB, identifiers["user_id"]) is not None
        assert len(
            session.exec(
                select(FoodLogDB).where(FoodLogDB.owner_id == identifiers["user_id"])
            ).all()
        ) == 1
        preserved = session.get(AuthSessionDB, identifiers["inbound_session_id"])
        assert preserved is not None
        assert preserved.replaced_by_session_id == identifiers["owned_session_id"]
        session.rollback()


def test_preflight_and_database_failures_are_mapped_without_detail_leak(
    erasure_engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unavailable_preflight(*_args, **_kwargs):
        raise InactiveAccountErasurePreflightSafetyError(
            "private preflight diagnostic"
        )

    monkeypatch.setattr(
        execution_module,
        "preflight_inactive_account_erasure",
        unavailable_preflight,
    )
    with Session(erasure_engine) as session:
        with pytest.raises(
            InactiveAccountErasureExecutionSafetyError,
            match="preflight is unavailable",
        ) as rejected:
            execute_inactive_account_erasure(
                session,
                notice_id="synthetic-notice",
                as_of=AS_OF,
                environment="test",
                execute=True,
                approval_reference="synthetic-preflight-failure",
            )
        assert "private preflight diagnostic" not in str(rejected.value)

    def database_failure(*_args, **_kwargs):
        raise SQLAlchemyError("private database diagnostic")

    monkeypatch.setattr(
        execution_module,
        "preflight_inactive_account_erasure",
        database_failure,
    )
    with Session(erasure_engine) as session:
        with pytest.raises(
            InactiveAccountErasureExecutionSafetyError,
            match="execution is unavailable",
        ) as rejected:
            execute_inactive_account_erasure(
                session,
                notice_id="synthetic-notice",
                as_of=AS_OF,
                environment="test",
                execute=True,
                approval_reference="synthetic-database-failure",
            )
        assert "private database diagnostic" not in str(rejected.value)
