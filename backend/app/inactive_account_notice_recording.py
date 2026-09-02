"""Transaction-owned recording of confirmed inactive-account notice evidence.

This module has no provider, network, queue, scheduler or erasure capability.
It may only persist already-minimized evidence after a future reviewed adapter
has independently confirmed successful delivery.
"""

from __future__ import annotations

from datetime import UTC, datetime
import re

from sqlmodel import Session, select

from .inactive_account_notice_receipt import (
    MAXIMUM_USER_ID_BYTES,
    InactiveAccountNoticeDeliveryEvidence,
)
from .models import CalorieAppUserDB, InactiveAccountNoticeDB


SUPPORTED_DATABASE_BACKENDS = frozenset({"postgresql", "sqlite"})
_CHANNEL_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,39}$")
_DIGEST_PATTERN = re.compile(r"^[0-9a-f]{64}$")


class InactiveAccountNoticeRecordingSafetyError(RuntimeError):
    """Raised before recording when a fail-closed invariant is not met."""


def _naive_utc(value: datetime, *, field_name: str) -> datetime:
    if not isinstance(value, datetime):
        raise InactiveAccountNoticeRecordingSafetyError(
            f"{field_name} must be a datetime"
        )
    if value.tzinfo is not None:
        if value.utcoffset() is None:
            raise InactiveAccountNoticeRecordingSafetyError(
                f"{field_name} has an invalid timezone"
            )
        return value.astimezone(UTC).replace(tzinfo=None)
    return value


def _validate_user_id(user_id: str) -> None:
    if not isinstance(user_id, str) or not user_id:
        raise InactiveAccountNoticeRecordingSafetyError(
            "user_id must be a non-empty string"
        )
    if len(user_id) > MAXIMUM_USER_ID_BYTES or len(user_id.encode("utf-8")) > (
        MAXIMUM_USER_ID_BYTES
    ):
        raise InactiveAccountNoticeRecordingSafetyError(
            "user_id exceeds its byte limit"
        )


def _validate_evidence(
    evidence: InactiveAccountNoticeDeliveryEvidence,
) -> datetime:
    if not isinstance(evidence, InactiveAccountNoticeDeliveryEvidence):
        raise InactiveAccountNoticeRecordingSafetyError(
            "evidence must be minimized delivery evidence"
        )
    delivered_at = _naive_utc(evidence.delivered_at, field_name="delivered_at")
    if not isinstance(
        evidence.delivery_channel,
        str,
    ) or not _CHANNEL_PATTERN.fullmatch(evidence.delivery_channel):
        raise InactiveAccountNoticeRecordingSafetyError(
            "delivery_channel must be a bounded provider-neutral key"
        )
    if not isinstance(
        evidence.delivery_evidence_digest,
        str,
    ) or not _DIGEST_PATTERN.fullmatch(evidence.delivery_evidence_digest):
        raise InactiveAccountNoticeRecordingSafetyError(
            "delivery_evidence_digest must be lowercase HMAC-SHA256 hex"
        )
    return delivered_at


def _matches_immutable_evidence(
    notice: InactiveAccountNoticeDB,
    *,
    user_id: str,
    activity_anchor_at: datetime,
    notice_window_started_at: datetime,
    retention_due_at: datetime,
    delivered_at: datetime,
    evidence: InactiveAccountNoticeDeliveryEvidence,
) -> bool:
    return (
        notice.calorieapp_user_id == user_id
        and notice.activity_anchor_at == activity_anchor_at
        and notice.notice_window_started_at == notice_window_started_at
        and notice.retention_due_at == retention_due_at
        and notice.delivered_at == delivered_at
        and notice.delivery_channel == evidence.delivery_channel
        and notice.delivery_evidence_digest
        == evidence.delivery_evidence_digest
    )


def record_successful_delivery_notice_evidence(
    session: Session,
    *,
    user_id: str,
    activity_anchor_at: datetime,
    notice_window_started_at: datetime,
    retention_due_at: datetime,
    evidence: InactiveAccountNoticeDeliveryEvidence,
    recorded_at: datetime | None = None,
) -> InactiveAccountNoticeDB:
    """Stage confirmed minimized evidence in the caller-owned transaction.

    The current user row is locked. Before a new row is inserted, the account
    must still be active and its durable activity anchor must match. Repeating
    identical evidence returns the existing lifecycle row even if later
    activity has advanced the current anchor; a conflicting replay fails
    closed. This function flushes for constraint validation but never commits.
    """

    backend = session.get_bind().dialect.name
    if backend not in SUPPORTED_DATABASE_BACKENDS:
        raise InactiveAccountNoticeRecordingSafetyError(
            "notice evidence recording requires SQLite or PostgreSQL"
        )

    _validate_user_id(user_id)
    anchor = _naive_utc(activity_anchor_at, field_name="activity_anchor_at")
    notice_start = _naive_utc(
        notice_window_started_at,
        field_name="notice_window_started_at",
    )
    retention_due = _naive_utc(
        retention_due_at,
        field_name="retention_due_at",
    )
    delivered = _validate_evidence(evidence)
    recorded = _naive_utc(
        recorded_at or datetime.now(UTC),
        field_name="recorded_at",
    )
    if not anchor < notice_start <= delivered < retention_due:
        raise InactiveAccountNoticeRecordingSafetyError(
            "inactive-account notice timeline is invalid"
        )
    if recorded < delivered:
        raise InactiveAccountNoticeRecordingSafetyError(
            "recorded_at cannot be before delivered_at"
        )

    user = session.exec(
        select(CalorieAppUserDB)
        .where(CalorieAppUserDB.id == user_id)
        .with_for_update()
    ).one_or_none()
    if user is None:
        raise InactiveAccountNoticeRecordingSafetyError(
            "inactive-account notice user does not exist"
        )

    existing = session.exec(
        select(InactiveAccountNoticeDB).where(
            InactiveAccountNoticeDB.calorieapp_user_id == user_id,
            InactiveAccountNoticeDB.activity_anchor_at == anchor,
        )
    ).one_or_none()
    if existing is not None:
        if not _matches_immutable_evidence(
            existing,
            user_id=user_id,
            activity_anchor_at=anchor,
            notice_window_started_at=notice_start,
            retention_due_at=retention_due,
            delivered_at=delivered,
            evidence=evidence,
        ):
            raise InactiveAccountNoticeRecordingSafetyError(
                "conflicting notice evidence already exists for activity anchor"
            )
        return existing

    stored_activity = _naive_utc(
        user.last_authenticated_activity_at,
        field_name="last_authenticated_activity_at",
    )
    if user.status != "active" or stored_activity != anchor:
        raise InactiveAccountNoticeRecordingSafetyError(
            "activity anchor is stale or account is not active"
        )

    notice = InactiveAccountNoticeDB(
        calorieapp_user_id=user_id,
        activity_anchor_at=anchor,
        notice_window_started_at=notice_start,
        retention_due_at=retention_due,
        delivered_at=delivered,
        delivery_channel=evidence.delivery_channel,
        delivery_evidence_digest=evidence.delivery_evidence_digest,
        status="delivered",
        recorded_at=recorded,
    )
    session.add(notice)
    session.flush()
    return notice
