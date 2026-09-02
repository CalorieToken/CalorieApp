"""Safety transitions for delivered inactive-account notice evidence."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import update
from sqlmodel import Session

from .models import InactiveAccountNoticeDB


AUTHENTICATED_ACTIVITY_CANCELLATION = "authenticated-activity"


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def cancel_inactive_account_notices_for_activity(
    session: Session,
    *,
    user_id: str,
    observed_at: datetime,
) -> None:
    """Cancel delivered notices superseded by later authenticated activity.

    The caller owns the surrounding authentication transaction. This helper
    deliberately performs no commit and creates no delivery or erasure action.
    """

    normalized_observed_at = _naive_utc(observed_at)
    session.exec(
        update(InactiveAccountNoticeDB)
        .where(InactiveAccountNoticeDB.calorieapp_user_id == user_id)
        .where(InactiveAccountNoticeDB.status == "delivered")
        .where(
            InactiveAccountNoticeDB.activity_anchor_at
            < normalized_observed_at
        )
        .where(
            InactiveAccountNoticeDB.delivered_at
            <= normalized_observed_at
        )
        .values(
            status="cancelled",
            cancelled_at=normalized_observed_at,
            cancellation_reason=AUTHENTICATED_ACTIVITY_CANCELLATION,
        )
        .execution_options(synchronize_session=False)
    )
