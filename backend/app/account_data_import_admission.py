"""Pure fail-closed admission for a future account-data import transaction.

This module binds an already validated import plan to a server-authenticated
target and explicit target confirmation. It applies the initial clean-target,
exact-replay and retained-row capacity policies without opening a database
session or performing any mutation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .account_data_import import (
    IMPORT_PLAN_VERSION,
    MAXIMUM_USER_ID_BYTES,
    SUPPORTED_EXPORT_VERSION,
    AccountDataImportPlan,
    PlannedFoodLogImport,
)


IMPORT_ADMISSION_VERSION = "calorieapp-account-data-import-admission-v1"
IMPORT_DUPLICATE_POLICY = "clean-target-exact-plan-replay-only-v1"
FOOD_LOG_IMPORT_TARGET_LIMIT = 10_000


class AccountDataImportAdmissionError(ValueError):
    """Raised when a private import plan is not safe to admit."""


@dataclass(frozen=True, slots=True, repr=False)
class AccountDataImportAdmission:
    """Private admission decision; it is not authorization to mutate data."""

    admission_version: str
    action: Literal["prepare_insert", "idempotent_noop"]
    duplicate_policy: str
    plan: AccountDataImportPlan
    existing_target_food_log_count: int
    planned_insert_count: int
    food_log_limit: int

    def __repr__(self) -> str:
        """Keep the private plan and admission evidence out of debug output."""

        return "AccountDataImportAdmission(<private>)"


def _bounded_account_id(value: object, *, field_name: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise AccountDataImportAdmissionError(
            f"{field_name} must be a non-empty exact identifier"
        )
    if len(value.encode("utf-8")) > MAXIMUM_USER_ID_BYTES:
        raise AccountDataImportAdmissionError(f"{field_name} exceeds its byte limit")
    return value


def _require_nonnegative_integer(value: object, *, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise AccountDataImportAdmissionError(
            f"{field_name} must be a non-negative integer"
        )
    return value


def _require_positive_integer(value: object, *, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise AccountDataImportAdmissionError(
            f"{field_name} must be a positive integer"
        )
    return value


def _validate_plan_integrity(plan: object) -> AccountDataImportPlan:
    if not isinstance(plan, AccountDataImportPlan):
        raise AccountDataImportAdmissionError(
            "plan must be a reviewed account-data import plan"
        )
    if (
        plan.plan_version != IMPORT_PLAN_VERSION
        or plan.export_version != SUPPORTED_EXPORT_VERSION
    ):
        raise AccountDataImportAdmissionError("plan version is not supported")
    _bounded_account_id(plan.source_account_id, field_name="plan source account")
    _bounded_account_id(plan.target_account_id, field_name="plan target account")
    digest = plan.private_import_digest
    if (
        not isinstance(digest, str)
        or len(digest) != 64
        or any(character not in "0123456789abcdef" for character in digest)
    ):
        raise AccountDataImportAdmissionError("plan digest is not valid")
    if not isinstance(plan.food_logs, tuple) or any(
        not isinstance(food_log, PlannedFoodLogImport)
        for food_log in plan.food_logs
    ):
        raise AccountDataImportAdmissionError("plan food logs are not valid")
    if any(
        food_log.target_owner_id != plan.target_account_id
        for food_log in plan.food_logs
    ):
        raise AccountDataImportAdmissionError(
            "plan food-log ownership does not match its target account"
        )
    return plan


def admit_account_data_import(
    plan: AccountDataImportPlan,
    *,
    authenticated_target_account_id: str,
    confirmed_target_account_id: str,
    existing_target_food_log_count: int,
    private_digest_already_recorded: bool,
    food_log_limit: int = FOOD_LOG_IMPORT_TARGET_LIMIT,
) -> AccountDataImportAdmission:
    """Return a pure admission decision for a future caller-owned transaction.

    ``authenticated_target_account_id`` must come from server-side
    authentication, not from the uploaded export. A future database caller must
    read the count and private digest record under the same transaction and lock
    that it will use for insertion. This function never queries or writes data.
    """

    reviewed_plan = _validate_plan_integrity(plan)
    authenticated_target = _bounded_account_id(
        authenticated_target_account_id,
        field_name="authenticated_target_account_id",
    )
    confirmed_target = _bounded_account_id(
        confirmed_target_account_id,
        field_name="confirmed_target_account_id",
    )
    existing_count = _require_nonnegative_integer(
        existing_target_food_log_count,
        field_name="existing_target_food_log_count",
    )
    selected_limit = _require_positive_integer(
        food_log_limit,
        field_name="food_log_limit",
    )
    if selected_limit > FOOD_LOG_IMPORT_TARGET_LIMIT:
        raise AccountDataImportAdmissionError(
            "food_log_limit exceeds the reviewed maximum"
        )
    if not isinstance(private_digest_already_recorded, bool):
        raise AccountDataImportAdmissionError(
            "private_digest_already_recorded must be a boolean"
        )
    if authenticated_target != reviewed_plan.target_account_id:
        raise AccountDataImportAdmissionError(
            "authenticated target account does not match the import plan"
        )
    if confirmed_target != authenticated_target:
        raise AccountDataImportAdmissionError(
            "confirmed target account does not match authentication"
        )

    if private_digest_already_recorded:
        return AccountDataImportAdmission(
            admission_version=IMPORT_ADMISSION_VERSION,
            action="idempotent_noop",
            duplicate_policy=IMPORT_DUPLICATE_POLICY,
            plan=reviewed_plan,
            existing_target_food_log_count=existing_count,
            planned_insert_count=0,
            food_log_limit=selected_limit,
        )

    if existing_count != 0:
        raise AccountDataImportAdmissionError(
            "target account is not clean for the initial import policy"
        )
    planned_count = len(reviewed_plan.food_logs)
    if planned_count > selected_limit:
        raise AccountDataImportAdmissionError(
            "import exceeds the target food-log capacity"
        )

    return AccountDataImportAdmission(
        admission_version=IMPORT_ADMISSION_VERSION,
        action="prepare_insert",
        duplicate_policy=IMPORT_DUPLICATE_POLICY,
        plan=reviewed_plan,
        existing_target_food_log_count=existing_count,
        planned_insert_count=planned_count,
        food_log_limit=selected_limit,
    )
