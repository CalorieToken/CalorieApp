"""Read-only, bounded preview of the selected inactive-account lifecycle."""

from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from .models import CalorieAppUserDB


INACTIVE_ACCOUNT_MONTHS = 24
NOTICE_DAYS = 30
DEFAULT_BATCH_LIMIT = 500
MAX_BATCH_LIMIT = 5_000
PREVIEW_SCHEMA_VERSION = "calorieapp-inactive-account-preview-v1"
SUPPORTED_DATABASE_BACKENDS = frozenset({"postgresql", "sqlite"})


class InactiveAccountPreviewSafetyError(RuntimeError):
    """Raised before preview when a fail-closed safety condition is not met."""


@dataclass(frozen=True)
class InactiveAccountPreviewResult:
    """Aggregate-only preview with no account or contact identifiers."""

    as_of_utc: datetime
    batch_limit: int
    evaluated_accounts: int
    notice_window_accounts: int
    retention_boundary_reached_accounts: int
    more_due_accounts_pending: bool

    def as_payload(self) -> dict[str, object]:
        return {
            "schema_version": PREVIEW_SCHEMA_VERSION,
            "status": "planned",
            "read_only": True,
            "as_of_utc": _format_utc(self.as_of_utc),
            "inactive_account_months": INACTIVE_ACCOUNT_MONTHS,
            "notice_days": NOTICE_DAYS,
            "batch_limit": self.batch_limit,
            "evaluated_accounts": self.evaluated_accounts,
            "due_total": (
                self.notice_window_accounts
                + self.retention_boundary_reached_accounts
            ),
            "notice_window_accounts": self.notice_window_accounts,
            "retention_boundary_reached_accounts": (
                self.retention_boundary_reached_accounts
            ),
            "more_due_accounts_pending": self.more_due_accounts_pending,
            "notice_sent": False,
            "account_marked": False,
            "automatic_erasure_authorized": False,
            "account_erased": False,
        }


def _format_utc(value: datetime) -> str:
    timespec = "microseconds" if value.microsecond else "seconds"
    return f"{value.isoformat(timespec=timespec)}Z"


def _normalize_as_of(as_of: datetime | None) -> datetime:
    selected = as_of or datetime.now(UTC)
    if selected.tzinfo is not None:
        selected = selected.astimezone(UTC).replace(tzinfo=None)
    return selected


def _shift_calendar_months(value: datetime, months: int) -> datetime:
    month_index = value.year * 12 + value.month - 1 + months
    if month_index < 0:
        raise InactiveAccountPreviewSafetyError("calendar month is out of range")
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def _validate_batch_limit(batch_limit: int) -> None:
    if isinstance(batch_limit, bool) or not 1 <= batch_limit <= MAX_BATCH_LIMIT:
        raise InactiveAccountPreviewSafetyError(
            f"batch_limit must be between 1 and {MAX_BATCH_LIMIT}"
        )


def _validate_session(session: Session) -> None:
    backend = session.get_bind().dialect.name
    if backend not in SUPPORTED_DATABASE_BACKENDS:
        raise InactiveAccountPreviewSafetyError(
            "inactive-account preview requires SQLite or PostgreSQL"
        )
    if (
        session.in_transaction()
        or len(session.identity_map) > 0
        or session.new
        or session.dirty
        or session.deleted
    ):
        raise InactiveAccountPreviewSafetyError(
            "inactive-account preview requires a clean dedicated session"
        )


def _lifecycle_state(last_activity: datetime, as_of: datetime) -> str | None:
    normalized_activity = (
        last_activity.astimezone(UTC).replace(tzinfo=None)
        if last_activity.tzinfo is not None
        else last_activity
    )
    retention_at = _shift_calendar_months(
        normalized_activity,
        INACTIVE_ACCOUNT_MONTHS,
    )
    if retention_at <= as_of:
        return "retention-boundary-reached"
    if retention_at - timedelta(days=NOTICE_DAYS) <= as_of:
        return "notice-window"
    return None


def preview_inactive_accounts(
    session: Session,
    *,
    as_of: datetime | None = None,
    batch_limit: int = DEFAULT_BATCH_LIMIT,
) -> InactiveAccountPreviewResult:
    """Preview due lifecycle counts without marking, notifying or erasing.

    The oldest active accounts are evaluated first. Calendar deadlines are
    calculated per account so leap days and month ends remain deterministic.
    The dedicated read transaction is always rolled back before returning.
    """

    _validate_batch_limit(batch_limit)
    _validate_session(session)
    selected_as_of = _normalize_as_of(as_of)

    try:
        rows = session.exec(
            select(
                CalorieAppUserDB.id,
                CalorieAppUserDB.last_authenticated_activity_at,
            )
            .where(CalorieAppUserDB.status == "active")
            .order_by(
                CalorieAppUserDB.last_authenticated_activity_at,
                CalorieAppUserDB.id,
            )
            .limit(batch_limit + 1)
        ).all()

        evaluated = rows[:batch_limit]
        states = [
            _lifecycle_state(last_activity, selected_as_of)
            for _user_id, last_activity in evaluated
        ]
        next_state = (
            _lifecycle_state(rows[batch_limit][1], selected_as_of)
            if len(rows) > batch_limit
            else None
        )
        result = InactiveAccountPreviewResult(
            as_of_utc=selected_as_of,
            batch_limit=batch_limit,
            evaluated_accounts=len(evaluated),
            notice_window_accounts=states.count("notice-window"),
            retention_boundary_reached_accounts=states.count(
                "retention-boundary-reached"
            ),
            more_due_accounts_pending=next_state is not None,
        )
        session.rollback()
    except Exception:
        session.rollback()
        raise

    return result
