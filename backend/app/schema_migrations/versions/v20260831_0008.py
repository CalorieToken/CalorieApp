"""Add the source-neutral product, link and assertion catalog foundation.

Revision: 20260831_0008
Parent: 20260831_0007
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260831_0008"
down_revision = "20260831_0007"

metadata = sa.MetaData()

food_source_record = sa.Table(
    "food_source_record",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
)

food_product = sa.Table(
    "food_product",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("status", sa.String(20), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.CheckConstraint(
        "status IN ('staged', 'active', 'deprecated')",
        name="ck_food_product_status",
    ),
)

food_product_source_link = sa.Table(
    "food_product_source_link",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column(
        "food_product_id",
        sa.String(),
        sa.ForeignKey("food_product.id", name="fk_food_product_source_link_product"),
        nullable=False,
    ),
    sa.Column(
        "source_record_id",
        sa.String(),
        sa.ForeignKey(
            "food_source_record.id",
            name="fk_food_product_source_link_record",
        ),
        nullable=False,
    ),
    sa.Column("match_method", sa.String(80), nullable=False),
    sa.Column("match_confidence", sa.Float(), nullable=False),
    sa.Column("review_status", sa.String(20), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.UniqueConstraint(
        "food_product_id",
        "source_record_id",
        name="uq_food_product_source_link_pair",
    ),
    sa.CheckConstraint(
        "match_confidence >= 0 AND match_confidence <= 1",
        name="ck_food_product_source_link_confidence",
    ),
    sa.CheckConstraint(
        "review_status IN ('quarantined', 'validated', 'rejected')",
        name="ck_food_product_source_link_review_status",
    ),
)
sa.Index(
    "ix_food_product_source_link_food_product_id",
    food_product_source_link.c.food_product_id,
)
sa.Index(
    "ix_food_product_source_link_source_record_id",
    food_product_source_link.c.source_record_id,
)

food_attribute_assertion = sa.Table(
    "food_attribute_assertion",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("food_product_id", sa.String(), nullable=False),
    sa.Column("source_record_id", sa.String(), nullable=False),
    sa.Column("attribute_key", sa.String(120), nullable=False),
    sa.Column("value", sa.String(255), nullable=False),
    sa.Column("unit_or_value_type", sa.String(80), nullable=False),
    sa.Column("observed_or_effective_at", sa.DateTime(), nullable=False),
    sa.Column("verification_status", sa.String(20), nullable=False),
    sa.Column("verification_version", sa.Integer(), nullable=False),
    sa.Column(
        "supersedes_assertion_id",
        sa.String(),
        nullable=True,
    ),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(
        ("food_product_id", "source_record_id"),
        (
            "food_product_source_link.food_product_id",
            "food_product_source_link.source_record_id",
        ),
        name="fk_food_attribute_assertion_product_source_link",
    ),
    sa.UniqueConstraint(
        "source_record_id",
        "attribute_key",
        "value",
        "unit_or_value_type",
        "observed_or_effective_at",
        name="uq_food_attribute_assertion_evidence",
    ),
    sa.UniqueConstraint(
        "id",
        "food_product_id",
        "source_record_id",
        name="uq_food_attribute_assertion_lineage_target",
    ),
    sa.ForeignKeyConstraint(
        (
            "supersedes_assertion_id",
            "food_product_id",
            "source_record_id",
        ),
        (
            "food_attribute_assertion.id",
            "food_attribute_assertion.food_product_id",
            "food_attribute_assertion.source_record_id",
        ),
        name="fk_food_attribute_assertion_supersedes_same_lineage",
    ),
    sa.CheckConstraint(
        "verification_status IN ('quarantined', 'validated', 'rejected')",
        name="ck_food_attribute_assertion_verification_status",
    ),
    sa.CheckConstraint(
        "verification_version > 0",
        name="ck_food_attribute_assertion_verification_version",
    ),
    sa.CheckConstraint(
        "supersedes_assertion_id IS NULL OR supersedes_assertion_id <> id",
        name="ck_food_attribute_assertion_not_self_superseding",
    ),
)
sa.Index(
    "ix_food_attribute_assertion_food_product_id",
    food_attribute_assertion.c.food_product_id,
)
sa.Index(
    "ix_food_attribute_assertion_source_record_id",
    food_attribute_assertion.c.source_record_id,
)
sa.Index(
    "ix_food_attribute_assertion_supersedes_assertion_id",
    food_attribute_assertion.c.supersedes_assertion_id,
)


def upgrade(connection: Connection) -> None:
    metadata.create_all(connection, checkfirst=True)


def _columns(inspector: sa.Inspector, table: sa.Table) -> dict[str, dict]:
    return {
        str(column["name"]): column
        for column in inspector.get_columns(table.name)
    }


def _foreign_keys(inspector: sa.Inspector, table: sa.Table) -> set[tuple]:
    return {
        (
            tuple(item["constrained_columns"]),
            item["referred_table"],
            tuple(item["referred_columns"]),
        )
        for item in inspector.get_foreign_keys(table.name)
    }


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    for table in (
        food_product,
        food_product_source_link,
        food_attribute_assertion,
    ):
        if not inspector.has_table(table.name):
            raise RuntimeError(f"Required table is missing: {table.name}")
        actual_columns = _columns(inspector, table)
        if set(actual_columns) != {column.name for column in table.columns}:
            raise RuntimeError(f"Schema column drift detected for {table.name}")

    if any(bool(column["nullable"]) for column in _columns(inspector, food_product).values()):
        raise RuntimeError("Food product columns must be non-nullable")
    if any(
        bool(column["nullable"])
        for column in _columns(inspector, food_product_source_link).values()
    ):
        raise RuntimeError("Food product source-link columns must be non-nullable")
    assertion_columns = _columns(inspector, food_attribute_assertion)
    if any(
        bool(column["nullable"])
        for name, column in assertion_columns.items()
        if name != "supersedes_assertion_id"
    ) or not bool(assertion_columns["supersedes_assertion_id"]["nullable"]):
        raise RuntimeError("Food assertion nullability is unsafe")

    product_checks = {
        item["name"] for item in inspector.get_check_constraints(food_product.name)
    }
    if "ck_food_product_status" not in product_checks:
        raise RuntimeError("Food product status constraint is missing")

    link_foreign_keys = _foreign_keys(inspector, food_product_source_link)
    if not {
        (("food_product_id",), "food_product", ("id",)),
        (("source_record_id",), "food_source_record", ("id",)),
    }.issubset(link_foreign_keys):
        raise RuntimeError("Food product source-link foreign keys are missing")
    link_unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(food_product_source_link.name)
    }
    if ("food_product_id", "source_record_id") not in link_unique_sets:
        raise RuntimeError("Food product source-link uniqueness is missing")
    link_checks = {
        item["name"]
        for item in inspector.get_check_constraints(food_product_source_link.name)
    }
    if not {
        "ck_food_product_source_link_confidence",
        "ck_food_product_source_link_review_status",
    }.issubset(link_checks):
        raise RuntimeError("Food product source-link constraints are missing")

    assertion_foreign_keys = _foreign_keys(inspector, food_attribute_assertion)
    if not {
        (
            ("food_product_id", "source_record_id"),
            "food_product_source_link",
            ("food_product_id", "source_record_id"),
        ),
        (
            (
                "supersedes_assertion_id",
                "food_product_id",
                "source_record_id",
            ),
            "food_attribute_assertion",
            ("id", "food_product_id", "source_record_id"),
        ),
    }.issubset(assertion_foreign_keys):
        raise RuntimeError("Food assertion provenance foreign keys are missing")
    assertion_unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(food_attribute_assertion.name)
    }
    if (
        "source_record_id",
        "attribute_key",
        "value",
        "unit_or_value_type",
        "observed_or_effective_at",
    ) not in assertion_unique_sets:
        raise RuntimeError("Food assertion evidence uniqueness is missing")
    if (
        "id",
        "food_product_id",
        "source_record_id",
    ) not in assertion_unique_sets:
        raise RuntimeError("Food assertion correction lineage target is missing")
    assertion_checks = {
        item["name"]
        for item in inspector.get_check_constraints(food_attribute_assertion.name)
    }
    if not {
        "ck_food_attribute_assertion_verification_status",
        "ck_food_attribute_assertion_verification_version",
        "ck_food_attribute_assertion_not_self_superseding",
    }.issubset(assertion_checks):
        raise RuntimeError("Food assertion constraints are missing")

    expected_indexes = {
        food_product_source_link.name: {
            "ix_food_product_source_link_food_product_id": ("food_product_id",),
            "ix_food_product_source_link_source_record_id": ("source_record_id",),
        },
        food_attribute_assertion.name: {
            "ix_food_attribute_assertion_food_product_id": ("food_product_id",),
            "ix_food_attribute_assertion_source_record_id": ("source_record_id",),
            "ix_food_attribute_assertion_supersedes_assertion_id": (
                "supersedes_assertion_id",
            ),
        },
    }
    for table_name, expected in expected_indexes.items():
        actual = {
            item["name"]: tuple(item["column_names"])
            for item in inspector.get_indexes(table_name)
        }
        if not expected.items() <= actual.items():
            raise RuntimeError(f"Required indexes are missing for {table_name}")
