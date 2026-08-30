"""Baseline the complete pre-public CalorieApp schema.

Revision: 20260830_0001
Parent: none
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


revision = "20260830_0001"
down_revision = None

metadata = sa.MetaData()

calorieappuser = sa.Table(
    "calorieappuser",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column("updated_at", sa.DateTime(), nullable=False),
    sa.Column("status", sa.String(), nullable=False),
)

food_log = sa.Table(
    "food_log",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True),
    sa.Column("product_name", sa.String(120), nullable=False),
    sa.Column("calories", sa.Float(), nullable=False),
    sa.Column("protein", sa.Float(), nullable=False),
    sa.Column("fat", sa.Float(), nullable=False),
    sa.Column("carbohydrates", sa.Float(), nullable=False),
    sa.Column("portion_percentage", sa.Float(), nullable=True),
    sa.Column("barcode", sa.String(64), nullable=True),
    sa.Column("image_url", sa.String(500), nullable=True),
    sa.Column("brand", sa.String(160), nullable=True),
    sa.Column("serving_size", sa.String(80), nullable=True),
    sa.Column("nutri_score", sa.String(2), nullable=True),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column(
        "owner_id",
        sa.String(),
        sa.ForeignKey("calorieappuser.id", name="fk_food_log_owner_id_calorieappuser"),
        nullable=True,
    ),
)

externalidentity = sa.Table(
    "externalidentity",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column(
        "calorieapp_user_id",
        sa.String(),
        sa.ForeignKey("calorieappuser.id", name="fk_externalidentity_user"),
        nullable=False,
    ),
    sa.Column("provider", sa.String(50), nullable=False),
    sa.Column("external_subject", sa.String(255), nullable=False),
    sa.Column("xrpl_address", sa.String(34), nullable=True),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column("last_verified_at", sa.DateTime(), nullable=False),
    sa.UniqueConstraint(
        "provider",
        "external_subject",
        name="uq_externalidentity_provider_subject",
    ),
)
sa.Index("ix_externalidentity_provider", externalidentity.c.provider)
sa.Index("ix_externalidentity_external_subject", externalidentity.c.external_subject)

authorizationcode = sa.Table(
    "authorizationcode",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("code_hash", sa.String(255), nullable=False, unique=True),
    sa.Column("external_subject", sa.String(255), nullable=False),
    sa.Column("xrpl_address", sa.String(34), nullable=True),
    sa.Column("state", sa.String(255), nullable=False),
    sa.Column("login_session_id", sa.String(255), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column("expires_at", sa.DateTime(), nullable=False),
    sa.Column("used_at", sa.DateTime(), nullable=True),
    sa.Column("used_by_ip", sa.String(45), nullable=True),
)

pendingloginstate = sa.Table(
    "pendingloginstate",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("state_hash", sa.String(64), nullable=False),
    sa.Column("status", sa.String(20), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column("expires_at", sa.DateTime(), nullable=False),
    sa.Column("consumed_at", sa.DateTime(), nullable=True),
    sa.Column("post_login_redirect", sa.String(255), nullable=True),
)
sa.Index("ix_pendingloginstate_state_hash", pendingloginstate.c.state_hash, unique=True)
sa.Index("ix_pendingloginstate_status", pendingloginstate.c.status)

pendingloginlocale = sa.Table(
    "pendingloginlocale",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("state_hash", sa.String(64), nullable=False),
    sa.Column("locale", sa.String(16), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column("expires_at", sa.DateTime(), nullable=False),
)
sa.Index("ix_pendingloginlocale_state_hash", pendingloginlocale.c.state_hash, unique=True)
sa.Index("ix_pendingloginlocale_expires_at", pendingloginlocale.c.expires_at)

originloginhandoff = sa.Table(
    "originloginhandoff",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("state_hash", sa.String(64), nullable=False),
    sa.Column("handoff_token_hash", sa.String(64), nullable=False),
    sa.Column("status", sa.String(20), nullable=False),
    sa.Column(
        "calorieapp_user_id",
        sa.String(),
        sa.ForeignKey("calorieappuser.id", name="fk_originloginhandoff_user"),
        nullable=True,
    ),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column("expires_at", sa.DateTime(), nullable=False),
    sa.Column("completed_at", sa.DateTime(), nullable=True),
    sa.Column("claimed_at", sa.DateTime(), nullable=True),
    sa.Column("failure_code", sa.String(40), nullable=True),
)
sa.Index("ix_originloginhandoff_state_hash", originloginhandoff.c.state_hash, unique=True)
sa.Index("ix_originloginhandoff_handoff_token_hash", originloginhandoff.c.handoff_token_hash)
sa.Index("ix_originloginhandoff_status", originloginhandoff.c.status)
sa.Index("ix_originloginhandoff_calorieapp_user_id", originloginhandoff.c.calorieapp_user_id)
sa.Index("ix_originloginhandoff_expires_at", originloginhandoff.c.expires_at)

authsession = sa.Table(
    "authsession",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("session_token_hash", sa.String(64), nullable=False),
    sa.Column(
        "calorieapp_user_id",
        sa.String(),
        sa.ForeignKey("calorieappuser.id", name="fk_authsession_user"),
        nullable=False,
    ),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column("last_seen_at", sa.DateTime(), nullable=False),
    sa.Column("expires_at", sa.DateTime(), nullable=False),
    sa.Column("revoked_at", sa.DateTime(), nullable=True),
    sa.Column(
        "replaced_by_session_id",
        sa.String(),
        sa.ForeignKey("authsession.id", name="fk_authsession_replacement"),
        nullable=True,
    ),
)
sa.Index("ix_authsession_session_token_hash", authsession.c.session_token_hash, unique=True)
sa.Index("ix_authsession_calorieapp_user_id", authsession.c.calorieapp_user_id)
sa.Index("ix_authsession_last_seen_at", authsession.c.last_seen_at)
sa.Index("ix_authsession_expires_at", authsession.c.expires_at)
sa.Index("ix_authsession_revoked_at", authsession.c.revoked_at)

bridgeauthnonce = sa.Table(
    "bridgeauthnonce",
    metadata,
    sa.Column("id", sa.String(), primary_key=True),
    sa.Column("client_id", sa.String(120), nullable=False),
    sa.Column("nonce_hash", sa.String(64), nullable=False),
    sa.Column("context", sa.String(60), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.Column("expires_at", sa.DateTime(), nullable=False),
    sa.UniqueConstraint(
        "client_id",
        "nonce_hash",
        "context",
        name="uq_bridgeauthnonce_context_nonce",
    ),
)
sa.Index("ix_bridgeauthnonce_client_id", bridgeauthnonce.c.client_id)
sa.Index("ix_bridgeauthnonce_nonce_hash", bridgeauthnonce.c.nonce_hash)
sa.Index("ix_bridgeauthnonce_context", bridgeauthnonce.c.context)
sa.Index("ix_bridgeauthnonce_expires_at", bridgeauthnonce.c.expires_at)

_required_food_log_columns = {
    "id",
    "product_name",
    "calories",
    "protein",
    "fat",
    "carbohydrates",
    "created_at",
}


def _food_log_has_owner_foreign_key(connection: Connection) -> bool:
    return any(
        foreign_key.get("constrained_columns") == ["owner_id"]
        and foreign_key.get("referred_table") == "calorieappuser"
        and foreign_key.get("referred_columns") == ["id"]
        for foreign_key in sa.inspect(connection).get_foreign_keys("food_log")
    )


def _validate_legacy_owner_links(
    connection: Connection,
    existing_columns: set[str] | None = None,
) -> None:
    if existing_columns is not None and "owner_id" not in existing_columns:
        return
    invalid_owner = connection.execute(
        sa.text(
            "SELECT food_log.owner_id FROM food_log "
            "LEFT JOIN calorieappuser ON calorieappuser.id = food_log.owner_id "
            "WHERE food_log.owner_id IS NOT NULL AND calorieappuser.id IS NULL LIMIT 1"
        )
    ).first()
    if invalid_owner is not None:
        raise RuntimeError(
            "food_log contains an owner_id without a matching calorieappuser; "
            "migration stopped without inventing ownership"
        )


def _rebuild_sqlite_food_log(connection: Connection, existing_columns: set[str]) -> None:
    _validate_legacy_owner_links(connection, existing_columns)
    temporary_name = "food_log_migration_20260830_0001"
    quote = connection.dialect.identifier_preparer.quote
    temp_metadata = sa.MetaData()
    sa.Table("calorieappuser", temp_metadata, sa.Column("id", sa.String(), primary_key=True))
    temporary = food_log.to_metadata(temp_metadata, name=temporary_name)
    temporary.create(connection, checkfirst=False)

    copied_columns = [column.name for column in food_log.columns if column.name in existing_columns]
    quoted_columns = ", ".join(quote(column) for column in copied_columns)
    connection.execute(
        sa.text(
            f"INSERT INTO {quote(temporary_name)} ({quoted_columns}) "
            f"SELECT {quoted_columns} FROM {quote('food_log')}"
        )
    )
    connection.execute(sa.text(f"DROP TABLE {quote('food_log')}"))
    connection.execute(
        sa.text(f"ALTER TABLE {quote(temporary_name)} RENAME TO {quote('food_log')}")
    )


def _upgrade_existing_food_log(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    existing_columns = {str(column["name"]) for column in inspector.get_columns("food_log")}
    missing_required = _required_food_log_columns - existing_columns
    if missing_required:
        missing = ", ".join(sorted(missing_required))
        raise RuntimeError(f"Legacy food_log is missing required columns: {missing}")

    expected_columns = {column.name for column in food_log.columns}
    needs_upgrade = existing_columns != expected_columns or not _food_log_has_owner_foreign_key(connection)
    if not needs_upgrade:
        return

    if connection.dialect.name == "sqlite":
        _rebuild_sqlite_food_log(connection, existing_columns)
        return

    quote = connection.dialect.identifier_preparer.quote
    postgresql_types = {
        "portion_percentage": "DOUBLE PRECISION",
        "barcode": "VARCHAR(64)",
        "image_url": "VARCHAR(500)",
        "brand": "VARCHAR(160)",
        "serving_size": "VARCHAR(80)",
        "nutri_score": "VARCHAR(2)",
        "owner_id": "VARCHAR",
    }
    for column_name in sorted(expected_columns - existing_columns):
        connection.execute(
            sa.text(
                f"ALTER TABLE {quote('food_log')} ADD COLUMN {quote(column_name)} "
                f"{postgresql_types[column_name]}"
            )
        )
    if not _food_log_has_owner_foreign_key(connection):
        _validate_legacy_owner_links(connection)
        connection.execute(
            sa.text(
                "ALTER TABLE food_log ADD CONSTRAINT fk_food_log_owner_id_calorieappuser "
                "FOREIGN KEY (owner_id) REFERENCES calorieappuser (id)"
            )
        )


def _ensure_declared_indexes(connection: Connection) -> None:
    inspector = sa.inspect(connection)
    for table in metadata.tables.values():
        existing = {index["name"] for index in inspector.get_indexes(table.name)}
        for index in table.indexes:
            if index.name not in existing:
                index.create(connection, checkfirst=True)


def upgrade(connection: Connection) -> None:
    """Create the baseline or safely adopt the one supported legacy table shape."""
    food_log_existed = sa.inspect(connection).has_table("food_log")
    metadata.create_all(connection, checkfirst=True)
    if food_log_existed:
        _upgrade_existing_food_log(connection)
    _ensure_declared_indexes(connection)


def _required_unique_column_sets(table: sa.Table) -> set[tuple[str, ...]]:
    required: set[tuple[str, ...]] = set()
    for constraint in table.constraints:
        if isinstance(constraint, sa.UniqueConstraint):
            required.add(tuple(column.name for column in constraint.columns))
    for index in table.indexes:
        if index.unique:
            required.add(tuple(column.name for column in index.columns))
    return required


def validate(connection: Connection) -> None:
    """Detect missing, extra or constraint-drifted objects for this revision."""
    inspector = sa.inspect(connection)
    for table in metadata.sorted_tables:
        if not inspector.has_table(table.name):
            raise RuntimeError(f"Required table is missing: {table.name}")

        actual_columns = {str(column["name"]) for column in inspector.get_columns(table.name)}
        expected_columns = {column.name for column in table.columns}
        if actual_columns != expected_columns:
            raise RuntimeError(f"Schema column drift detected for table {table.name}")

        actual_indexes = {index["name"] for index in inspector.get_indexes(table.name)}
        expected_indexes = {index.name for index in table.indexes}
        if not expected_indexes.issubset(actual_indexes):
            raise RuntimeError(f"Schema index drift detected for table {table.name}")

        actual_unique_sets = {
            tuple(item["column_names"])
            for item in inspector.get_unique_constraints(table.name)
            if item.get("column_names")
        }
        actual_unique_sets.update(
            tuple(item["column_names"])
            for item in inspector.get_indexes(table.name)
            if item.get("unique") and item.get("column_names")
        )
        if not _required_unique_column_sets(table).issubset(actual_unique_sets):
            raise RuntimeError(f"Schema uniqueness drift detected for table {table.name}")

        expected_foreign_keys = {
            (
                tuple(constraint.column_keys),
                constraint.referred_table.name,
                tuple(element.column.name for element in constraint.elements),
            )
            for constraint in table.foreign_key_constraints
        }
        actual_foreign_keys = {
            (
                tuple(item["constrained_columns"]),
                item["referred_table"],
                tuple(item["referred_columns"]),
            )
            for item in inspector.get_foreign_keys(table.name)
        }
        if not expected_foreign_keys.issubset(actual_foreign_keys):
            raise RuntimeError(f"Schema foreign-key drift detected for table {table.name}")
