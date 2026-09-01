"""Add retained source-assertion correction audit receipts.

Revision: 20260901_0011
Parent: 20260901_0010
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260901_0011"
down_revision = "20260901_0010"

metadata = sa.MetaData()
food_attribute_assertion = sa.Table(
    "food_attribute_assertion",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("supersedes_assertion_id", sa.String(), nullable=True),
)
food_assertion_correction_lineage_index = sa.Index(
    "ux_food_assertion_correction_lineage",
    food_attribute_assertion.c.id,
    food_attribute_assertion.c.supersedes_assertion_id,
    unique=True,
)
food_assertion_correction_predecessor_index = sa.Index(
    "ux_food_assertion_correction_predecessor",
    food_attribute_assertion.c.supersedes_assertion_id,
    unique=True,
)
food_attribute_assertion_correction_audit = sa.Table(
    "food_attribute_assertion_correction_audit",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column(
        "predecessor_assertion_id",
        sa.String(),
        sa.ForeignKey(
            "food_attribute_assertion.id",
            name="fk_food_assertion_correction_audit_predecessor",
        ),
        nullable=False,
    ),
    sa.Column(
        "correction_assertion_id",
        sa.String(),
        sa.ForeignKey(
            "food_attribute_assertion.id",
            name="fk_food_assertion_correction_audit_correction",
        ),
        nullable=False,
    ),
    sa.Column("idempotency_key", sa.String(128), nullable=False),
    sa.Column("expected_predecessor_version", sa.Integer(), nullable=False),
    sa.Column("resulting_correction_version", sa.Integer(), nullable=False),
    sa.Column("corrector_reference", sa.String(120), nullable=False),
    sa.Column("authorization_scope", sa.String(80), nullable=False),
    sa.Column("reason_code", sa.String(80), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(
        ("correction_assertion_id", "predecessor_assertion_id"),
        (
            "food_attribute_assertion.id",
            "food_attribute_assertion.supersedes_assertion_id",
        ),
        name="fk_food_assertion_correction_audit_lineage",
    ),
    sa.UniqueConstraint(
        "predecessor_assertion_id",
        name="uq_food_assertion_correction_audit_predecessor",
    ),
    sa.UniqueConstraint(
        "correction_assertion_id",
        name="uq_food_assertion_correction_audit_correction",
    ),
    sa.UniqueConstraint(
        "idempotency_key",
        name="uq_food_assertion_correction_audit_idempotency",
    ),
    sa.CheckConstraint(
        "expected_predecessor_version > 0 "
        "AND resulting_correction_version = 1",
        name="ck_food_assertion_correction_audit_versions",
    ),
    sa.CheckConstraint(
        "predecessor_assertion_id <> correction_assertion_id",
        name="ck_food_assertion_correction_audit_distinct_assertions",
    ),
    sa.CheckConstraint(
        "authorization_scope = 'catalog:source-assertion:correct'",
        name="ck_food_assertion_correction_audit_scope",
    ),
)
sa.Index(
    "ix_food_assert_corr_audit_predecessor",
    food_attribute_assertion_correction_audit.c.predecessor_assertion_id,
)
sa.Index(
    "ix_food_assert_corr_audit_correction",
    food_attribute_assertion_correction_audit.c.correction_assertion_id,
)


def upgrade(connection: Connection) -> None:
    food_assertion_correction_lineage_index.create(connection, checkfirst=True)
    food_assertion_correction_predecessor_index.create(
        connection,
        checkfirst=True,
    )
    food_attribute_assertion_correction_audit.create(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    table = food_attribute_assertion_correction_audit
    if not inspector.has_table(food_attribute_assertion.name):
        raise RuntimeError("Required table is missing: food_attribute_assertion")
    if not inspector.has_table(table.name):
        raise RuntimeError(
            "Required table is missing: food_attribute_assertion_correction_audit"
        )

    actual_columns = {
        str(column["name"]): column
        for column in inspector.get_columns(table.name)
    }
    if set(actual_columns) != {column.name for column in table.columns}:
        raise RuntimeError(
            "Schema column drift detected for assertion correction audit"
        )
    if any(bool(column["nullable"]) for column in actual_columns.values()):
        raise RuntimeError("Assertion correction audit columns must be non-nullable")

    foreign_keys = {
        (
            tuple(item["constrained_columns"]),
            item["referred_table"],
            tuple(item["referred_columns"]),
        )
        for item in inspector.get_foreign_keys(table.name)
    }
    expected_foreign_keys = {
        (("predecessor_assertion_id",), "food_attribute_assertion", ("id",)),
        (("correction_assertion_id",), "food_attribute_assertion", ("id",)),
        (
            ("correction_assertion_id", "predecessor_assertion_id"),
            "food_attribute_assertion",
            ("id", "supersedes_assertion_id"),
        ),
    }
    if not expected_foreign_keys.issubset(foreign_keys):
        raise RuntimeError("Assertion correction audit foreign keys are missing")

    unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(table.name)
    }
    if not {
        ("predecessor_assertion_id",),
        ("correction_assertion_id",),
        ("idempotency_key",),
    }.issubset(unique_sets):
        raise RuntimeError("Assertion correction audit uniqueness is missing")

    checks = {
        item["name"] for item in inspector.get_check_constraints(table.name)
    }
    expected_checks = {
        "ck_food_assertion_correction_audit_versions",
        "ck_food_assertion_correction_audit_distinct_assertions",
        "ck_food_assertion_correction_audit_scope",
    }
    if not expected_checks.issubset(checks):
        raise RuntimeError("Assertion correction audit constraints are missing")

    indexes = {
        item["name"]: tuple(item["column_names"])
        for item in inspector.get_indexes(table.name)
    }
    expected_indexes = {
        "ix_food_assert_corr_audit_predecessor": (
            "predecessor_assertion_id",
        ),
        "ix_food_assert_corr_audit_correction": (
            "correction_assertion_id",
        ),
    }
    if not expected_indexes.items() <= indexes.items():
        raise RuntimeError("Assertion correction audit indexes are missing")

    assertion_indexes = {
        item["name"]: (tuple(item["column_names"]), bool(item["unique"]))
        for item in inspector.get_indexes(food_attribute_assertion.name)
    }
    expected_assertion_indexes = {
        "ux_food_assertion_correction_lineage": (
            ("id", "supersedes_assertion_id"),
            True,
        ),
        "ux_food_assertion_correction_predecessor": (
            ("supersedes_assertion_id",),
            True,
        ),
    }
    if not expected_assertion_indexes.items() <= assertion_indexes.items():
        raise RuntimeError("Assertion correction uniqueness indexes are missing")
