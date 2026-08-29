"""
Identity service for CalorieApp.

Handles:
- Authorization code generation and validation
- User lookup and creation
- External identity association
- Session management
"""
import hashlib
import logging
import os
from datetime import UTC, datetime, timedelta
from secrets import compare_digest
from secrets import token_urlsafe
from typing import Optional
from uuid import uuid4

from sqlalchemy import delete, update
from sqlmodel import Session, select

from app.models import (
    AuthorizationCodeDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    OriginLoginHandoffDB,
    PendingLoginStateDB,
    utc_now,
)
from app.schemas import IdentityClaimsResponse

logger = logging.getLogger(__name__)

# Authorization code configuration
AUTH_CODE_LENGTH = 32  # bytes
AUTH_CODE_LIFETIME_SECONDS = 60  # 60 second lifetime
LOGIN_STATE_LENGTH = 48
ORIGIN_HANDOFF_TOKEN_LENGTH = 48
LOGIN_STATE_LIFETIME_SECONDS = int(os.getenv("LOGIN_STATE_LIFETIME_SECONDS", "300"))
WORDPRESS_BRIDGE_SECRET = os.getenv("WORDPRESS_BRIDGE_SECRET", "")

if not WORDPRESS_BRIDGE_SECRET:
    logger.warning(
        "WORDPRESS_BRIDGE_SECRET not set in environment. "
        "Server-to-server authentication will not work."
    )


def generate_authorization_code() -> str:
    """Generate cryptographically random authorization code."""
    return token_urlsafe(AUTH_CODE_LENGTH)


def hash_authorization_code(code: str) -> str:
    """Hash authorization code for secure storage."""
    return hashlib.sha256(code.encode()).hexdigest()


def generate_login_session_id() -> str:
    """Generate unique login session identifier."""
    return str(uuid4())


def generate_login_state() -> str:
    """Generate a browser-facing, high-entropy login state token."""
    return token_urlsafe(LOGIN_STATE_LENGTH)


def hash_login_state(state: str) -> str:
    """Hash login state token for persistent storage."""
    return hashlib.sha256(state.encode("utf-8")).hexdigest()


def generate_origin_handoff_token() -> str:
    """Generate the proof retained only by the browser that started login."""
    return token_urlsafe(ORIGIN_HANDOFF_TOKEN_LENGTH)


