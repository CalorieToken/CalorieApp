"""Add the durable last-authenticated-activity account marker.

Revision: 20260901_0012
Parent: 20260901_0011
"""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260901_0012"
down_revision = "20260901_0011"

ACTIVITY_COLUMN = "last_authenticated_activity_at"
ACTIVITY_INDEX = "ix_calorieappuser_last_authenticated_activity_at"
_BACKFILL_SENTINEL = datetime(1970, 1, 1)


def upgrade(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    columns = {
        str(column["name"])
        for column in inspector.get_columns("calorieappuser")
    }
    if ACTIVITY_COLUMN not in columns:
        column_type = (
            "TIMESTAMP WITHOUT TIME ZONE"
            if connection.dialect.name == "postgresql"
            else "DATETIME"
        )
        connection.execute(
            sa.text(
                "ALTER TABLE calorieappuser "
                f"ADD COLUMN {ACTIVITY_COLUMN} {column_type} NOT NULL "
                "DEFAULT '1970-01-01 00:00:00'"
            )
        )
        connection.execute(
            sa.text(
                f"UPDATE calorieappuser SET {ACTIVITY_COLUMN} = "
                "COALESCE(("
                "SELECT MAX(authsession.last_seen_at) FROM authsession "
                "WHERE authsession.calorieapp_user_id = calorieappuser.id"
                "), calorieappuser.created_at)"
            )
        )
        if connection.dialect.name == "postgresql":
            connection.execute(
                sa.text(
                    "ALTER TABLE calorieappuser "
                    f"ALTER COLUMN {ACTIVITY_COLUMN} DROP DEFAULT"
                )
            )

    metadata = sa.MetaData()
    users = sa.Table("calorieappuser", metadata, autoload_with=connection)
    sa.Index(ACTIVITY_INDEX, users.c.last_authenticated_activity_at).create(
        connection,
        checkfirst=True,
    )


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    if not inspector.has_table("calorieappuser"):
        raise RuntimeError("Required table is missing: calorieappuser")

    columns = {
        str(column["name"]): column
        for column in inspector.get_columns("calorieappuser")
    }
    activity_column = columns.get(ACTIVITY_COLUMN)
    if activity_column is None or bool(activity_column["nullable"]):
        raise RuntimeError(
            "Last-authenticated-activity marker is missing or nullable"
        )

    indexes = {
        index["name"]: tuple(index["column_names"])
        for index in inspector.get_indexes("calorieappuser")
    }
    if indexes.get(ACTIVITY_INDEX) != (ACTIVITY_COLUMN,):
        raise RuntimeError("Last-authenticated-activity index is missing")

    metadata = sa.MetaData()
    users = sa.Table("calorieappuser", metadata, autoload_with=connection)
    invalid_markers = connection.execute(
        sa.select(sa.func.count())
        .select_from(users)
        .where(users.c.last_authenticated_activity_at <= _BACKFILL_SENTINEL)
    ).scalar_one()
    if invalid_markers:
        raise RuntimeError("Last-authenticated-activity backfill is incomplete")
