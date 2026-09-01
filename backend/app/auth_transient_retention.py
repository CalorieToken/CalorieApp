"""Bounded, provider-neutral cleanup for authentication-transient records."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, or_, update
from sqlmodel import Session, select

from .models import (
    AuthSessionDB,
    AuthorizationCodeDB,
    BridgeAuthNonceDB,
    OriginLoginHandoffDB,
    PendingLoginLocaleDB,
    PendingLoginStateDB,
)


DEFAULT_BATCH_LIMIT = 500
MAX_BATCH_LIMIT = 5_000
CLEANUP_SCHEMA_VERSION = "calorieapp-auth-transient-cleanup-v1"
SUPPORTED_DATABASE_BACKENDS = frozenset({"postgresql", "sqlite"})

_TRANSIENT_TABLES: tuple[tuple[str, Any], ...] = (
    ("authorizationcode", AuthorizationCodeDB),
    ("pendingloginstate", PendingLoginStateDB),
    ("pendingloginlocale", PendingLoginLocaleDB),
    ("originloginhandoff", OriginLoginHandoffDB),
    ("authsession", AuthSessionDB),
    ("bridgeauthnonce", BridgeAuthNonceDB),
)


class RetentionCleanupSafetyError(RuntimeError):
    """Raised before cleanup when a fail-closed safety condition is not met."""


@dataclass(frozen=True)
class TableCleanupResult:
    """Aggregate result for one bounded table pass."""

    table: str
    selected: int
    deleted: int
    more_rows_pending: bool

    def as_payload(self) -> dict[str, object]:
        return {
            "table": self.table,
            "selected": self.selected,
            "deleted": self.deleted,
            "more_rows_pending": self.more_rows_pending,
        }


@dataclass(frozen=True)
class AuthenticationTransientCleanupResult:
    """Low-cardinality result that never contains record identifiers or secrets."""

    dry_run: bool
    cutoff_utc: datetime
    batch_limit_per_table: int
    tables: tuple[TableCleanupResult, ...]

    def as_payload(self) -> dict[str, object]:
        return {
            "schema_version": CLEANUP_SCHEMA_VERSION,
            "status": "planned" if self.dry_run else "executed",
            "dry_run": self.dry_run,
            "cutoff_utc": f"{self.cutoff_utc.isoformat(timespec='seconds')}Z",
            "batch_limit_per_table": self.batch_limit_per_table,
            "selected_total": sum(table.selected for table in self.tables),
            "deleted_total": sum(table.deleted for table in self.tables),
            "more_rows_pending": any(
                table.more_rows_pending for table in self.tables
            ),
            "tables": [table.as_payload() for table in self.tables],
        }


def _normalize_cutoff(cutoff: datetime | None) -> datetime:
    selected = cutoff or datetime.now(UTC)
    if selected.tzinfo is not None:
        selected = selected.astimezone(UTC).replace(tzinfo=None)
    return selected


def _validate_batch_limit(batch_limit: int) -> None:
    if isinstance(batch_limit, bool) or not 1 <= batch_limit <= MAX_BATCH_LIMIT:
        raise RetentionCleanupSafetyError(
            f"batch_limit must be between 1 and {MAX_BATCH_LIMIT}"
        )


def _validate_session(session: Session) -> None:
    backend = session.get_bind().dialect.name
    if backend not in SUPPORTED_DATABASE_BACKENDS:
        raise RetentionCleanupSafetyError(
            "authentication-transient cleanup requires SQLite or PostgreSQL"
        )
    if session.new or session.dirty or session.deleted:
        raise RetentionCleanupSafetyError(
            "authentication-transient cleanup requires a clean dedicated session"
        )


def _eligibility(model: Any, cutoff: datetime) -> Any:
    if model is AuthSessionDB:
        return or_(
            AuthSessionDB.expires_at <= cutoff,
            AuthSessionDB.revoked_at.is_not(None),
        )
    return model.expires_at <= cutoff


def _bounded_ids(
    session: Session,
    model: Any,
    cutoff: datetime,
    batch_limit: int,
) -> tuple[list[str], bool]:
    candidates = session.exec(
        select(model.id)
        .where(_eligibility(model, cutoff))
        .order_by(model.expires_at, model.id)
        .limit(batch_limit + 1)
    ).all()
    return list(candidates[:batch_limit]), len(candidates) > batch_limit


def _delete_selected_rows(session: Session, model: Any, ids: list[str]) -> int:
    if not ids:
        return 0
    result = session.exec(delete(model).where(model.id.in_(ids)))
    rowcount = getattr(result, "rowcount", None)
    return len(ids) if rowcount is None or rowcount < 0 else int(rowcount)


def cleanup_authentication_transients(
    session: Session,
    *,
    dry_run: bool = True,
    cutoff: datetime | None = None,
    batch_limit: int = DEFAULT_BATCH_LIMIT,
) -> AuthenticationTransientCleanupResult:
    """Plan or execute one atomic, bounded pass over every transient table.

    The caller must provide a clean, dedicated session. Dry-run never flushes or
    commits. Execute rolls every table back if any table fails.
    """

    _validate_batch_limit(batch_limit)
    _validate_session(session)
    selected_cutoff = _normalize_cutoff(cutoff)
    results: list[TableCleanupResult] = []

    try:
        with session.no_autoflush:
            selections = [
                (
                    table_name,
                    model,
                    *_bounded_ids(session, model, selected_cutoff, batch_limit),
                )
                for table_name, model in _TRANSIENT_TABLES
            ]

        if dry_run:
            for table_name, _model, ids, more_rows_pending in selections:
                results.append(
                    TableCleanupResult(
                        table=table_name,
                        selected=len(ids),
                        deleted=0,
                        more_rows_pending=more_rows_pending,
                    )
                )
        else:
            for table_name, model, ids, more_rows_pending in selections:
                if model is AuthSessionDB and ids:
                    session.exec(
                        update(AuthSessionDB)
                        .where(AuthSessionDB.replaced_by_session_id.in_(ids))
                        .values(replaced_by_session_id=None)
                    )
                deleted_count = _delete_selected_rows(session, model, ids)
                results.append(
                    TableCleanupResult(
                        table=table_name,
                        selected=len(ids),
                        deleted=deleted_count,
                        more_rows_pending=more_rows_pending,
                    )
                )
            session.commit()
    except Exception:
        session.rollback()
        raise

    return AuthenticationTransientCleanupResult(
        dry_run=dry_run,
        cutoff_utc=selected_cutoff,
        batch_limit_per_table=batch_limit,
        tables=tuple(results),
    )
