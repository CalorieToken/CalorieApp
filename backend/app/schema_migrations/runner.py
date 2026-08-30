"""Small, deterministic forward-only migration runner for SQLite and PostgreSQL."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Callable

import sqlalchemy as sa
from sqlalchemy.engine import Connection, Engine

from .versions import v20260830_0001


class MigrationError(RuntimeError):
    """Raised when migration history or schema state is unsafe."""


@dataclass(frozen=True)
class Migration:
    revision: str
    down_revision: str | None
    upgrade: Callable[[Connection], None]
    validate: Callable[[Connection], None]


MIGRATIONS = (
    Migration(
        revision=v20260830_0001.revision,
        down_revision=v20260830_0001.down_revision,
        upgrade=v20260830_0001.upgrade,
        validate=v20260830_0001.validate,
    ),
)
SCHEMA_HEAD = MIGRATIONS[-1].revision

_history_metadata = sa.MetaData()
_history = sa.Table(
    "calorie_schema_revision",
    _history_metadata,
    sa.Column("revision", sa.String(64), primary_key=True),
    sa.Column("down_revision", sa.String(64), nullable=True),
    sa.Column("applied_at", sa.DateTime(), nullable=False),
    sa.Column("approval_reference", sa.String(120), nullable=True),
)


def _applied_revisions(connection: Connection) -> list[str]:
    if not sa.inspect(connection).has_table(_history.name):
        return []
    statement = sa.select(_history.c.revision).order_by(
        _history.c.applied_at,
        _history.c.revision,
    )
    return list(connection.execute(statement).scalars())


def _validate_history(applied: list[str]) -> None:
    expected_prefix = [migration.revision for migration in MIGRATIONS[: len(applied)]]
    if applied != expected_prefix:
        raise MigrationError(
            "Database migration history is unknown, duplicated, or not a valid prefix"
        )


def current_revision(engine: Engine) -> str | None:
    with engine.connect() as connection:
        applied = _applied_revisions(connection)
        _validate_history(applied)
        return applied[-1] if applied else None


def upgrade_database(engine: Engine, *, approval_reference: str | None = None) -> str:
    """Apply each unapplied forward migration in one ordered pass."""
    with engine.begin() as connection:
        _history_metadata.create_all(connection, checkfirst=True)
        applied = _applied_revisions(connection)
        _validate_history(applied)

        for migration in MIGRATIONS[len(applied) :]:
            expected_parent = applied[-1] if applied else None
            if migration.down_revision != expected_parent:
                raise MigrationError(
                    f"Migration {migration.revision} does not follow {expected_parent}"
                )
            migration.upgrade(connection)
            migration.validate(connection)
            connection.execute(
                _history.insert().values(
                    revision=migration.revision,
                    down_revision=migration.down_revision,
                    applied_at=datetime.now(UTC).replace(tzinfo=None),
                    approval_reference=approval_reference,
                )
            )
            applied.append(migration.revision)

        for migration in MIGRATIONS:
            migration.validate(connection)
    return applied[-1]


def assert_database_at_head(engine: Engine) -> None:
    """Fail closed unless all known migrations are recorded and the schema matches."""
    with engine.connect() as connection:
        applied = _applied_revisions(connection)
        _validate_history(applied)
        if not applied or applied[-1] != SCHEMA_HEAD:
            current = applied[-1] if applied else "unversioned"
            raise MigrationError(
                f"Database revision {current} is not at required head {SCHEMA_HEAD}"
            )
        for migration in MIGRATIONS:
            migration.validate(connection)
