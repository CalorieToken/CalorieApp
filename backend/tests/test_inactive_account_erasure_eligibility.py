"""Safety tests for the internal inactive-account erasure candidate guard."""

from dataclasses import fields
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.inactive_account_erasure_eligibility import (
    InactiveAccountErasureEligibilitySafetyError,
    lock_inactive_account_erasure_candidate,
)
from app.models import CalorieAppUserDB, InactiveAccountNoticeDB


ANCHOR = datetime(2024, 1, 1)
NOTICE_START = datetime(2025, 12, 2)
DELIVERED = datetime(2025, 12, 5)
RETENTION_DUE = datetime(2026, 1, 1)
AS_OF = datetime(2026, 1, 2, tzinfo=UTC)


def _memory_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def _seed(
    session: Session,
    *,
    user_status: str = "active",
    current_activity: datetime = ANCHOR,
    notice_status: str = "delivered",
    cancelled_at: datetime | None = None,
    cancellation_reason: str | None = None,
    retention_due_at: datetime = RETENTION_DUE,
    recorded_at: datetime = DELIVERED + timedelta(seconds=1),
) -> str:
    user = CalorieAppUserDB(
        id="eligibility-user",
        status=user_status,
        last_authenticated_activity_at=current_activity,
    )
    notice = InactiveAccountNoticeDB(
        id="eligibility-notice",
        calorieapp_user_id=user.id,
        activity_anchor_at=ANCHOR,
        notice_window_started_at=NOTICE_START,
        retention_due_at=retention_due_at,
        delivered_at=DELIVERED,
        delivery_channel="synthetic-email",
        delivery_evidence_digest="a" * 64,
        status=notice_status,
        cancelled_at=cancelled_at,
        cancellation_reason=cancellation_reason,
        recorded_at=recorded_at,
    )
    session.add_all([user, notice])
    session.commit()
    return notice.id


def test_due_unchanged_delivered_notice_returns_minimal_candidate() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            notice_id = _seed(session)
            candidate = lock_inactive_account_erasure_candidate(
                session,
                notice_id=notice_id,
                as_of=AS_OF,
            )

            assert candidate is not None
            assert candidate.notice_id == notice_id
            assert candidate.user_id == "eligibility-user"
            assert candidate.activity_anchor_at == ANCHOR
            assert candidate.retention_due_at == RETENTION_DUE
            assert candidate.evaluated_at == AS_OF.replace(tzinfo=None)
            assert {field.name for field in fields(candidate)} == {
                "notice_id",
                "user_id",
                "activity_anchor_at",
                "retention_due_at",
                "evaluated_at",
            }
            assert "delivery_evidence_digest" not in repr(candidate)
            session.rollback()
    finally:
        engine.dispose()


def test_guard_never_mutates_or_commits_lifecycle_state() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            notice_id = _seed(session)
            candidate = lock_inactive_account_erasure_candidate(
                session,
                notice_id=notice_id,
                as_of=AS_OF,
            )
            assert candidate is not None
            session.rollback()

        with Session(engine) as session:
            notice = session.get(InactiveAccountNoticeDB, notice_id)
            user = session.get(CalorieAppUserDB, "eligibility-user")
            assert notice is not None
            assert notice.status == "delivered"
            assert notice.cancelled_at is None
            assert user is not None
            assert user.status == "active"
    finally:
        engine.dispose()


def test_notice_before_retention_deadline_is_not_candidate() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            notice_id = _seed(session)
            assert (
                lock_inactive_account_erasure_candidate(
                    session,
                    notice_id=notice_id,
                    as_of=datetime(2025, 12, 31, 23, 59, 59, tzinfo=UTC),
                )
                is None
            )
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("seed_overrides"),
    [
        {"current_activity": ANCHOR + timedelta(seconds=1)},
        {"user_status": "disabled"},
        {
            "notice_status": "cancelled",
            "cancelled_at": DELIVERED + timedelta(seconds=1),
            "cancellation_reason": "authenticated-activity",
        },
        {"recorded_at": DELIVERED - timedelta(seconds=1)},
    ],
)
def test_changed_cancelled_or_invalid_state_is_not_candidate(
    seed_overrides: dict,
) -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            notice_id = _seed(session, **seed_overrides)
            assert (
                lock_inactive_account_erasure_candidate(
                    session,
                    notice_id=notice_id,
                    as_of=AS_OF,
                )
                is None
            )
    finally:
        engine.dispose()


def test_missing_notice_is_not_candidate() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            assert (
                lock_inactive_account_erasure_candidate(
                    session,
                    notice_id="missing-notice",
                    as_of=AS_OF,
                )
                is None
            )
    finally:
        engine.dispose()


def test_as_of_requires_explicit_timezone() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            notice_id = _seed(session)
            with pytest.raises(
                InactiveAccountErasureEligibilitySafetyError,
                match="timezone",
            ):
                lock_inactive_account_erasure_candidate(
                    session,
                    notice_id=notice_id,
                    as_of=AS_OF.replace(tzinfo=None),
                )
    finally:
        engine.dispose()


def test_pending_session_mutation_fails_closed() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            notice_id = _seed(session)
            session.add(
                CalorieAppUserDB(
                    id="unrelated-pending-user",
                    last_authenticated_activity_at=ANCHOR,
                )
            )
            with pytest.raises(
                InactiveAccountErasureEligibilitySafetyError,
                match="no pending session mutations",
            ):
                lock_inactive_account_erasure_candidate(
                    session,
                    notice_id=notice_id,
                    as_of=AS_OF,
                )
            session.rollback()
    finally:
        engine.dispose()
