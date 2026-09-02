"""Guarded, transaction-owned inactive-account primary-store erasure.

This internal module has no endpoint, CLI, scheduler, provider, batch selector or
commit capability. Production execution is deliberately rejected. A caller may
stage one already-eligible synthetic/non-production erasure only after the
read-only preflight succeeds in the same database transaction.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import delete, update
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from .inactive_account_erasure_preflight import (
    InactiveAccountErasurePreflight,
    InactiveAccountErasurePreflightSafetyError,
    preflight_inactive_account_erasure,
)
from .models import (
    AccountDataImportReceiptDB,
    AuthSessionDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
)


EXECUTION_SCHEMA_VERSION = "calorieapp-inactive-account-erasure-execution-v1"
MAXIMUM_APPROVAL_REFERENCE_BYTES = 120
NON_PRODUCTION_ENVIRONMENTS = frozenset({"local", "staging", "test"})


class InactiveAccountErasureExecutionSafetyError(RuntimeError):
    """Raised when one exact preflighted erasure cannot be staged safely."""


@dataclass(frozen=True, slots=True)
class InactiveAccountErasureExecutionResult:
    """Low-cardinality evidence for mutations awaiting the caller's decision."""

    evaluated_at: datetime
    approval_reference_sha256: str
    food_log_rows_deleted: int
    external_identity_rows_deleted: int
    origin_login_handoff_rows_deleted: int
    auth_session_rows_deleted: int
    inactive_account_notice_rows_deleted: int
    inbound_session_references_cleared: int
    user_rows_deleted: int
    account_data_import_receipt_rows_deleted: int = 0

    @property
    def total_delete_rows(self) -> int:
        return sum(
            (
                self.food_log_rows_deleted,
                self.external_identity_rows_deleted,
                self.origin_login_handoff_rows_deleted,
                self.auth_session_rows_deleted,
                self.inactive_account_notice_rows_deleted,
                self.account_data_import_receipt_rows_deleted,
                self.user_rows_deleted,
            )
        )

    def as_payload(self) -> dict[str, object]:
        """Return aggregate evidence without an account, notice or data value."""

        return {
            "schema_version": EXECUTION_SCHEMA_VERSION,
            "status": "staged-pending-caller-commit",
            "evaluated_at": self.evaluated_at.isoformat(timespec="seconds") + "Z",
            "approval_reference_sha256": self.approval_reference_sha256,
            "delete_rows": {
                "food_log": self.food_log_rows_deleted,
                "externalidentity": self.external_identity_rows_deleted,
                "originloginhandoff": self.origin_login_handoff_rows_deleted,
                "authsession": self.auth_session_rows_deleted,
                "inactive_account_notice": self.inactive_account_notice_rows_deleted,
                "account_data_import_receipt": (
                    self.account_data_import_receipt_rows_deleted
                ),
                "calorieappuser": self.user_rows_deleted,
            },
            "inbound_session_references_cleared": (
                self.inbound_session_references_cleared
            ),
            "total_delete_rows": self.total_delete_rows,
            "caller_commit_required": True,
        }


def _approval_reference_digest(approval_reference: str | None) -> str:
    reference = (
        approval_reference.strip()
        if isinstance(approval_reference, str)
        else ""
    )
    if (
        not reference
        or len(reference.encode("utf-8")) > MAXIMUM_APPROVAL_REFERENCE_BYTES
    ):
        raise InactiveAccountErasureExecutionSafetyError(
            "execution requires an approval reference of 1 to 120 bytes"
        )
    return hashlib.sha256(reference.encode("utf-8")).hexdigest()


def _validate_execution_authorization(
    *,
    environment: str,
    execute: bool,
    approval_reference: str | None,
) -> str:
    if execute is not True:
        raise InactiveAccountErasureExecutionSafetyError(
            "inactive-account erasure execution is disabled by default"
        )
    if (
        not isinstance(environment, str)
        or environment not in NON_PRODUCTION_ENVIRONMENTS
    ):
        raise InactiveAccountErasureExecutionSafetyError(
            "execution requires a validated local, staging or test environment"
        )
    return _approval_reference_digest(approval_reference)


def _exact_rowcount(result: Any, *, expected: int, relation: str) -> int:
    rowcount = getattr(result, "rowcount", None)
    try:
        actual = int(rowcount)
    except (TypeError, ValueError, OverflowError):
        actual = -1
    if actual < 0:
        raise InactiveAccountErasureExecutionSafetyError(
            f"{relation} mutation did not report an exact row count"
        )
    if actual != expected:
        raise InactiveAccountErasureExecutionSafetyError(
            f"{relation} changed after its locked preflight"
        )
    return actual


def _ensure_sqlite_outer_transaction(session: Session) -> None:
    """Prevent a released SQLite savepoint from becoming an implicit commit.

    Python's sqlite3 legacy transaction mode does not begin a database
    transaction for a SELECT or SAVEPOINT. The eligibility/preflight reads can
    therefore leave the driver outside a real transaction even though
    SQLAlchemy reports an ORM transaction. Start that outer database
    transaction explicitly before the inner mutation savepoint.
    """

    if session.get_bind().dialect.name != "sqlite":
        return
    connection = session.connection()
    driver_connection = connection.connection.driver_connection
    if not driver_connection.in_transaction:
        connection.exec_driver_sql("BEGIN")


