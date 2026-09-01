"""Fail-closed PostgreSQL grants for the runtime application role.

The schema owner/migration role applies this policy after an approved migration.
The runtime role owns no database objects and receives only the row privileges
the current application needs.  Audit receipts remain insert-only for that role.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import sqlalchemy as sa
from sqlalchemy.engine import Connection, Row


class PostgreSQLPrivilegeError(RuntimeError):
    """Raised when the runtime database-role boundary is incomplete or unsafe."""


APPLICATION_AUDIT_TABLES = frozenset(
    {
        "food_source_moderation_audit",
        "food_attribute_assertion_ingest_audit",
        "food_attribute_assertion_moderation_audit",
        "food_attribute_assertion_correction_audit",
    }
)
APPLICATION_READ_ONLY_TABLES = frozenset({"calorie_schema_revision"})
APPLICATION_READ_WRITE_TABLES = frozenset(
    {
        "food_log",
        "food_source",
        "food_source_record",
        "food_product",
        "food_product_source_link",
        "food_attribute_assertion",
        "calorieappuser",
        "inactive_account_notice",
        "externalidentity",
        "authorizationcode",
        "pendingloginstate",
        "pendingloginlocale",
        "originloginhandoff",
        "authsession",
        "bridgeauthnonce",
        "provider_rate_event",
        "route_rate_event",
    }
)
APPLICATION_MANAGED_TABLES = (
    APPLICATION_AUDIT_TABLES
    | APPLICATION_READ_ONLY_TABLES
    | APPLICATION_READ_WRITE_TABLES
)

_ROLE_NAME = re.compile(r"[a-z][a-z0-9_]{0,62}\Z")
_TABLE_PRIVILEGES = (
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
)
_SEQUENCE_PRIVILEGES = ("USAGE", "SELECT", "UPDATE")
_UNSAFE_ROLE_FLAGS = {
    "rolsuper": "SUPERUSER",
    "rolcreaterole": "CREATEROLE",
    "rolcreatedb": "CREATEDB",
    "rolreplication": "REPLICATION",
    "rolbypassrls": "BYPASSRLS",
}


@dataclass(frozen=True)
class ApplicationPrivilegeProof:
    """Summary safe to print in CI or an operator record."""

    application_role: str
    database_name: str
    read_write_table_count: int
    insert_only_audit_table_count: int
    read_only_table_count: int
    sequence_count: int


def validate_application_role_name(application_role: str) -> str:
    """Accept a deliberately narrow, unquoted PostgreSQL role-name subset."""
    normalized = application_role.strip()
    if not _ROLE_NAME.fullmatch(normalized):
        raise PostgreSQLPrivilegeError(
            "Application role must match [a-z][a-z0-9_]{0,62}"
        )
    return normalized


def validate_approval_reference(approval_reference: str | None) -> str:
    """Require a short, non-empty change or review reference for mutations."""
    normalized = approval_reference.strip() if approval_reference else ""
    if not normalized or len(normalized) > 120:
        raise PostgreSQLPrivilegeError(
            "An approval reference of 1 through 120 characters is required"
        )
    return normalized


def _require_postgresql(connection: Connection) -> None:
    if connection.dialect.name != "postgresql":
        raise PostgreSQLPrivilegeError(
            "Application-role privileges can only be managed on PostgreSQL"
        )


def _quoted_identifier(connection: Connection, value: str) -> str:
    return connection.dialect.identifier_preparer.quote_identifier(value)


def _current_database(connection: Connection) -> str:
    database_name = connection.exec_driver_sql(
        "SELECT current_database()"
    ).scalar_one()
    if not isinstance(database_name, str) or not database_name:
        raise PostgreSQLPrivilegeError("Could not determine the PostgreSQL database")
    return database_name


def _current_user(connection: Connection) -> str:
    user_name = connection.exec_driver_sql("SELECT current_user").scalar_one()
    if not isinstance(user_name, str) or not user_name:
        raise PostgreSQLPrivilegeError("Could not determine the PostgreSQL role")
    return user_name


def _role_row(connection: Connection, application_role: str) -> Row:
    row = connection.execute(
        sa.text(
            """
            SELECT oid, rolname, rolsuper, rolcreaterole, rolcreatedb,
                   rolreplication, rolbypassrls
            FROM pg_catalog.pg_roles
            WHERE rolname = :application_role
            """
        ),
        {"application_role": application_role},
    ).one_or_none()
    if row is None:
        raise PostgreSQLPrivilegeError(
            f"PostgreSQL application role does not exist: {application_role}"
        )
    return row


def _assert_role_has_no_powerful_capabilities(
    connection: Connection,
    application_role: str,
) -> None:
    row = _role_row(connection, application_role)
    enabled_flags = [
        label
        for column, label in _UNSAFE_ROLE_FLAGS.items()
        if bool(row._mapping[column])
    ]
    if enabled_flags:
        raise PostgreSQLPrivilegeError(
            "Application role has forbidden capabilities: "
            + ", ".join(enabled_flags)
        )

    inherited_roles = connection.execute(
        sa.text(
            """
            SELECT granted.rolname
            FROM pg_catalog.pg_auth_members AS membership
            JOIN pg_catalog.pg_roles AS member
              ON member.oid = membership.member
            JOIN pg_catalog.pg_roles AS granted
              ON granted.oid = membership.roleid
            WHERE member.rolname = :application_role
            ORDER BY granted.rolname
            """
        ),
        {"application_role": application_role},
    ).scalars().all()
    if inherited_roles:
        raise PostgreSQLPrivilegeError(
            "Application role must not inherit or SET ROLE into other roles: "
            + ", ".join(inherited_roles)
        )

    database_owner = connection.execute(
        sa.text(
            """
            SELECT owner.rolname
            FROM pg_catalog.pg_database AS d
            JOIN pg_catalog.pg_roles AS owner ON owner.oid = d.datdba
            WHERE d.datname = current_database()
            """
        )
    ).scalar_one()
    if database_owner == application_role:
        raise PostgreSQLPrivilegeError("Application role must not own the database")

    owned_schemas = connection.execute(
        sa.text(
            """
            SELECT n.nspname
            FROM pg_catalog.pg_namespace AS n
            JOIN pg_catalog.pg_roles AS owner ON owner.oid = n.nspowner
            WHERE owner.rolname = :application_role
              AND n.nspname NOT LIKE 'pg_temp_%'
              AND n.nspname NOT LIKE 'pg_toast_temp_%'
            ORDER BY n.nspname
            """
        ),
        {"application_role": application_role},
    ).scalars().all()
    if owned_schemas:
        raise PostgreSQLPrivilegeError(
            "Application role must not own schemas: " + ", ".join(owned_schemas)
        )

    owned_objects = connection.execute(
        sa.text(
            """
            SELECT n.nspname || '.' || c.relname
            FROM pg_catalog.pg_class AS c
            JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
            JOIN pg_catalog.pg_roles AS owner ON owner.oid = c.relowner
            WHERE owner.rolname = :application_role
              AND n.nspname NOT LIKE 'pg_temp_%'
              AND n.nspname NOT LIKE 'pg_toast_temp_%'
            ORDER BY n.nspname, c.relname
            """
        ),
        {"application_role": application_role},
    ).scalars().all()
    if owned_objects:
        raise PostgreSQLPrivilegeError(
            "Application role must not own database objects: "
            + ", ".join(owned_objects)
        )

    owned_functions = connection.execute(
        sa.text(
            """
            SELECT n.nspname || '.' || p.proname
            FROM pg_catalog.pg_proc AS p
            JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
            JOIN pg_catalog.pg_roles AS owner ON owner.oid = p.proowner
            WHERE owner.rolname = :application_role
              AND n.nspname NOT LIKE 'pg_temp_%'
              AND n.nspname NOT LIKE 'pg_toast_temp_%'
            ORDER BY n.nspname, p.proname
            """
        ),
        {"application_role": application_role},
    ).scalars().all()
    if owned_functions:
        raise PostgreSQLPrivilegeError(
            "Application role must not own functions: "
            + ", ".join(owned_functions)
        )


def _assert_managed_table_inventory(connection: Connection) -> None:
    actual_tables = frozenset(sa.inspect(connection).get_table_names(schema="public"))
    if actual_tables == APPLICATION_MANAGED_TABLES:
        return

    missing = sorted(APPLICATION_MANAGED_TABLES - actual_tables)
    unknown = sorted(actual_tables - APPLICATION_MANAGED_TABLES)
    details: list[str] = []
    if missing:
        details.append("missing=" + ",".join(missing))
    if unknown:
        details.append("unclassified=" + ",".join(unknown))
    raise PostgreSQLPrivilegeError(
        "PostgreSQL table inventory does not match the reviewed privilege policy: "
        + "; ".join(details)
    )


def _grant_tables(
    connection: Connection,
    application_role: str,
    tables: frozenset[str],
    privileges: str,
) -> None:
    if not tables:
        return
    quoted_public = _quoted_identifier(connection, "public")
    relations = ", ".join(
        f"{quoted_public}.{_quoted_identifier(connection, table)}"
        for table in sorted(tables)
    )
    quoted_role = _quoted_identifier(connection, application_role)
    connection.exec_driver_sql(
        f"GRANT {privileges} ON TABLE {relations} TO {quoted_role}"
    )


def _has_privilege(
    connection: Connection,
    function_name: str,
    application_role: str,
    object_name: str,
    privilege: str,
) -> bool:
    if function_name not in {
        "has_database_privilege",
        "has_schema_privilege",
        "has_table_privilege",
        "has_sequence_privilege",
    }:
        raise PostgreSQLPrivilegeError("Unsupported PostgreSQL privilege function")
    return bool(
        connection.execute(
            sa.text(
                f"SELECT {function_name}(:application_role, :object_name, :privilege)"
            ),
            {
                "application_role": application_role,
                "object_name": object_name,
                "privilege": privilege,
            },
        ).scalar_one()
    )


def _assert_privilege(
    connection: Connection,
    function_name: str,
    application_role: str,
    object_name: str,
    privilege: str,
    *,
    expected: bool,
) -> None:
    actual = _has_privilege(
        connection,
        function_name,
        application_role,
        object_name,
        privilege,
    )
    if actual != expected:
        expectation = "required" if expected else "forbidden"
        raise PostgreSQLPrivilegeError(
            f"{privilege} is {expectation} for {application_role} on {object_name}"
        )


def verify_postgresql_application_privileges(
    connection: Connection,
    application_role: str,
) -> ApplicationPrivilegeProof:
    """Fail unless effective PostgreSQL privileges match the reviewed matrix."""
    _require_postgresql(connection)
    role = validate_application_role_name(application_role)
    _assert_role_has_no_powerful_capabilities(connection, role)
    _assert_managed_table_inventory(connection)

    database_name = _current_database(connection)
    for privilege, expected in (
        ("CONNECT", True),
        ("CREATE", False),
        ("TEMPORARY", False),
    ):
        _assert_privilege(
            connection,
            "has_database_privilege",
            role,
            database_name,
            privilege,
            expected=expected,
        )
    for privilege, expected in (("USAGE", True), ("CREATE", False)):
        _assert_privilege(
            connection,
            "has_schema_privilege",
            role,
            "public",
            privilege,
            expected=expected,
        )
    schema_names = sa.inspect(connection).get_schema_names()
    for schema_name in schema_names:
        if schema_name.startswith(("pg_temp_", "pg_toast_temp_")):
            continue
        _assert_privilege(
            connection,
            "has_schema_privilege",
            role,
            schema_name,
            "CREATE",
            expected=False,
        )

    table_policy = {
        **{
            table: frozenset({"SELECT", "INSERT", "UPDATE", "DELETE"})
            for table in APPLICATION_READ_WRITE_TABLES
        },
        **{
            table: frozenset({"SELECT", "INSERT"})
            for table in APPLICATION_AUDIT_TABLES
        },
        **{
            table: frozenset({"SELECT"})
            for table in APPLICATION_READ_ONLY_TABLES
        },
    }
    for table, allowed in sorted(table_policy.items()):
        for privilege in _TABLE_PRIVILEGES:
            _assert_privilege(
                connection,
                "has_table_privilege",
                role,
                f"public.{table}",
                privilege,
                expected=privilege in allowed,
            )

    sequence_names = sorted(sa.inspect(connection).get_sequence_names(schema="public"))
    for sequence in sequence_names:
        for privilege in _SEQUENCE_PRIVILEGES:
            _assert_privilege(
                connection,
                "has_sequence_privilege",
                role,
                f"public.{sequence}",
                privilege,
                expected=True,
            )

    return ApplicationPrivilegeProof(
        application_role=role,
        database_name=database_name,
        read_write_table_count=len(APPLICATION_READ_WRITE_TABLES),
        insert_only_audit_table_count=len(APPLICATION_AUDIT_TABLES),
        read_only_table_count=len(APPLICATION_READ_ONLY_TABLES),
        sequence_count=len(sequence_names),
    )


def apply_postgresql_application_privileges(
    connection: Connection,
    application_role: str,
    *,
    approval_reference: str | None,
) -> ApplicationPrivilegeProof:
    """Apply and immediately verify the reviewed runtime-role privilege policy."""
    _require_postgresql(connection)
    role = validate_application_role_name(application_role)
    validate_approval_reference(approval_reference)
    _assert_role_has_no_powerful_capabilities(connection, role)
    _assert_managed_table_inventory(connection)
    if _current_user(connection) == role:
        raise PostgreSQLPrivilegeError(
            "Privileges must be applied by the separate schema owner/migration role"
        )

    quoted_role = _quoted_identifier(connection, role)
    quoted_public = _quoted_identifier(connection, "public")
    database_name = _current_database(connection)
    quoted_database = _quoted_identifier(connection, database_name)

    # PostgreSQL privileges are additive. Remove PUBLIC access first so an
    # apparently restrictive role grant cannot be bypassed through PUBLIC.
    connection.exec_driver_sql(
        f"REVOKE CREATE, TEMPORARY ON DATABASE {quoted_database} FROM PUBLIC"
    )
    connection.exec_driver_sql(
        f"REVOKE CREATE ON SCHEMA {quoted_public} FROM PUBLIC"
    )
    connection.exec_driver_sql(
        f"REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA {quoted_public} FROM PUBLIC"
    )
    connection.exec_driver_sql(
        f"REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA {quoted_public} FROM PUBLIC"
    )

    connection.exec_driver_sql(
        f"REVOKE ALL PRIVILEGES ON DATABASE {quoted_database} FROM {quoted_role}"
    )
    connection.exec_driver_sql(
        f"REVOKE ALL PRIVILEGES ON SCHEMA {quoted_public} FROM {quoted_role}"
    )
    connection.exec_driver_sql(
        f"REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA {quoted_public} FROM {quoted_role}"
    )
    connection.exec_driver_sql(
        f"REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA {quoted_public} FROM {quoted_role}"
    )

    connection.exec_driver_sql(
        f"GRANT CONNECT ON DATABASE {quoted_database} TO {quoted_role}"
    )
    connection.exec_driver_sql(
        f"GRANT USAGE ON SCHEMA {quoted_public} TO {quoted_role}"
    )
    _grant_tables(
        connection,
        role,
        APPLICATION_READ_WRITE_TABLES,
        "SELECT, INSERT, UPDATE, DELETE",
    )
    _grant_tables(
        connection,
        role,
        APPLICATION_AUDIT_TABLES,
        "SELECT, INSERT",
    )
    _grant_tables(
        connection,
        role,
        APPLICATION_READ_ONLY_TABLES,
        "SELECT",
    )
    connection.exec_driver_sql(
        f"GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA "
        f"{quoted_public} TO {quoted_role}"
    )

    return verify_postgresql_application_privileges(connection, role)
