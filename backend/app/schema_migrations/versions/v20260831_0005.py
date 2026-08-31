"""Index private food history for per-subject growth admission.

Revision: 20260831_0005
Parent: 20260831_0004
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260831_0005"
down_revision = "20260831_0004"

FOOD_LOG_OWNER_INDEX = "ix_food_log_owner_id"


def upgrade(connection: Connection) -> None:
    metadata = sa.MetaData()
    food_log = sa.Table("food_log", metadata, autoload_with=connection)
    sa.Index(FOOD_LOG_OWNER_INDEX, food_log.c.owner_id).create(
        connection,
        checkfirst=True,
    )


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    if not inspector.has_table("food_log"):
        raise RuntimeError("Required table is missing: food_log")

    actual_indexes = {
        index["name"]: tuple(index["column_names"])
        for index in inspector.get_indexes("food_log")
    }
    if actual_indexes.get(FOOD_LOG_OWNER_INDEX) != ("owner_id",):
        raise RuntimeError("Schema index drift detected for ix_food_log_owner_id")
