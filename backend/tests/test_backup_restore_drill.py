"""Fail-closed boundary tests for the synthetic PostgreSQL restore drill."""

import pytest

from app.backup_restore_drill import validate_drill_urls


SOURCE = (
    "postgresql+psycopg://calorieapp_ci:synthetic_ci_only@"
    "127.0.0.1:5432/calorieapp_ci_test"
)
RESTORE = (
    "postgresql+psycopg://calorieapp_ci:synthetic_ci_only@"
    "127.0.0.1:5432/calorieapp_ci_restore"
)


def test_restore_drill_accepts_only_the_distinct_loopback_ci_databases() -> None:
    urls = validate_drill_urls(SOURCE, RESTORE)

    assert urls.source.database == "calorieapp_ci_test"
    assert urls.restore.database == "calorieapp_ci_restore"


@pytest.mark.parametrize(
    ("source", "restore", "message"),
    [
        (SOURCE.replace("127.0.0.1", "db.example.com"), RESTORE, "loopback-only"),
        (SOURCE, RESTORE.replace("calorieapp_ci_restore", "production"), "calorieapp_ci_restore"),
        (SOURCE.replace("calorieapp_ci_test", "production"), RESTORE, "calorieapp_ci_test"),
        (SOURCE.replace("postgresql+psycopg", "sqlite"), RESTORE, "PostgreSQL"),
        (SOURCE, RESTORE.replace("synthetic_ci_only@", "@"), "credentials"),
        (SOURCE, RESTORE + "?sslmode=require", "query options"),
        (SOURCE, RESTORE.replace("calorieapp_ci:", "other_ci:"), "same isolated CI server"),
    ],
)
def test_restore_drill_rejects_unsafe_database_boundaries(
    source: str,
    restore: str,
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        validate_drill_urls(source, restore)
