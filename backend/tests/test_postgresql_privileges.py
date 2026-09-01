from __future__ import annotations

import pytest
from sqlmodel import SQLModel, create_engine

import app.models  # noqa: F401 - loads the reviewed SQLModel table inventory
from app.postgresql_privileges import (
    APPLICATION_MANAGED_TABLES,
    APPLICATION_READ_ONLY_TABLES,
    PostgreSQLPrivilegeError,
    apply_postgresql_application_privileges,
    validate_application_role_name,
    validate_approval_reference,
)


def test_privilege_policy_classifies_every_current_application_table() -> None:
    model_tables = frozenset(SQLModel.metadata.tables)
    assert APPLICATION_MANAGED_TABLES == model_tables | APPLICATION_READ_ONLY_TABLES
    assert APPLICATION_READ_ONLY_TABLES == frozenset({"calorie_schema_revision"})


@pytest.mark.parametrize(
    "role_name",
    [
        "calorieapp_runtime",
        "a",
        "a" + "1" * 62,
    ],
)
def test_application_role_name_accepts_narrow_safe_identifiers(role_name: str) -> None:
    assert validate_application_role_name(role_name) == role_name


@pytest.mark.parametrize(
    "role_name",
    [
        "",
        "CalorieApp_runtime",
        "1calorieapp",
        "calorieapp-runtime",
        "calorieapp runtime",
        "a" + "1" * 63,
        "calorieapp_runtime; DROP SCHEMA public",
    ],
)
def test_application_role_name_rejects_ambiguous_or_unsafe_identifiers(
    role_name: str,
) -> None:
    with pytest.raises(PostgreSQLPrivilegeError):
        validate_application_role_name(role_name)


def test_privilege_mutation_requires_bounded_approval_reference() -> None:
    assert validate_approval_reference(" PR-56 ") == "PR-56"
    for reference in (None, "", " ", "x" * 121):
        with pytest.raises(PostgreSQLPrivilegeError):
            validate_approval_reference(reference)


def test_privilege_policy_refuses_non_postgresql_database() -> None:
    engine = create_engine("sqlite://")
    try:
        with engine.begin() as connection:
            with pytest.raises(
                PostgreSQLPrivilegeError,
                match="only be managed on PostgreSQL",
            ):
                apply_postgresql_application_privileges(
                    connection,
                    "calorieapp_runtime",
                    approval_reference="SYNTHETIC-TEST",
                )
    finally:
        engine.dispose()
