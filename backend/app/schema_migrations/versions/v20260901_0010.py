"""Add terminal source-assertion moderation audit evidence.

Revision: 20260901_0010
Parent: 20260831_0009
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260901_0010"
down_revision = "20260831_0009"

metadata = sa.MetaData()
food_attribute_assertion = sa.Table(
    "food_attribute_assertion",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
)
food_attribute_assertion_moderation_audit = sa.Table(
    "food_attribute_assertion_moderation_audit",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column(
        "assertion_id",
        sa.String(),
        sa.ForeignKey(
            "food_attribute_assertion.id",
            name="fk_food_assertion_moderation_audit_assertion",
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
        "assertion_id",
        name="uq_food_assertion_moderation_audit_assertion",
    ),
    sa.UniqueConstraint(
        "idempotency_key",
        name="uq_food_assertion_moderation_audit_idempotency",
    ),
    sa.CheckConstraint(
        "previous_status = 'quarantined'",
        name="ck_food_assertion_moderation_audit_previous_status",
    ),
    sa.CheckConstraint(
        "new_status IN ('validated', 'rejected')",
        name="ck_food_assertion_moderation_audit_new_status",
    ),
    sa.CheckConstraint(
        "expected_version > 0 AND resulting_version = expected_version + 1",
        name="ck_food_assertion_moderation_audit_versions",
    ),
    sa.CheckConstraint(
        "authorization_scope = 'catalog:source-assertion:moderate'",
        name="ck_food_assertion_moderation_audit_scope",
    ),
)
sa.Index(
    "ix_food_attribute_assertion_moderation_audit_assertion_id",
    food_attribute_assertion_moderation_audit.c.assertion_id,
)


def upgrade(connection: Connection) -> None:
    food_attribute_assertion_moderation_audit.create(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    table = food_attribute_assertion_moderation_audit
    if not inspector.has_table(food_attribute_assertion.name):
        raise RuntimeError("Required table is missing: food_attribute_assertion")
    if not inspector.has_table(table.name):
        raise RuntimeError(
            "Required table is missing: food_attribute_assertion_moderation_audit"
        )

    actual_columns = {
        str(column["name"]): column
        for column in inspector.get_columns(table.name)
    }
    if set(actual_columns) != {column.name for column in table.columns}:
        raise RuntimeError("Schema column drift detected for assertion moderation audit")
    if any(bool(column["nullable"]) for column in actual_columns.values()):
        raise RuntimeError("Assertion moderation audit columns must be non-nullable")

    foreign_keys = {
        (
            tuple(item["constrained_columns"]),
            item["referred_table"],
            tuple(item["referred_columns"]),
        )
        for item in inspector.get_foreign_keys(table.name)
    }
    if (
        ("assertion_id",),
        "food_attribute_assertion",
        ("id",),
    ) not in foreign_keys:
        raise RuntimeError("Assertion moderation audit foreign key is missing")

    unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(table.name)
    }
    if not {("assertion_id",), ("idempotency_key",)}.issubset(unique_sets):
        raise RuntimeError("Assertion moderation audit uniqueness is missing")

    checks = {
        item["name"] for item in inspector.get_check_constraints(table.name)
    }
    expected_checks = {
        "ck_food_assertion_moderation_audit_previous_status",
        "ck_food_assertion_moderation_audit_new_status",
        "ck_food_assertion_moderation_audit_versions",
        "ck_food_assertion_moderation_audit_scope",
    }
    if not expected_checks.issubset(checks):
        raise RuntimeError("Assertion moderation audit constraints are missing")

    indexes = {
        item["name"]: tuple(item["column_names"])
        for item in inspector.get_indexes(table.name)
    }
    if indexes.get(
        "ix_food_attribute_assertion_moderation_audit_assertion_id"
    ) != ("assertion_id",):
        raise RuntimeError("Assertion moderation audit index is missing")
