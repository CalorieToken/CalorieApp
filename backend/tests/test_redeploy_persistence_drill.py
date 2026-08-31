"""Fail-closed boundary tests for the synthetic process-replacement drill."""

import pytest

from app.redeploy_persistence_drill import validate_drill_url


DATABASE_URL = (
    "postgresql+psycopg://calorieapp_ci:synthetic_ci_only@"
    "127.0.0.1:5432/calorieapp_ci_test"
)


def test_redeploy_drill_accepts_only_the_loopback_ci_database() -> None:
    parsed = validate_drill_url(DATABASE_URL)

    assert parsed.host == "127.0.0.1"
    assert parsed.database == "calorieapp_ci_test"


@pytest.mark.parametrize(
    ("database_url", "message"),
    [
        (DATABASE_URL.replace("127.0.0.1", "db.example.com"), "loopback-only"),
        (DATABASE_URL.replace("calorieapp_ci_test", "production"), "calorieapp_ci_test"),
        (DATABASE_URL.replace("postgresql+psycopg", "sqlite"), "PostgreSQL"),
        (DATABASE_URL.replace("synthetic_ci_only@", "@"), "credentials"),
        (DATABASE_URL + "?sslmode=require", "query options"),
    ],
)
def test_redeploy_drill_rejects_unsafe_database_boundaries(
    database_url: str,
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        validate_drill_url(database_url)
