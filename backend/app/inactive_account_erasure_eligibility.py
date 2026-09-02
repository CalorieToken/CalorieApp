"""Transaction-bound guard for inactive-account erasure candidates.

The guard is internal and read-only. It has no deletion, provider, contact,
queue, scheduler, endpoint or commit capability and does not authorize erasure.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlmodel import Session, select

from .models import CalorieAppUserDB, InactiveAccountNoticeDB


MAXIMUM_NOTICE_ID_BYTES = 64
SUPPORTED_DATABASE_BACKENDS = frozenset({"postgresql", "sqlite"})


class InactiveAccountErasureEligibilitySafetyError(RuntimeError):
    """Raised before evaluation when a fail-closed precondition is unmet."""


@dataclass(frozen=True, slots=True)
class InactiveAccountErasureCandidate:
    """Minimal candidate facts held only within the caller's transaction."""

    notice_id: str
    user_id: str
    activity_anchor_at: datetime
    retention_due_at: datetime
    evaluated_at: datetime


def _explicit_naive_utc(value: datetime | None) -> datetime:
    selected = value or datetime.now(UTC)
    if not isinstance(selected, datetime):
        raise InactiveAccountErasureEligibilitySafetyError(
            "as_of must be a datetime with a timezone"
        )
    if selected.tzinfo is None or selected.utcoffset() is None:
        raise InactiveAccountErasureEligibilitySafetyError(
            "as_of must include a timezone"
        )
    return selected.astimezone(UTC).replace(tzinfo=None)


def _stored_naive_utc(value: object) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value
    if value.utcoffset() is None:
        return None
    return value.astimezone(UTC).replace(tzinfo=None)


def _validate_notice_id(notice_id: str) -> None:
    if not isinstance(notice_id, str) or not notice_id:
        raise InactiveAccountErasureEligibilitySafetyError(
            "notice_id must be a non-empty string"
        )
    if len(notice_id) > MAXIMUM_NOTICE_ID_BYTES or len(
        notice_id.encode("utf-8")
    ) > MAXIMUM_NOTICE_ID_BYTES:
        raise InactiveAccountErasureEligibilitySafetyError(
            "notice_id exceeds its byte limit"
        )


def _validate_session(session: Session) -> None:
    backend = session.get_bind().dialect.name
    if backend not in SUPPORTED_DATABASE_BACKENDS:
        raise InactiveAccountErasureEligibilitySafetyError(
            "erasure eligibility requires SQLite or PostgreSQL"
        )
    if session.new or session.dirty or session.deleted:
        raise InactiveAccountErasureEligibilitySafetyError(
            "erasure eligibility requires no pending session mutations"
        )


def lock_inactive_account_erasure_candidate(
    session: Session,
    *,
    notice_id: str,
    as_of: datetime | None = None,
) -> InactiveAccountErasureCandidate | None:
    """Lock and revalidate one candidate without deleting or committing.

    PostgreSQL evaluates both the notice and current user under ``FOR UPDATE``
    locks held by the caller's transaction. SQLite is supported only for local
    contract tests and does not prove equivalent row-lock behavior. Returning a
    candidate is necessary but never sufficient authorization for erasure.
    """

    _validate_notice_id(notice_id)
    _validate_session(session)
    evaluated_at = _explicit_naive_utc(as_of)

    owner_id = session.exec(
        select(InactiveAccountNoticeDB.calorieapp_user_id).where(
            InactiveAccountNoticeDB.id == notice_id
        )
    ).one_or_none()
    if owner_id is None:
        return None

    # Lock in the same user-then-notice order as authenticated activity and
    # evidence recording. The final notice query revalidates the unlocked
    # ownership lookup inside this transaction.
    user = session.exec(
        select(CalorieAppUserDB)
        .where(CalorieAppUserDB.id == owner_id)
        .with_for_update()
    ).one_or_none()
    if user is None:
        return None

    notice = session.exec(
        select(InactiveAccountNoticeDB)
        .where(InactiveAccountNoticeDB.id == notice_id)
        .with_for_update()
    ).one_or_none()
    if notice is None or notice.calorieapp_user_id != user.id:
        return None

    anchor = _stored_naive_utc(notice.activity_anchor_at)
    notice_start = _stored_naive_utc(notice.notice_window_started_at)
    delivered = _stored_naive_utc(notice.delivered_at)
    retention_due = _stored_naive_utc(notice.retention_due_at)
    recorded = _stored_naive_utc(notice.recorded_at)
    current_activity = _stored_naive_utc(user.last_authenticated_activity_at)
    if None in {
        anchor,
        notice_start,
        delivered,
        retention_due,
        recorded,
        current_activity,
    }:
        return None

    assert anchor is not None
    assert notice_start is not None
    assert delivered is not None
    assert retention_due is not None
    assert recorded is not None
    assert current_activity is not None
    if not anchor < notice_start <= delivered < retention_due:
        return None
    if recorded < delivered or retention_due > evaluated_at:
        return None
    if (
        notice.status != "delivered"
        or notice.cancelled_at is not None
        or notice.cancellation_reason is not None
        or user.status != "active"
        or current_activity != anchor
    ):
        return None

    return InactiveAccountErasureCandidate(
        notice_id=notice.id,
        user_id=user.id,
        activity_anchor_at=anchor,
        retention_due_at=retention_due,
        evaluated_at=evaluated_at,
    )
