"""Safety tests for the read-only inactive-account erasure preflight."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

import app.inactive_account_erasure_preflight as preflight_module
from app.inactive_account_erasure_preflight import (
    InactiveAccountErasurePreflightSafetyError,
    preflight_inactive_account_erasure,
)
from app.inactive_account_erasure_eligibility import (
    InactiveAccountErasureEligibilitySafetyError,
)
from app.models import (
    AuthSessionDB,
    AuthorizationCodeDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
)


ANCHOR = datetime(2024, 1, 1)
NOTICE_START = datetime(2025, 12, 2)
DELIVERED = datetime(2025, 12, 5)
RETENTION_DUE = datetime(2026, 1, 1)
AS_OF = datetime(2026, 1, 2, tzinfo=UTC)


def _memory_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def _seed_candidate(session: Session) -> tuple[str, str]:
    user = CalorieAppUserDB(
        id="preflight-user",
        status="active",
        last_authenticated_activity_at=ANCHOR,
    )
    notice = InactiveAccountNoticeDB(
        id="preflight-notice",
        calorieapp_user_id=user.id,
        activity_anchor_at=ANCHOR,
        notice_window_started_at=NOTICE_START,
        retention_due_at=RETENTION_DUE,
        delivered_at=DELIVERED,
        delivery_channel="synthetic-email",
        delivery_evidence_digest="a" * 64,
        status="delivered",
        recorded_at=DELIVERED + timedelta(seconds=1),
    )
    session.add_all([user, notice])
    session.commit()
    return user.id, notice.id


def test_preflight_returns_bounded_minimal_counts_without_mutation() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            user_id, notice_id = _seed_candidate(session)
            other_user = CalorieAppUserDB(id="preflight-other-user")
            target_session = AuthSessionDB(
                id="preflight-target-session",
                session_token_hash="1" * 64,
                calorieapp_user_id=user_id,
                created_at=ANCHOR,
                last_seen_at=ANCHOR,
                expires_at=RETENTION_DUE,
            )
            session.add_all(
                [
                    other_user,
                    FoodLogDB(
                        product_name="Private apple",
                        calories=52,
                        owner_id=user_id,
                    ),
                    ExternalIdentityDB(
                        calorieapp_user_id=user_id,
                        provider="wordpress_xumm",
                        external_subject="preflight-subject",
                    ),
                    OriginLoginHandoffDB(
                        state_hash="2" * 64,
                        handoff_token_hash="3" * 64,
                        status="claimed",
                        calorieapp_user_id=user_id,
                        created_at=ANCHOR,
                        expires_at=RETENTION_DUE,
                    ),
                    target_session,
                ]
            )
            session.flush()
            session.add(
                AuthSessionDB(
                    id="preflight-inbound-session",
                    session_token_hash="4" * 64,
                    calorieapp_user_id=other_user.id,
                    created_at=ANCHOR,
                    last_seen_at=ANCHOR,
                    expires_at=RETENTION_DUE,
                    replaced_by_session_id=target_session.id,
                )
            )
            session.commit()

            plan = preflight_inactive_account_erasure(
                session,
                notice_id=notice_id,
                as_of=AS_OF,
            )

            assert plan is not None
            assert plan.notice_id == notice_id
            assert plan.user_id == user_id
            assert plan.evaluated_at == AS_OF.replace(tzinfo=None)
            assert plan.food_log_rows == 1
            assert plan.external_identity_rows == 1
            assert plan.origin_login_handoff_rows == 1
            assert plan.auth_session_rows == 1
            assert plan.inactive_account_notice_rows == 1
            assert plan.inbound_session_reference_rows == 1
            assert plan.total_delete_rows == 6
            session.rollback()

        with Session(engine) as session:
            assert session.get(CalorieAppUserDB, user_id) is not None
            assert session.get(InactiveAccountNoticeDB, notice_id) is not None
            assert len(session.exec(select(FoodLogDB)).all()) == 1
            inbound = session.get(AuthSessionDB, "preflight-inbound-session")
            assert inbound is not None
            assert inbound.replaced_by_session_id == "preflight-target-session"
    finally:
        engine.dispose()


def test_preflight_returns_none_for_ineligible_candidate() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _user_id, notice_id = _seed_candidate(session)
            assert (
                preflight_inactive_account_erasure(
                    session,
                    notice_id=notice_id,
                    as_of=datetime(2025, 12, 31, tzinfo=UTC),
                )
                is None
            )
            session.rollback()
    finally:
        engine.dispose()


def test_preflight_rejects_ambiguous_external_subject_across_chunks(
    monkeypatch,
) -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            user_id, notice_id = _seed_candidate(session)
            other_user = CalorieAppUserDB(id="ambiguous-other-user")
            session.add_all(
                [
                    other_user,
                    *[
                        ExternalIdentityDB(
                            calorieapp_user_id=user_id,
                            provider="wordpress_xumm",
                            external_subject=f"ambiguous-filler-{index}",
                        )
                        for index in range(4)
                    ],
                    ExternalIdentityDB(
                        calorieapp_user_id=user_id,
                        provider="wordpress_xumm",
                        external_subject="shared-preflight-subject",
                    ),
                    ExternalIdentityDB(
                        calorieapp_user_id=other_user.id,
                        provider="future-provider",
                        external_subject="shared-preflight-subject",
                    ),
                ]
            )
            session.commit()
            monkeypatch.setattr(
                preflight_module,
                "MAXIMUM_SUBJECTS_PER_QUERY",
                2,
            )

            with pytest.raises(
                InactiveAccountErasurePreflightSafetyError,
                match="operator review",
            ):
                preflight_inactive_account_erasure(
                    session,
                    notice_id=notice_id,
                    as_of=AS_OF,
                )
            session.rollback()

        with Session(engine) as session:
            assert session.get(CalorieAppUserDB, user_id) is not None
    finally:
        engine.dispose()


def test_preflight_rejects_unowned_legacy_authorization_across_chunks(
    monkeypatch,
) -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            user_id, notice_id = _seed_candidate(session)
            subject = "legacy-preflight-subject"
            session.add_all(
                [
                    *[
                        ExternalIdentityDB(
                            calorieapp_user_id=user_id,
                            provider="wordpress_xumm",
                            external_subject=f"legacy-filler-{index}",
                        )
                        for index in range(4)
                    ],
                    ExternalIdentityDB(
                        calorieapp_user_id=user_id,
                        provider="wordpress_xumm",
                        external_subject=subject,
                    ),
                    AuthorizationCodeDB(
                        code_hash="5" * 64,
                        external_subject=subject,
                        state="legacy-preflight-state",
                        login_session_id="legacy-preflight-login",
                        expires_at=RETENTION_DUE,
                    ),
                ]
            )
            session.commit()
            monkeypatch.setattr(
                preflight_module,
                "MAXIMUM_SUBJECTS_PER_QUERY",
                2,
            )

            with pytest.raises(
                InactiveAccountErasurePreflightSafetyError,
                match="authorization history",
            ):
                preflight_inactive_account_erasure(
                    session,
                    notice_id=notice_id,
                    as_of=AS_OF,
                )
            session.rollback()

        with Session(engine) as session:
            assert session.get(CalorieAppUserDB, user_id) is not None
            assert len(session.exec(select(AuthorizationCodeDB)).all()) == 1
    finally:
        engine.dispose()


def test_preflight_wraps_invalid_eligibility_time() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _user_id, notice_id = _seed_candidate(session)

            with pytest.raises(
                InactiveAccountErasurePreflightSafetyError,
                match="eligibility is unavailable",
            ) as exc_info:
                preflight_inactive_account_erasure(
                    session,
                    notice_id=notice_id,
                    as_of=datetime(2026, 1, 2),
                )

            assert isinstance(
                exc_info.value.__cause__,
                InactiveAccountErasureEligibilitySafetyError,
            )
            session.rollback()
    finally:
        engine.dispose()


def test_preflight_wraps_dirty_session_eligibility_error() -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            _user_id, notice_id = _seed_candidate(session)
            session.add(CalorieAppUserDB(id="pending-preflight-user"))

            with pytest.raises(
                InactiveAccountErasurePreflightSafetyError,
                match="eligibility is unavailable",
            ) as exc_info:
                preflight_inactive_account_erasure(
                    session,
                    notice_id=notice_id,
                    as_of=AS_OF,
                )

            assert isinstance(
                exc_info.value.__cause__,
                InactiveAccountErasureEligibilitySafetyError,
            )
            session.rollback()
    finally:
        engine.dispose()


def test_preflight_fails_closed_when_relation_limit_is_exceeded(
    monkeypatch,
) -> None:
    engine = _memory_engine()
    try:
        with Session(engine) as session:
            user_id, notice_id = _seed_candidate(session)
            monkeypatch.setattr(preflight_module, "MAXIMUM_ROWS_PER_RELATION", 0)

            with pytest.raises(
                InactiveAccountErasurePreflightSafetyError,
                match="preflight limit",
            ):
                preflight_inactive_account_erasure(
                    session,
                    notice_id=notice_id,
                    as_of=AS_OF,
                )
            session.rollback()

        with Session(engine) as session:
            assert session.get(CalorieAppUserDB, user_id) is not None
    finally:
        engine.dispose()
