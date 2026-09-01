"""Tests for aggregate-only inactive-account lifecycle preview."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlmodel import SQLModel, Session, select
from sqlmodel.pool import StaticPool

import app.inactive_account_preview_cli as cli_module
from app.inactive_account_preview import (
    InactiveAccountPreviewSafetyError,
    _shift_calendar_months,
    preview_inactive_accounts,
)
from app.models import CalorieAppUserDB


AS_OF = datetime(2026, 9, 1, 12, 0, 0)


@pytest.fixture()
def preview_engine():
    selected_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(selected_engine)
    try:
        yield selected_engine
    finally:
        selected_engine.dispose()


def _user(label: str, activity: datetime, *, status: str = "active") -> CalorieAppUserDB:
    return CalorieAppUserDB(
        id=f"preview-{label}",
        status=status,
        last_authenticated_activity_at=activity,
    )


def _seed_boundaries(session: Session) -> None:
    session.add_all(
        [
            _user("past-retention", datetime(2024, 8, 31, 12, 0, 0)),
            _user("exact-retention", datetime(2024, 9, 1, 12, 0, 0)),
            _user("notice-window", datetime(2024, 9, 15, 12, 0, 0)),
            _user("exact-notice", datetime(2024, 10, 1, 12, 0, 0)),
            _user("not-due", datetime(2024, 10, 1, 12, 0, 1)),
            _user(
                "non-active",
                datetime(2020, 1, 1, 0, 0, 0),
                status="suspended",
            ),
        ]
    )
    session.commit()


def test_preview_reports_only_bounded_aggregate_lifecycle_counts(preview_engine) -> None:
    with Session(preview_engine) as session:
        _seed_boundaries(session)

    with Session(preview_engine) as session:
        payload = preview_inactive_accounts(
            session,
            as_of=AS_OF,
            batch_limit=10,
        ).as_payload()

        assert payload == {
            "schema_version": "calorieapp-inactive-account-preview-v1",
            "status": "planned",
            "read_only": True,
            "as_of_utc": "2026-09-01T12:00:00Z",
            "inactive_account_months": 24,
            "notice_days": 30,
            "batch_limit": 10,
            "evaluated_accounts": 5,
            "due_total": 4,
            "notice_window_accounts": 2,
            "retention_boundary_reached_accounts": 2,
            "more_due_accounts_pending": False,
            "notice_sent": False,
            "account_marked": False,
            "automatic_erasure_authorized": False,
            "account_erased": False,
        }
        assert session.in_transaction() is False
        assert len(session.identity_map) == 0

    serialized = json.dumps(payload)
    assert "preview-past-retention" not in serialized
    assert "preview-exact-notice" not in serialized

    with Session(preview_engine) as session:
        assert len(session.exec(select(CalorieAppUserDB)).all()) == 6


def test_preview_normalizes_offset_as_of_to_naive_utc(preview_engine) -> None:
    with Session(preview_engine) as session:
        session.add(_user("offset-boundary", datetime(2024, 9, 1, 12, 0, 0)))
        session.commit()

    with Session(preview_engine) as session:
        result = preview_inactive_accounts(
            session,
            as_of=datetime(
                2026,
                9,
                1,
                14,
                0,
                0,
                tzinfo=timezone(timedelta(hours=2)),
            ),
        )

    assert result.as_of_utc == AS_OF
    assert result.retention_boundary_reached_accounts == 1


def test_calendar_months_handle_leap_days_and_month_ends() -> None:
    assert _shift_calendar_months(datetime(2024, 2, 29, 9, 30), 24) == datetime(
        2026,
        2,
        28,
        9,
        30,
    )
    assert _shift_calendar_months(datetime(2025, 1, 31, 9, 30), 1) == datetime(
        2025,
        2,
        28,
        9,
        30,
    )


def test_preview_reports_more_due_accounts_without_exposing_them(preview_engine) -> None:
    with Session(preview_engine) as session:
        session.add_all(
            [
                _user("old-a", datetime(2024, 1, 1)),
                _user("old-b", datetime(2024, 1, 2)),
                _user("old-c", datetime(2024, 1, 3)),
            ]
        )
        session.commit()

    with Session(preview_engine) as session:
        payload = preview_inactive_accounts(
            session,
            as_of=AS_OF,
            batch_limit=2,
        ).as_payload()

    assert payload["evaluated_accounts"] == 2
    assert payload["due_total"] == 2
    assert payload["more_due_accounts_pending"] is True
    assert "old-c" not in json.dumps(payload)


def test_preview_does_not_report_newer_rows_as_pending_due(preview_engine) -> None:
    with Session(preview_engine) as session:
        session.add_all(
            [
                _user("due", datetime(2024, 1, 1)),
                _user("new", datetime(2026, 1, 1)),
            ]
        )
        session.commit()

    with Session(preview_engine) as session:
        result = preview_inactive_accounts(
            session,
            as_of=AS_OF,
            batch_limit=1,
        )

    assert result.retention_boundary_reached_accounts == 1
    assert result.more_due_accounts_pending is False


def test_preview_requires_valid_limit_and_clean_dedicated_session(preview_engine) -> None:
    with Session(preview_engine) as session:
        for batch_limit in (0, 5_001, True):
            with pytest.raises(InactiveAccountPreviewSafetyError):
                preview_inactive_accounts(
                    session,
                    as_of=AS_OF,
                    batch_limit=batch_limit,
                )

    with Session(preview_engine) as session:
        session.add(_user("pending", datetime(2024, 1, 1)))
        with pytest.raises(
            InactiveAccountPreviewSafetyError,
            match="clean dedicated session",
        ):
            preview_inactive_accounts(session, as_of=AS_OF)


def _configure_cli_database(
    monkeypatch: pytest.MonkeyPatch,
    selected_engine: object,
    *,
    environment: str = "test",
) -> None:
    monkeypatch.setattr(
        cli_module,
        "_load_database_runtime",
        lambda: (
            selected_engine,
            False,
            lambda *_args, **_kwargs: environment,
        ),
    )
    monkeypatch.setattr(cli_module, "assert_database_at_head", lambda _engine: None)


def test_cli_outputs_aggregates_only(preview_engine, monkeypatch, capsys) -> None:
    with Session(preview_engine) as session:
        session.add(_user("cli-secret-id", datetime(2024, 1, 1)))
        session.commit()

    _configure_cli_database(monkeypatch, preview_engine)
    monkeypatch.setattr(sys, "argv", ["inactive-account-preview", "--batch-limit", "10"])

    assert cli_module.main() == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "planned"
    assert payload["read_only"] is True
    assert payload["evaluated_accounts"] == 1
    assert payload["notice_sent"] is False
    assert payload["account_erased"] is False
    assert "cli-secret-id" not in json.dumps(payload)


def test_cli_blocks_production_and_redacts_failures(
    preview_engine,
    monkeypatch,
    capsys,
) -> None:
    _configure_cli_database(monkeypatch, preview_engine, environment="production")
    monkeypatch.setattr(sys, "argv", ["inactive-account-preview"])

    assert cli_module.main() == 2
    payload = json.loads(capsys.readouterr().out)
    assert payload == {
        "schema_version": "calorieapp-inactive-account-preview-v1",
        "status": "blocked",
        "read_only": True,
        "reason_code": "preview-unavailable",
    }
