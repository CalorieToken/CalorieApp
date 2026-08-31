"""Add source-neutral catalog source and immutable record tables.

Revision: 20260831_0006
Parent: 20260831_0005
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260831_0006"
down_revision = "20260831_0005"

metadata = sa.MetaData()

food_source = sa.Table(
    "food_source",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("source_key", sa.String(100), nullable=False),
    sa.Column("source_category", sa.String(80), nullable=False),
    sa.Column("operator_name", sa.String(160), nullable=False),
    sa.Column("status", sa.String(20), nullable=False),
    sa.Column("licence_id", sa.String(120), nullable=False),
    sa.Column("terms_reference", sa.String(500), nullable=False),
    sa.Column("attribution_text", sa.String(500), nullable=False),
    sa.Column("record_limit", sa.Integer(), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.UniqueConstraint("source_key", name="uq_food_source_key"),
    sa.CheckConstraint(
        "status IN ('staged', 'enabled', 'paused', 'disabled')",
        name="ck_food_source_status",
    ),
    sa.CheckConstraint("record_limit > 0", name="ck_food_source_record_limit"),
)

food_source_record = sa.Table(
    "food_source_record",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column(
        "source_id",
        sa.String(),
        sa.ForeignKey("food_source.id", name="fk_food_source_record_source"),
        nullable=False,
    ),
    sa.Column("external_record_id", sa.String(255), nullable=False),
    sa.Column("source_version_or_content_digest", sa.String(128), nullable=False),
    sa.Column("retrieved_or_submitted_at", sa.DateTime(), nullable=False),
    sa.Column("verification_status", sa.String(20), nullable=False),
    sa.UniqueConstraint(
        "source_id",
        "external_record_id",
        "source_version_or_content_digest",
        name="uq_food_source_record_idempotency",
    ),
    sa.CheckConstraint(
        "verification_status IN ('quarantined', 'validated', 'rejected')",
        name="ck_food_source_record_verification_status",
    ),
)
sa.Index("ix_food_source_record_source_id", food_source_record.c.source_id)


def upgrade(connection: Connection) -> None:
    metadata.create_all(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    for table in (food_source, food_source_record):
        if not inspector.has_table(table.name):
            raise RuntimeError(f"Required table is missing: {table.name}")
        actual_columns = {
            str(column["name"])
            for column in inspector.get_columns(table.name)
        }
        expected_columns = {column.name for column in table.columns}
        allowed_columns = set(expected_columns)
        if table.name == food_source_record.name:
            allowed_columns.add("verification_version")
        if frozenset(actual_columns) not in {
            frozenset(expected_columns),
            frozenset(allowed_columns),
        }:
            raise RuntimeError(f"Schema column drift detected for {table.name}")

    source_unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(food_source.name)
    }
    if ("source_key",) not in source_unique_sets:
        raise RuntimeError("Food source key uniqueness is missing")
    source_checks = {
        item["name"] for item in inspector.get_check_constraints(food_source.name)
    }
    if not {"ck_food_source_status", "ck_food_source_record_limit"}.issubset(
        source_checks
    ):
        raise RuntimeError("Food source status or record limit constraint is missing")

    record_unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(food_source_record.name)
    }
    if (
        "source_id",
        "external_record_id",
        "source_version_or_content_digest",
    ) not in record_unique_sets:
        raise RuntimeError("Food source record idempotency constraint is missing")
    record_checks = {
        item["name"]
        for item in inspector.get_check_constraints(food_source_record.name)
    }
    if "ck_food_source_record_verification_status" not in record_checks:
        raise RuntimeError("Food source record verification constraint is missing")

    record_indexes = {
        index["name"]: tuple(index["column_names"])
        for index in inspector.get_indexes(food_source_record.name)
    }
    if record_indexes.get("ix_food_source_record_source_id") != ("source_id",):
        raise RuntimeError("Food source record source index is missing")
