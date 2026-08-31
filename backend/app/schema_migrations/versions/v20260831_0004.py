"""Add per-client identity-start admission indexes.

Revision: 20260831_0004
Parent: 20260831_0003
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260831_0004"
down_revision = "20260831_0003"

CLIENT_CREATED_INDEX = "ix_pendingloginstate_client_created"
CLIENT_EXPIRES_INDEX = "ix_pendingloginstate_client_expires"


def upgrade(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    columns = {
        str(column["name"])
        for column in inspector.get_columns("pendingloginstate")
    }
    if "client_id" not in columns:
        connection.execute(
            sa.text(
                "ALTER TABLE pendingloginstate "
                "ADD COLUMN client_id VARCHAR(120) NOT NULL DEFAULT 'legacy'"
            )
        )

    metadata = sa.MetaData()
    pending = sa.Table("pendingloginstate", metadata, autoload_with=connection)
    sa.Index(
        CLIENT_CREATED_INDEX,
        pending.c.client_id,
        pending.c.created_at,
    ).create(connection, checkfirst=True)
    sa.Index(
        CLIENT_EXPIRES_INDEX,
        pending.c.client_id,
        pending.c.expires_at,
    ).create(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    if not inspector.has_table("pendingloginstate"):
        raise RuntimeError("Required table is missing: pendingloginstate")

    columns = {
        str(column["name"]): column
        for column in inspector.get_columns("pendingloginstate")
    }
    client_column = columns.get("client_id")
    if client_column is None or bool(client_column["nullable"]):
        raise RuntimeError("Identity client admission column is missing or nullable")

    actual_indexes = {
        index["name"]: tuple(index["column_names"])
        for index in inspector.get_indexes("pendingloginstate")
    }
    expected_indexes = {
        CLIENT_CREATED_INDEX: ("client_id", "created_at"),
        CLIENT_EXPIRES_INDEX: ("client_id", "expires_at"),
    }
    for name, columns in expected_indexes.items():
        if actual_indexes.get(name) != columns:
            raise RuntimeError(f"Schema index drift detected for {name}")
