"""Tests for bounded authentication-transient retention cleanup."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine, event
from sqlmodel import SQLModel, Session, select
from sqlmodel.pool import StaticPool

import app.auth_transient_retention as retention_module
import app.auth_transient_retention_cli as cli_module
from app.auth_transient_retention import (
    RetentionCleanupSafetyError,
    STATEMENT_ID_CHUNK_SIZE,
    cleanup_authentication_transients,
)
from app.auth_transient_retention_cli import validate_execution_authorization
from app.models import (
    AuthSessionDB,
    AuthorizationCodeDB,
    BridgeAuthNonceDB,
    CalorieAppUserDB,
    OriginLoginHandoffDB,
    PendingLoginLocaleDB,
    PendingLoginStateDB,
)


NOW = datetime(2026, 9, 1, 12, 0, 0)


@pytest.fixture()
def retention_engine():
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


def _authorization_code(label: str, expires_at: datetime) -> AuthorizationCodeDB:
    return AuthorizationCodeDB(
        code_hash=f"code-{label}",
        external_subject=f"subject-{label}",
        state=f"state-{label}",
        login_session_id=f"login-{label}",
        created_at=NOW - timedelta(minutes=5),
        expires_at=expires_at,
        used_by_ip=f"192.0.2.{len(label) + 1}",
    )


def _seed_all_transient_tables(session: Session) -> dict[str, str]:
    expired = NOW - timedelta(seconds=1)
    future = NOW + timedelta(hours=1)
    user = CalorieAppUserDB(id="retention-user", status="active")
    expired_session = AuthSessionDB(
        id="expired-session",
        session_token_hash="a" * 64,
        calorieapp_user_id=user.id,
        created_at=NOW - timedelta(hours=2),
        last_seen_at=NOW - timedelta(hours=2),
        expires_at=expired,
    )
    revoked_session = AuthSessionDB(
        id="revoked-session",
        session_token_hash="b" * 64,
        calorieapp_user_id=user.id,
        created_at=NOW - timedelta(minutes=30),
        last_seen_at=NOW - timedelta(minutes=30),
        expires_at=future,
        revoked_at=NOW - timedelta(minutes=1),
    )
    active_session = AuthSessionDB(
        id="active-session",
        session_token_hash="c" * 64,
        calorieapp_user_id=user.id,
        created_at=NOW,
        last_seen_at=NOW,
        expires_at=future,
        replaced_by_session_id=expired_session.id,
    )
    rows = [
        user,
        _authorization_code("expired", expired),
        _authorization_code("future", future),
        PendingLoginStateDB(
            state_hash="1" * 64,
            created_at=NOW - timedelta(minutes=5),
            expires_at=expired,
        ),
        PendingLoginStateDB(
            state_hash="2" * 64,
            created_at=NOW,
            expires_at=future,
        ),
        PendingLoginLocaleDB(
            state_hash="3" * 64,
            locale="en",
            created_at=NOW - timedelta(minutes=5),
            expires_at=expired,
        ),
        PendingLoginLocaleDB(
            state_hash="4" * 64,
            locale="nl",
            created_at=NOW,
            expires_at=future,
        ),
        OriginLoginHandoffDB(
            state_hash="5" * 64,
            handoff_token_hash="6" * 64,
            created_at=NOW - timedelta(minutes=5),
            expires_at=expired,
        ),
        OriginLoginHandoffDB(
            state_hash="7" * 64,
            handoff_token_hash="8" * 64,
            created_at=NOW,
            expires_at=future,
        ),
        expired_session,
        revoked_session,
        active_session,
        BridgeAuthNonceDB(
            client_id="retention-test",
            nonce_hash="9" * 64,
            context="login",
            created_at=NOW - timedelta(minutes=5),
            expires_at=expired,
        ),
        BridgeAuthNonceDB(
            client_id="retention-test",
            nonce_hash="0" * 64,
            context="login",
            created_at=NOW,
            expires_at=future,
        ),
    ]
    session.add_all(rows)
    session.commit()
    return {
        "expired_authorization_code_id": rows[1].id,
        "active_session_id": active_session.id,
    }


def _table_results(payload: dict[str, object]) -> dict[str, dict[str, object]]:
    tables = payload["tables"]
    assert isinstance(tables, list)
    return {str(table["table"]): table for table in tables}


def test_dry_run_covers_all_six_tables_without_writing_or_exposing_ids(
    retention_engine,
) -> None:
    with Session(retention_engine) as session:
        identifiers = _seed_all_transient_tables(session)
        result = cleanup_authentication_transients(
            session,
            dry_run=True,
            cutoff=NOW,
            batch_limit=10,
        )
        payload = result.as_payload()

        assert payload["status"] == "planned"
        assert payload["selected_total"] == 7
        assert payload["deleted_total"] == 0
        assert payload["more_rows_pending"] is False
        table_results = _table_results(payload)
        assert set(table_results) == {
            "authorizationcode",
            "pendingloginstate",
            "pendingloginlocale",
            "originloginhandoff",
            "authsession",
            "bridgeauthnonce",
        }
        assert table_results["authsession"]["selected"] == 2
        assert all(table["deleted"] == 0 for table in table_results.values())
        assert len(session.exec(select(AuthorizationCodeDB)).all()) == 2

    serialized = json.dumps(payload)
    assert identifiers["expired_authorization_code_id"] not in serialized
    assert "192.0.2." not in serialized
    assert "code-expired" not in serialized


def test_execute_deletes_only_eligible_rows_and_clears_inbound_session_reference(
    retention_engine,
) -> None:
    with Session(retention_engine) as session:
        identifiers = _seed_all_transient_tables(session)

    with Session(retention_engine) as session:
        payload = cleanup_authentication_transients(
            session,
            dry_run=False,
            cutoff=NOW,
            batch_limit=10,
        ).as_payload()
        assert payload["status"] == "executed"
        assert payload["selected_total"] == 7
        assert payload["deleted_total"] == 7

    with Session(retention_engine) as session:
        assert len(session.exec(select(AuthorizationCodeDB)).all()) == 1
        assert len(session.exec(select(PendingLoginStateDB)).all()) == 1
        assert len(session.exec(select(PendingLoginLocaleDB)).all()) == 1
        assert len(session.exec(select(OriginLoginHandoffDB)).all()) == 1
        assert len(session.exec(select(AuthSessionDB)).all()) == 1
        assert len(session.exec(select(BridgeAuthNonceDB)).all()) == 1
        active = session.get(AuthSessionDB, identifiers["active_session_id"])
        assert active is not None
        assert active.replaced_by_session_id is None

        repeated = cleanup_authentication_transients(
            session,
            dry_run=False,
            cutoff=NOW,
            batch_limit=10,
        ).as_payload()
        assert repeated["selected_total"] == 0
        assert repeated["deleted_total"] == 0


def test_batch_limit_is_per_table_and_reports_more_rows(retention_engine) -> None:
    with Session(retention_engine) as session:
        for index in range(3):
            session.add(
                _authorization_code(
                    f"batch-{index}",
                    NOW - timedelta(seconds=index + 1),
                )
            )
        session.commit()

        first = cleanup_authentication_transients(
            session,
            dry_run=False,
            cutoff=NOW,
            batch_limit=1,
        ).as_payload()
        first_tables = _table_results(first)
        assert first_tables["authorizationcode"] == {
            "table": "authorizationcode",
            "selected": 1,
            "deleted": 1,
            "more_rows_pending": True,
        }

        second = cleanup_authentication_transients(
            session,
            dry_run=False,
            cutoff=NOW,
            batch_limit=1,
        ).as_payload()
        assert _table_results(second)["authorizationcode"]["more_rows_pending"] is True

        third = cleanup_authentication_transients(
            session,
            dry_run=False,
            cutoff=NOW,
            batch_limit=1,
        ).as_payload()
        assert _table_results(third)["authorizationcode"]["more_rows_pending"] is False
        assert len(session.exec(select(AuthorizationCodeDB)).all()) == 0


def test_large_session_batch_chunks_every_in_clause_below_sqlite_limit(
    retention_engine,
) -> None:
    expired_count = 1_001
    with Session(retention_engine) as session:
        user = CalorieAppUserDB(id="large-retention-user", status="active")
        session.add(user)
        session.add_all(
            [
                AuthSessionDB(
                    id=f"expired-{index:04d}",
                    session_token_hash=f"{index:064x}",
                    calorieapp_user_id=user.id,
                    created_at=NOW - timedelta(hours=2),
                    last_seen_at=NOW - timedelta(hours=2),
                    expires_at=NOW - timedelta(seconds=1),
                )
                for index in range(expired_count)
            ]
        )
        session.add(
            AuthSessionDB(
                id="active-large-batch-session",
                session_token_hash="f" * 64,
                calorieapp_user_id=user.id,
                created_at=NOW,
                last_seen_at=NOW,
                expires_at=NOW + timedelta(hours=1),
                replaced_by_session_id="expired-0000",
            )
        )
        session.commit()

    mutation_parameter_counts: list[tuple[str, int]] = []

    def record_mutation_parameters(
        _connection: object,
        _cursor: object,
        statement: str,
        parameters: tuple[object, ...],
        _context: object,
        _executemany: bool,
    ) -> None:
        normalized = statement.lstrip().upper()
        if normalized.startswith("UPDATE AUTHSESSION"):
            mutation_parameter_counts.append(("update", len(parameters)))
        elif normalized.startswith("DELETE FROM AUTHSESSION"):
            mutation_parameter_counts.append(("delete", len(parameters)))

    event.listen(
        retention_engine,
        "before_cursor_execute",
        record_mutation_parameters,
    )
    try:
        with Session(retention_engine) as session:
            payload = cleanup_authentication_transients(
                session,
                dry_run=False,
                cutoff=NOW,
                batch_limit=expired_count,
            ).as_payload()
            active = session.get(AuthSessionDB, "active-large-batch-session")
            assert active is not None
            assert active.replaced_by_session_id is None
    finally:
        event.remove(
            retention_engine,
            "before_cursor_execute",
            record_mutation_parameters,
        )

    assert payload["selected_total"] == expired_count
    assert payload["deleted_total"] == expired_count
    update_counts = [
        count
        for operation, count in mutation_parameter_counts
        if operation == "update"
    ]
    delete_counts = [
        count
        for operation, count in mutation_parameter_counts
        if operation == "delete"
    ]
    assert len(update_counts) == 3
    assert len(delete_counts) == 3
    assert max(update_counts) <= STATEMENT_ID_CHUNK_SIZE + 1
    assert max(delete_counts) <= STATEMENT_ID_CHUNK_SIZE


def test_execute_rolls_back_every_table_when_one_delete_fails(
    retention_engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with Session(retention_engine) as session:
        session.add(_authorization_code("rollback", NOW - timedelta(seconds=1)))
        session.add(
            PendingLoginStateDB(
                state_hash="f" * 64,
                created_at=NOW - timedelta(minutes=1),
                expires_at=NOW - timedelta(seconds=1),
            )
        )
        session.commit()

        original_delete = retention_module._delete_selected_rows

        def fail_on_pending_login_state(
            selected_session: Session,
            model: object,
            ids: list[str],
        ) -> int:
            if model is PendingLoginStateDB:
                raise RuntimeError("synthetic failure")
            return original_delete(selected_session, model, ids)

        monkeypatch.setattr(
            retention_module,
            "_delete_selected_rows",
            fail_on_pending_login_state,
        )
        with pytest.raises(RuntimeError, match="synthetic failure"):
            cleanup_authentication_transients(
                session,
                dry_run=False,
                cutoff=NOW,
                batch_limit=10,
            )

        assert len(session.exec(select(AuthorizationCodeDB)).all()) == 1
        assert len(session.exec(select(PendingLoginStateDB)).all()) == 1


def test_cleanup_rejects_dirty_session_and_invalid_batch_limit(retention_engine) -> None:
    with Session(retention_engine) as session:
        session.add(_authorization_code("pending", NOW - timedelta(seconds=1)))
        with pytest.raises(RetentionCleanupSafetyError, match="clean dedicated session"):
            cleanup_authentication_transients(session, dry_run=True, cutoff=NOW)
        session.rollback()

        with pytest.raises(RetentionCleanupSafetyError, match="between 1 and"):
            cleanup_authentication_transients(
                session,
                dry_run=True,
                cutoff=NOW,
                batch_limit=0,
            )


@pytest.mark.parametrize(
    ("environment", "enabled", "reference"),
    [
        ("production", "true", "PR-66"),
        ("staging", None, "PR-66"),
        ("test", "false", "PR-66"),
        ("local", "true", None),
        ("local", "true", " "),
        ("local", "true", "x" * 121),
    ],
)
def test_execution_authorization_fails_closed(
    environment: str,
    enabled: str | None,
    reference: str | None,
) -> None:
    with pytest.raises(RetentionCleanupSafetyError):
        validate_execution_authorization(
            environment=environment,
            enabled=enabled,
            approval_reference=reference,
        )


def test_execution_authorization_accepts_explicit_non_production_approval() -> None:
    validate_execution_authorization(
        environment="test",
        enabled="true",
        approval_reference="PR-66",
    )


def test_cli_defaults_to_dry_run_and_outputs_aggregates_only(
    retention_engine,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(cli_module, "engine", retention_engine)
    monkeypatch.setattr(cli_module, "_DATABASE_URL_WAS_EXPLICIT", False)
    monkeypatch.setattr(cli_module, "assert_database_at_head", lambda engine: None)
    monkeypatch.setenv("CALORIEAPP_ENV", "test")
    monkeypatch.delenv(cli_module.EXECUTION_ENABLE_ENV, raising=False)
    monkeypatch.setattr(sys, "argv", ["auth-transient-retention"])

    assert cli_module.main() == 0

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "planned"
    assert payload["dry_run"] is True
    assert payload["deleted_total"] == 0
    assert len(payload["tables"]) == 6


def test_cli_blocks_execute_before_database_access_when_not_enabled(
    retention_engine,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(cli_module, "engine", retention_engine)
    monkeypatch.setattr(cli_module, "_DATABASE_URL_WAS_EXPLICIT", False)
    monkeypatch.setenv("CALORIEAPP_ENV", "test")
    monkeypatch.delenv(cli_module.EXECUTION_ENABLE_ENV, raising=False)
    monkeypatch.setattr(
        cli_module,
        "assert_database_at_head",
        lambda engine: pytest.fail("blocked execution must not access the database"),
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "auth-transient-retention",
            "--execute",
            "--approval-reference",
            "PR-66",
        ],
    )

    assert cli_module.main() == 2

    assert json.loads(capsys.readouterr().out) == {
        "schema_version": "calorieapp-auth-transient-cleanup-v1",
        "status": "blocked",
        "dry_run": None,
        "reason_code": "execution-not-authorized",
    }
