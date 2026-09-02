"""Guarded transaction-owned account-data import staging.

This internal module connects the reviewed pure import plan and admission policy
to private replay storage and food-log inserts. It has no endpoint, upload
control, provider action, production capability or commit call. The caller owns
the surrounding transaction and must explicitly commit or roll it back.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Literal

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from .account_data_import import AccountDataImportPlan
from .account_data_import_admission import (
    AccountDataImportAdmissionError,
    admit_account_data_import,
)
from .data_growth import (
    FOOD_LOG_SUBJECT_ENTRY_LIMIT,
    food_log_subject_transaction_lock,
)
from .models import (
    AccountDataImportReceiptDB,
    CalorieAppUserDB,
    FoodLogDB,
)


IMPORT_TRANSACTION_VERSION = "calorieapp-account-data-import-transaction-v1"
MAXIMUM_APPROVAL_REFERENCE_BYTES = 120
NON_PRODUCTION_ENVIRONMENTS = frozenset({"local", "staging", "test"})


class AccountDataImportTransactionSafetyError(RuntimeError):
    """Raised when one private import cannot be staged safely."""


@dataclass(frozen=True, slots=True, repr=False)
class AccountDataImportTransactionResult:
    """Low-cardinality evidence for a staged import or exact replay."""

    action: Literal["staged_insert", "idempotent_noop"]
    staged_food_log_rows: int
    staged_receipt_rows: int
    approval_reference_sha256: str

    def __repr__(self) -> str:
        """Keep private transaction context out of debug output."""

        return "AccountDataImportTransactionResult(<private>)"

    def as_payload(self) -> dict[str, object]:
        """Return aggregate evidence without an account or private digest."""

        return {
            "transaction_version": IMPORT_TRANSACTION_VERSION,
            "action": self.action,
            "staged_food_log_rows": self.staged_food_log_rows,
            "staged_receipt_rows": self.staged_receipt_rows,
            "approval_reference_sha256": self.approval_reference_sha256,
            "caller_commit_required": self.action == "staged_insert",
        }


def _validate_execution_authorization(
    *,
    environment: str,
    execute: bool,
    approval_reference: str | None,
) -> str:
    if execute is not True:
        raise AccountDataImportTransactionSafetyError(
            "account-data import transaction is disabled by default"
        )
    if (
        not isinstance(environment, str)
        or environment not in NON_PRODUCTION_ENVIRONMENTS
    ):
        raise AccountDataImportTransactionSafetyError(
            "account-data import requires a validated non-production environment"
        )
    reference = (
        approval_reference.strip()
        if isinstance(approval_reference, str)
        else ""
    )
    if (
        not reference
        or len(reference.encode("utf-8")) > MAXIMUM_APPROVAL_REFERENCE_BYTES
    ):
        raise AccountDataImportTransactionSafetyError(
            "account-data import requires an approval reference of 1 to 120 bytes"
        )
    return hashlib.sha256(reference.encode("utf-8")).hexdigest()


def _ensure_sqlite_outer_transaction(session: Session) -> None:
    """Ensure a future savepoint cannot become an implicit SQLite commit."""

    if session.get_bind().dialect.name != "sqlite":
        return
    connection = session.connection()
    driver_connection = connection.connection.driver_connection
    if not driver_connection.in_transaction:
        connection.exec_driver_sql("BEGIN")


def _require_no_pending_session_mutations(session: Session) -> None:
    if session.new or session.dirty or session.deleted:
        raise AccountDataImportTransactionSafetyError(
            "account-data import requires no pending session mutations"
        )


def _lock_active_target(session: Session, target_account_id: str) -> None:
    target = session.exec(
        select(CalorieAppUserDB)
        .where(CalorieAppUserDB.id == target_account_id)
        .with_for_update()
    ).one_or_none()
    if target is None or target.status != "active":
        raise AccountDataImportTransactionSafetyError(
            "authenticated import target is unavailable"
        )


def _target_food_log_count(session: Session, target_account_id: str) -> int:
    return int(
        session.exec(
            select(sa.func.count(FoodLogDB.id)).where(
                FoodLogDB.owner_id == target_account_id
            )
        ).one()
    )


def _private_digest_receipt(
    session: Session,
    *,
    target_account_id: str,
    private_import_digest: str,
) -> AccountDataImportReceiptDB | None:
    return session.exec(
        select(AccountDataImportReceiptDB).where(
            AccountDataImportReceiptDB.target_account_id == target_account_id,
            AccountDataImportReceiptDB.private_import_digest
            == private_import_digest,
        )
    ).one_or_none()


def _target_has_private_receipt(
    session: Session,
    target_account_id: str,
) -> bool:
    receipt_count = int(
        session.exec(
            select(sa.func.count(AccountDataImportReceiptDB.id)).where(
                AccountDataImportReceiptDB.target_account_id
                == target_account_id
            )
        ).one()
    )
    return receipt_count > 0


def _require_receipt_matches_plan(
    receipt: AccountDataImportReceiptDB | None,
    plan: AccountDataImportPlan,
) -> bool:
    if receipt is None:
        return False
    if (
        receipt.plan_version != plan.plan_version
        or receipt.export_version != plan.export_version
        or receipt.food_log_count != len(plan.food_logs)
    ):
        raise AccountDataImportTransactionSafetyError(
            "private account-data import receipt conflicts with the reviewed plan"
        )
    return True


def _stage_admitted_import(
    session: Session,
    plan: AccountDataImportPlan,
) -> tuple[int, int]:
    entries = [
        FoodLogDB(**planned_food_log.as_insert_values())
        for planned_food_log in plan.food_logs
    ]
    receipt = AccountDataImportReceiptDB(
        target_account_id=plan.target_account_id,
        private_import_digest=plan.private_import_digest,
        plan_version=plan.plan_version,
        export_version=plan.export_version,
        food_log_count=len(entries),
    )

    with session.begin_nested():
        session.add_all([*entries, receipt])
        session.flush()
        if any(entry.id is None for entry in entries):
            raise AccountDataImportTransactionSafetyError(
                "account-data import did not stage every food-log row"
            )
        if receipt.id is None:
            raise AccountDataImportTransactionSafetyError(
                "account-data import did not stage its private replay receipt"
            )
    return len(entries), 1


def execute_account_data_import_transaction(
    session: Session,
    plan: AccountDataImportPlan,
    *,
    authenticated_target_account_id: str,
    confirmed_target_account_id: str,
    environment: str,
    execute: bool = False,
    approval_reference: str | None = None,
) -> AccountDataImportTransactionResult:
    """Stage one private import without committing the caller's transaction.

    The authenticated target must be derived from server-side authentication.
    The same per-account transaction lock protects target lookup, current count,
    exact replay lookup, inserts and the replay receipt. Production is rejected
    and the operation remains disabled unless the caller opts in explicitly.
    """

    approval_digest = _validate_execution_authorization(
        environment=environment,
        execute=execute,
        approval_reference=approval_reference,
    )
    try:
        # Validate plan, target binding and the fixed capacity ceiling before
        # touching the database. Database-derived facts are re-evaluated below.
        admit_account_data_import(
            plan,
            authenticated_target_account_id=authenticated_target_account_id,
            confirmed_target_account_id=confirmed_target_account_id,
            existing_target_food_log_count=0,
            private_digest_already_recorded=False,
            any_private_receipt_recorded=False,
            food_log_limit=FOOD_LOG_SUBJECT_ENTRY_LIMIT,
        )

        _require_no_pending_session_mutations(session)
        _ensure_sqlite_outer_transaction(session)
        with food_log_subject_transaction_lock(
            session,
            authenticated_target_account_id,
        ):
            _lock_active_target(session, authenticated_target_account_id)
            existing_count = _target_food_log_count(
                session,
                authenticated_target_account_id,
            )
            receipt = _private_digest_receipt(
                session,
                target_account_id=authenticated_target_account_id,
                private_import_digest=plan.private_import_digest,
            )
            digest_recorded = _require_receipt_matches_plan(receipt, plan)
            any_receipt_recorded = _target_has_private_receipt(
                session,
                authenticated_target_account_id,
            )
            admission = admit_account_data_import(
                plan,
                authenticated_target_account_id=authenticated_target_account_id,
                confirmed_target_account_id=confirmed_target_account_id,
                existing_target_food_log_count=existing_count,
                private_digest_already_recorded=digest_recorded,
                any_private_receipt_recorded=any_receipt_recorded,
                food_log_limit=FOOD_LOG_SUBJECT_ENTRY_LIMIT,
            )
            if admission.action == "idempotent_noop":
                return AccountDataImportTransactionResult(
                    action="idempotent_noop",
                    staged_food_log_rows=0,
                    staged_receipt_rows=0,
                    approval_reference_sha256=approval_digest,
                )

            staged_food_logs, staged_receipts = _stage_admitted_import(
                session,
                admission.plan,
            )
            return AccountDataImportTransactionResult(
                action="staged_insert",
                staged_food_log_rows=staged_food_logs,
                staged_receipt_rows=staged_receipts,
                approval_reference_sha256=approval_digest,
            )
    except AccountDataImportTransactionSafetyError:
        raise
    except AccountDataImportAdmissionError:
        raise AccountDataImportTransactionSafetyError(
            "account-data import admission was rejected"
        ) from None
    except (SQLAlchemyError, TypeError, ValueError):
        raise AccountDataImportTransactionSafetyError(
            "account-data import transaction is unavailable"
        ) from None