def _stage_preflighted_erasure(
    session: Session,
    preflight: InactiveAccountErasurePreflight,
) -> dict[str, int]:
    """Stage the exact preflighted deletion shape inside one savepoint."""

    user_id = preflight.user_id
    owned_session_ids = select(AuthSessionDB.id).where(
        AuthSessionDB.calorieapp_user_id == user_id
    )

    with session.begin_nested():
        food_logs = _exact_rowcount(
            session.exec(delete(FoodLogDB).where(FoodLogDB.owner_id == user_id)),
            expected=preflight.food_log_rows,
            relation="food_log",
        )
        notices = _exact_rowcount(
            session.exec(
                delete(InactiveAccountNoticeDB).where(
                    InactiveAccountNoticeDB.calorieapp_user_id == user_id
                )
            ),
            expected=preflight.inactive_account_notice_rows,
            relation="inactive_account_notice",
        )
        import_receipts = _exact_rowcount(
            session.exec(
                delete(AccountDataImportReceiptDB).where(
                    AccountDataImportReceiptDB.target_account_id == user_id
                )
            ),
            expected=preflight.account_data_import_receipt_rows,
            relation="account_data_import_receipt",
        )
        handoffs = _exact_rowcount(
            session.exec(
                delete(OriginLoginHandoffDB).where(
                    OriginLoginHandoffDB.calorieapp_user_id == user_id
                )
            ),
            expected=preflight.origin_login_handoff_rows,
            relation="originloginhandoff",
        )
        inbound_references = _exact_rowcount(
            session.exec(
                update(AuthSessionDB)
                .where(AuthSessionDB.replaced_by_session_id.in_(owned_session_ids))
                .values(replaced_by_session_id=None)
            ),
            expected=preflight.inbound_session_reference_rows,
            relation="inbound_authsession_reference",
        )
        auth_sessions = _exact_rowcount(
            session.exec(
                delete(AuthSessionDB).where(
                    AuthSessionDB.calorieapp_user_id == user_id
                )
            ),
            expected=preflight.auth_session_rows,
            relation="authsession",
        )
        identities = _exact_rowcount(
            session.exec(
                delete(ExternalIdentityDB).where(
                    ExternalIdentityDB.calorieapp_user_id == user_id
                )
            ),
            expected=preflight.external_identity_rows,
            relation="externalidentity",
        )
        users = _exact_rowcount(
            session.exec(
                delete(CalorieAppUserDB).where(CalorieAppUserDB.id == user_id)
            ),
            expected=1,
            relation="calorieappuser",
        )
        if sum(
            (
                food_logs,
                notices,
                import_receipts,
                handoffs,
                auth_sessions,
                identities,
                users,
            )
        ) != preflight.total_delete_rows:
            raise InactiveAccountErasureExecutionSafetyError(
                "staged erasure does not match its locked preflight"
            )
        session.flush()

    return {
        "food_logs": food_logs,
        "notices": notices,
        "import_receipts": import_receipts,
        "handoffs": handoffs,
        "inbound_references": inbound_references,
        "auth_sessions": auth_sessions,
        "identities": identities,
        "users": users,
    }


def execute_inactive_account_erasure(
    session: Session,
    *,
    notice_id: str,
    as_of: datetime,
    environment: str,
    execute: bool = False,
    approval_reference: str | None = None,
) -> InactiveAccountErasureExecutionResult | None:
    """Stage one non-production erasure without committing the transaction.

    Authorization is checked before database access. The existing eligibility
    guard and bounded preflight then run in the same caller-owned transaction.
    ``None`` is an idempotent no-op for a missing or no-longer-eligible notice.
    """

    approval_digest = _validate_execution_authorization(
        environment=environment,
        execute=execute,
        approval_reference=approval_reference,
    )
    try:
        _ensure_sqlite_outer_transaction(session)
        preflight = preflight_inactive_account_erasure(
            session,
            notice_id=notice_id,
            as_of=as_of,
        )
        if preflight is None:
            return None
        counts = _stage_preflighted_erasure(session, preflight)
        result = InactiveAccountErasureExecutionResult(
            evaluated_at=preflight.evaluated_at,
            approval_reference_sha256=approval_digest,
            food_log_rows_deleted=counts["food_logs"],
            external_identity_rows_deleted=counts["identities"],
            origin_login_handoff_rows_deleted=counts["handoffs"],
            auth_session_rows_deleted=counts["auth_sessions"],
            inactive_account_notice_rows_deleted=counts["notices"],
            account_data_import_receipt_rows_deleted=counts["import_receipts"],
            inbound_session_references_cleared=counts["inbound_references"],
            user_rows_deleted=counts["users"],
        )
        return result
    except InactiveAccountErasureExecutionSafetyError:
        raise
    except InactiveAccountErasurePreflightSafetyError as exc:
        raise InactiveAccountErasureExecutionSafetyError(
            "inactive-account erasure preflight is unavailable"
        ) from exc
    except SQLAlchemyError as exc:
        raise InactiveAccountErasureExecutionSafetyError(
            "inactive-account erasure execution is unavailable"
        ) from exc
