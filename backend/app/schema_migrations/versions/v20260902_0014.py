"""Require inactive-account cancellation at or after notice delivery.

Revision: 20260902_0014
Parent: 20260901_0013
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260902_0014"
down_revision = "20260901_0013"

TABLE_NAME = "inactive_account_notice"
CONSTRAINT_NAME = "ck_inactive_account_notice_cancelled_after_delivery"
INSERT_TRIGGER = f"{CONSTRAINT_NAME}_insert"
UPDATE_TRIGGER = f"{CONSTRAINT_NAME}_update"


def _assert_existing_rows_are_safe(connection: Connection) -> None:
    invalid = connection.execute(
        sa.text(
            "SELECT id FROM inactive_account_notice "
            "WHERE cancelled_at IS NOT NULL "
            "AND cancelled_at < delivered_at LIMIT 1"
        )
    ).first()
    if invalid is not None:
        raise RuntimeError(
            "Inactive-account notice cancellation predates delivery"
        )


def _sqlite_trigger_sql(name: str, operation: str) -> str:
    return (
        f'CREATE TRIGGER "{name}" BEFORE {operation} ON "{TABLE_NAME}" '
        "FOR EACH ROW WHEN NEW.cancelled_at IS NOT NULL "
        "AND NEW.cancelled_at < NEW.delivered_at BEGIN "
        "SELECT RAISE(ABORT, "
        "'inactive-account cancellation predates delivery'); END"
    )


def upgrade(connection: Connection) -> None:
    if not sa.inspect(connection).has_table(TABLE_NAME):
        raise RuntimeError(f"Required table is missing: {TABLE_NAME}")
    _assert_existing_rows_are_safe(connection)

    if connection.dialect.name == "postgresql":
        checks = {
            item["name"]
            for item in sa.inspect(connection).get_check_constraints(TABLE_NAME)
        }
        if CONSTRAINT_NAME not in checks:
            connection.exec_driver_sql(
                f'ALTER TABLE "{TABLE_NAME}" ADD CONSTRAINT "{CONSTRAINT_NAME}" '
                "CHECK (cancelled_at IS NULL OR cancelled_at >= delivered_at)"
            )
        return

    if connection.dialect.name == "sqlite":
        existing_triggers = {
            row[0]
            for row in connection.exec_driver_sql(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'trigger' AND tbl_name = ?",
                (TABLE_NAME,),
            )
        }
        if INSERT_TRIGGER not in existing_triggers:
            connection.exec_driver_sql(
                _sqlite_trigger_sql(INSERT_TRIGGER, "INSERT")
            )
        if UPDATE_TRIGGER not in existing_triggers:
            connection.exec_driver_sql(
                _sqlite_trigger_sql(UPDATE_TRIGGER, "UPDATE")
            )
        return

    raise RuntimeError(
        "Inactive-account notice hardening requires SQLite or PostgreSQL"
    )


def validate(connection: Connection) -> None:
    if not sa.inspect(connection).has_table(TABLE_NAME):
        raise RuntimeError(f"Required table is missing: {TABLE_NAME}")
    _assert_existing_rows_are_safe(connection)

    if connection.dialect.name == "postgresql":
        checks = {
            item["name"]
            for item in sa.inspect(connection).get_check_constraints(TABLE_NAME)
        }
        if CONSTRAINT_NAME not in checks:
            raise RuntimeError(
                "Inactive-account cancellation delivery constraint is missing"
            )
        return

    if connection.dialect.name == "sqlite":
        triggers = {
            row[0]
            for row in connection.exec_driver_sql(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'trigger' AND tbl_name = ?",
                (TABLE_NAME,),
            )
        }
        if not {INSERT_TRIGGER, UPDATE_TRIGGER}.issubset(triggers):
            raise RuntimeError(
                "Inactive-account cancellation delivery triggers are missing"
            )
        return

    raise RuntimeError(
        "Inactive-account notice hardening requires SQLite or PostgreSQL"
    )
