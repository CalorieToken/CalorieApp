"""Add bounded shared public-route admission events.

Revision: 20260831_0003
Parent: 20260831_0002
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260831_0003"
down_revision = "20260831_0002"

metadata = sa.MetaData()

route_rate_event = sa.Table(
    "route_rate_event",
    metadata,
    sa.Column("id", sa.String(36), primary_key=True),
    sa.Column("route_key", sa.String(100), nullable=False),
    sa.Column("admitted_at", sa.DateTime(timezone=True), nullable=False),
)
sa.Index(
    "ix_route_rate_event_route_admitted",
    route_rate_event.c.route_key,
    route_rate_event.c.admitted_at,
)


def upgrade(connection: Connection) -> None:
    metadata.create_all(connection, checkfirst=True)


def validate(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    if not inspector.has_table(route_rate_event.name):
        raise RuntimeError("Required table is missing: route_rate_event")

    actual_columns = {
        str(column["name"])
        for column in inspector.get_columns(route_rate_event.name)
    }
    expected_columns = {column.name for column in route_rate_event.columns}
    if actual_columns != expected_columns:
        raise RuntimeError("Schema column drift detected for route_rate_event")

    actual_indexes = {
        index["name"] for index in inspector.get_indexes(route_rate_event.name)
    }
    expected_indexes = {index.name for index in route_rate_event.indexes}
    if not expected_indexes.issubset(actual_indexes):
        raise RuntimeError("Schema index drift detected for route_rate_event")
