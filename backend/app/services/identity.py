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
    PendingLoginStateDB,
)
from app.schemas import IdentityClaimsResponse

logger = logging.getLogger(__name__)

# Authorization code configuration
AUTH_CODE_LENGTH = 32  # bytes
AUTH_CODE_LIFETIME_SECONDS = 60  # 60 second lifetime
LOGIN_STATE_LENGTH = 48
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


def create_pending_login_state(
    session: Session,
    state_lifetime_seconds: int,
    post_login_redirect: Optional[str] = None,
) -> tuple[str, PendingLoginStateDB]:
    """Create a persistent pending login state transaction and return plaintext state."""
    created_at = datetime.utcnow()
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
    now = datetime.utcnow()
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


def cleanup_pending_login_states(session: Session) -> None:
    """Delete expired pending login states opportunistically."""
    now = datetime.utcnow()
    session.exec(
        delete(PendingLoginStateDB).where(PendingLoginStateDB.expires_at < now)
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

    logger.info(
        "Created authorization code for external_subject=%s, "
        "login_session_id=%s",
        external_subject,
        login_session_id,
    )

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
        logger.warning("Authorization code not found (hash=%s)", code_hash[:8])
        return False, "Invalid or expired authorization code", None

    # Check expiration (handle both aware and naive datetimes)
    now = datetime.now(UTC)
    expires_at = auth_code_db.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if now > expires_at:
        logger.warning("Authorization code expired (id=%s)", auth_code_db.id)
        return False, "Authorization code expired", None

    # Check state
    if auth_code_db.state != state:
        logger.warning(
            "State mismatch (expected=%s, received=%s)", auth_code_db.state[:8], state[:8]
        )
        return False, "State parameter mismatch", None

    # Check login session
    if auth_code_db.login_session_id != login_session_id:
        logger.warning("Login session mismatch (id=%s)", auth_code_db.id)
        return False, "Login session mismatch", None

    # Check if already used
    if auth_code_db.used_at is not None:
        logger.warning(
            "Authorization code reuse attempt (id=%s, previously used at=%s)",
            auth_code_db.id,
            auth_code_db.used_at,
        )
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

    logger.info("Authorization code consumed (id=%s)", auth_code_db.id)
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
            logger.info(
                "Returning existing user for external_identity (provider=%s, "
                "external_subject=%s)",
                provider,
                external_subject,
            )
            return user_db, False
        else:
            # This shouldn't happen (foreign key violation), but handle it
            logger.error(
                "External identity exists but user does not (id=%s)",
                external_identity_db.calorieapp_user_id,
            )
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

    logger.info(
        "Created new user and external identity (user_id=%s, provider=%s, "
        "external_subject=%s)",
        user_db.id,
        provider,
        external_subject,
    )

    return user_db, True


def get_user_by_id(session: Session, user_id: str) -> Optional[CalorieAppUserDB]:
    """Retrieve user by ID."""
    stmt = select(CalorieAppUserDB).where(CalorieAppUserDB.id == user_id)
    return session.exec(stmt).first()
