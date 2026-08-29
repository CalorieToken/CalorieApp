"""
SQLModel table definitions for CalorieApp backend.
FoodLogDB maps to the food_log table in calorieapp.db.
Also includes identity tables: CalorieAppUser, ExternalIdentity, AuthorizationCode.
"""
from datetime import UTC, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    """Return naive UTC for compatibility with SQLite DateTime columns."""
    return datetime.now(UTC).replace(tzinfo=None)


class FoodLogDB(SQLModel, table=True):
    """Persistent food log entry stored in SQLite."""

    __tablename__ = "food_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    product_name: str = Field(min_length=1, max_length=120)
    calories: float = Field(ge=0)
    protein: float = Field(default=0.0, ge=0)
    fat: float = Field(default=0.0, ge=0)
    carbohydrates: float = Field(default=0.0, ge=0)
    portion_percentage: Optional[float] = Field(default=None, ge=1, le=100)
    barcode: Optional[str] = Field(default=None, max_length=64)
    image_url: Optional[str] = Field(default=None, max_length=500)
    brand: Optional[str] = Field(default=None, max_length=160)
    serving_size: Optional[str] = Field(default=None, max_length=80)
    nutri_score: Optional[str] = Field(default=None, max_length=2)
    created_at: datetime = Field(default_factory=utc_now)
    owner_id: Optional[str] = Field(default=None, foreign_key="calorieappuser.id")


class CalorieAppUserDB(SQLModel, table=True):
    """Internal CalorieApp user identity. Immutable identifier."""

    __tablename__ = "calorieappuser"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    status: str = Field(default="active")


class ExternalIdentityDB(SQLModel, table=True):
    """Link CalorieAppUser to an external identity provider."""

    __tablename__ = "externalidentity"
    __table_args__ = (
        UniqueConstraint("provider", "external_subject", name="uq_externalidentity_provider_subject"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    calorieapp_user_id: str = Field(foreign_key="calorieappuser.id")
    provider: str = Field(max_length=50, index=True)  # e.g., "wordpress_xumm"
    external_subject: str = Field(max_length=255, index=True)  # e.g., WordPress user ID
    xrpl_address: Optional[str] = Field(default=None, max_length=34)  # XRPL r-address
    created_at: datetime = Field(default_factory=utc_now)
    last_verified_at: datetime = Field(default_factory=utc_now)


class AuthorizationCodeDB(SQLModel, table=True):
    """One-time authorization code for code exchange flow."""

    __tablename__ = "authorizationcode"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    code_hash: str = Field(max_length=255, unique=True)  # SHA256 hash of the actual code
    external_subject: str = Field(max_length=255)  # WordPress user ID
    xrpl_address: Optional[str] = Field(default=None, max_length=34)
    state: str = Field(max_length=255)  # CSRF state value
    login_session_id: str = Field(max_length=255)  # Unique login attempt identifier
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime  # When the code expires (default 60s)
    used_at: Optional[datetime] = Field(default=None)  # When code was exchanged
    used_by_ip: Optional[str] = Field(default=None, max_length=45)  # IPv4 or IPv6


class PendingLoginStateDB(SQLModel, table=True):
    """Persistent login transaction state used for XUMM callback protection."""

    __tablename__ = "pendingloginstate"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    state_hash: str = Field(max_length=64, unique=True, index=True)
    status: str = Field(default="pending", max_length=20, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    consumed_at: Optional[datetime] = Field(default=None)
    post_login_redirect: Optional[str] = Field(default=None, max_length=255)


class OriginLoginHandoffDB(SQLModel, table=True):
    """One-time proof that lets the browser which started login claim a session."""

    __tablename__ = "originloginhandoff"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    state_hash: str = Field(max_length=64, unique=True, index=True)
    handoff_token_hash: str = Field(max_length=64, index=True)
    status: str = Field(default="pending", max_length=20, index=True)
    calorieapp_user_id: Optional[str] = Field(
        default=None,
        foreign_key="calorieappuser.id",
        index=True,
    )
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime = Field(index=True)
    completed_at: Optional[datetime] = Field(default=None)
    claimed_at: Optional[datetime] = Field(default=None)
    failure_code: Optional[str] = Field(default=None, max_length=40)


class AuthSessionDB(SQLModel, table=True):
    """Opaque server-side authentication session."""

    __tablename__ = "authsession"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    session_token_hash: str = Field(max_length=64, unique=True, index=True)
    calorieapp_user_id: str = Field(foreign_key="calorieappuser.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    last_seen_at: datetime = Field(default_factory=utc_now, index=True)
    expires_at: datetime = Field(index=True)
    revoked_at: Optional[datetime] = Field(default=None, index=True)
    replaced_by_session_id: Optional[str] = Field(default=None, foreign_key="authsession.id")


class BridgeAuthNonceDB(SQLModel, table=True):
    """One-time nonce records used for bridge-auth replay protection."""

    __tablename__ = "bridgeauthnonce"
    __table_args__ = (
        UniqueConstraint("client_id", "nonce_hash", "context", name="uq_bridgeauthnonce_context_nonce"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    client_id: str = Field(max_length=120, index=True)
    nonce_hash: str = Field(max_length=64, index=True)
    context: str = Field(max_length=60, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime = Field(index=True)
