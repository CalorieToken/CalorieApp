"""Fail-closed boundary tests for the synthetic PostgreSQL restore drill."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import app.backup_restore_drill as drill_module
from app.backup_restore_drill import (
    SYNTHETIC_REPLAY_MAX_USERS,
    SYNTHETIC_USER_IDS,
    SyntheticReplayContext,
    SyntheticRestoreReplaySafetyError,
    _build_synthetic_replay_context,
    _erase_synthetic_replay_target,
    _match_synthetic_replay_candidate,
    _replay_synthetic_erasure,
    _seed_synthetic_accounts,
    _stage_synthetic_replay_target,
    validate_drill_urls,
)
from app.models import (
    AccountDataImportReceiptDB,
    AuthSessionDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
)


SOURCE = (
    "postgresql+psycopg://calorieapp_ci:synthetic_ci_only@"
    "127.0.0.1:5432/calorieapp_ci_test"
)
RESTORE = (
    "postgresql+psycopg://calorieapp_ci:synthetic_ci_only@"
    "127.0.0.1:5432/calorieapp_ci_restore"
)
ERASED_AT = datetime(2026, 9, 2, 15, 0, tzinfo=UTC)


@pytest.fixture()
def replay_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


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


def test_synthetic_replay_context_matches_only_the_erased_account() -> None:
    context = _build_synthetic_replay_context(
        user_id=SYNTHETIC_USER_IDS[0],
        erased_at=ERASED_AT,
    )

    assert context.proof.erasure_reason == "authenticated-user-request"
    assert _match_synthetic_replay_candidate(
        list(reversed(SYNTHETIC_USER_IDS)),
        context,
    ) == SYNTHETIC_USER_IDS[0]
    assert _match_synthetic_replay_candidate(
        [SYNTHETIC_USER_IDS[1]],
        context,
    ) is None


def test_synthetic_replay_rejects_changed_authorization_context() -> None:
    context = _build_synthetic_replay_context(
        user_id=SYNTHETIC_USER_IDS[0],
        erased_at=ERASED_AT,
    )
    changed = SyntheticReplayContext(
        proof=context.proof,
        authorization_reference_sha256="b" * 64,
    )

    assert _match_synthetic_replay_candidate(
        list(SYNTHETIC_USER_IDS),
        changed,
    ) is None


def test_synthetic_replay_rejects_duplicate_candidates() -> None:
    context = _build_synthetic_replay_context(
        user_id=SYNTHETIC_USER_IDS[0],
        erased_at=ERASED_AT,
    )

    with pytest.raises(
        SyntheticRestoreReplaySafetyError,
        match="candidates must be unique",
    ):
        _match_synthetic_replay_candidate(
            [SYNTHETIC_USER_IDS[0], SYNTHETIC_USER_IDS[0]],
            context,
        )


def test_synthetic_replay_rejects_oversized_batch_before_proof_work(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    context = _build_synthetic_replay_context(
        user_id=SYNTHETIC_USER_IDS[0],
        erased_at=ERASED_AT,
    )

    def unexpected_verification(**_kwargs) -> bool:
        raise AssertionError("oversized candidate batch must fail first")

    monkeypatch.setattr(
        drill_module,
        "verify_account_erasure_replay_proof",
        unexpected_verification,
    )

    with pytest.raises(SyntheticRestoreReplaySafetyError, match="fixed limit"):
        _match_synthetic_replay_candidate(
            [
                f"synthetic-candidate-{index}"
                for index in range(SYNTHETIC_REPLAY_MAX_USERS + 1)
            ],
            context,
        )


def test_synthetic_replay_maps_invalid_candidate_without_identifier_leak() -> None:
    context = _build_synthetic_replay_context(
        user_id=SYNTHETIC_USER_IDS[0],
        erased_at=ERASED_AT,
    )
    invalid_candidate = ""

    with pytest.raises(
        SyntheticRestoreReplaySafetyError,
        match="proof input is invalid",
    ) as caught:
        _match_synthetic_replay_candidate([invalid_candidate], context)

    assert SYNTHETIC_USER_IDS[0] not in str(caught.value)


def test_synthetic_replay_stage_is_rollback_safe_and_preserves_other_account(
    replay_engine,
) -> None:
    with Session(replay_engine) as session:
        _seed_synthetic_accounts(session, now=ERASED_AT.replace(tzinfo=None))
        session.commit()

    context = _build_synthetic_replay_context(
        user_id=SYNTHETIC_USER_IDS[0],
        erased_at=ERASED_AT,
    )
    with Session(replay_engine) as session:
        candidate_ids = session.exec(
            select(CalorieAppUserDB.id).order_by(CalorieAppUserDB.id)
        ).all()
        matched_id = _match_synthetic_replay_candidate(candidate_ids, context)
        assert matched_id == SYNTHETIC_USER_IDS[0]
        _stage_synthetic_replay_target(session, matched_id)
        session.rollback()

    with Session(replay_engine) as session:
        assert session.get(CalorieAppUserDB, SYNTHETIC_USER_IDS[0]) is not None
        _stage_synthetic_replay_target(session, SYNTHETIC_USER_IDS[0])
        session.commit()

    with Session(replay_engine) as session:
        assert session.get(CalorieAppUserDB, SYNTHETIC_USER_IDS[0]) is None
        assert session.get(CalorieAppUserDB, SYNTHETIC_USER_IDS[1]) is not None
        identities = session.exec(select(ExternalIdentityDB)).all()
        food_logs = session.exec(select(FoodLogDB)).all()
        import_receipts = session.exec(select(AccountDataImportReceiptDB)).all()
        handoffs = session.exec(select(OriginLoginHandoffDB)).all()
        notices = session.exec(select(InactiveAccountNoticeDB)).all()
        assert [row.calorieapp_user_id for row in identities] == [
            SYNTHETIC_USER_IDS[1]
        ]
        assert [row.owner_id for row in food_logs] == [SYNTHETIC_USER_IDS[1]]
        assert [row.target_account_id for row in import_receipts] == [
            SYNTHETIC_USER_IDS[1]
        ]
        assert [row.calorieapp_user_id for row in handoffs] == [
            SYNTHETIC_USER_IDS[1]
        ]
        assert [row.calorieapp_user_id for row in notices] == [
            SYNTHETIC_USER_IDS[1]
        ]
        retained_sessions = session.exec(select(AuthSessionDB)).all()
        assert len(retained_sessions) == 1
        assert retained_sessions[0].calorieapp_user_id == SYNTHETIC_USER_IDS[1]
        assert retained_sessions[0].replaced_by_session_id is None


def test_synthetic_erasure_helpers_reject_non_ci_databases_before_connecting() -> None:
    unsafe_url = make_url(
        "postgresql+psycopg://synthetic:synthetic@127.0.0.1:5432/production"
    )
    context = _build_synthetic_replay_context(
        user_id=SYNTHETIC_USER_IDS[0],
        erased_at=ERASED_AT,
    )

    with pytest.raises(
        SyntheticRestoreReplaySafetyError,
        match="exact loopback CI database",
    ):
        _erase_synthetic_replay_target(unsafe_url, SYNTHETIC_USER_IDS[0])
    with pytest.raises(
        SyntheticRestoreReplaySafetyError,
        match="exact loopback CI database",
    ):
        _replay_synthetic_erasure(unsafe_url, context)

    sqlite_lookalike = make_url("sqlite:///calorieapp_ci_test")
    with pytest.raises(
        SyntheticRestoreReplaySafetyError,
        match="exact loopback CI database",
    ):
        _erase_synthetic_replay_target(sqlite_lookalike, SYNTHETIC_USER_IDS[0])

    valid_source_url = make_url(SOURCE)
    with pytest.raises(SyntheticRestoreReplaySafetyError, match="fixed target"):
        _erase_synthetic_replay_target(valid_source_url, SYNTHETIC_USER_IDS[1])
