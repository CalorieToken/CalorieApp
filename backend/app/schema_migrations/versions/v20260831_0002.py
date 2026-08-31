"""Add bounded shared external-provider admission events.

Revision: 20260831_0002
Parent: 20260830_0001
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260831_0002"
down_revision = "20260830_0001"

metadata = sa.MetaData()

provider_rate_event = sa.Table(
    "provider_rate_event",
    metadata,
    sa.Column("id", sa.String(36), primary_key=True),
    sa.Column("provider_key", sa.String(100), nullable=False),
    sa.Column("admitted_at", sa.DateTime(timezone=True), nullable=False),
)
sa.Index(
    "ix_provider_rate_event_provider_admitted",
    provider_rate_event.c.provider_key,
    provider_rate_event.c.admitted_at,
)


def upgrade(connection: Connection) -> None:
    metadata.create_all(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    if not inspector.has_table(provider_rate_event.name):
        raise RuntimeError("Required table is missing: provider_rate_event")

    actual_columns = {
        str(column["name"])
        for column in inspector.get_columns(provider_rate_event.name)
    }
    expected_columns = {column.name for column in provider_rate_event.columns}
    if actual_columns != expected_columns:
        raise RuntimeError("Schema column drift detected for provider_rate_event")

    actual_indexes = {
        index["name"] for index in inspector.get_indexes(provider_rate_event.name)
    }
    expected_indexes = {index.name for index in provider_rate_event.indexes}
    if not expected_indexes.issubset(actual_indexes):
        raise RuntimeError("Schema index drift detected for provider_rate_event")
