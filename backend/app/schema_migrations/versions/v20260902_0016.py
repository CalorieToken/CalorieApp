"""Allow v1 and v2 source versions in private import replay receipts.

Revision: 20260902_0016
Parent: 20260902_0015
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260902_0016"
down_revision = "20260902_0015"

TABLE_NAME = "account_data_import_receipt"
TEMPORARY_TABLE_NAME = "account_data_import_receipt_v1"
CONSTRAINT_NAME = "ck_account_data_import_receipt_export_version"
INDEX_NAME = "ix_account_data_import_receipt_target_account_id"
ALLOWED_EXPORT_VERSIONS = (
    "calorieapp-account-data-v1",
    "calorieapp-account-data-v2",
)

metadata = sa.MetaData()

calorieappuser = sa.Table(
    "calorieappuser",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
)

account_data_import_receipt = sa.Table(
    TABLE_NAME,
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column(
        "target_account_id",
        sa.String(255),
        sa.ForeignKey(
            "calorieappuser.id",
            name="fk_account_data_import_receipt_target",
        ),
        nullable=False,
    ),
    sa.Column("private_import_digest", sa.String(64), nullable=False),
    sa.Column("plan_version", sa.String(80), nullable=False),
    sa.Column("export_version", sa.String(80), nullable=False),
    sa.Column("food_log_count", sa.Integer(), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.UniqueConstraint(
        "target_account_id",
        "private_import_digest",
        name="uq_account_data_import_receipt_target_digest",
    ),
    sa.CheckConstraint(
        "LENGTH(private_import_digest) = 64 "
        "AND private_import_digest = LOWER(private_import_digest)",
        name="ck_account_data_import_receipt_digest",
    ),
    sa.CheckConstraint(
        "food_log_count >= 0 AND food_log_count <= 10000",
        name="ck_account_data_import_receipt_food_log_count",
    ),
    sa.CheckConstraint(
        "plan_version = 'calorieapp-account-data-import-plan-v1'",
        name="ck_account_data_import_receipt_plan_version",
    ),
    sa.CheckConstraint(
        "export_version IN ('calorieapp-account-data-v1', "
        "'calorieapp-account-data-v2')",
        name=CONSTRAINT_NAME,
    ),
)
sa.Index(INDEX_NAME, account_data_import_receipt.c.target_account_id)


def _assert_existing_rows_are_safe(connection: Connection) -> None:
    invalid = connection.execute(
        sa.text(
            f"SELECT id FROM {TABLE_NAME} "
            "WHERE export_version NOT IN "
            "('calorieapp-account-data-v1', 'calorieapp-account-data-v2') "
            "LIMIT 1"
        )
    ).first()
    if invalid is not None:
        raise RuntimeError("Import receipt has an unsupported export version")


def _constraint_supports_v2(connection: Connection) -> bool:
    for item in sa.inspect(connection).get_check_constraints(TABLE_NAME):
        if item.get("name") != CONSTRAINT_NAME:
            continue
        sqltext = str(item.get("sqltext") or "")
        return all(version in sqltext for version in ALLOWED_EXPORT_VERSIONS)
    return False


def _rebuild_sqlite_table(connection: Connection) -> None:
    connection.exec_driver_sql(f'DROP INDEX IF EXISTS "{INDEX_NAME}"')
    connection.exec_driver_sql(
        f'ALTER TABLE "{TABLE_NAME}" RENAME TO "{TEMPORARY_TABLE_NAME}"'
    )
    account_data_import_receipt.create(connection)
    columns = (
        "id, target_account_id, private_import_digest, plan_version, "
        "export_version, food_log_count, created_at"
    )
    connection.exec_driver_sql(
        f'INSERT INTO "{TABLE_NAME}" ({columns}) '
        f'SELECT {columns} FROM "{TEMPORARY_TABLE_NAME}"'
    )
    connection.exec_driver_sql(f'DROP TABLE "{TEMPORARY_TABLE_NAME}"')


def upgrade(connection: Connection) -> None:
    if not sa.inspect(connection).has_table(TABLE_NAME):
        raise RuntimeError(f"Required table is missing: {TABLE_NAME}")
    _assert_existing_rows_are_safe(connection)
    if _constraint_supports_v2(connection):
        return

    if connection.dialect.name == "postgresql":
        connection.exec_driver_sql(
            f'ALTER TABLE "{TABLE_NAME}" DROP CONSTRAINT "{CONSTRAINT_NAME}"'
        )
        connection.exec_driver_sql(
            f'ALTER TABLE "{TABLE_NAME}" ADD CONSTRAINT "{CONSTRAINT_NAME}" '
            "CHECK (export_version IN ('calorieapp-account-data-v1', "
            "'calorieapp-account-data-v2'))"
        )
        return
    if connection.dialect.name == "sqlite":
        _rebuild_sqlite_table(connection)
        return
    raise RuntimeError("Import receipt migration requires SQLite or PostgreSQL")


def validate(connection: Connection) -> None:
    if not sa.inspect(connection).has_table(TABLE_NAME):
        raise RuntimeError(f"Required table is missing: {TABLE_NAME}")
    _assert_existing_rows_are_safe(connection)
    if not _constraint_supports_v2(connection):
        raise RuntimeError("Import receipt v2 export-version constraint is missing")
