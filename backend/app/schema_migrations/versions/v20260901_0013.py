"""Add minimal inactive-account notice delivery evidence.

Revision: 20260901_0013
Parent: 20260901_0012
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260901_0013"
down_revision = "20260901_0012"

metadata = sa.MetaData()
calorieappuser = sa.Table(
    "calorieappuser",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
)
inactive_account_notice = sa.Table(
    "inactive_account_notice",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column(
        "calorieapp_user_id",
        sa.String(),
        sa.ForeignKey(
            "calorieappuser.id",
            name="fk_inactive_account_notice_user",
        ),
        nullable=False,
    ),
    sa.Column("activity_anchor_at", sa.DateTime(), nullable=False),
    sa.Column("notice_window_started_at", sa.DateTime(), nullable=False),
    sa.Column("retention_due_at", sa.DateTime(), nullable=False),
    sa.Column("delivered_at", sa.DateTime(), nullable=False),
    sa.Column("delivery_channel", sa.String(40), nullable=False),
    sa.Column("delivery_evidence_digest", sa.String(64), nullable=False),
    sa.Column("status", sa.String(20), nullable=False),
    sa.Column("cancelled_at", sa.DateTime(), nullable=True),
    sa.Column("cancellation_reason", sa.String(40), nullable=True),
    sa.Column("recorded_at", sa.DateTime(), nullable=False),
    sa.UniqueConstraint(
        "calorieapp_user_id",
        "activity_anchor_at",
        name="uq_inactive_account_notice_user_anchor",
    ),
    sa.CheckConstraint(
        "status IN ('delivered', 'cancelled')",
        name="ck_inactive_account_notice_status",
    ),
    sa.CheckConstraint(
        "(status = 'delivered' AND cancelled_at IS NULL "
        "AND cancellation_reason IS NULL) OR "
        "(status = 'cancelled' AND cancelled_at IS NOT NULL "
        "AND cancellation_reason = 'authenticated-activity')",
        name="ck_inactive_account_notice_cancellation_state",
    ),
    sa.CheckConstraint(
        "activity_anchor_at < notice_window_started_at "
        "AND notice_window_started_at <= delivered_at "
        "AND delivered_at < retention_due_at",
        name="ck_inactive_account_notice_timeline",
    ),
    sa.CheckConstraint(
        "cancelled_at IS NULL OR cancelled_at > activity_anchor_at",
        name="ck_inactive_account_notice_cancellation_time",
    ),
    sa.CheckConstraint(
        "LENGTH(delivery_evidence_digest) = 64",
        name="ck_inactive_account_notice_evidence_digest",
    ),
)
sa.Index(
    "ix_inactive_account_notice_user_status",
    inactive_account_notice.c.calorieapp_user_id,
    inactive_account_notice.c.status,
)
sa.Index(
    "ix_inactive_account_notice_status_retention_due",
    inactive_account_notice.c.status,
    inactive_account_notice.c.retention_due_at,
)


def upgrade(connection: Connection) -> None:
    inactive_account_notice.create(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    table = inactive_account_notice
    if not inspector.has_table(calorieappuser.name):
        raise RuntimeError("Required table is missing: calorieappuser")
    if not inspector.has_table(table.name):
        raise RuntimeError("Required table is missing: inactive_account_notice")

    actual_columns = {
        str(column["name"]): column
        for column in inspector.get_columns(table.name)
    }
    if set(actual_columns) != {column.name for column in table.columns}:
        raise RuntimeError("Schema column drift detected for inactive-account notice")

    expected_nullable = {
        "cancelled_at": True,
        "cancellation_reason": True,
    }
    for name, column in actual_columns.items():
        if bool(column["nullable"]) != expected_nullable.get(name, False):
            raise RuntimeError("Inactive-account notice nullability is unsafe")

    foreign_keys = {
        (
            tuple(item["constrained_columns"]),
            item["referred_table"],
            tuple(item["referred_columns"]),
        )
        for item in inspector.get_foreign_keys(table.name)
    }
    if (
        ("calorieapp_user_id",),
        "calorieappuser",
        ("id",),
    ) not in foreign_keys:
        raise RuntimeError("Inactive-account notice user foreign key is missing")

    unique_sets = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(table.name)
    }
    if ("calorieapp_user_id", "activity_anchor_at") not in unique_sets:
        raise RuntimeError("Inactive-account notice cycle uniqueness is missing")

    checks = {
        item["name"] for item in inspector.get_check_constraints(table.name)
    }
    expected_checks = {
        "ck_inactive_account_notice_status",
        "ck_inactive_account_notice_cancellation_state",
        "ck_inactive_account_notice_timeline",
        "ck_inactive_account_notice_cancellation_time",
        "ck_inactive_account_notice_evidence_digest",
    }
    if not expected_checks.issubset(checks):
        raise RuntimeError("Inactive-account notice constraints are missing")

    indexes = {
        item["name"]: tuple(item["column_names"])
        for item in inspector.get_indexes(table.name)
    }
    expected_indexes = {
        "ix_inactive_account_notice_user_status": (
            "calorieapp_user_id",
            "status",
        ),
        "ix_inactive_account_notice_status_retention_due": (
            "status",
            "retention_due_at",
        ),
    }
    if any(indexes.get(name) != columns for name, columns in expected_indexes.items()):
        raise RuntimeError("Inactive-account notice indexes are missing")
