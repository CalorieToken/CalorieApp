"""Tests for transaction-owned inactive-account notice evidence recording."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.inactive_account_notice_receipt import (
    InactiveAccountNoticeDeliveryEvidence,
    successful_delivery_receipt_to_evidence,
)
from app.inactive_account_notice_recording import (
    InactiveAccountNoticeRecordingSafetyError,
    record_successful_delivery_notice_evidence,
)
from app.models import CalorieAppUserDB, InactiveAccountNoticeDB


SECRET = b"synthetic-recording-key-not-for-production" * 2
ANCHOR = datetime(2024, 1, 1, tzinfo=UTC)
NOTICE_START = datetime(2025, 12, 2, tzinfo=UTC)
DELIVERED = datetime(2025, 12, 5, tzinfo=UTC)
RETENTION_DUE = datetime(2026, 1, 1, tzinfo=UTC)
RECORDED = DELIVERED + timedelta(seconds=1)


def _memory_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def _evidence(
    *,
    provider_receipt: str = "synthetic-provider-receipt",
) -> InactiveAccountNoticeDeliveryEvidence:
    return successful_delivery_receipt_to_evidence(
        secret_key=SECRET,
        provider_receipt=provider_receipt,
        user_id="recording-user",
        activity_anchor_at=ANCHOR,
        notice_window_started_at=NOTICE_START,
        retention_due_at=RETENTION_DUE,
        delivered_at=DELIVERED,
        delivery_channel="synthetic-email",
    )


def _record(session: Session, **overrides) -> InactiveAccountNoticeDB:
    values = {
        "user_id": "recording-user",
        "activity_anchor_at": ANCHOR,
        "notice_window_started_at": NOTICE_START,
        "retention_due_at": RETENTION_DUE,
        "evidence": _evidence(),
        "recorded_at": RECORDED,
    }
    values.update(overrides)
    return record_successful_delivery_notice_evidence(session, **values)


def _add_user(session: Session, *, status: str = "active") -> None:
    session.add(
        CalorieAppUserDB(
            id="recording-user",
            status=status,
            last_authenticated_activity_at=ANCHOR.replace(tzinfo=None),
        )
    )
    session.commit()


def test_records_only_minimized_successful_delivery_evidence() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _add_user(session)
            notice = _record(session)
            notice_id = notice.id
            session.commit()

        with Session(engine) as session:
            persisted = session.get(InactiveAccountNoticeDB, notice_id)
            assert persisted is not None
            assert persisted.calorieapp_user_id == "recording-user"
            assert persisted.activity_anchor_at == ANCHOR.replace(tzinfo=None)
            assert persisted.delivered_at == DELIVERED.replace(tzinfo=None)
            assert persisted.delivery_channel == "synthetic-email"
            assert len(persisted.delivery_evidence_digest) == 64
            assert persisted.status == "delivered"
            assert persisted.cancelled_at is None
            assert persisted.cancellation_reason is None
            assert "synthetic-provider-receipt" not in repr(persisted)
            assert SECRET.hex() not in repr(persisted)
    finally:
        engine.dispose()


def test_recording_never_commits_the_caller_transaction() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _add_user(session)
            _record(session)
            session.rollback()

        with Session(engine) as session:
            assert session.exec(select(InactiveAccountNoticeDB)).all() == []
    finally:
        engine.dispose()


def test_identical_retry_returns_existing_notice_without_duplicate() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _add_user(session)
            first = _record(session)
            second = _record(session, recorded_at=RECORDED + timedelta(minutes=1))
            session.commit()

            assert second.id == first.id
            notices = session.exec(select(InactiveAccountNoticeDB)).all()
            assert [notice.id for notice in notices] == [first.id]
            assert notices[0].recorded_at == RECORDED.replace(tzinfo=None)
    finally:
        engine.dispose()


def test_conflicting_retry_fails_closed_without_replacing_evidence() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _add_user(session)
            first = _record(session)
            original_digest = first.delivery_evidence_digest

            with pytest.raises(
                InactiveAccountNoticeRecordingSafetyError,
                match="conflicting notice evidence",
            ):
                _record(
                    session,
                    evidence=_evidence(provider_receipt="conflicting-receipt"),
                )

            session.commit()
            notices = session.exec(select(InactiveAccountNoticeDB)).all()
            assert len(notices) == 1
            assert notices[0].delivery_evidence_digest == original_digest
    finally:
        engine.dispose()


@pytest.mark.parametrize("status", ["disabled", "erased"])
def test_non_active_account_fails_closed(status: str) -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _add_user(session, status=status)
            with pytest.raises(
                InactiveAccountNoticeRecordingSafetyError,
                match="stale or account is not active",
            ):
                _record(session)
            session.rollback()
    finally:
        engine.dispose()


def test_stale_activity_anchor_fails_closed_without_recording() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _add_user(session)
            user = session.get(CalorieAppUserDB, "recording-user")
            assert user is not None
            user.last_authenticated_activity_at = ANCHOR.replace(
                tzinfo=None
            ) + timedelta(seconds=1)
            session.commit()

            with pytest.raises(
                InactiveAccountNoticeRecordingSafetyError,
                match="activity anchor is stale",
            ):
                _record(session)
            session.rollback()

        with Session(engine) as session:
            assert session.exec(select(InactiveAccountNoticeDB)).all() == []
    finally:
        engine.dispose()


def test_invalid_timeline_and_recording_time_fail_before_mutation() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _add_user(session)
            with pytest.raises(
                InactiveAccountNoticeRecordingSafetyError,
                match="timeline",
            ):
                _record(
                    session,
                    notice_window_started_at=DELIVERED + timedelta(seconds=1),
                )
            with pytest.raises(
                InactiveAccountNoticeRecordingSafetyError,
                match="recorded_at cannot be before delivered_at",
            ):
                _record(session, recorded_at=DELIVERED - timedelta(seconds=1))
            session.rollback()
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("evidence", "message"),
    [
        (
            InactiveAccountNoticeDeliveryEvidence(
                delivery_channel=None,
                delivered_at=DELIVERED.replace(tzinfo=None),
                delivery_evidence_digest="a" * 64,
            ),
            "delivery_channel",
        ),
        (
            InactiveAccountNoticeDeliveryEvidence(
                delivery_channel="synthetic-email",
                delivered_at=DELIVERED.replace(tzinfo=None),
                delivery_evidence_digest=None,
            ),
            "delivery_evidence_digest",
        ),
    ],
)
def test_malformed_minimized_evidence_fails_closed(
    evidence: InactiveAccountNoticeDeliveryEvidence,
    message: str,
) -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _add_user(session)
            with pytest.raises(
                InactiveAccountNoticeRecordingSafetyError,
                match=message,
            ):
                _record(session, evidence=evidence)
            session.rollback()
    finally:
        engine.dispose()
