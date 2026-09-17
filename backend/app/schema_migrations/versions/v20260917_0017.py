"""Add an optional private account nickname, preserving all existing rows."""
import sqlalchemy as sa
from sqlalchemy.engine import Connection

revision = "20260917_0017"
down_revision = "20260902_0016"


def upgrade(connection: Connection) -> None:
    columns = {column["name"] for column in sa.inspect(connection).get_columns("calorieappuser")}
    if "nickname" not in columns:
        connection.execute(sa.text("ALTER TABLE calorieappuser ADD COLUMN nickname VARCHAR(32) NULL"))


def validate(connection: Connection) -> None:
    columns = {column["name"]: column for column in sa.inspect(connection).get_columns("calorieappuser")}
    column = columns.get("nickname")
    if column is None or not column["nullable"] or not isinstance(column["type"], sa.String) or column["type"].length != 32:
        raise RuntimeError("Account nickname column is missing or has drifted")
