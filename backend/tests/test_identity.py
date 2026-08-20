"""
Tests for identity service.
"""
import tempfile
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import NullPool
from sqlmodel import Session, create_engine, select
from sqlmodel.pool import StaticPool

from app.database import init_db
from app.models import (
    AuthorizationCodeDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    PendingLoginStateDB,
    SQLModel,
)
from app.services.identity import (
    cleanup_pending_login_states,
    consume_pending_login_state,
    create_pending_login_state,
    create_authorization_code,
    hash_login_state,
    generate_authorization_code,
    generate_login_state,
    generate_login_session_id,
    get_or_create_user_from_external_identity,
    get_user_by_id,
    validate_pending_login_state,
    hash_authorization_code,
    validate_and_consume_authorization_code,
)


@pytest.fixture
def test_session():
    """Create an in-memory test database session."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


class TestAuthorizationCode:
    """Test authorization code generation and validation."""

    def test_generate_code(self):
        """Authorization code should be random and high-entropy."""
        code1 = generate_authorization_code()
        code2 = generate_authorization_code()
        assert code1 != code2
        assert len(code1) > 20  # Should be reasonably long
        assert len(code2) > 20

    def test_hash_code(self):
        """Code hash should be deterministic but different from plaintext."""
        code = "test-code-12345"
        hash1 = hash_authorization_code(code)
        hash2 = hash_authorization_code(code)
        assert hash1 == hash2
        assert hash1 != code
        assert len(hash1) == 64  # SHA256 hex

    def test_generate_login_session_id(self):
        """Login session IDs should be unique."""
        id1 = generate_login_session_id()
        id2 = generate_login_session_id()
        assert id1 != id2
        assert len(id1) > 0

    def test_create_and_validate_code(self, test_session: Session):
        """Create and validate an authorization code."""
        external_subject = "wordpress_user_123"
        xrpl_address = "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg"
        state = "state-value-12345"
        login_session_id = generate_login_session_id()

        # Create code
        code = create_authorization_code(
            test_session,
            external_subject,
            xrpl_address,
            state,
            login_session_id,
        )

        assert code  # Should return a code
        assert len(code) > 0

        # Validate code
        is_valid, error, identity = validate_and_consume_authorization_code(
            test_session,
            code,
            state,
            login_session_id,
            client_ip="127.0.0.1",
        )

        assert is_valid
        assert error is None
        assert identity is not None
        assert identity["external_subject"] == external_subject
        assert identity["xrpl_address"] == xrpl_address

    def test_code_expiration(self, test_session: Session):
        """Expired codes should be rejected."""
        from app.services.identity import AUTH_CODE_LIFETIME_SECONDS

        external_subject = "wordpress_user_123"
        state = "state-value-12345"
        login_session_id = generate_login_session_id()

        # Create code manually with past expiration
        code = generate_authorization_code()
        code_hash = hash_authorization_code(code)
        expired_at = datetime.now(UTC) - timedelta(seconds=1)

        auth_code = AuthorizationCodeDB(
            code_hash=code_hash,
            external_subject=external_subject,
            state=state,
            login_session_id=login_session_id,
            expires_at=expired_at,
        )
        test_session.add(auth_code)
        test_session.commit()

        # Try to validate
        is_valid, error, identity = validate_and_consume_authorization_code(
            test_session,
            code,
            state,
            login_session_id,
        )

        assert not is_valid
        assert "expired" in error.lower()

    def test_code_replay_protection(self, test_session: Session):
        """Code should only be usable once."""
        external_subject = "wordpress_user_123"
        state = "state-value-12345"
        login_session_id = generate_login_session_id()

        code = create_authorization_code(
            test_session,
            external_subject,
            None,
            state,
            login_session_id,
        )

        # First use should succeed
        is_valid1, error1, identity1 = validate_and_consume_authorization_code(
            test_session,
            code,
            state,
            login_session_id,
        )
        assert is_valid1
        assert error1 is None

        # Second use should fail
        is_valid2, error2, identity2 = validate_and_consume_authorization_code(
            test_session,
            code,
            state,
            login_session_id,
        )
        assert not is_valid2
        assert "already used" in error2.lower()

    def test_state_mismatch(self, test_session: Session):
        """Code with mismatched state should be rejected."""
        external_subject = "wordpress_user_123"
        state = "state-value-12345"
        wrong_state = "wrong-state-value"
        login_session_id = generate_login_session_id()

        code = create_authorization_code(
            test_session,
            external_subject,
            None,
            state,
            login_session_id,
        )

        # Try with wrong state
        is_valid, error, identity = validate_and_consume_authorization_code(
            test_session,
            code,
            wrong_state,
            login_session_id,
        )

        assert not is_valid
        assert "state" in error.lower()

    def test_login_session_mismatch(self, test_session: Session):
        """Code with mismatched login session should be rejected."""
        external_subject = "wordpress_user_123"
        state = "state-value-12345"
        login_session_id = generate_login_session_id()
        wrong_login_session_id = generate_login_session_id()

        code = create_authorization_code(
            test_session,
            external_subject,
            None,
            state,
            login_session_id,
        )

        # Try with wrong login session
        is_valid, error, identity = validate_and_consume_authorization_code(
            test_session,
            code,
            state,
            wrong_login_session_id,
        )

        assert not is_valid
        assert "session" in error.lower()


class TestUserIdentity:
    """Test user and external identity management."""

    def test_create_new_user_from_identity(self, test_session: Session):
        """Creating a new external identity should create a new user."""
        provider = "wordpress_xumm"
        external_subject = "wp_user_456"
        xrpl_address = "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg"

        user, created = get_or_create_user_from_external_identity(
            test_session,
            provider,
            external_subject,
            xrpl_address,
        )

        assert created
        assert user.id  # Should have generated an ID
        assert user.status == "active"

    def test_get_existing_user_by_identity(self, test_session: Session):
        """Getting an existing identity should return the same user."""
        provider = "wordpress_xumm"
        external_subject = "wp_user_456"
        xrpl_address = "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg"

        # Create user
        user1, created1 = get_or_create_user_from_external_identity(
            test_session,
            provider,
            external_subject,
            xrpl_address,
        )
        assert created1
        user1_id = user1.id

        # Get same identity again
        user2, created2 = get_or_create_user_from_external_identity(
            test_session,
            provider,
            external_subject,
            xrpl_address,
        )

        assert not created2  # Should be existing user
        assert user2.id == user1_id

    def test_different_external_subjects_create_different_users(
        self, test_session: Session
    ):
        """Different external subjects should create different users."""
        provider = "wordpress_xumm"
        xrpl_address = "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg"

        user1, created1 = get_or_create_user_from_external_identity(
            test_session,
            provider,
            "wp_user_1",
            xrpl_address,
        )
        assert created1

        user2, created2 = get_or_create_user_from_external_identity(
            test_session,
            provider,
            "wp_user_2",
            xrpl_address,
        )
        assert created2
        assert user1.id != user2.id

    def test_duplicate_provider_external_subject_is_rejected_by_db(
        self, test_session: Session
    ):
        """The provider+subject pair must be enforced as unique by the database."""
        user, _ = get_or_create_user_from_external_identity(
            test_session,
            "wordpress_xumm",
            "wp_user_duplicate",
            "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg",
        )

        with pytest.raises(IntegrityError):
            duplicate_identity = ExternalIdentityDB(
                calorieapp_user_id=user.id,
                provider="wordpress_xumm",
                external_subject="wp_user_duplicate",
                xrpl_address="rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg",
            )
            test_session.add(duplicate_identity)
            test_session.commit()

    def test_same_external_subject_with_different_provider_is_allowed(
        self, test_session: Session
    ):
        """The same external subject can exist under different providers."""
        user1, created1 = get_or_create_user_from_external_identity(
            test_session,
            "wordpress_xumm",
            "shared_subject",
            "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg",
        )
        user2, created2 = get_or_create_user_from_external_identity(
            test_session,
            "google",
            "shared_subject",
            "rG1QQQ2vndM3f3x2K5q7aP7Ws7nL9jv1X7",
        )

        assert created1
        assert created2
        assert user1.id != user2.id

    def test_same_provider_with_different_external_subject_is_allowed(
        self, test_session: Session
    ):
        """The same provider may map to multiple external subjects."""
        user1, created1 = get_or_create_user_from_external_identity(
            test_session,
            "wordpress_xumm",
            "wp_user_1",
            "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg",
        )
        user2, created2 = get_or_create_user_from_external_identity(
            test_session,
            "wordpress_xumm",
            "wp_user_2",
            "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg",
        )

        assert created1
        assert created2
        assert user1.id != user2.id

    def test_get_user_by_id(self, test_session: Session):
        """Should be able to retrieve user by ID."""
        provider = "wordpress_xumm"
        external_subject = "wp_user_789"

        user1, _ = get_or_create_user_from_external_identity(
            test_session,
            provider,
            external_subject,
            None,
        )

        user2 = get_user_by_id(test_session, user1.id)

        assert user2 is not None
        assert user2.id == user1.id

    def test_get_nonexistent_user_by_id(self, test_session: Session):
        """Getting a nonexistent user should return None."""
        user = get_user_by_id(test_session, "nonexistent-id")
        assert user is None


class TestPendingLoginState:
    def test_state_is_persisted_and_hashed(self, test_session: Session):
        state, row = create_pending_login_state(test_session, state_lifetime_seconds=300)

        assert row is not None
        assert row.state_hash == hash_login_state(state)
        assert row.state_hash != state

    def test_state_validation_accepts_valid_pending_state(self, test_session: Session):
        state, _ = create_pending_login_state(test_session, state_lifetime_seconds=300)
        is_valid, reason, _ = validate_pending_login_state(test_session, state)
        assert is_valid
        assert reason == "ok"

    def test_state_validation_rejects_unknown_state(self, test_session: Session):
        is_valid, reason, _ = validate_pending_login_state(test_session, generate_login_state())
        assert not is_valid
        assert reason == "unknown"

    def test_state_validation_rejects_expired_state(self, test_session: Session):
        state, row = create_pending_login_state(test_session, state_lifetime_seconds=300)
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        test_session.add(row)
        test_session.commit()

        is_valid, reason, _ = validate_pending_login_state(test_session, state)
        assert not is_valid
        assert reason == "expired"

    def test_state_consumption_is_single_use(self, test_session: Session):
        state, _ = create_pending_login_state(test_session, state_lifetime_seconds=300)

        first_ok, first_reason = consume_pending_login_state(test_session, state)
        second_ok, second_reason = consume_pending_login_state(test_session, state)

        assert first_ok
        assert first_reason == "ok"
        assert not second_ok
        assert second_reason == "consumed"

    def test_concurrent_consume_allows_only_one_success(self):
        from concurrent.futures import ThreadPoolExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = f"{tmpdir}/pending_login_state_concurrency.db".replace("\\", "/")
            engine = create_engine(
                f"sqlite:///{db_path}",
                connect_args={"check_same_thread": False},
                poolclass=NullPool,
            )
            SQLModel.metadata.create_all(engine)

            try:
                with Session(engine) as session:
                    state, _ = create_pending_login_state(session, state_lifetime_seconds=300)

                def consume_once() -> tuple[bool, str]:
                    with Session(engine) as session:
                        return consume_pending_login_state(session, state)

                with ThreadPoolExecutor(max_workers=2) as executor:
                    results = list(executor.map(lambda _: consume_once(), [1, 2]))

                successes = [ok for ok, _ in results if ok]
                failures = [reason for ok, reason in results if not ok]
                assert len(successes) == 1
                assert len(failures) == 1
                assert failures[0] == "consumed"
            finally:
                engine.dispose()

    def test_cleanup_removes_expired_and_keeps_valid(self, test_session: Session):
        valid_state, _ = create_pending_login_state(test_session, state_lifetime_seconds=300)
        expired_state, expired_row = create_pending_login_state(test_session, state_lifetime_seconds=300)
        expired_row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        test_session.add(expired_row)
        test_session.commit()

        cleanup_pending_login_states(test_session)

        valid_exists = test_session.exec(
            select(PendingLoginStateDB).where(PendingLoginStateDB.state_hash == hash_login_state(valid_state))
        ).first()
        expired_exists = test_session.exec(
            select(PendingLoginStateDB).where(PendingLoginStateDB.state_hash == hash_login_state(expired_state))
        ).first()

        assert valid_exists is not None
        assert expired_exists is None

    def test_state_persists_across_sessions(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)

        with Session(engine) as session:
            state, _ = create_pending_login_state(session, state_lifetime_seconds=300)

        with Session(engine) as session:
            is_valid, reason, _ = validate_pending_login_state(session, state)

        assert is_valid
        assert reason == "ok"
        engine.dispose()
