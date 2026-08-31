"""Add versioned source-record moderation and append-only audit evidence.

Revision: 20260831_0007
Parent: 20260831_0006
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260831_0007"
down_revision = "20260831_0006"

metadata = sa.MetaData()
food_source_record = sa.Table(
    "food_source_record",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
)
food_source_moderation_audit = sa.Table(
    "food_source_moderation_audit",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column(
        "source_record_id",
        sa.String(),
        sa.ForeignKey(
            "food_source_record.id",
            name="fk_food_source_moderation_audit_record",
        ),
        nullable=False,
    ),
    sa.Column("idempotency_key", sa.String(128), nullable=False),
    sa.Column("expected_version", sa.Integer(), nullable=False),
    sa.Column("resulting_version", sa.Integer(), nullable=False),
    sa.Column("previous_status", sa.String(20), nullable=False),
    sa.Column("new_status", sa.String(20), nullable=False),
    sa.Column("moderator_reference", sa.String(120), nullable=False),
    sa.Column("authorization_scope", sa.String(80), nullable=False),
    sa.Column("reason_code", sa.String(80), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.UniqueConstraint(
        "idempotency_key",
        name="uq_food_source_moderation_audit_idempotency",
    ),
    sa.CheckConstraint(
        "previous_status = 'quarantined'",
        name="ck_food_source_moderation_audit_previous_status",
    ),
    sa.CheckConstraint(
        "new_status IN ('validated', 'rejected')",
        name="ck_food_source_moderation_audit_new_status",
    ),
    sa.CheckConstraint(
        "expected_version > 0 AND resulting_version = expected_version + 1",
        name="ck_food_source_moderation_audit_versions",
    ),
)
sa.Index(
    "ix_food_source_moderation_audit_source_record_id",
    food_source_moderation_audit.c.source_record_id,
)


def upgrade(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    record_columns = {
        str(column["name"])
        for column in inspector.get_columns(food_source_record.name)
    }
    if "verification_version" not in record_columns:
        connection.execute(
            sa.text(
                "ALTER TABLE food_source_record ADD COLUMN "
                "verification_version INTEGER NOT NULL DEFAULT 1 "
                "CHECK (verification_version > 0)"
            )
        )

    food_source_moderation_audit.create(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    if not inspector.has_table(food_source_record.name):
        raise RuntimeError("Required table is missing: food_source_record")

    record_columns = {
        str(column["name"]): column
        for column in inspector.get_columns(food_source_record.name)
    }
    version_column = record_columns.get("verification_version")
    if version_column is None or bool(version_column["nullable"]):
        raise RuntimeError("Source-record verification version is missing or nullable")
    record_checks = inspector.get_check_constraints(food_source_record.name)
    if not any(
        "verification_version" in str(item.get("sqltext", ""))
        and "> 0" in str(item.get("sqltext", ""))
        for item in record_checks
    ):
        raise RuntimeError("Source-record verification version constraint is missing")

    if not inspector.has_table(food_source_moderation_audit.name):
        raise RuntimeError(
            "Required table is missing: food_source_moderation_audit"
        )
    actual_column_map = {
        str(column["name"]): column
        for column in inspector.get_columns(food_source_moderation_audit.name)
    }
    actual_columns = set(actual_column_map)
    expected_columns = {
        column.name for column in food_source_moderation_audit.columns
    }
    if actual_columns != expected_columns:
        raise RuntimeError("Schema column drift detected for moderation audit")
    if any(bool(column["nullable"]) for column in actual_column_map.values()):
        raise RuntimeError("Moderation audit columns must be non-nullable")

    foreign_keys = {
        (
            tuple(item["constrained_columns"]),
            item["referred_table"],
            tuple(item["referred_columns"]),
        )
        for item in inspector.get_foreign_keys(food_source_moderation_audit.name)
    }
    if (("source_record_id",), "food_source_record", ("id",)) not in foreign_keys:
        raise RuntimeError("Moderation audit source-record foreign key is missing")

    unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(
            food_source_moderation_audit.name
        )
    }
    if ("idempotency_key",) not in unique_sets:
        raise RuntimeError("Moderation audit idempotency constraint is missing")

    checks = {
        item["name"]
        for item in inspector.get_check_constraints(
            food_source_moderation_audit.name
        )
    }
    expected_checks = {
        "ck_food_source_moderation_audit_previous_status",
        "ck_food_source_moderation_audit_new_status",
        "ck_food_source_moderation_audit_versions",
    }
    if not expected_checks.issubset(checks):
        raise RuntimeError("Moderation audit constraints are missing")

    indexes = {
        index["name"]: tuple(index["column_names"])
        for index in inspector.get_indexes(food_source_moderation_audit.name)
    }
    if indexes.get(
        "ix_food_source_moderation_audit_source_record_id"
    ) != ("source_record_id",):
        raise RuntimeError("Moderation audit source-record index is missing")