def hash_origin_handoff_token(token: str) -> str:
    """Hash an origin-browser handoff token before persistent storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_pending_login_state(
    session: Session,
    state_lifetime_seconds: int,
    post_login_redirect: Optional[str] = None,
) -> tuple[str, PendingLoginStateDB]:
    """Create a persistent pending login state transaction and return plaintext state."""
    created_at = utc_now()
    expires_at = created_at + timedelta(seconds=state_lifetime_seconds)

    for _ in range(3):
        state = generate_login_state()
        state_hash = hash_login_state(state)
        existing = session.exec(
            select(PendingLoginStateDB).where(PendingLoginStateDB.state_hash == state_hash)
        ).first()
        if existing:
            continue

        row = PendingLoginStateDB(
            state_hash=state_hash,
            status="pending",
            created_at=created_at,
            expires_at=expires_at,
            post_login_redirect=post_login_redirect,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return state, row

    raise RuntimeError("Unable to allocate unique login state")


def create_origin_login_handoff(
    session: Session,
    state: str,
    lifetime_seconds: int,
) -> tuple[str, OriginLoginHandoffDB]:
    """Create a browser-bound, one-time handoff for the login origin tab."""
    created_at = utc_now()
    expires_at = created_at + timedelta(seconds=lifetime_seconds)

    for _ in range(3):
        token = generate_origin_handoff_token()
        token_hash = hash_origin_handoff_token(token)
        existing = session.exec(
            select(OriginLoginHandoffDB).where(
                OriginLoginHandoffDB.handoff_token_hash == token_hash
            )
        ).first()
        if existing:
            continue

        row = OriginLoginHandoffDB(
            state_hash=hash_login_state(state),
            handoff_token_hash=token_hash,
            status="pending",
            created_at=created_at,
            expires_at=expires_at,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return token, row

    raise RuntimeError("Unable to allocate unique origin login handoff")


def validate_origin_login_handoff(
    session: Session,
    state: str,
    handoff_token: str,
) -> tuple[bool, str, Optional[OriginLoginHandoffDB]]:
    """Validate state + origin proof without exposing which value was wrong."""
    row = session.exec(
        select(OriginLoginHandoffDB).where(
            OriginLoginHandoffDB.state_hash == hash_login_state(state)
        )
    ).first()

    if row is None:
        return False, "unknown", None

    supplied_hash = hash_origin_handoff_token(handoff_token)
    if not compare_digest(row.handoff_token_hash, supplied_hash):
        return False, "unknown", None

    expires_at = (
        row.expires_at.replace(tzinfo=UTC)
        if row.expires_at.tzinfo is None
        else row.expires_at.astimezone(UTC)
    )
    if expires_at < datetime.now(UTC):
        return False, "expired", row

    return True, row.status, row


def complete_origin_login_handoff(
    session: Session,
    state: str,
    calorieapp_user_id: str,
) -> bool:
    """Mark the origin handoff ready after the verified callback resolves a user."""
    now = utc_now()
    updated = session.exec(
        update(OriginLoginHandoffDB)
        .where(OriginLoginHandoffDB.state_hash == hash_login_state(state))
        .where(OriginLoginHandoffDB.status == "pending")
        .where(OriginLoginHandoffDB.expires_at >= now)
        .values(
            status="completed",
            calorieapp_user_id=calorieapp_user_id,
            completed_at=now,
        )
    )
    session.commit()
    return updated.rowcount == 1


def fail_origin_login_handoff(
    session: Session,
    state: str,
    failure_code: str = "callback_failed",
) -> None:
    """Let the origin tab stop waiting when callback processing cannot finish."""
    session.exec(
        update(OriginLoginHandoffDB)
        .where(OriginLoginHandoffDB.state_hash == hash_login_state(state))
        .where(OriginLoginHandoffDB.status == "pending")
        .values(status="failed", failure_code=failure_code[:40])
    )
    session.commit()


def claim_origin_login_handoff(
    session: Session,
    state: str,
    handoff_token: str,
) -> tuple[bool, str, Optional[OriginLoginHandoffDB]]:
    """Atomically claim a completed origin handoff once."""
    valid, status, row = validate_origin_login_handoff(session, state, handoff_token)
    if not valid or row is None:
        return False, status, row
    if status != "completed":
        return False, status, row
    if not row.calorieapp_user_id:
        return False, "failed", row

    now = utc_now()
    updated = session.exec(
        update(OriginLoginHandoffDB)
        .where(OriginLoginHandoffDB.id == row.id)
        .where(OriginLoginHandoffDB.status == "completed")
        .where(OriginLoginHandoffDB.claimed_at.is_(None))
        .where(OriginLoginHandoffDB.expires_at >= now)
        .values(status="claimed", claimed_at=now)
    )
    session.commit()

    if updated.rowcount != 1:
        refreshed = session.get(OriginLoginHandoffDB, row.id)
        return False, "claimed", refreshed

    session.refresh(row)
    return True, "claimed", row


def validate_pending_login_state(
    session: Session,
    state: str,
) -> tuple[bool, str, Optional[PendingLoginStateDB]]:
    """Validate that the login state exists, is pending, and not expired."""
    row = session.exec(
        select(PendingLoginStateDB).where(PendingLoginStateDB.state_hash == hash_login_state(state))
    ).first()

    if row is None:
        return False, "unknown", None

    if row.expires_at.tzinfo is None:
        expires_at = row.expires_at.replace(tzinfo=UTC)
    else:
        expires_at = row.expires_at.astimezone(UTC)

    if expires_at < datetime.now(UTC):
        return False, "expired", row

    if row.status != "pending" or row.consumed_at is not None:
        return False, "consumed", row

    return True, "ok", row


def consume_pending_login_state(
    session: Session,
    state: str,
) -> tuple[bool, str]:
    """Atomically consume a pending login state so only one callback can proceed."""
    now = utc_now()
    state_hash = hash_login_state(state)

    updated = session.exec(
        update(PendingLoginStateDB)
        .where(PendingLoginStateDB.state_hash == state_hash)
        .where(PendingLoginStateDB.status == "pending")
        .where(PendingLoginStateDB.consumed_at.is_(None))
        .where(PendingLoginStateDB.expires_at >= now)
        .values(status="consumed", consumed_at=now)
    )
    session.commit()

    if updated.rowcount == 1:
        return True, "ok"

    is_valid, reason, _ = validate_pending_login_state(session, state)
    if is_valid:
        # Another request consumed it between the conditional update and validation.
        return False, "consumed"
    return False, reason


def restore_pending_login_state_after_transient_failure(
    session: Session,
    state: str,
) -> bool:
    """Restore a consumed, unexpired state after a retryable bridge failure."""
    now = utc_now()
    updated = session.exec(
        update(PendingLoginStateDB)
        .where(PendingLoginStateDB.state_hash == hash_login_state(state))
        .where(PendingLoginStateDB.status == "consumed")
        .where(PendingLoginStateDB.expires_at >= now)
        .values(status="pending", consumed_at=None)
    )
    session.commit()
    return updated.rowcount == 1


def cleanup_pending_login_states(session: Session) -> None:
    """Delete expired pending login states opportunistically."""
    now = utc_now()
    session.exec(
        delete(PendingLoginStateDB).where(PendingLoginStateDB.expires_at < now)
    )
    session.exec(
        delete(OriginLoginHandoffDB).where(OriginLoginHandoffDB.expires_at < now)
    )
    session.commit()


def create_authorization_code(
    session: Session,
    external_subject: str,
    xrpl_address: Optional[str],
    state: str,
    login_session_id: str,
) -> str:
    """
    Create a short-lived authorization code.

    Returns the plaintext code (only shared with browser once).
    The hash is stored in the database.
    """
    code = generate_authorization_code()
    code_hash = hash_authorization_code(code)

    expires_at = datetime.now(UTC) + timedelta(seconds=AUTH_CODE_LIFETIME_SECONDS)

    auth_code_db = AuthorizationCodeDB(
        code_hash=code_hash,
        external_subject=external_subject,
        xrpl_address=xrpl_address,
        state=state,
        login_session_id=login_session_id,
        expires_at=expires_at,
    )

    session.add(auth_code_db)
    session.commit()

    logger.info("Authorization code created")

    return code


def validate_and_consume_authorization_code(
    session: Session,
    code: str,
    state: str,
    login_session_id: str,
    client_ip: Optional[str] = None,
) -> tuple[bool, Optional[str], Optional[dict]]:
    """
    Validate and consume an authorization code.

    Returns:
        (is_valid, error_message, identity_dict)

    identity_dict contains:
        - external_subject
        - xrpl_address
        - issued_at
        - expires_at
        - jti
    """
    code_hash = hash_authorization_code(code)

    # Look up the authorization code
    stmt = select(AuthorizationCodeDB).where(
        AuthorizationCodeDB.code_hash == code_hash
    )
    auth_code_db = session.exec(stmt).first()

    if not auth_code_db:
        logger.warning("Authorization code not found")
        return False, "Invalid or expired authorization code", None

    # Check expiration (handle both aware and naive datetimes)
    now = datetime.now(UTC)
    expires_at = auth_code_db.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if now > expires_at:
        logger.warning("Authorization code expired")
        return False, "Authorization code expired", None

    # Check state
    if auth_code_db.state != state:
        logger.warning("State mismatch")
        return False, "State parameter mismatch", None

    # Check login session
    if auth_code_db.login_session_id != login_session_id:
        logger.warning("Login session mismatch")
        return False, "Login session mismatch", None

    # Check if already used
    if auth_code_db.used_at is not None:
        logger.warning("Authorization code reuse attempt")
        return False, "Authorization code already used", None

    # Mark as used
    auth_code_db.used_at = datetime.now(UTC)
    auth_code_db.used_by_ip = client_ip
    session.add(auth_code_db)
    session.commit()

    # Return verified identity
    identity = {
        "external_subject": auth_code_db.external_subject,
        "xrpl_address": auth_code_db.xrpl_address,
        "issued_at": auth_code_db.created_at,
        "expires_at": auth_code_db.expires_at,
        "jti": auth_code_db.id,
    }

    logger.info("Authorization code consumed")
    return True, None, identity


def get_or_create_user_from_external_identity(
    session: Session,
    provider: str,
    external_subject: str,
    xrpl_address: Optional[str],
) -> tuple[CalorieAppUserDB, bool]:
    """
    Get or create CalorieAppUser from external identity.

    Returns:
        (user, created) where created=True if new user was created
    """
    # Look for existing external identity
    stmt = select(ExternalIdentityDB).where(
        (ExternalIdentityDB.provider == provider)
        & (ExternalIdentityDB.external_subject == external_subject)
    )
    external_identity_db = session.exec(stmt).first()

    if external_identity_db:
        # Existing identity: get user
        stmt = select(CalorieAppUserDB).where(
            CalorieAppUserDB.id == external_identity_db.calorieapp_user_id
        )
        user_db = session.exec(stmt).first()
        if user_db:
            # Update last verified timestamp
            external_identity_db.last_verified_at = datetime.now(UTC)
            session.add(external_identity_db)
            session.commit()
            logger.info("Returning existing user for external identity (provider=%s)", provider)
            return user_db, False
        else:
            # This shouldn't happen (foreign key violation), but handle it
            logger.error("External identity exists but linked user does not")
            raise RuntimeError(
                "External identity corrupted: linked user not found"
            )

    # New user: create
    user_db = CalorieAppUserDB()
    session.add(user_db)
    session.flush()  # Get the ID without committing

    external_identity_db = ExternalIdentityDB(
        calorieapp_user_id=user_db.id,
        provider=provider,
        external_subject=external_subject,
        xrpl_address=xrpl_address,
    )
    session.add(external_identity_db)
    session.commit()

    logger.info("Created new user and external identity (provider=%s)", provider)

    return user_db, True


def get_user_by_id(session: Session, user_id: str) -> Optional[CalorieAppUserDB]:
    """Retrieve user by ID."""
    stmt = select(CalorieAppUserDB).where(CalorieAppUserDB.id == user_id)
    return session.exec(stmt).first()
