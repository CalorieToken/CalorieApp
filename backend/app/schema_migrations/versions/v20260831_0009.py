"""Add bounded source-assertion ingest and its append-only audit receipt.

Revision: 20260831_0009
Parent: 20260831_0008
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260831_0009"
down_revision = "20260831_0008"

metadata = sa.MetaData()

food_source = sa.Table(
    "food_source",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
)

food_attribute_assertion = sa.Table(
    "food_attribute_assertion",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("food_product_id", sa.String(), nullable=False),
    sa.Column("source_record_id", sa.String(), nullable=False),
)

food_attribute_assertion_ingest_audit = sa.Table(
    "food_attribute_assertion_ingest_audit",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("assertion_id", sa.String(), nullable=False),
    sa.Column("food_product_id", sa.String(), nullable=False),
    sa.Column("source_record_id", sa.String(), nullable=False),
    sa.Column("idempotency_key", sa.String(128), nullable=False),
    sa.Column("expected_source_record_version", sa.Integer(), nullable=False),
    sa.Column("resulting_assertion_version", sa.Integer(), nullable=False),
    sa.Column("submitter_reference", sa.String(120), nullable=False),
    sa.Column("authorization_scope", sa.String(80), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(
        ("assertion_id", "food_product_id", "source_record_id"),
        (
            "food_attribute_assertion.id",
            "food_attribute_assertion.food_product_id",
            "food_attribute_assertion.source_record_id",
        ),
        name="fk_food_assertion_ingest_audit_assertion_lineage",
    ),
    sa.UniqueConstraint(
        "assertion_id",
        name="uq_food_assertion_ingest_audit_assertion",
    ),
    sa.UniqueConstraint(
        "idempotency_key",
        name="uq_food_assertion_ingest_audit_idempotency",
    ),
    sa.CheckConstraint(
        "expected_source_record_version > 0 "
        "AND resulting_assertion_version = 1",
        name="ck_food_assertion_ingest_audit_versions",
    ),
    sa.CheckConstraint(
        "authorization_scope = 'catalog:source-assertion:ingest'",
        name="ck_food_assertion_ingest_audit_scope",
    ),
)
sa.Index(
    "ix_food_attribute_assertion_ingest_audit_assertion_id",
    food_attribute_assertion_ingest_audit.c.assertion_id,
)
sa.Index(
    "ix_food_attribute_assertion_ingest_audit_food_product_id",
    food_attribute_assertion_ingest_audit.c.food_product_id,
)
sa.Index(
    "ix_food_attribute_assertion_ingest_audit_source_record_id",
    food_attribute_assertion_ingest_audit.c.source_record_id,
)


def upgrade(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    source_columns = {
        str(column["name"])
        for column in inspector.get_columns(food_source.name)
    }
    if "assertion_limit" not in source_columns:
        connection.execute(
            sa.text(
                "ALTER TABLE food_source ADD COLUMN "
                "assertion_limit INTEGER NOT NULL DEFAULT 1000 "
                "CONSTRAINT ck_food_source_assertion_limit "
                "CHECK (assertion_limit > 0)"
            )
        )

    food_attribute_assertion_ingest_audit.create(connection, checkfirst=True)


def _columns(inspector: sa.Inspector, table_name: str) -> dict[str, dict]:
    return {
        str(column["name"]): column
        for column in inspector.get_columns(table_name)
    }


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    if not inspector.has_table(food_source.name):
        raise RuntimeError("Required table is missing: food_source")

    source_columns = _columns(inspector, food_source.name)
    assertion_limit = source_columns.get("assertion_limit")
    if assertion_limit is None or bool(assertion_limit["nullable"]):
        raise RuntimeError("Source assertion limit is missing or nullable")
    source_checks = {
        item["name"] for item in inspector.get_check_constraints(food_source.name)
    }
    if "ck_food_source_assertion_limit" not in source_checks:
        raise RuntimeError("Source assertion limit constraint is missing")

    table = food_attribute_assertion_ingest_audit
    if not inspector.has_table(table.name):
        raise RuntimeError(
            "Required table is missing: food_attribute_assertion_ingest_audit"
        )
    actual_columns = _columns(inspector, table.name)
    if set(actual_columns) != {column.name for column in table.columns}:
        raise RuntimeError("Schema column drift detected for assertion ingest audit")
    if any(bool(column["nullable"]) for column in actual_columns.values()):
        raise RuntimeError("Assertion ingest audit columns must be non-nullable")

    foreign_keys = {
        (
            tuple(item["constrained_columns"]),
            item["referred_table"],
            tuple(item["referred_columns"]),
        )
        for item in inspector.get_foreign_keys(table.name)
    }
    expected_foreign_key = (
        ("assertion_id", "food_product_id", "source_record_id"),
        "food_attribute_assertion",
        ("id", "food_product_id", "source_record_id"),
    )
    if expected_foreign_key not in foreign_keys:
        raise RuntimeError("Assertion ingest audit lineage foreign key is missing")

    unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(table.name)
    }
    if not {
        ("assertion_id",),
        ("idempotency_key",),
    }.issubset(unique_sets):
        raise RuntimeError("Assertion ingest audit uniqueness is missing")

    checks = {
        item["name"] for item in inspector.get_check_constraints(table.name)
    }
    if not {
        "ck_food_assertion_ingest_audit_versions",
        "ck_food_assertion_ingest_audit_scope",
    }.issubset(checks):
        raise RuntimeError("Assertion ingest audit constraints are missing")

    indexes = {
        item["name"]: tuple(item["column_names"])
        for item in inspector.get_indexes(table.name)
    }
    expected_indexes = {
        "ix_food_attribute_assertion_ingest_audit_assertion_id": (
            "assertion_id",
        ),
        "ix_food_attribute_assertion_ingest_audit_food_product_id": (
            "food_product_id",
        ),
        "ix_food_attribute_assertion_ingest_audit_source_record_id": (
            "source_record_id",
        ),
    }
    if not expected_indexes.items() <= indexes.items():
        raise RuntimeError("Required assertion ingest audit indexes are missing")
