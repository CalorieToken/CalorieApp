"""Versioned CalorieApp schema migrations without a provider-specific service."""

from .runner import (
    SCHEMA_HEAD,
    MigrationError,
    assert_database_at_head,
    current_revision,
    upgrade_database,
)

__all__ = [
    "SCHEMA_HEAD",
    "MigrationError",
    "assert_database_at_head",
    "current_revision",
    "upgrade_database",
]
