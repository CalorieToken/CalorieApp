"""Tests for privacy-minimized inactive-account notice evidence."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

import app.database as db_module
import app.main as main_module
from app.inactive_account_notice import (
    AUTHENTICATED_ACTIVITY_CANCELLATION,
    cancel_inactive_account_notices_for_activity,
)
from app.models import CalorieAppUserDB, InactiveAccountNoticeDB


def _notice(
    user_id: str,
    *,
    anchor: datetime,
    digest: str,
) -> InactiveAccountNoticeDB:
    retention_due = anchor + timedelta(days=731)
    return InactiveAccountNoticeDB(
        calorieapp_user_id=user_id,
        activity_anchor_at=anchor,
        notice_window_started_at=retention_due - timedelta(days=30),
        retention_due_at=retention_due,
        delivered_at=retention_due - timedelta(days=25),
        delivery_channel="reviewed-channel",
        delivery_evidence_digest=digest,
        status="delivered",
        recorded_at=retention_due - timedelta(days=25),
    )


def _memory_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def test_authenticated_activity_cancels_only_older_delivered_notice() -> None:
    engine = _memory_engine()
    anchor = datetime(2024, 1, 1)
    try:
        with Session(engine) as session:
            target = CalorieAppUserDB(
                id="target-user",
                last_authenticated_activity_at=anchor,
            )
            other = CalorieAppUserDB(
                id="other-user",
                last_authenticated_activity_at=anchor,
            )
            target_notice = _notice(target.id, anchor=anchor, digest="a" * 64)
            other_notice = _notice(other.id, anchor=anchor, digest="b" * 64)
            session.add_all([target, other, target_notice, other_notice])
            session.commit()

            observed_at = datetime(2026, 1, 2, tzinfo=UTC)
            cancel_inactive_account_notices_for_activity(
                session,
                user_id=target.id,
                observed_at=observed_at,
            )
            session.commit()
            session.refresh(target_notice)
            session.refresh(other_notice)

            assert target_notice.status == "cancelled"
            assert target_notice.cancelled_at == observed_at.replace(tzinfo=None)
            assert (
                target_notice.cancellation_reason
                == AUTHENTICATED_ACTIVITY_CANCELLATION
            )
            assert other_notice.status == "delivered"
            assert other_notice.cancelled_at is None
    finally:
        engine.dispose()


def test_activity_at_or_before_notice_anchor_does_not_cancel() -> None:
    engine = _memory_engine()
    anchor = datetime(2024, 1, 1)
    try:
        with Session(engine) as session:
            user = CalorieAppUserDB(
                id="same-time-user",
                last_authenticated_activity_at=anchor,
            )
            notice = _notice(user.id, anchor=anchor, digest="c" * 64)
            session.add_all([user, notice])
            session.commit()

            cancel_inactive_account_notices_for_activity(
                session,
                user_id=user.id,
                observed_at=anchor.replace(tzinfo=UTC),
            )
            session.commit()
            session.refresh(notice)

            assert notice.status == "delivered"
            assert notice.cancelled_at is None
    finally:
        engine.dispose()


def test_activity_before_notice_delivery_does_not_cancel() -> None:
    engine = _memory_engine()
    anchor = datetime(2024, 1, 1)
    try:
        with Session(engine) as session:
            user = CalorieAppUserDB(
                id="pre-delivery-user",
                last_authenticated_activity_at=anchor,
            )
            notice = _notice(user.id, anchor=anchor, digest="f" * 64)
            session.add_all([user, notice])
            session.commit()

            observed_at = notice.delivered_at - timedelta(seconds=1)
            cancel_inactive_account_notices_for_activity(
                session,
                user_id=user.id,
                observed_at=observed_at.replace(tzinfo=UTC),
            )
            session.commit()
            session.refresh(notice)

            assert observed_at > anchor
            assert notice.status == "delivered"
            assert notice.cancelled_at is None
    finally:
        engine.dispose()


def test_activity_at_notice_delivery_time_can_cancel() -> None:
    engine = _memory_engine()
    anchor = datetime(2024, 1, 1)
    try:
        with Session(engine) as session:
            user = CalorieAppUserDB(
                id="delivery-time-user",
                last_authenticated_activity_at=anchor,
            )
            notice = _notice(user.id, anchor=anchor, digest="9" * 64)
            session.add_all([user, notice])
            session.commit()

            cancel_inactive_account_notices_for_activity(
                session,
                user_id=user.id,
                observed_at=notice.delivered_at.replace(tzinfo=UTC),
            )
            session.commit()
            session.refresh(notice)

            assert notice.status == "cancelled"
            assert notice.cancelled_at == notice.delivered_at
    finally:
        engine.dispose()


def test_successful_authenticated_request_cancels_notice_atomically(
    authenticated_client: TestClient,
) -> None:
    user_id = authenticated_client.get("/api/identity/me").json()["user_id"]
    anchor = datetime(2024, 1, 1)
    with Session(db_module.engine) as session:
        user = session.get(CalorieAppUserDB, user_id)
        assert user is not None
        user.last_authenticated_activity_at = anchor
        notice = _notice(user_id, anchor=anchor, digest="d" * 64)
        session.add_all([user, notice])
        session.commit()
        notice_id = notice.id

    response = authenticated_client.get("/api/identity/me")

    assert response.status_code == 200
    with Session(db_module.engine) as session:
        persisted = session.get(InactiveAccountNoticeDB, notice_id)
        assert persisted is not None
        assert persisted.status == "cancelled"
        assert persisted.cancellation_reason == AUTHENTICATED_ACTIVITY_CANCELLATION


def test_failed_activity_transaction_does_not_partially_cancel_notice() -> None:
    engine = _memory_engine()
    original_engine = db_module.engine
    anchor = datetime(2024, 1, 1)
    try:
        db_module.engine = engine
        with Session(engine) as session:
            user = CalorieAppUserDB(
                id="rollback-user",
                last_authenticated_activity_at=anchor,
            )
            notice = _notice(user.id, anchor=anchor, digest="e" * 64)
            session.add_all([user, notice])
            session.commit()
            notice_id = notice.id

            main_module._record_authenticated_activity(
                session,
                user.id,
                datetime(2026, 1, 2, tzinfo=UTC),
            )
            session.rollback()

        with Session(engine) as session:
            persisted = session.exec(
                select(InactiveAccountNoticeDB).where(
                    InactiveAccountNoticeDB.id == notice_id
                )
            ).one()
            assert persisted.status == "delivered"
            assert persisted.cancelled_at is None
    finally:
        db_module.engine = original_engine
        engine.dispose()
