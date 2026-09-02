"""Add private immutable account-data import replay receipts.

Revision: 20260902_0015
Parent: 20260902_0014
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260902_0015"
down_revision = "20260902_0014"

metadata = sa.MetaData()

calorieappuser = sa.Table(
    "calorieappuser",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
)

account_data_import_receipt = sa.Table(
    "account_data_import_receipt",
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
        "export_version = 'calorieapp-account-data-v1'",
        name="ck_account_data_import_receipt_export_version",
    ),
)
sa.Index(
    "ix_account_data_import_receipt_target_account_id",
    account_data_import_receipt.c.target_account_id,
)


def upgrade(connection: Connection) -> None:
    account_data_import_receipt.create(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    table = account_data_import_receipt
    if not inspector.has_table(table.name):
        raise RuntimeError(f"Required table is missing: {table.name}")

    actual_columns = {
        str(column["name"]): column
        for column in inspector.get_columns(table.name)
    }
    if set(actual_columns) != {column.name for column in table.columns}:
        raise RuntimeError("Schema column drift detected for import receipts")
    if any(bool(column["nullable"]) for column in actual_columns.values()):
        raise RuntimeError("Account-data import receipt columns must be non-nullable")

    foreign_keys = {
        (
            tuple(item["constrained_columns"]),
            item["referred_table"],
            tuple(item["referred_columns"]),
        )
        for item in inspector.get_foreign_keys(table.name)
    }
    if (
        ("target_account_id",),
        "calorieappuser",
        ("id",),
    ) not in foreign_keys:
        raise RuntimeError("Account-data import receipt target foreign key is missing")

    unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(table.name)
    }
    if (
        "target_account_id",
        "private_import_digest",
    ) not in unique_sets:
        raise RuntimeError("Account-data import receipt replay uniqueness is missing")

    checks = {
        item["name"] for item in inspector.get_check_constraints(table.name)
    }
    expected_checks = {
        "ck_account_data_import_receipt_digest",
        "ck_account_data_import_receipt_food_log_count",
        "ck_account_data_import_receipt_plan_version",
        "ck_account_data_import_receipt_export_version",
    }
    if not expected_checks.issubset(checks):
        raise RuntimeError("Account-data import receipt constraints are missing")

    indexes = {
        item["name"]: tuple(item["column_names"])
        for item in inspector.get_indexes(table.name)
    }
    if indexes.get("ix_account_data_import_receipt_target_account_id") != (
        "target_account_id",
    ):
        raise RuntimeError("Account-data import receipt target index is missing")
